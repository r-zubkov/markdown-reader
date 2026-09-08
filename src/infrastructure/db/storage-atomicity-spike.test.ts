import { afterEach, describe, expect, it } from "vitest";

import {
  createStorageAtomicitySpikeDatabase,
  deleteStorageAtomicitySpikeDatabase,
  seedStorageAtomicityLegacyV1Database,
  StorageAtomicitySpikeRepository,
  STORAGE_ATOMICITY_SPIKE_DB_SCHEMA_VERSION,
  type CommitStorageVersionResult,
  type StageStorageVersionInput,
  type StorageChunkRecord,
  type StorageDocumentVersionRecord,
  type StorageSpikeErrorCode,
  type StorageSpikeResult,
} from "./storage-atomicity-spike";
import {
  createLegacyStorageFixture,
  createStorageChunks,
  createStorageDatabaseName,
  createStorageStageInput,
} from "@/test/fixtures/storage-atomicity-fixtures";

const databaseNames: string[] = [];
const repositories: StorageAtomicitySpikeRepository[] = [];

afterEach(async () => {
  for (const repository of repositories) {
    repository.close();
  }

  repositories.length = 0;

  await Promise.all(databaseNames.map((databaseName) => deleteStorageAtomicitySpikeDatabase(databaseName)));
  databaseNames.length = 0;
});

