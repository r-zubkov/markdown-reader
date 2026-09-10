import { afterEach, describe, expect, it } from "vitest";

import {
  DexieDocumentRepository,
  PIPELINE_VERSION,
} from "@/infrastructure/db/document-repository";
import { deleteStorageAtomicitySpikeDatabase } from "@/infrastructure/db/storage-atomicity-spike";
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
    expect(await repository.getCurrentChunkWindow({
      documentId: input.documentId,
      endOrdinalInclusive: 1,
      pipelineVersion: PIPELINE_VERSION,
      startOrdinal: 0,
    })).toMatchObject({ ok: true, value: [{ value: "<p>storage chunk 0</p>" }, { value: "<p>storage chunk 1</p>" }] });
    expect(await repository.getCurrentChunkWindow({
      documentId: input.documentId,
      endOrdinalInclusive: 1,
      pipelineVersion: PIPELINE_VERSION + 1,
      startOrdinal: 0,
    })).toMatchObject({ ok: false, error: { code: "STALE_DERIVED" } });
    repository.close();
  });

  it("persists preference changes after the IndexedDB source of truth accepts them", async () => {
    const repository = createRepository("preferences");
    expect(await repository.getPreferences()).toMatchObject({ ok: true, value: { theme: "system" } });
    expect(await repository.saveTheme("dark", 42)).toEqual({ ok: true, value: undefined });
    expect(await repository.getPreferences()).toMatchObject({ ok: true, value: { theme: "dark", updatedAt: 42 } });
    repository.close();
  });
});

function createRepository(testName: string): DexieDocumentRepository {
  const name = `markdown-reader-repository-${testName}-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return new DexieDocumentRepository(name);
}
