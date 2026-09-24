import { afterEach, describe, expect, it } from "vitest";

import {
  DexieDocumentRepository,
  PIPELINE_VERSION,
} from "@/infrastructure/db/document-repository";
import { PIPELINE_LIMITS } from "@/domain/content/pipeline-limits";
import { runMarkdownPipeline } from "@/domain/content/markdown-pipeline";
import type { PipelineSuccess } from "@/domain/content/pipeline-types";
import { normalizeIdentityFileName, normalizeIdentityText } from "@/domain/documents/import-identity";
import { createStorageAtomicitySpikeDatabase, deleteStorageAtomicitySpikeDatabase, StorageAtomicitySpikeRepository, type StorageAtomicityFailureHooks } from "@/infrastructure/db/storage-atomicity-spike";
import { createProgressMappingPairs } from "@/test/corpus/progress-mapping-corpus";
import { createStorageChunks, createStorageStageInput } from "@/test/fixtures/storage-atomicity-fixtures";

const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map(async (name) => deleteStorageAtomicitySpikeDatabase(name)));
});

describe("DexieDocumentRepository", () => {
  it("publishes only a complete current version and returns a pipeline-validated chunk window", async () => {
    const repository = createRepository("commit");
    const staged = createStorageStageInput({ chunkCount: 2, versionId: crypto.randomUUID() });
    const input = { ...staged, pipelineVersion: PIPELINE_VERSION };
    let stopObserving = (): void => undefined;
    const publicationObserved = new Promise<void>((resolve, reject) => {
      stopObserving = repository.observeDocuments((result) => {
        if (!result.ok) { reject(new Error(result.error.code)); return; }
        if (result.value.length === 1) resolve();
      });
    });

    expect(await repository.stageVersion(input)).toEqual({ ok: true, value: undefined });
    const beforeCommit = await repository.listDocuments();
    expect(beforeCommit).toMatchObject({ ok: true, value: [] });

    expect(await repository.appendChunkBatch({
      batchOrdinal: 0,
      chunks: createStorageChunks(2, { pipelineVersion: PIPELINE_VERSION }),
      jobId: input.jobId,
      versionId: input.versionId,
    })).toEqual({ ok: true, value: undefined });
    expect(await repository.commitVersion({ jobId: input.jobId, readyAt: input.importedAt + 1, versionId: input.versionId })).toEqual({
      ok: true,
      value: { documentId: input.documentId, versionId: input.versionId },
    });
    await publicationObserved;
    stopObserving();

    const visible = await repository.listDocuments();
    expect(visible).toMatchObject({ ok: true, value: [{ documentId: input.documentId }] });
    const window = await repository.getCurrentChunkWindow({
      documentId: input.documentId,
      endOrdinalInclusive: 1,
      pipelineVersion: PIPELINE_VERSION,
      startOrdinal: 0,
    });
    expect(window).toMatchObject({ ok: true, value: [{ ordinal: 0, estimatedCost: 1, html: { value: "<p>storage chunk 0</p>" }, renderState: "ready" }, { ordinal: 1, estimatedCost: 1, html: { value: "<p>storage chunk 1</p>" }, renderState: "ready" }] });
    expect(await repository.getCurrentChunkWindow({
      documentId: input.documentId,
      endOrdinalInclusive: 1,
      pipelineVersion: PIPELINE_VERSION + 1,
      startOrdinal: 0,
    })).toMatchObject({ ok: false, error: { code: "STALE_DERIVED" } });
    expect(await repository.getCurrentDocument(input.documentId)).toMatchObject({ ok: true, value: { pipelineVersion: PIPELINE_VERSION } });
    repository.close();
  });

  it("rejects a current chunk whose persisted HTML no longer matches the allowlist", async () => {
    const databaseName = `markdown-reader-repository-html-policy-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const repository = new DexieDocumentRepository(databaseName);
    const staged = createStorageStageInput({ chunkCount: 1, versionId: crypto.randomUUID() });
    const input = { ...staged, pipelineVersion: PIPELINE_VERSION };

    await repository.stageVersion(input);
    await repository.appendChunkBatch({
      batchOrdinal: 0,
      chunks: createStorageChunks(1, { pipelineVersion: PIPELINE_VERSION }),
      jobId: input.jobId,
      versionId: input.versionId,
    });
    await repository.commitVersion({ jobId: input.jobId, readyAt: input.importedAt + 1, versionId: input.versionId });

    const database = createStorageAtomicitySpikeDatabase(databaseName);
    await database.open();
    try {
      await database.table("chunks").update([input.versionId, 0], {
        html: '<p data-unexpected="true">Changed derived markup</p>',
      });
    } finally {
      database.close();
    }

    await expect(repository.getCurrentChunkWindow({
      documentId: input.documentId,
      endOrdinalInclusive: 0,
      pipelineVersion: PIPELINE_VERSION,
      startOrdinal: 0,
    })).resolves.toEqual({ ok: false, error: { code: "INVALID_PERSISTED_RECORD" } });
    repository.close();
  });

  it("persists a validated semantic anchor and resolves it only for the current version", async () => {
    const repository = createRepository("reader-anchor");
    const staged = createStorageStageInput({ chunkCount: 3, versionId: crypto.randomUUID() });
    const input = { ...staged, pipelineVersion: PIPELINE_VERSION };
    await repository.stageVersion(input);
    await repository.appendChunkBatch({ batchOrdinal: 0, chunks: createStorageChunks(3, { pipelineVersion: PIPELINE_VERSION }), jobId: input.jobId, versionId: input.versionId });
    await repository.commitVersion({ jobId: input.jobId, readyAt: input.importedAt + 1, versionId: input.versionId });
    const anchor = { blockId: "block-2", blockOrdinalWithinHeading: 2, headingPathKey: "1:storage-spike[1]", intraBlockRatio: 0, overallSourceRatio: 1, versionId: input.versionId };

    expect(await repository.saveReaderAnchor({ anchor, documentId: input.documentId, lastSectionId: "section-3", progressRatio: 1, updatedAt: 2_000 })).toEqual({ ok: true, value: undefined });
    expect(await repository.getReaderState(input.documentId)).toMatchObject({ ok: true, value: { anchor, lastSectionId: "section-3", progressRatio: 1 } });
    expect(await repository.saveReaderPresentation({ documentId: input.documentId, modeOrigin: "user", readingMode: "sections", splitStrategy: "h2", updatedAt: 2_001 })).toEqual({ ok: true, value: undefined });
    expect(await repository.getReaderState(input.documentId)).toMatchObject({ ok: true, value: { anchor, modeOrigin: "user", readingMode: "sections", splitStrategy: "h2" } });
    expect(await repository.resolveCurrentAnchor({ anchor, documentId: input.documentId })).toMatchObject({ ok: true, value: { anchor: { blockId: anchor.blockId, intraBlockRatio: 0, versionId: input.versionId }, chunkOrdinal: 2, confidence: "exact", reason: "SAME_VERSION_BLOCK_ID" } });
    expect(await repository.resolveCurrentAnchor({ anchor: { ...anchor, versionId: "old-version" }, documentId: input.documentId })).toEqual({ ok: true, value: { chunkOrdinal: 0, confidence: "none", reason: "NO_RELIABLE_MATCH" } });
    expect(await repository.listDocuments()).toMatchObject({ ok: true, value: [{ documentId: input.documentId, progressRatio: 1 }] });
    repository.close();
  });

  it("rejects staging output from a stale pipeline", async () => {
    const repository = createRepository("pipeline-stale");
    const stale = createStorageStageInput({ chunkCount: 1, versionId: crypto.randomUUID() });
    const staleInput = { ...stale, pipelineVersion: PIPELINE_VERSION - 1 };
    expect(await repository.stageVersion(staleInput)).toMatchObject({
      ok: false,
      error: { code: "STALE_DERIVED" },
    });
    repository.close();
  });

  it("rejects malformed anchor provenance before persisting a chunk batch", async () => {
    const repository = createRepository("invalid-anchor");
    const staged = createStorageStageInput({ chunkCount: 1, versionId: crypto.randomUUID() });
    const input = { ...staged, pipelineVersion: PIPELINE_VERSION };
    const chunk = createStorageChunks(1, { pipelineVersion: PIPELINE_VERSION })[0];
    if (chunk === undefined) throw new Error("Expected fixture chunk.");
    const malformed = {
      ...chunk,
      blockAnchors: chunk.blockAnchors.map((anchor) => ({ ...anchor, contentFingerprint: "not-a-hash" })),
    };

    expect(await repository.stageVersion(input)).toEqual({ ok: true, value: undefined });
    expect(await repository.appendChunkBatch({
      batchOrdinal: 0,
      chunks: [malformed],
      jobId: input.jobId,
      versionId: input.versionId,
    })).toMatchObject({ ok: false, error: { code: "INVALID_PERSISTED_RECORD" } });
    repository.close();
  });

  it("persists preference changes after the IndexedDB source of truth accepts them", async () => {
    const repository = createRepository("preferences");
    expect(await repository.getPreferences()).toMatchObject({ ok: true, value: { theme: "system" } });
    expect(await repository.saveTheme("dark", 42)).toEqual({ ok: true, value: undefined });
    expect(await repository.getPreferences()).toMatchObject({ ok: true, value: { theme: "dark", updatedAt: 42 } });
    expect(await repository.saveRemoteImagesEnabled(false, 43)).toEqual({ ok: true, value: undefined });
    expect(await repository.getPreferences()).toMatchObject({ ok: true, value: { remoteImagesEnabled: false, theme: "dark", updatedAt: 43 } });
    repository.close();
  });

  it("finds every ready exact hash and normalized title/filename candidate without exposing staging", async () => {
    const repository = createRepository("import-identity");
    await commitFixture(repository, { contentHash: "a".repeat(64), documentId: "exact-one", fileName: "one.md", jobId: "job-one", title: "One", versionId: "version-one" });
    await commitFixture(repository, { contentHash: "a".repeat(64), documentId: "exact-two", fileName: "two.md", jobId: "job-two", title: "Two", versionId: "version-two" });
    await commitFixture(repository, { contentHash: "b".repeat(64), documentId: "candidate", fileName: "guide.md", jobId: "job-candidate", normalizedFileName: "guide", title: "Guide", versionId: "version-candidate" });
    const staging = createStorageStageInput({ contentHash: "c".repeat(64), documentId: "hidden", fileName: "guide.md", jobId: "job-hidden", title: "Guide", versionId: "version-hidden" });
    await repository.stageVersion({ ...staging, pipelineVersion: PIPELINE_VERSION });

    const result = await repository.findImportIdentityMatches({ contentHash: "a".repeat(64), normalizedFileName: "guide", normalizedTitle: "unrelated" });
    expect(result).toEqual({ ok: true, value: {
      exactDuplicates: [
        { currentVersionId: "version-one", documentId: "exact-one", fileName: "one.md", title: "One" },
        { currentVersionId: "version-two", documentId: "exact-two", fileName: "two.md", title: "Two" },
      ],
      possibleUpdates: [{ currentVersionId: "version-candidate", documentId: "candidate", fileName: "guide.md", title: "Guide" }],
    } });
    repository.close();
  });

  it("transactionally deletes all and only the exact Document records, then updates the live Library", async () => {
    const databaseName = `markdown-reader-repository-delete-exact-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const repository = new DexieDocumentRepository(databaseName);
    const target = createStorageStageInput({ chunkCount: 2, documentId: "target", jobId: "target-job", versionId: "target-version" });
    const targetInput = { ...target, pipelineVersion: PIPELINE_VERSION };
    const other = createStorageStageInput({ chunkCount: 1, documentId: "other", jobId: "other-job", versionId: "other-version" });
    const otherInput = { ...other, pipelineVersion: PIPELINE_VERSION };
    for (const input of [targetInput, otherInput]) {
      await repository.stageVersion(input);
      await repository.appendChunkBatch({ batchOrdinal: 0, chunks: createStorageChunks(input.chunkCount, { pipelineVersion: PIPELINE_VERSION }), jobId: input.jobId, versionId: input.versionId });
      await repository.commitVersion({ jobId: input.jobId, readyAt: input.importedAt + 1, versionId: input.versionId });
    }
    const historic = createStorageStageInput({ chunkCount: 1, documentId: targetInput.documentId, expectedCurrentVersionId: targetInput.versionId, jobId: "target-replacement-job", versionId: "target-replacement-version" });
    const historicInput = { ...historic, pipelineVersion: PIPELINE_VERSION };
    await repository.stageVersion(historicInput);
    await repository.appendChunkBatch({ batchOrdinal: 0, chunks: createStorageChunks(1, { pipelineVersion: PIPELINE_VERSION }), jobId: historicInput.jobId, versionId: historicInput.versionId });
    await repository.commitVersion({ jobId: historicInput.jobId, readyAt: historicInput.importedAt + 1, versionId: historicInput.versionId });
    await repository.saveReaderAnchor({ anchor: { blockId: "block-0", blockOrdinalWithinHeading: 0, headingPathKey: "1:storage-spike[1]", intraBlockRatio: 0, overallSourceRatio: 0, versionId: historicInput.versionId }, documentId: targetInput.documentId, progressRatio: 0, updatedAt: 10 });

    let stopObserving = (): void => undefined;
    const observedEmptyTarget = new Promise<void>((resolve, reject) => {
      stopObserving = repository.observeDocuments((result) => {
        if (!result.ok) { reject(new Error(result.error.code)); return; }
        if (result.value.length === 1 && result.value[0]?.documentId === otherInput.documentId) resolve();
      });
    });
    expect(await repository.deleteDocument(targetInput.documentId)).toEqual({ ok: true, value: { status: "deleted" } });
    await observedEmptyTarget;
    stopObserving();

    const database = createStorageAtomicitySpikeDatabase(databaseName);
    await database.open();
    try {
      expect(await database.table("documents").get(targetInput.documentId)).toBeUndefined();
      expect(await database.table("documentVersions").where("documentId").equals(targetInput.documentId).count()).toBe(0);
      expect(await database.table("chunks").where("versionId").equals(targetInput.versionId).count()).toBe(0);
      expect(await database.table("chunks").where("versionId").equals(historicInput.versionId).count()).toBe(0);
      expect(await database.table("readerStates").get(targetInput.documentId)).toBeUndefined();
      expect(await database.table("documents").get(otherInput.documentId)).toBeDefined();
    } finally {
      database.close();
    }
    repository.close();
  });

  it("is idempotent for a stale exact id and rolls back all records when deletion fails", async () => {
    const repository = createRepository("delete-failure", { beforeDocumentDelete: () => { throw new Error("forced failure"); } });
    await commitFixture(repository, { contentHash: "d".repeat(64), documentId: "safe", fileName: "safe.md", jobId: "safe-job", title: "Safe", versionId: "safe-version" });
    expect(await repository.deleteDocument("safe")).toMatchObject({ ok: false });
    expect(await repository.listDocuments()).toMatchObject({ ok: true, value: [{ documentId: "safe" }] });
    repository.close();

    const idempotentRepository = createRepository("delete-idempotent");
    expect(await idempotentRepository.deleteDocument("missing")).toEqual({ ok: true, value: { status: "not-found" } });
    await commitFixture(idempotentRepository, { contentHash: "e".repeat(64), documentId: "removed", fileName: "removed.md", jobId: "removed-job", title: "Removed", versionId: "removed-version" });
    await idempotentRepository.deleteDocument("removed");
    expect(await idempotentRepository.deleteDocument("removed")).toEqual({ ok: true, value: { status: "not-found" } });
    idempotentRepository.close();
  });

  for (const pair of createProgressMappingPairs()) {
    it(`atomically maps the production update pair: ${pair.id}`, async () => {
      const databaseName = `markdown-reader-repository-mapping-${pair.id}-${crypto.randomUUID()}`;
      databaseNames.push(databaseName);
      const repository = new DexieDocumentRepository(databaseName);
      const source = await pipeline(pair.sourceMarkdown, `${pair.id}.md`);
      const target = await pipeline(pair.targetMarkdown, `${pair.id}.md`);
      const sourceIds = { documentId: `document-${pair.id}`, jobId: `source-job-${pair.id}`, versionId: `source-version-${pair.id}` };
      await stagePipeline(repository, source, pair.sourceMarkdown, sourceIds);
      expect(await repository.commitVersion({ jobId: sourceIds.jobId, readyAt: 2_000, versionId: sourceIds.versionId })).toMatchObject({ ok: true });
      const sourceOffset = pair.sourceMarkdown.indexOf(pair.sourceMarker);
      const sourceBlock = source.chunks.flatMap((chunk) => chunk.blockAnchors).find((block) => block.sourceStart <= sourceOffset && sourceOffset <= block.sourceEnd);
      if (sourceBlock === undefined) throw new Error(`Missing source marker block for ${pair.id}.`);
      const sourceAnchor = {
        blockId: sourceBlock.blockId,
        blockOrdinalWithinHeading: sourceBlock.blockOrdinalWithinHeading,
        headingPathKey: sourceBlock.headingPathKey,
        intraBlockRatio: 0,
        overallSourceRatio: sourceOffset / pair.sourceMarkdown.length,
        versionId: sourceIds.versionId,
      };
      await repository.saveReaderAnchor({ anchor: sourceAnchor, documentId: sourceIds.documentId, progressRatio: sourceAnchor.overallSourceRatio, updatedAt: 2_001 });
      await repository.saveReaderPresentation({ documentId: sourceIds.documentId, modeOrigin: "user", readingMode: "sections", splitStrategy: "h2", updatedAt: 2_002 });
      const captured = await repository.getReaderState(sourceIds.documentId);
      if (!captured.ok || captured.value === undefined) throw new Error("Expected captured ReaderState.");

      const targetIds = { documentId: sourceIds.documentId, jobId: `target-job-${pair.id}`, versionId: `target-version-${pair.id}` };
      await stagePipeline(repository, target, pair.targetMarkdown, targetIds, sourceIds.versionId);
      const committed = await repository.commitVersion({
        jobId: targetIds.jobId,
        readyAt: 3_000,
        replacementReaderState: captured.value,
        versionId: targetIds.versionId,
      });
      expect(committed).toMatchObject({
        ok: true,
        value: {
          documentId: sourceIds.documentId,
          replacement: {
            cleanup: "complete",
            confidence: pair.expectedConfidence,
            reason: pair.expectedReason,
            replacedVersionId: sourceIds.versionId,
          },
          versionId: targetIds.versionId,
        },
      });
      const state = await repository.getReaderState(sourceIds.documentId);
      expect(state).toMatchObject({ ok: true, value: {
        anchor: { versionId: targetIds.versionId },
        documentId: sourceIds.documentId,
        modeOrigin: "user",
        readingMode: "sections",
        splitStrategy: "h2",
      } });
      if (!state.ok || state.value === undefined) throw new Error("Expected mapped ReaderState.");
      expect(target.chunks.flatMap((chunk) => chunk.blockAnchors).some((block) => block.blockId === state.value?.anchor?.blockId)).toBe(true);
      expect(state.value.pendingRestoreNotice?.confidence).toBe(pair.expectedConfidence === "exact" ? undefined : pair.expectedConfidence);
      if (pair.expectedConfidence !== "exact") {
        expect(await repository.dismissReaderRestoreNotice({ documentId: sourceIds.documentId, versionId: targetIds.versionId })).toEqual({ ok: true, value: undefined });
        expect(await repository.dismissReaderRestoreNotice({ documentId: sourceIds.documentId, versionId: targetIds.versionId })).toEqual({ ok: true, value: undefined });
        const cleared = await repository.getReaderState(sourceIds.documentId);
        expect(cleared.ok && cleared.value?.pendingRestoreNotice).toBeUndefined();
      }
      const database = createStorageAtomicitySpikeDatabase(databaseName);
      await database.open();
      try {
        expect(await database.table("documentVersions").get(sourceIds.versionId)).toBeUndefined();
        expect(await database.table("documentVersions").get(targetIds.versionId)).toMatchObject({ state: "ready" });
      } finally {
        database.close();
      }
      repository.close();
    });
  }

  it("keeps a successful pointer switch when cleanup fails and retries cleanup idempotently", async () => {
    let cleanupFailures = 1;
    const databaseName = `markdown-reader-repository-cleanup-retry-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const repository = new DexieDocumentRepository(databaseName, {
      beforeCleanupDelete: () => {
        if (cleanupFailures > 0) {
          cleanupFailures -= 1;
          throw new Error("forced cleanup failure");
        }
      },
    });
    const source = await pipeline("# Guide\n\nStable location.\n", "guide.md");
    const target = await pipeline("# Guide\n\nInserted.\n\nStable location.\n", "guide.md");
    const sourceIds = { documentId: "cleanup-document", jobId: "cleanup-source-job", versionId: "cleanup-source-version" };
    await stagePipeline(repository, source, "# Guide\n\nStable location.\n", sourceIds);
    await repository.commitVersion({ jobId: sourceIds.jobId, readyAt: 10, versionId: sourceIds.versionId });
    const captured = await repository.getReaderState(sourceIds.documentId);
    if (!captured.ok || captured.value === undefined) throw new Error("Expected ReaderState.");
    const targetIds = { documentId: sourceIds.documentId, jobId: "cleanup-target-job", versionId: "cleanup-target-version" };
    await stagePipeline(repository, target, "# Guide\n\nInserted.\n\nStable location.\n", targetIds, sourceIds.versionId);
    const committed = await repository.commitVersion({ jobId: targetIds.jobId, readyAt: 20, replacementReaderState: captured.value, versionId: targetIds.versionId });
    expect(committed).toMatchObject({ ok: true, value: { replacement: { cleanup: "pending" }, versionId: targetIds.versionId } });
    expect(await repository.getCurrentDocument(sourceIds.documentId)).toMatchObject({ ok: true, value: { versionId: targetIds.versionId } });
    await expect(repository.retryReplacementCleanup(sourceIds.versionId)).resolves.toEqual({ ok: true, value: undefined });
    await expect(repository.retryReplacementCleanup(sourceIds.versionId)).resolves.toEqual({ ok: true, value: undefined });
    repository.close();
  });

  it("preserves the old current version and ReaderState when mapped commit fails before the switch", async () => {
    const targetVersionId = "atomic-target-version";
    const repository = createRepository("mapped-atomic-failure", {
      beforeCommitPointerSwitch: ({ versionId }) => {
        if (versionId === targetVersionId) throw new Error("forced commit failure");
      },
    });
    const sourceMarkdown = "# Atomic\n\nKeep this position.\n";
    const targetMarkdown = "# Atomic\n\nChanged position.\n";
    const source = await pipeline(sourceMarkdown, "atomic.md");
    const target = await pipeline(targetMarkdown, "atomic.md");
    const sourceIds = { documentId: "atomic-document", jobId: "atomic-source-job", versionId: "atomic-source-version" };
    await stagePipeline(repository, source, sourceMarkdown, sourceIds);
    await repository.commitVersion({ jobId: sourceIds.jobId, readyAt: 10, versionId: sourceIds.versionId });
    const block = source.chunks.flatMap((chunk) => chunk.blockAnchors)[1];
    if (block === undefined) throw new Error("Expected source block.");
    await repository.saveReaderAnchor({
      anchor: { ...block, intraBlockRatio: 0.5, overallSourceRatio: 0.5, versionId: sourceIds.versionId },
      documentId: sourceIds.documentId,
      progressRatio: 0.5,
      updatedAt: 11,
    });
    const captured = await repository.getReaderState(sourceIds.documentId);
    if (!captured.ok || captured.value === undefined) throw new Error("Expected ReaderState.");
    const targetIds = { documentId: sourceIds.documentId, jobId: "atomic-target-job", versionId: targetVersionId };
    await stagePipeline(repository, target, targetMarkdown, targetIds, sourceIds.versionId);

    expect(await repository.commitVersion({ jobId: targetIds.jobId, readyAt: 20, replacementReaderState: captured.value, versionId: targetIds.versionId })).toMatchObject({ ok: false });
    expect(await repository.getCurrentDocument(sourceIds.documentId)).toMatchObject({ ok: true, value: { versionId: sourceIds.versionId } });
    expect(await repository.getReaderState(sourceIds.documentId)).toEqual(captured);
    repository.close();
  });

  it("rejects a stale mapped replacement after another version wins", async () => {
    const repository = createRepository("mapped-conflict");
    const sourceMarkdown = "# Conflict\n\nOriginal.\n";
    const source = await pipeline(sourceMarkdown, "conflict.md");
    const stale = await pipeline("# Conflict\n\nStale replacement.\n", "conflict.md");
    const winner = await pipeline("# Conflict\n\nWinning replacement.\n", "conflict.md");
    const sourceIds = { documentId: "conflict-document", jobId: "conflict-source-job", versionId: "conflict-source-version" };
    await stagePipeline(repository, source, sourceMarkdown, sourceIds);
    await repository.commitVersion({ jobId: sourceIds.jobId, readyAt: 10, versionId: sourceIds.versionId });
    const captured = await repository.getReaderState(sourceIds.documentId);
    if (!captured.ok || captured.value === undefined) throw new Error("Expected ReaderState.");
    const staleIds = { documentId: sourceIds.documentId, jobId: "conflict-stale-job", versionId: "conflict-stale-version" };
    const winnerIds = { documentId: sourceIds.documentId, jobId: "conflict-winner-job", versionId: "conflict-winner-version" };
    await stagePipeline(repository, stale, "# Conflict\n\nStale replacement.\n", staleIds, sourceIds.versionId);
    await stagePipeline(repository, winner, "# Conflict\n\nWinning replacement.\n", winnerIds, sourceIds.versionId);
    expect(await repository.commitVersion({ jobId: winnerIds.jobId, readyAt: 20, replacementReaderState: captured.value, versionId: winnerIds.versionId })).toMatchObject({ ok: true });
    expect(await repository.commitVersion({ jobId: staleIds.jobId, readyAt: 21, replacementReaderState: captured.value, versionId: staleIds.versionId })).toEqual({ ok: false, error: { code: "COMMIT_CONFLICT" } });
    expect(await repository.getCurrentDocument(sourceIds.documentId)).toMatchObject({ ok: true, value: { versionId: winnerIds.versionId } });
    repository.close();
  });

  it("requires a fingerprint-capable source pipeline before cross-version mapping", async () => {
    const databaseName = `markdown-reader-repository-old-pipeline-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const storage = new StorageAtomicitySpikeRepository(databaseName);
    const repository = new DexieDocumentRepository(databaseName);
    const source = createStorageStageInput({ documentId: "old-pipeline-document", jobId: "old-pipeline-job", versionId: "old-pipeline-version" });
    const oldPipelineVersion = 2;
    await storage.stageVersion({ ...source, pipelineVersion: oldPipelineVersion });
    await storage.appendChunkBatch({ batchOrdinal: 0, chunks: createStorageChunks(source.chunkCount, { pipelineVersion: oldPipelineVersion }), jobId: source.jobId, versionId: source.versionId });
    await storage.commitVersion({ jobId: source.jobId, readyAt: 10, versionId: source.versionId });
    const captured = await repository.getReaderState(source.documentId);
    if (!captured.ok || captured.value === undefined) throw new Error("Expected legacy ReaderState.");
    const targetMarkdown = "# Current pipeline\n\nReplacement.\n";
    const target = await pipeline(targetMarkdown, "old-pipeline.md");
    const targetIds = { documentId: source.documentId, jobId: "current-pipeline-job", versionId: "current-pipeline-version" };
    await stagePipeline(repository, target, targetMarkdown, targetIds, source.versionId);
    expect(await repository.commitVersion({ jobId: targetIds.jobId, readyAt: 20, replacementReaderState: captured.value, versionId: targetIds.versionId })).toEqual({ ok: false, error: { code: "STALE_DERIVED" } });
    expect(await storage.listVisibleDocuments()).toMatchObject({ ok: true, value: [{ currentVersionId: source.versionId }] });
    storage.close();
    repository.close();
  });
});