describe("Storage atomicity spike repository", () => {
  it("keeps staging invisible and publishes only complete ready current versions", async () => {
    const repository = createRepository("new-document");
    const stageInput = createStorageStageInput();

    expectOk(await repository.stageVersion(stageInput));
    expectOk(await repository.appendChunkBatch(createAppendInput(stageInput)));

    expect(expectOk(await repository.listVisibleDocuments())).toHaveLength(0);

    expectOk(await repository.commitVersion(createCommitInput(stageInput)));

    const visibleDocuments = expectOk(await repository.listVisibleDocuments());
    expect(visibleDocuments).toHaveLength(1);

    const visibleDocument = expectSingle(visibleDocuments);
    expect(visibleDocument).toMatchObject({
      chunkCount: stageInput.chunkCount,
      contentHash: stageInput.contentHash,
      currentVersionId: stageInput.versionId,
      documentId: stageInput.documentId,
      title: stageInput.title,
    });

    const duplicate = expectOk(
      await repository.findCurrentReadyVersionByHash(stageInput.contentHash),
    );
    expect(duplicate?.documentId).toBe(stageInput.documentId);

    const readyVersion = expectOk(await repository.getVersion(stageInput.versionId));
    expect(readyVersion?.state).toBe("ready");
  });

  it("rolls back a quota-like append failure without exposing partial chunks", async () => {
    const repository = createRepository("quota-append", {
      afterChunksAdded: () => {
        const quotaError = new Error("simulated quota");
        quotaError.name = "QuotaExceededError";
        throw quotaError;
      },
    });
    const stageInput = createStorageStageInput();

    expectOk(await repository.stageVersion(stageInput));

    expectError(await repository.appendChunkBatch(createAppendInput(stageInput)), "QUOTA_EXCEEDED");

    expect(expectOk(await repository.getChunks(stageInput.versionId))).toHaveLength(0);
    expect(expectOk(await repository.listVisibleDocuments())).toHaveLength(0);

    const stagedVersion = expectOk(await repository.getVersion(stageInput.versionId));
    expect(stagedVersion?.stagedChunkCount).toBe(0);
    expect(stagedVersion?.nextBatchOrdinal).toBe(0);
  });

  it("preserves the previous ready version when replace commit fails before pointer switch", async () => {
    const replacementVersionId = "ver-replace-failing";
    const repository = createRepository("pre-commit-failure", {
      beforeCommitPointerSwitch: ({ versionId }) => {
        if (versionId === replacementVersionId) {
          const quotaError = new Error("simulated commit quota");
          quotaError.name = "QuotaExceededError";
          throw quotaError;
        }
      },
    });
    const readyInput = createStorageStageInput({
      documentId: "doc-replace-target",
      jobId: "job-ready",
      versionId: "ver-ready",
    });

    await stageAppendCommit(repository, readyInput);

    const replacementInput = createStorageStageInput({
      contentHash: "b".repeat(64),
      documentId: readyInput.documentId,
      expectedCurrentVersionId: readyInput.versionId,
      jobId: "job-replace-failing",
      title: "Storage Spike Replacement",
      versionId: replacementVersionId,
    });

    expectOk(await repository.stageVersion(replacementInput));
    expectOk(await repository.appendChunkBatch(createAppendInput(replacementInput)));

    expectError(await repository.commitVersion(createCommitInput(replacementInput)), "QUOTA_EXCEEDED");

    const visibleDocument = expectSingle(expectOk(await repository.listVisibleDocuments()));
    expect(visibleDocument.currentVersionId).toBe(readyInput.versionId);

    const failedReplacement = expectOk(await repository.getVersion(replacementInput.versionId));
    expect(failedReplacement?.state).toBe("staging");
  });

  it("rejects missing, duplicate and out-of-order batches before publication", async () => {
    const repository = createRepository("batch-validation");
    const missingBatchInput = createStorageStageInput({
      jobId: "job-missing",
      versionId: "ver-missing",
    });

    expectOk(await repository.stageVersion(missingBatchInput));
    expectOk(
      await repository.appendChunkBatch({
        batchOrdinal: 0,
        chunks: createStorageChunks(2),
        jobId: missingBatchInput.jobId,
        versionId: missingBatchInput.versionId,
      }),
    );
    expectError(await repository.commitVersion(createCommitInput(missingBatchInput)), "MISSING_CHUNK_RANGE");

    const duplicateBatchInput = createStorageStageInput({
      documentId: "doc-duplicate",
      jobId: "job-duplicate",
      versionId: "ver-duplicate",
    });
    expectOk(await repository.stageVersion(duplicateBatchInput));
    expectOk(
      await repository.appendChunkBatch({
        batchOrdinal: 0,
        chunks: createStorageChunks(1),
        jobId: duplicateBatchInput.jobId,
        versionId: duplicateBatchInput.versionId,
      }),
    );
    expectError(
      await repository.appendChunkBatch({
        batchOrdinal: 0,
        chunks: createStorageChunks(1),
        jobId: duplicateBatchInput.jobId,
        versionId: duplicateBatchInput.versionId,
      }),
      "DUPLICATE_BATCH",
    );

    const outOfOrderInput = createStorageStageInput({
      documentId: "doc-out-of-order",
      jobId: "job-out-of-order",
      versionId: "ver-out-of-order",
    });
    expectOk(await repository.stageVersion(outOfOrderInput));
    expectError(
      await repository.appendChunkBatch({
        batchOrdinal: 1,
        chunks: createStorageChunks(1),
        jobId: outOfOrderInput.jobId,
        versionId: outOfOrderInput.versionId,
      }),
      "OUT_OF_ORDER_BATCH",
    );

    expect(expectOk(await repository.listVisibleDocuments())).toHaveLength(0);
  });

  it("rejects stale expected-current replacement conflicts", async () => {
    const repository = createRepository("stale-replace");
    const firstReadyInput = createStorageStageInput({
      documentId: "doc-stale-replace",
      jobId: "job-ready",
      versionId: "ver-ready",
    });
    await stageAppendCommit(repository, firstReadyInput);

    const staleReplacementInput = createStorageStageInput({
      contentHash: "b".repeat(64),
      documentId: firstReadyInput.documentId,
      expectedCurrentVersionId: firstReadyInput.versionId,
      jobId: "job-stale",
      versionId: "ver-stale",
    });
    expectOk(await repository.stageVersion(staleReplacementInput));
    expectOk(await repository.appendChunkBatch(createAppendInput(staleReplacementInput)));

    const winningReplacementInput = createStorageStageInput({
      contentHash: "c".repeat(64),
      documentId: firstReadyInput.documentId,
      expectedCurrentVersionId: firstReadyInput.versionId,
      jobId: "job-winning",
      versionId: "ver-winning",
    });
    await stageAppendCommit(repository, winningReplacementInput);

    expectError(
      await repository.commitVersion(createCommitInput(staleReplacementInput)),
      "CURRENT_VERSION_CONFLICT",
    );

    const visibleDocument = expectSingle(expectOk(await repository.listVisibleDocuments()));
    expect(visibleDocument.currentVersionId).toBe(winningReplacementInput.versionId);
  });

  it("keeps cleanup scoped, idempotent and separated from successful replace commit", async () => {
    let failCleanup = true;
    const repository = createRepository("cleanup", {
      beforeCleanupDelete: () => {
        if (failCleanup) {
          throw new Error("simulated cleanup failure");
        }
      },
    });
    const readyInput = createStorageStageInput({
      documentId: "doc-cleanup",
      jobId: "job-shared-cleanup",
      versionId: "ver-cleanup-ready",
    });
    await stageAppendCommit(repository, readyInput);

    const sameJobStagingInput = createStorageStageInput({
      documentId: "doc-cleanup-other",
      jobId: readyInput.jobId,
      versionId: "ver-cleanup-staging",
    });
    expectOk(await repository.stageVersion(sameJobStagingInput));
    expectOk(await repository.abortVersion(readyInput.jobId));
    expect(expectOk(await repository.getVersion(readyInput.versionId))?.state).toBe("ready");
    expect(expectOk(await repository.getVersion(sameJobStagingInput.versionId))).toBeUndefined();

    const replacementInput = createStorageStageInput({
      contentHash: "d".repeat(64),
      documentId: readyInput.documentId,
      expectedCurrentVersionId: readyInput.versionId,
      jobId: "job-cleanup-replace",
      versionId: "ver-cleanup-replace",
    });
    const replaceCommit = await stageAppendCommit(repository, replacementInput);
    expect(replaceCommit.replacedVersionId).toBe(readyInput.versionId);

    expectError(await repository.cleanupReadyVersion(readyInput.versionId), "CLEANUP_FAILED");
    expect(expectOk(await repository.getVersion(readyInput.versionId))?.state).toBe("ready");

    failCleanup = false;

    const cleanupResult = expectOk(await repository.cleanupReadyVersion(readyInput.versionId));
    expect(cleanupResult).toEqual({
      removedChunkCount: readyInput.chunkCount,
      removedVersionIds: [readyInput.versionId],
    });

    expectOk(await repository.cleanupReadyVersion(readyInput.versionId));
    expect(expectSingle(expectOk(await repository.listVisibleDocuments())).currentVersionId).toBe(
      replacementInput.versionId,
    );
  });

  it("cleans abandoned staging after reload without touching active jobs", async () => {
    const databaseName = registerDatabaseName("abandoned-staging");
    const firstRepository = registerRepository(new StorageAtomicitySpikeRepository(databaseName));
    const abandonedInput = createStorageStageInput({
      importedAt: 100,
      jobId: "job-abandoned",
      versionId: "ver-abandoned",
    });
    const activeInput = createStorageStageInput({
      documentId: "doc-active-staging",
      importedAt: 100,
      jobId: "job-active",
      versionId: "ver-active-staging",
    });

    expectOk(await firstRepository.stageVersion(abandonedInput));
    expectOk(await firstRepository.appendChunkBatch(createAppendInput(abandonedInput, 1)));
    expectOk(await firstRepository.stageVersion(activeInput));
    firstRepository.close();

    const reloadedRepository = registerRepository(new StorageAtomicitySpikeRepository(databaseName));
    const cleanupResult = expectOk(
      await reloadedRepository.cleanupAbandonedStaging({
        activeJobIds: new Set([activeInput.jobId]),
        olderThan: 1_000,
      }),
    );

    expect(cleanupResult.removedVersionIds).toEqual([abandonedInput.versionId]);
    expect(cleanupResult.removedChunkCount).toBe(1);
    expect(expectOk(await reloadedRepository.getVersion(abandonedInput.versionId))).toBeUndefined();
    expect(expectOk(await reloadedRepository.getVersion(activeInput.versionId))?.state).toBe(
      "staging",
    );
    expect(expectOk(await reloadedRepository.listVisibleDocuments())).toHaveLength(0);
  });

  it("rejects invalid persisted source ranges during commit validation", async () => {
    const databaseName = registerDatabaseName("corrupt-ranges");
    const repository = registerRepository(new StorageAtomicitySpikeRepository(databaseName));
    const stageInput = createStorageStageInput({
      chunkCount: 2,
      jobId: "job-corrupt",
      versionId: "ver-corrupt",
    });
    expectOk(await repository.stageVersion(stageInput));

    const database = createStorageAtomicitySpikeDatabase(databaseName);
    await database.open();

    try {
      await database.transaction(
        "rw",
        database.table<StorageDocumentVersionRecord, string>("documentVersions"),
        database.table<StorageChunkRecord, [string, number]>("chunks"),
        async () => {
          const chunks = database.table<StorageChunkRecord, [string, number]>("chunks");
          await chunks.bulkAdd([
            createStorageChunkRecord(stageInput, 0, 20, 30),
            createStorageChunkRecord(stageInput, 1, 10, 15),
          ]);
          await database
            .table<StorageDocumentVersionRecord, string>("documentVersions")
            .update(stageInput.versionId, {
              lastStagedOrdinal: 1,
              nextBatchOrdinal: 1,
              stagedChunkCount: 2,
            });
        },
      );
    } finally {
      database.close();
    }

    expectError(await repository.commitVersion(createCommitInput(stageInput)), "INVALID_CHUNK_RANGE");
    expect(expectOk(await repository.listVisibleDocuments())).toHaveLength(0);
  });

  it("upgrades a legacy fixture while preserving the source blob for rebuild", async () => {
    const databaseName = registerDatabaseName("legacy-migration");
    const legacyFixture = createLegacyStorageFixture();
    await seedStorageAtomicityLegacyV1Database({
      chunks: legacyFixture.chunks,
      databaseName,
      document: legacyFixture.document,
      version: legacyFixture.version,
    });

    const repository = registerRepository(new StorageAtomicitySpikeRepository(databaseName));
    const visibleDocument = expectSingle(expectOk(await repository.listVisibleDocuments()));
    expect(visibleDocument.documentId).toBe(legacyFixture.document.id);

    const migratedVersion = expectOk(await repository.getVersion(legacyFixture.version.id));
    expect(migratedVersion?.pipelineVersion).toBe(0);
    expect(migratedVersion?.stagedChunkCount).toBe(legacyFixture.version.chunkCount);
    expect(migratedVersion?.layouts.h3.strategy).toBe("h3");

    const recovery = expectOk(
      await repository.readCurrentSourceBlobForRebuild(legacyFixture.document.id),
    );
    expect(recovery.pipelineVersion).toBe(0);
    expect(await recovery.sourceBlob.text()).toContain("# Storage Spike");

    const upgradedDatabase = createStorageAtomicitySpikeDatabase(databaseName);
    await upgradedDatabase.open();
    try {
      expect(upgradedDatabase.verno).toBe(STORAGE_ATOMICITY_SPIKE_DB_SCHEMA_VERSION);
    } finally {
      upgradedDatabase.close();
    }
  });

});

