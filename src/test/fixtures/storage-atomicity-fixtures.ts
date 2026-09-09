import {
  createSingleSectionLayouts,
  STORAGE_ATOMICITY_SPIKE_PIPELINE_VERSION,
  type StageStorageVersionInput,
  type StorageChunkRecord,
  type StorageDocumentRecord,
  type StorageDocumentVersionRecord,
} from "@/infrastructure/db/storage-atomicity-spike";
import type { PersistablePipelineChunk } from "@/domain/content/pipeline-types";

export interface StorageStageFixtureOptions {
  readonly documentId?: string;
  readonly versionId?: string;
  readonly jobId?: string;
  readonly fileName?: string;
  readonly title?: string;
  readonly contentHash?: string;
  readonly chunkCount?: number;
  readonly importedAt?: number;
  readonly expectedCurrentVersionId?: string;
}

export interface LegacyStorageFixture {
  readonly document: StorageDocumentRecord;
  readonly version: Omit<
    StorageDocumentVersionRecord,
    "pipelineVersion" | "nextBatchOrdinal" | "stagedChunkCount" | "lastStagedOrdinal"
  >;
  readonly chunks: readonly Omit<
    StorageChunkRecord,
    "pipelineVersion" | "jobId" | "batchOrdinal"
  >[];
}

export function createStorageStageInput(
  options: StorageStageFixtureOptions = {},
): StageStorageVersionInput {
  const chunkCount = options.chunkCount ?? 3;
  const documentId = options.documentId ?? "doc-storage-spike";
  const fileName = options.fileName ?? "storage-spike.md";
  const title = options.title ?? "Storage Spike";
  const stageInput: StageStorageVersionInput = {
    byteLength: 128,
    charLength: 128,
    chunkCount,
    contentHash: options.contentHash ?? "a".repeat(64),
    documentId,
    fileName,
    importedAt: options.importedAt ?? 1_000,
    jobId: options.jobId ?? "job-storage-spike",
    layouts: createSingleSectionLayouts(chunkCount),
    normalizedFileName: normalizeFixtureName(fileName),
    normalizedTitle: normalizeFixtureName(title),
    outline: [
      {
        childIds: [],
        chunkOrdinal: 0,
        id: "mdr-h-storage-spike-1",
        level: 1,
        pathKey: "1:storage-spike[1]",
        sourceStart: 0,
        text: title,
      },
    ],
    pipelineVersion: STORAGE_ATOMICITY_SPIKE_PIPELINE_VERSION,
    sourceBlob: new Blob(["# Storage Spike\n\nfixture"], { type: "text/markdown" }),
    title,
    versionId: options.versionId ?? "ver-storage-spike",
  };

  if (options.expectedCurrentVersionId !== undefined) {
    return {
      ...stageInput,
      expectedCurrentVersionId: options.expectedCurrentVersionId,
    };
  }

  return stageInput;
}

export function createStorageChunks(
  count: number,
  options: {
    readonly startOrdinal?: number;
    readonly pipelineVersion?: number;
    readonly sourceStart?: number;
  } = {},
): readonly PersistablePipelineChunk[] {
  const startOrdinal = options.startOrdinal ?? 0;
  const pipelineVersion = options.pipelineVersion ?? STORAGE_ATOMICITY_SPIKE_PIPELINE_VERSION;
  let sourceCursor = options.sourceStart ?? 0;
  const chunks: PersistablePipelineChunk[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const ordinal = startOrdinal + offset;
    const sourceStart = sourceCursor;
    const sourceEnd = sourceStart + 10;

    chunks.push({
      blockAnchors: [
        {
          blockId: `block-${String(ordinal)}`,
          blockOrdinalWithinHeading: ordinal,
          contentFingerprint: ordinal.toString(16).padStart(64, "0"),
          headingPathKey: "1:storage-spike[1]",
          sourceEnd,
          sourceStart,
        },
      ],
      estimatedCost: 1,
      headingIds: ordinal === 0 ? ["mdr-h-storage-spike-1"] : [],
      html: `<p>storage chunk ${String(ordinal)}</p>`,
      ordinal,
      pipelineVersion,
      renderState: "ready",
      sourceEnd,
      sourceStart,
    });

    sourceCursor = sourceEnd;
  }

  return chunks;
}

export function createLegacyStorageFixture(): LegacyStorageFixture {
  const stageInput = createStorageStageInput({
    documentId: "doc-legacy-storage",
    importedAt: 500,
    jobId: "job-legacy-storage",
    versionId: "ver-legacy-storage",
  });

  const document: StorageDocumentRecord = {
    createdAt: 500,
    currentVersionId: stageInput.versionId,
    fileName: stageInput.fileName,
    id: stageInput.documentId,
    normalizedFileName: stageInput.normalizedFileName,
    normalizedTitle: stageInput.normalizedTitle,
    title: stageInput.title,
    updatedAt: 500,
  };

  const version: LegacyStorageFixture["version"] = {
    byteLength: stageInput.byteLength,
    charLength: stageInput.charLength,
    chunkCount: stageInput.chunkCount,
    contentHash: stageInput.contentHash,
    documentId: stageInput.documentId,
    encoding: "utf-8",
    fileName: stageInput.fileName,
    id: stageInput.versionId,
    importedAt: stageInput.importedAt,
    jobId: stageInput.jobId,
    layouts: stageInput.layouts,
    normalizedFileName: stageInput.normalizedFileName,
    normalizedTitle: stageInput.normalizedTitle,
    outline: stageInput.outline,
    readyAt: 500,
    sourceBytes: Array.from(new TextEncoder().encode("# Storage Spike\n\nfixture")),
    sourceBlob: stageInput.sourceBlob,
    state: "ready",
    title: stageInput.title,
  };

  const chunks = createStorageChunks(stageInput.chunkCount).map(
    (chunk): LegacyStorageFixture["chunks"][number] => ({
      blockAnchors: chunk.blockAnchors,
      estimatedCost: chunk.estimatedCost,
      headingIds: chunk.headingIds,
      html: chunk.html,
      ordinal: chunk.ordinal,
      renderState: chunk.renderState,
      sourceEnd: chunk.sourceEnd,
      sourceStart: chunk.sourceStart,
      versionId: stageInput.versionId,
    }),
  );

  return {
    chunks,
    document,
    version,
  };
}

export function createStorageDatabaseName(testName: string): string {
  return `markdown-reader-storage-spike-${testName}-${crypto.randomUUID()}`;
}

function normalizeFixtureName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}
