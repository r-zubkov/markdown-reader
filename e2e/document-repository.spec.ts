import { expect, test } from "@playwright/test";

import type * as RepositoryModule from "../src/infrastructure/db/document-repository";
import type * as StorageModule from "../src/infrastructure/db/storage-atomicity-spike";
import type * as FixtureModule from "../src/test/fixtures/storage-atomicity-fixtures";
import type * as PipelineModule from "../src/domain/content/markdown-pipeline";

test("production repository blocks stale HTML and atomically rebuilds it from the source Blob", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const repositoryModulePath = "/src/infrastructure/db/document-repository.ts";
    const storageModulePath = "/src/infrastructure/db/storage-atomicity-spike.ts";
    const fixtureModulePath = "/src/test/fixtures/storage-atomicity-fixtures.ts";
    const pipelineModulePath = "/src/domain/content/markdown-pipeline.ts";
    const repositoryModule = (await import(repositoryModulePath)) as typeof RepositoryModule;
    const storageModule = (await import(storageModulePath)) as typeof StorageModule;
    const fixtures = (await import(fixtureModulePath)) as typeof FixtureModule;
    const pipelineModule = (await import(pipelineModulePath)) as typeof PipelineModule;
    const databaseName = `markdown-reader-browser-${crypto.randomUUID()}`;
    const storage = new storageModule.StorageAtomicitySpikeRepository(databaseName);
    const repository = new repositoryModule.DexieDocumentRepository(databaseName);
    const input = { ...fixtures.createStorageStageInput({ chunkCount: 1 }), pipelineVersion: repositoryModule.PIPELINE_VERSION - 1 };
    try {
      const stage = await storage.stageVersion(input);
      if (!stage.ok) return { code: stage.error.code, ok: false };
      const append = await storage.appendChunkBatch({ batchOrdinal: 0, chunks: fixtures.createStorageChunks(1, { pipelineVersion: input.pipelineVersion }), jobId: input.jobId, versionId: input.versionId });
      if (!append.ok) return { code: append.error.code, ok: false };
      const committed = await storage.commitVersion({ jobId: input.jobId, readyAt: input.importedAt + 1, versionId: input.versionId });
      if (!committed.ok) return { code: committed.error.code, ok: false };
      const stale = await repository.getCurrentDocument(input.documentId);
      if (stale.ok || stale.error.code !== "STALE_DERIVED") return { code: "STALE_NOT_BLOCKED", ok: false };
      const recovered = await repository.getCurrentSourceForRebuild(input.documentId);
      if (!recovered.ok) return { code: recovered.error.code, ok: false };
      const sourceBytes = new Uint8Array(await recovered.value.sourceBlob.arrayBuffer());
      const pipeline = await pipelineModule.runMarkdownPipeline(sourceBytes, recovered.value.fileName);
      if (!pipeline.ok) return { code: pipeline.error.code, ok: false };
      const nextVersionId = crypto.randomUUID();
      const nextJobId = crypto.randomUUID();
      const next = {
        ...input,
        byteLength: pipeline.value.metadata.byteLength,
        charLength: pipeline.value.metadata.charLength,
        chunkCount: pipeline.value.metadata.chunkCount,
        contentHash: pipeline.value.metadata.contentHash,
        expectedCurrentVersionId: recovered.value.currentVersionId,
        importedAt: input.importedAt + 2,
        jobId: nextJobId,
        layouts: pipeline.value.metadata.layouts,
        outline: pipeline.value.metadata.outline,
        pipelineVersion: pipeline.value.metadata.pipelineVersion,
        sourceBlob: recovered.value.sourceBlob,
        title: pipeline.value.metadata.title,
        versionId: nextVersionId,
      };
      const nextStage = await repository.stageVersion(next);
      if (!nextStage.ok) return { code: nextStage.error.code, ok: false };
      for (const batch of pipeline.value.batches) {
        const nextAppend = await repository.appendChunkBatch({ batchOrdinal: batch.batchOrdinal, chunks: batch.chunks, jobId: nextJobId, versionId: nextVersionId });
        if (!nextAppend.ok) return { code: nextAppend.error.code, ok: false };
      }
      const nextCommit = await repository.commitVersion({ jobId: nextJobId, readyAt: next.importedAt + 1, versionId: nextVersionId });
      if (!nextCommit.ok) return { code: nextCommit.error.code, ok: false };
      const current = await repository.getCurrentDocument(input.documentId);
      if (!current.ok) return { code: current.error.code, ok: false };
      return { ok: true, text: await recovered.value.sourceBlob.text(), currentPipeline: current.value.pipelineVersion === repositoryModule.PIPELINE_VERSION };
    } finally {
      storage.close();
      repository.close();
      await storageModule.deleteStorageAtomicitySpikeDatabase(databaseName);
    }
  });
  expect(result).toEqual({ ok: true, text: "# Storage Spike\n\nfixture", currentPipeline: true });
});

test("Reader rejects changed persisted markup before it reaches the HTML boundary", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("library-import-trigger").click();
  await page.getByTestId("import-file-input").setInputFiles({
    name: "persisted-boundary.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Persisted boundary\n\nOriginal safe paragraph."),
  });
  await page.locator("a.import-overlay__open").click();
  await expect(page.getByText("Original safe paragraph.")).toBeVisible();

  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("markdown-reader");
    request.onerror = () => { reject(request.error ?? new Error("IndexedDB open failed.")); };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("chunks", "readwrite");
      const cursorRequest = transaction.objectStore("chunks").openCursor();
      cursorRequest.onerror = () => { reject(cursorRequest.error ?? new Error("Chunk cursor failed.")); };
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor === null) { reject(new Error("Expected a persisted chunk.")); return; }
        cursor.update({ ...cursor.value, html: '<p data-unexpected="true">Changed derived markup</p>' });
      };
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Chunk update failed.")); };
    };
  }));

  await page.reload();
  await expect(page.locator(".reader__recovery")).toBeVisible();
  await expect(page.locator(".reader__diagnostic code")).toHaveText("INVALID_PERSISTED_RECORD");
  await expect(page.locator("[data-unexpected]")).toHaveCount(0);
});
