import { expect, test } from "@playwright/test";

import type * as StorageModule from "../src/infrastructure/db/storage-atomicity-spike";
import type * as FixtureModule from "../src/test/fixtures/storage-atomicity-fixtures";

type BrowserStorageConfirmation =
  | {
      readonly ok: true;
      readonly visibleCount: number;
      readonly currentVersionId: string;
      readonly recoveredText: string;
      readonly sourceBlobConstructor: string;
    }
  | {
      readonly ok: false;
      readonly step: string;
      readonly code: string;
      readonly message?: string;
    };

test("confirms atomic commit and Blob recovery in real browser IndexedDB", async ({ page }) => {
  await page.goto("/");

  const result: BrowserStorageConfirmation = await page.evaluate(async () => {
    const browserModulePath = (path: string): string => path;
    const storageModulePath = browserModulePath("/src/infrastructure/db/storage-atomicity-spike.ts");
    const fixtureModulePath = browserModulePath("/src/test/fixtures/storage-atomicity-fixtures.ts");
    const storage = (await import(storageModulePath)) as typeof StorageModule;
    const fixtures = (await import(fixtureModulePath)) as typeof FixtureModule;
    const databaseName = fixtures.createStorageDatabaseName("browser");
    const repository = new storage.StorageAtomicitySpikeRepository(databaseName);
    const stageInput = fixtures.createStorageStageInput({
      documentId: "doc-browser-storage",
      jobId: "job-browser-storage",
      versionId: "ver-browser-storage",
    });

    try {
      const stageResult = await repository.stageVersion(stageInput);
      if (!stageResult.ok) {
        return {
          code: stageResult.error.code,
          message: stageResult.error.message,
          ok: false,
          step: "stage",
        };
      }

      const appendResult = await repository.appendChunkBatch({
        batchOrdinal: 0,
        chunks: fixtures.createStorageChunks(stageInput.chunkCount),
        jobId: stageInput.jobId,
        versionId: stageInput.versionId,
      });
      if (!appendResult.ok) {
        return {
          code: appendResult.error.code,
          message: appendResult.error.message,
          ok: false,
          step: "append",
        };
      }

      const commitResult = await repository.commitVersion({
        jobId: stageInput.jobId,
        readyAt: stageInput.importedAt + 1,
        versionId: stageInput.versionId,
      });
      if (!commitResult.ok) {
        return {
          code: commitResult.error.code,
          message: commitResult.error.message,
          ok: false,
          step: "commit",
        };
      }

      const visibleResult = await repository.listVisibleDocuments();
      if (!visibleResult.ok) {
        return {
          code: visibleResult.error.code,
          message: visibleResult.error.message,
          ok: false,
          step: "list",
        };
      }

      const recoveryResult = await repository.readCurrentSourceBlobForRebuild(
        stageInput.documentId,
      );
      if (!recoveryResult.ok) {
        return {
          code: recoveryResult.error.code,
          message: recoveryResult.error.message,
          ok: false,
          step: "recovery",
        };
      }

      return {
        currentVersionId: visibleResult.value[0]?.currentVersionId ?? "",
        ok: true,
        recoveredText: await recoveryResult.value.sourceBlob.text(),
        sourceBlobConstructor: recoveryResult.value.sourceBlob.constructor.name,
        visibleCount: visibleResult.value.length,
      };
    } finally {
      repository.close();
      await storage.deleteStorageAtomicitySpikeDatabase(databaseName);
    }
  });

  if (!result.ok) {
    throw new Error(
      `Browser storage confirmation failed at ${result.step}: ${result.code}: ${result.message ?? "No detail"}.`,
    );
  }

  expect(result.visibleCount).toBe(1);
  expect(result.currentVersionId).toBe("ver-browser-storage");
  expect(result.recoveredText).toContain("# Storage Spike");
  expect(result.sourceBlobConstructor).toBe("Blob");
});