async function pipeline(markdown: string, fileName: string): Promise<PipelineSuccess> {
  const result = await runMarkdownPipeline(new TextEncoder().encode(markdown), fileName, PIPELINE_LIMITS);
  if (!result.ok) throw new Error(`Pipeline failed: ${result.error.code}`);
  return result.value;
}

async function stagePipeline(
  repository: DexieDocumentRepository,
  pipelineResult: PipelineSuccess,
  markdown: string,
  ids: { readonly documentId: string; readonly jobId: string; readonly versionId: string },
  expectedCurrentVersionId?: string,
): Promise<void> {
  const fileName = `${ids.documentId}.md`;
  const staged = await repository.stageVersion({
    ...ids,
    byteLength: pipelineResult.metadata.byteLength,
    charLength: pipelineResult.metadata.charLength,
    chunkCount: pipelineResult.metadata.chunkCount,
    contentHash: pipelineResult.metadata.contentHash,
    fileName,
    importedAt: 1_000,
    layouts: pipelineResult.metadata.layouts,
    normalizedFileName: normalizeIdentityFileName(fileName),
    normalizedTitle: normalizeIdentityText(pipelineResult.metadata.title),
    outline: pipelineResult.metadata.outline,
    pipelineVersion: pipelineResult.metadata.pipelineVersion,
    sourceBlob: new Blob([markdown], { type: "text/markdown" }),
    title: pipelineResult.metadata.title,
    ...(expectedCurrentVersionId === undefined ? {} : { expectedCurrentVersionId }),
  });
  expect(staged).toEqual({ ok: true, value: undefined });
  for (const batch of pipelineResult.batches) {
    expect(await repository.appendChunkBatch({ ...ids, batchOrdinal: batch.batchOrdinal, chunks: batch.chunks })).toEqual({ ok: true, value: undefined });
  }
}

async function commitFixture(repository: DexieDocumentRepository, options: {
  readonly contentHash: string;
  readonly documentId: string;
  readonly fileName: string;
  readonly jobId: string;
  readonly normalizedFileName?: string;
  readonly title: string;
  readonly versionId: string;
}): Promise<void> {
  const staged = createStorageStageInput({ ...options, chunkCount: 1 });
  const input = { ...staged, ...(options.normalizedFileName === undefined ? {} : { normalizedFileName: options.normalizedFileName }), pipelineVersion: PIPELINE_VERSION };
  await repository.stageVersion(input);
  await repository.appendChunkBatch({ batchOrdinal: 0, chunks: createStorageChunks(1, { pipelineVersion: PIPELINE_VERSION }), jobId: input.jobId, versionId: input.versionId });
  await repository.commitVersion({ jobId: input.jobId, readyAt: input.importedAt + 1, versionId: input.versionId });
}

function createRepository(testName: string, failureHooks?: StorageAtomicityFailureHooks): DexieDocumentRepository {
  const name = `markdown-reader-repository-${testName}-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return new DexieDocumentRepository(name, failureHooks);
}
