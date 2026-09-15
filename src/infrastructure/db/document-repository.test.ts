import { afterEach, describe, expect, it } from "vitest";

import {
  DexieDocumentRepository,
  PIPELINE_VERSION,
} from "@/infrastructure/db/document-repository";
import { createStorageAtomicitySpikeDatabase, deleteStorageAtomicitySpikeDatabase, type StorageAtomicityFailureHooks } from "@/infrastructure/db/storage-atomicity-spike";
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
});

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