function createRepository(
  testName: string,
  hooks?: ConstructorParameters<typeof StorageAtomicitySpikeRepository>[1],
): StorageAtomicitySpikeRepository {
  const databaseName = registerDatabaseName(testName);
  return registerRepository(new StorageAtomicitySpikeRepository(databaseName, hooks));
}

function registerDatabaseName(testName: string): string {
  const databaseName = createStorageDatabaseName(testName);
  databaseNames.push(databaseName);
  return databaseName;
}

function registerRepository(
  repository: StorageAtomicitySpikeRepository,
): StorageAtomicitySpikeRepository {
  repositories.push(repository);
  return repository;
}

function createAppendInput(
  input: StageStorageVersionInput,
  chunkCount = input.chunkCount,
) {
  return {
    batchOrdinal: 0,
    chunks: createStorageChunks(chunkCount),
    jobId: input.jobId,
    versionId: input.versionId,
  };
}

function createCommitInput(input: StageStorageVersionInput) {
  return {
    jobId: input.jobId,
    readyAt: input.importedAt + 1,
    versionId: input.versionId,
  };
}

async function stageAppendCommit(
  repository: StorageAtomicitySpikeRepository,
  input: StageStorageVersionInput,
): Promise<CommitStorageVersionResult> {
  expectOk(await repository.stageVersion(input));
  expectOk(await repository.appendChunkBatch(createAppendInput(input)));
  return expectOk(await repository.commitVersion(createCommitInput(input)));
}

