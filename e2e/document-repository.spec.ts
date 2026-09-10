import { expect, test } from "@playwright/test";

import type * as RepositoryModule from "../src/infrastructure/db/document-repository";
import type * as StorageModule from "../src/infrastructure/db/storage-atomicity-spike";
import type * as FixtureModule from "../src/test/fixtures/storage-atomicity-fixtures";

test("production repository commits and recovers a source Blob in Chromium IndexedDB", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const repositoryModulePath = "/src/infrastructure/db/document-repository.ts";
    const storageModulePath = "/src/infrastructure/db/storage-atomicity-spike.ts";
    const fixtureModulePath = "/src/test/fixtures/storage-atomicity-fixtures.ts";
    const repositoryModule = (await import(repositoryModulePath)) as typeof RepositoryModule;
    const storageModule = (await import(storageModulePath)) as typeof StorageModule;
    const fixtures = (await import(fixtureModulePath)) as typeof FixtureModule;
    const databaseName = `markdown-reader-browser-${crypto.randomUUID()}`;
    const repository = new repositoryModule.DexieDocumentRepository(databaseName);
    const input = { ...fixtures.createStorageStageInput({ chunkCount: 1 }), pipelineVersion: repositoryModule.PIPELINE_VERSION };
    try {
      const stage = await repository.stageVersion(input);
      if (!stage.ok) return { code: stage.error.code, ok: false };
      const append = await repository.appendChunkBatch({ batchOrdinal: 0, chunks: fixtures.createStorageChunks(1, { pipelineVersion: repositoryModule.PIPELINE_VERSION }), jobId: input.jobId, versionId: input.versionId });
      if (!append.ok) return { code: append.error.code, ok: false };
      const committed = await repository.commitVersion({ jobId: input.jobId, readyAt: input.importedAt + 1, versionId: input.versionId });
      if (!committed.ok) return { code: committed.error.code, ok: false };
      const recovered = await (new storageModule.StorageAtomicitySpikeRepository(databaseName)).readCurrentSourceBlobForRebuild(input.documentId);
      if (!recovered.ok) return { code: recovered.error.code, ok: false };
      return { ok: true, text: await recovered.value.sourceBlob.text() };
    } finally {
      repository.close();
      await storageModule.deleteStorageAtomicitySpikeDatabase(databaseName);
    }
  });
  expect(result).toEqual({ ok: true, text: "# Storage Spike\n\nfixture" });
});