function createStorageChunkRecord(
  input: StageStorageVersionInput,
  ordinal: number,
  sourceStart: number,
  sourceEnd: number,
): StorageChunkRecord {
  return {
    batchOrdinal: 0,
    blockAnchors: [
      {
        blockId: `corrupt-block-${String(ordinal)}`,
        blockOrdinalWithinHeading: ordinal,
        headingPathKey: "1:storage-spike[1]",
        sourceEnd,
        sourceStart,
      },
    ],
    estimatedCost: 1,
    headingIds: [],
    html: `<p>corrupt ${String(ordinal)}</p>`,
    jobId: input.jobId,
    ordinal,
    pipelineVersion: input.pipelineVersion,
    renderState: "ready",
    sourceEnd,
    sourceStart,
    versionId: input.versionId,
  };
}

function expectOk<T>(result: StorageSpikeResult<T>): T {
  if (result.ok) {
    return result.value;
  }

  throw new Error(`Expected storage result ok, got ${result.error.code}.`);
}

function expectError<T>(
  result: StorageSpikeResult<T>,
  code: StorageSpikeErrorCode,
): void {
  if (result.ok) {
    throw new Error("Expected storage result error, got ok.");
  }

  expect(result.error.code).toBe(code);
}

function expectSingle<T>(items: readonly T[]): T {
  expect(items).toHaveLength(1);

  const item = items[0];
  if (item === undefined) {
    throw new Error("Expected one item.");
  }

  return item;
}
