import Dexie, { liveQuery, type Table } from "dexie";

import type {
  BlockAnchor,
  OutlineItem,
  PersistablePipelineChunk,
  SectionLayout,
  SectionRef,
  SplitStrategy,
} from "@/domain/content/pipeline-types";

export const STORAGE_ATOMICITY_SPIKE_DB_SCHEMA_VERSION = 3;
export const STORAGE_ATOMICITY_SPIKE_PIPELINE_VERSION = 1;

const splitStrategies = ["auto", "h1", "h2", "h3", "whole"] as const satisfies readonly SplitStrategy[];

export type StorageDocumentState = "staging" | "ready";
export type StorageReadingMode = "continuous" | "sections";
export type StorageModeOrigin = "auto" | "user";

export type StorageSpikeErrorCode =
  | "VERSION_NOT_FOUND"
  | "VERSION_NOT_STAGING"
  | "JOB_MISMATCH"
  | "DUPLICATE_BATCH"
  | "OUT_OF_ORDER_BATCH"
  | "DUPLICATE_CHUNK_ORDINAL"
  | "OUT_OF_ORDER_CHUNK"
  | "INVALID_CHUNK_RANGE"
  | "PIPELINE_VERSION_MISMATCH"
  | "MISSING_CHUNK_RANGE"
  | "CHUNK_COUNT_MISMATCH"
  | "INVALID_LAYOUT"
  | "INVALID_VERSION_METADATA"
  | "DOCUMENT_ALREADY_EXISTS"
  | "DOCUMENT_NOT_FOUND"
  | "CURRENT_VERSION_CONFLICT"
  | "VERSION_IS_CURRENT"
  | "QUOTA_EXCEEDED"
  | "CLEANUP_FAILED"
  | "MIGRATION_FAILED"
  | "UNKNOWN_STORAGE_ERROR";

export interface StorageSpikeError {
  readonly code: StorageSpikeErrorCode;
  readonly message: string;
}

export type StorageSpikeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StorageSpikeError };

export interface StorageDocumentRecord {
  id: string;
  title: string;
  normalizedTitle: string;
  fileName: string;
  normalizedFileName: string;
  currentVersionId: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface StorageDocumentVersionRecord {
  id: string;
  documentId: string;
  jobId: string;
  state: StorageDocumentState;
  contentHash: string;
  byteLength: number;
  charLength: number;
  encoding: "utf-8";
  sourceBlob: Blob;
  sourceBytes?: readonly number[] | Uint8Array;
  fileName: string;
  normalizedFileName: string;
  title: string;
  normalizedTitle: string;
  outline: readonly OutlineItem[];
  layouts: Record<SplitStrategy, SectionLayout>;
  chunkCount: number;
  pipelineVersion: number;
  importedAt: number;
  readyAt?: number;
  expectedCurrentVersionId?: string;
  nextBatchOrdinal: number;
  stagedChunkCount: number;
  lastStagedOrdinal: number;
}

export interface StorageChunkRecord {
  versionId: string;
  ordinal: number;
  jobId: string;
  batchOrdinal: number;
  html: string;
  pipelineVersion: number;
  sourceStart: number;
  sourceEnd: number;
  estimatedCost: number;
  headingIds: readonly string[];
  blockAnchors: readonly BlockAnchor[];
  renderState: "ready" | "safe-fallback";
  diagnosticCode?: "FRAGMENT_FALLBACK" | "HIGHLIGHT_FAILED" | "OVERSIZED_NODE";
}

export interface StorageReaderStateRecord {
  documentId: string;
  readingMode: StorageReadingMode;
  modeOrigin: StorageModeOrigin;
  splitStrategy: SplitStrategy;
  anchor?: StorageSemanticAnchor;
  progressRatio: number;
  updatedAt: number;
}

export interface StorageSemanticAnchor {
  versionId: string;
  headingPathKey: string;
  blockOrdinalWithinHeading: number;
  blockId: string;
  intraBlockRatio: number;
  overallSourceRatio: number;
}

export interface StoragePreferencesRecord {
  key: "app";
  theme: "system" | "light" | "dark";
  remoteImagesEnabled: boolean;
  desktopTocCollapsed: boolean;
  updatedAt: number;
}

export interface StageStorageVersionInput {
  readonly documentId: string;
  readonly versionId: string;
  readonly jobId: string;
  readonly fileName: string;
  readonly normalizedFileName: string;
  readonly title: string;
  readonly normalizedTitle: string;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly charLength: number;
  readonly sourceBlob: Blob;
  readonly outline: readonly OutlineItem[];
  readonly layouts: Record<SplitStrategy, SectionLayout>;
  readonly chunkCount: number;
  readonly pipelineVersion: number;
  readonly importedAt: number;
  readonly expectedCurrentVersionId?: string;
}

export interface AppendStorageChunkBatchInput {
  readonly versionId: string;
  readonly jobId: string;
  readonly batchOrdinal: number;
  readonly chunks: readonly PersistablePipelineChunk[];
}

export interface CommitStorageVersionInput {
  readonly versionId: string;
  readonly jobId: string;
  readonly readyAt: number;
}

export interface CommitStorageVersionResult {
  readonly documentId: string;
  readonly versionId: string;
  readonly replacedVersionId?: string;
}

export interface VisibleStorageDocument {
  readonly documentId: string;
  readonly currentVersionId: string;
  readonly title: string;
  readonly fileName: string;
  readonly activityAt: number;
  readonly chunkCount: number;
  readonly contentHash: string;
}

export interface ImportIdentityStorageMatches {
  readonly exactDuplicates: readonly VisibleStorageDocument[];
  readonly possibleUpdates: readonly VisibleStorageDocument[];
}

export interface SourceBlobRecoveryResult {
  readonly documentId: string;
  readonly fileName: string;
  readonly versionId: string;
  readonly pipelineVersion: number;
  readonly sourceBlob: Blob;
}

export interface CleanupResult {
  readonly removedVersionIds: readonly string[];
  readonly removedChunkCount: number;
}

export interface StorageAtomicityFailureHooks {
  readonly afterChunksAdded?: (context: {
    readonly versionId: string;
    readonly batchOrdinal: number;
  }) => void | Promise<void>;
  readonly beforeCommitPointerSwitch?: (context: {
    readonly documentId: string;
    readonly versionId: string;
  }) => void | Promise<void>;
  readonly beforeCleanupDelete?: (context: {
    readonly versionId: string;
  }) => void | Promise<void>;
}

export class StorageAtomicitySpikeRepository {
  private readonly database: Dexie;
  private readonly failureHooks: StorageAtomicityFailureHooks;

  public constructor(databaseName: string, failureHooks: StorageAtomicityFailureHooks = {}) {
    this.database = createStorageAtomicitySpikeDatabase(databaseName);
    this.failureHooks = failureHooks;
  }

  public close(): void {
    this.database.close();
  }

  public async stageVersion(
    input: StageStorageVersionInput,
  ): Promise<StorageSpikeResult<{ readonly documentId: string; readonly versionId: string }>> {
    try {
      assertStageInput(input);

      const value = await this.database.transaction("rw", this.versions, async () => {
        const existingVersion = await this.versions.get(input.versionId);

        if (existingVersion !== undefined) {
          throwStorageError("INVALID_VERSION_METADATA", "Version id already exists.");
        }

        await this.versions.add(createStagingVersionRecord(input));

        return {
          documentId: input.documentId,
          versionId: input.versionId,
        };
      });

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async appendChunkBatch(
    input: AppendStorageChunkBatchInput,
  ): Promise<StorageSpikeResult<{ readonly stagedChunkCount: number }>> {
    try {
      assertAppendInput(input);

      const value = await this.database.transaction("rw", this.versions, this.chunks, async () => {
        const version = await this.requireStagingVersion(input.versionId, input.jobId);

        assertBatchOrdinal(version, input.batchOrdinal);
        assertChunkOrdinals(version, input.chunks);

        const chunkRecords = input.chunks.map((chunk): StorageChunkRecord => {
          const record: StorageChunkRecord = {
            versionId: input.versionId,
            ordinal: chunk.ordinal,
            jobId: input.jobId,
            batchOrdinal: input.batchOrdinal,
            html: chunk.html,
            pipelineVersion: chunk.pipelineVersion,
            sourceStart: chunk.sourceStart,
            sourceEnd: chunk.sourceEnd,
            estimatedCost: chunk.estimatedCost,
            headingIds: chunk.headingIds,
            blockAnchors: chunk.blockAnchors,
            renderState: chunk.renderState,
          };

          if (chunk.diagnosticCode !== undefined) {
            return { ...record, diagnosticCode: chunk.diagnosticCode };
          }

          return record;
        });

        await this.chunks.bulkAdd(chunkRecords);
        await this.failureHooks.afterChunksAdded?.({
          versionId: input.versionId,
          batchOrdinal: input.batchOrdinal,
        });

        const nextStagedChunkCount = version.stagedChunkCount + input.chunks.length;
        const lastChunk = input.chunks.at(-1);
        const lastStagedOrdinal = lastChunk?.ordinal ?? version.lastStagedOrdinal;

        await this.versions.update(version.id, {
          lastStagedOrdinal,
          nextBatchOrdinal: input.batchOrdinal + 1,
          stagedChunkCount: nextStagedChunkCount,
        });

        return { stagedChunkCount: nextStagedChunkCount };
      });

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async commitVersion(
    input: CommitStorageVersionInput,
  ): Promise<StorageSpikeResult<CommitStorageVersionResult>> {
    try {
      const value = await this.database.transaction(
        "rw",
        this.documents,
        this.versions,
        this.chunks,
        this.readerStates,
        async () => {
          const version = await this.requireStagingVersion(input.versionId, input.jobId);
          const stagedChunks = await this.loadChunks(version.id);

          assertCompleteReadyVersion(version, stagedChunks);

          const existingDocument = await this.documents.get(version.documentId);
          const expectedCurrentVersionId = version.expectedCurrentVersionId;

          if (expectedCurrentVersionId === undefined) {
            if (existingDocument !== undefined) {
              throwStorageError(
                "DOCUMENT_ALREADY_EXISTS",
                "New document commit cannot overwrite an existing document.",
              );
            }
          } else {
            if (existingDocument === undefined) {
              throwStorageError("DOCUMENT_NOT_FOUND", "Replacement target document is missing.");
            }

            if (existingDocument.currentVersionId !== expectedCurrentVersionId) {
              throwStorageError(
                "CURRENT_VERSION_CONFLICT",
                "Replacement expected-current precondition failed.",
              );
            }
          }

          await this.failureHooks.beforeCommitPointerSwitch?.({
            documentId: version.documentId,
            versionId: version.id,
          });

          const readyVersion = makeReadyVersion(version, input.readyAt);
          await this.versions.put(readyVersion);

          if (existingDocument === undefined) {
            await this.documents.add(createCommittedDocumentRecord(version, input.readyAt));
            await this.readerStates.add(createDefaultReaderState(version.documentId, input.readyAt));

            return {
              documentId: version.documentId,
              versionId: version.id,
            };
          }

          await this.documents.update(existingDocument.id, {
            currentVersionId: version.id,
            fileName: version.fileName,
            normalizedFileName: version.normalizedFileName,
            normalizedTitle: version.normalizedTitle,
            title: version.title,
            updatedAt: input.readyAt,
          });

          const existingReaderState = await this.readerStates.get(version.documentId);
          if (existingReaderState === undefined) {
            await this.readerStates.add(createDefaultReaderState(version.documentId, input.readyAt));
          }

          return {
            documentId: version.documentId,
            replacedVersionId: existingDocument.currentVersionId,
            versionId: version.id,
          };
        },
      );

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async abortVersion(jobId: string): Promise<StorageSpikeResult<CleanupResult>> {
    try {
      const value = await this.database.transaction("rw", this.versions, this.chunks, async () => {
        const stagingVersions = await this.versions
          .where("jobId")
          .equals(jobId)
          .and((version) => version.state === "staging")
          .toArray();
        return await this.removeVersions(stagingVersions.map((version) => version.id));
      });

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async cleanupAbandonedStaging(input: {
    readonly olderThan: number;
    readonly activeJobIds?: ReadonlySet<string>;
  }): Promise<StorageSpikeResult<CleanupResult>> {
    try {
      const value = await this.database.transaction("rw", this.versions, this.chunks, async () => {
        const activeJobIds = input.activeJobIds ?? new Set<string>();
        const stagingVersions = (await this.versions.where("state").equals("staging").toArray())
          .filter((version) => version.importedAt < input.olderThan)
          .filter((version) => !activeJobIds.has(version.jobId));

        return await this.removeVersions(stagingVersions.map((version) => version.id));
      });

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async cleanupReadyVersion(
    versionId: string,
  ): Promise<StorageSpikeResult<CleanupResult>> {
    try {
      const value = await this.database.transaction(
        "rw",
        this.documents,
        this.versions,
        this.chunks,
        async () => {
          const version = await this.versions.get(versionId);

          if (version === undefined) {
            return { removedChunkCount: 0, removedVersionIds: [] };
          }

          const document = await this.documents.get(version.documentId);
          if (document?.currentVersionId === versionId) {
            throwStorageError("VERSION_IS_CURRENT", "Cleanup cannot delete a current version.");
          }

          try {
            await this.failureHooks.beforeCleanupDelete?.({ versionId });
          } catch {
            throwStorageError("CLEANUP_FAILED", "Post-commit cleanup failed before deletion.");
          }

          return await this.removeVersions([versionId]);
        },
      );

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async listVisibleDocuments(): Promise<StorageSpikeResult<readonly VisibleStorageDocument[]>> {
    try {
      const value = await this.database.transaction("r", this.documents, this.versions, this.chunks, async () => {
        const documents = await this.documents.toArray();
        const visibleDocuments: VisibleStorageDocument[] = [];

        for (const document of documents) {
          const version = await this.versions.get(document.currentVersionId);
          if (version?.documentId !== document.id || version.state !== "ready") {
            continue;
          }

          const chunks = await this.loadChunks(version.id);
          if (!isCompleteReadyVersion(version, chunks)) {
            continue;
          }

          visibleDocuments.push({
            activityAt: document.lastOpenedAt ?? document.updatedAt,
            chunkCount: version.chunkCount,
            contentHash: version.contentHash,
            currentVersionId: version.id,
            documentId: document.id,
            fileName: document.fileName,
            title: document.title,
          });
        }

        return visibleDocuments.sort((left, right) => {
          if (left.activityAt !== right.activityAt) {
            return right.activityAt - left.activityAt;
          }

          return left.documentId.localeCompare(right.documentId);
        });
      });

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public observeVisibleDocuments(
    listener: (result: StorageSpikeResult<readonly VisibleStorageDocument[]>) => void,
  ): () => void {
    const subscription = liveQuery(async () => this.listVisibleDocuments()).subscribe({
      error: (error: unknown) => { listener(failed(mapStorageError(error))); },
      next: (result) => { listener(result); },
    });
    return () => { subscription.unsubscribe(); };
  }

  public async findCurrentReadyVersionByHash(
    contentHash: string,
  ): Promise<StorageSpikeResult<VisibleStorageDocument | undefined>> {
    try {
      const visible = unwrapStorageResult(await this.listVisibleDocuments());
      return succeeded(visible.find((document) => document.contentHash === contentHash));
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  /**
   * Reads only ready current versions. The exact branch uses the contentHash
   * index; title/filename candidates use their corresponding document indexes.
   */
  public async findReadyImportIdentityMatches(input: {
    readonly contentHash: string;
    readonly normalizedTitle: string;
    readonly normalizedFileName: string;
  }): Promise<StorageSpikeResult<ImportIdentityStorageMatches>> {
    try {
      if (!isLowercaseSha256(input.contentHash) || !isNonEmptyString(input.normalizedTitle) || !isNonEmptyString(input.normalizedFileName)) {
        throwStorageError("INVALID_VERSION_METADATA", "Import identity query is invalid.");
      }
      const value = await this.database.transaction("r", this.documents, this.versions, this.chunks, async () => {
        const exactVersions = await this.versions.where("contentHash").equals(input.contentHash).toArray();
        const exactIds = new Set<string>();
        const exactDuplicates: VisibleStorageDocument[] = [];
        for (const version of exactVersions) {
          const visible = await this.getVisibleDocument(version.documentId);
          if (visible?.currentVersionId === version.id && !exactIds.has(version.documentId)) {
            exactIds.add(version.documentId);
            exactDuplicates.push(visible);
          }
        }

        const titleMatches = await this.documents.where("normalizedTitle").equals(input.normalizedTitle).toArray();
        const fileNameMatches = await this.documents.where("normalizedFileName").equals(input.normalizedFileName).toArray();
        const candidateIds = new Set([...titleMatches, ...fileNameMatches].map((document) => document.id));
        const possibleUpdates: VisibleStorageDocument[] = [];
        for (const documentId of candidateIds) {
          if (exactIds.has(documentId)) continue;
          const visible = await this.getVisibleDocument(documentId);
          if (visible !== undefined) possibleUpdates.push(visible);
        }
        const sort = (left: VisibleStorageDocument, right: VisibleStorageDocument) => left.documentId.localeCompare(right.documentId);
        return { exactDuplicates: exactDuplicates.sort(sort), possibleUpdates: possibleUpdates.sort(sort) };
      });
      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async readCurrentSourceBlobForRebuild(
    documentId: string,
  ): Promise<StorageSpikeResult<SourceBlobRecoveryResult>> {
    try {
      const value = await this.database.transaction("r", this.documents, this.versions, async () => {
        const document = await this.documents.get(documentId);
        if (document === undefined) {
          throwStorageError("DOCUMENT_NOT_FOUND", "Document is missing.");
        }

        const version = await this.versions.get(document.currentVersionId);
        if (version?.state !== "ready") {
          throwStorageError("VERSION_NOT_FOUND", "Current ready version is missing.");
        }

        const sourceBlob = recoverSourceBlob(version);

        if (sourceBlob === undefined) {
          throwStorageError("INVALID_VERSION_METADATA", "Current version source blob is invalid.");
        }

        return {
          documentId,
          fileName: version.fileName,
          pipelineVersion: version.pipelineVersion,
          sourceBlob,
          versionId: version.id,
        };
      });

      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async getCurrentReadyVersion(
    documentId: string,
  ): Promise<StorageSpikeResult<StorageDocumentVersionRecord>> {
    try {
      const value = await this.database.transaction("r", this.documents, this.versions, async () => {
        const document = await this.documents.get(documentId);
        if (document === undefined) {
          throwStorageError("DOCUMENT_NOT_FOUND", "Document is missing.");
        }
        const version = await this.versions.get(document.currentVersionId);
        if (version?.documentId !== documentId || version.state !== "ready") {
          throwStorageError("VERSION_NOT_FOUND", "Current ready version is missing.");
        }
        return version;
      });
      return succeeded(value);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async getVersion(
    versionId: string,
  ): Promise<StorageSpikeResult<StorageDocumentVersionRecord | undefined>> {
    try {
      return succeeded(await this.versions.get(versionId));
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async getChunks(
    versionId: string,
  ): Promise<StorageSpikeResult<readonly StorageChunkRecord[]>> {
    try {
      return succeeded(await this.loadChunks(versionId));
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async getChunkRange(
    versionId: string,
    startOrdinal: number,
    endOrdinalInclusive: number,
  ): Promise<StorageSpikeResult<readonly StorageChunkRecord[]>> {
    try {
      if (
        !isNonEmptyString(versionId) ||
        !isSafeNonNegativeInteger(startOrdinal) ||
        !isSafeNonNegativeInteger(endOrdinalInclusive) ||
        endOrdinalInclusive < startOrdinal
      ) {
        throwStorageError("INVALID_VERSION_METADATA", "Chunk range is invalid.");
      }

      return succeeded(
        await this.chunks
          .where("[versionId+ordinal]")
          .between(
            [versionId, startOrdinal],
            [versionId, endOrdinalInclusive],
            true,
            true,
          )
          .sortBy("ordinal"),
      );
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  /**
   * These narrow accessors are used by the production repository adapter. They
   * intentionally return records only inside infrastructure, where the adapter
   * validates and maps them before they can reach a feature.
   */
  public async getReaderState(
    documentId: string,
  ): Promise<StorageSpikeResult<StorageReaderStateRecord | undefined>> {
    try {
      return succeeded(await this.readerStates.get(documentId));
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async saveReaderAnchor(input: {
    readonly documentId: string;
    readonly anchor: StorageSemanticAnchor;
    readonly progressRatio: number;
    readonly updatedAt: number;
  }): Promise<StorageSpikeResult<void>> {
    try {
      if (!isNonEmptyString(input.documentId) || !isStorageSemanticAnchor(input.anchor) || !isRatio(input.progressRatio) || !isSafeNonNegativeInteger(input.updatedAt)) {
        throwStorageError("INVALID_VERSION_METADATA", "Reader anchor update is invalid.");
      }
      await this.database.transaction("rw", this.readerStates, async () => {
        const state = await this.readerStates.get(input.documentId);
        if (state === undefined) {
          throwStorageError("DOCUMENT_NOT_FOUND", "Reader state document is missing.");
        }
        await this.readerStates.put({ ...state, anchor: input.anchor, progressRatio: input.progressRatio, updatedAt: input.updatedAt });
      });
      return succeeded(undefined);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async findChunkOrdinalByBlockId(versionId: string, blockId: string): Promise<StorageSpikeResult<number | undefined>> {
    try {
      if (!isNonEmptyString(versionId) || !isNonEmptyString(blockId)) {
        throwStorageError("INVALID_VERSION_METADATA", "Reader anchor lookup is invalid.");
      }
      const chunk = await this.chunks.where("versionId").equals(versionId).filter((record) => record.blockAnchors.some((anchor) => anchor.blockId === blockId)).first();
      return succeeded(chunk?.ordinal);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async getPreferences(): Promise<StorageSpikeResult<StoragePreferencesRecord>> {
    try {
      const value = await this.preferences.get("app");
      return succeeded(
        value ?? {
          desktopTocCollapsed: false,
          key: "app",
          remoteImagesEnabled: true,
          theme: "system",
          updatedAt: 0,
        },
      );
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  public async saveTheme(
    theme: StoragePreferencesRecord["theme"],
    updatedAt: number,
  ): Promise<StorageSpikeResult<void>> {
    try {
      if (!isSafeNonNegativeInteger(updatedAt)) {
        throwStorageError("INVALID_VERSION_METADATA", "Preference update time is invalid.");
      }

      await this.database.transaction("rw", this.preferences, async () => {
        const current = await this.preferences.get("app");
        await this.preferences.put({
          desktopTocCollapsed: current?.desktopTocCollapsed ?? false,
          key: "app",
          remoteImagesEnabled: current?.remoteImagesEnabled ?? true,
          theme,
          updatedAt,
        });
      });
      return succeeded(undefined);
    } catch (error) {
      return failed(mapStorageError(error));
    }
  }

  private get documents(): Table<StorageDocumentRecord, string> {
    return this.database.table<StorageDocumentRecord, string>("documents");
  }

  private get versions(): Table<StorageDocumentVersionRecord, string> {
    return this.database.table<StorageDocumentVersionRecord, string>("documentVersions");
  }

  private get chunks(): Table<StorageChunkRecord, [string, number]> {
    return this.database.table<StorageChunkRecord, [string, number]>("chunks");
  }

  private get readerStates(): Table<StorageReaderStateRecord, string> {
    return this.database.table<StorageReaderStateRecord, string>("readerStates");
  }

  private get preferences(): Table<StoragePreferencesRecord, "app"> {
    return this.database.table<StoragePreferencesRecord, "app">("preferences");
  }

  private async requireStagingVersion(
    versionId: string,
    jobId: string,
  ): Promise<StorageDocumentVersionRecord> {
    const version = await this.versions.get(versionId);

    if (version === undefined) {
      throwStorageError("VERSION_NOT_FOUND", "Staging version is missing.");
    }

    if (version.state !== "staging") {
      throwStorageError("VERSION_NOT_STAGING", "Version is not staging.");
    }

    if (version.jobId !== jobId) {
      throwStorageError("JOB_MISMATCH", "Job id does not own the staging version.");
    }

    return version;
  }

  private async loadChunks(versionId: string): Promise<readonly StorageChunkRecord[]> {
    const chunks = await this.chunks.where("versionId").equals(versionId).sortBy("ordinal");
    return chunks;
  }

  private async getVisibleDocument(documentId: string): Promise<VisibleStorageDocument | undefined> {
    const document = await this.documents.get(documentId);
    if (document === undefined) return undefined;
    const version = await this.versions.get(document.currentVersionId);
    if (version?.documentId !== document.id || version.state !== "ready") return undefined;
    const chunks = await this.loadChunks(version.id);
    if (!isCompleteReadyVersion(version, chunks)) return undefined;
    return {
      activityAt: document.lastOpenedAt ?? document.updatedAt,
      chunkCount: version.chunkCount,
      contentHash: version.contentHash,
      currentVersionId: version.id,
      documentId: document.id,
      fileName: document.fileName,
      title: document.title,
    };
  }

  private async removeVersions(versionIds: readonly string[]): Promise<CleanupResult> {
    let removedChunkCount = 0;

    for (const versionId of versionIds) {
      const chunkKeys = await this.chunks
        .where("versionId")
        .equals(versionId)
        .primaryKeys();
      removedChunkCount += chunkKeys.length;
      await this.chunks.bulkDelete(chunkKeys);
      await this.versions.delete(versionId);
    }

    return {
      removedChunkCount,
      removedVersionIds: versionIds,
    };
  }
}

export function createStorageAtomicitySpikeDatabase(databaseName: string): Dexie {
  const database = new Dexie(databaseName);

  database.version(1).stores({
    chunks: "[versionId+ordinal], versionId, [versionId+sourceStart]",
    documentVersions:
      "id, documentId, state, contentHash, [documentId+state], jobId, importedAt",
    documents: "id, normalizedTitle, normalizedFileName, lastOpenedAt, updatedAt",
    preferences: "key",
    readerStates: "documentId, updatedAt",
  });

  database
    .version(2)
    .stores({
      chunks: "[versionId+ordinal], versionId, [versionId+sourceStart], jobId, batchOrdinal",
      documentVersions:
        "id, documentId, state, contentHash, [documentId+state], jobId, importedAt",
      documents: "id, normalizedTitle, normalizedFileName, lastOpenedAt, updatedAt",
      preferences: "key",
      readerStates: "documentId, updatedAt",
    })
    .upgrade(async (transaction) => {
      try {
        await transaction
          .table<StorageDocumentVersionRecord, string>("documentVersions")
          .toCollection()
          .modify((record) => {
            if (!isSafeNonNegativeInteger(record.pipelineVersion)) {
              record.pipelineVersion = 0;
            }

            if (!hasCompleteLayouts(record.layouts, record.chunkCount)) {
              record.layouts = createSingleSectionLayouts(record.chunkCount);
            }

            if (!isSafeNonNegativeInteger(record.nextBatchOrdinal)) {
              record.nextBatchOrdinal = 0;
            }

            if (!isSafeNonNegativeInteger(record.stagedChunkCount)) {
              record.stagedChunkCount = record.state === "ready" ? record.chunkCount : 0;
            }

            if (!Number.isSafeInteger(record.lastStagedOrdinal)) {
              record.lastStagedOrdinal =
                record.state === "ready" && record.chunkCount > 0 ? record.chunkCount - 1 : -1;
            }

            if (record.state === "ready" && record.readyAt === undefined) {
              record.readyAt = record.importedAt;
            }
          });

        await transaction
          .table<StorageChunkRecord, [string, number]>("chunks")
          .toCollection()
          .modify((record) => {
            if (!isSafeNonNegativeInteger(record.pipelineVersion)) {
              record.pipelineVersion = 0;
            }

            if (typeof record.jobId !== "string") {
              record.jobId = "legacy-migration";
            }

            if (!isSafeNonNegativeInteger(record.batchOrdinal)) {
              record.batchOrdinal = 0;
            }
          });
      } catch (error) {
        throw new StorageSpikeOperationError({
          code: "MIGRATION_FAILED",
          message: error instanceof Error ? error.message : "Storage migration failed.",
        });
      }
    });

  database
    .version(STORAGE_ATOMICITY_SPIKE_DB_SCHEMA_VERSION)
    .stores({
      chunks: "[versionId+ordinal], versionId, [versionId+sourceStart], jobId, batchOrdinal",
      documentVersions:
        "id, documentId, state, contentHash, [documentId+state], jobId, importedAt",
      documents: "id, normalizedTitle, normalizedFileName, lastOpenedAt, updatedAt",
      preferences: "key",
      readerStates: "documentId, updatedAt",
    })
    .upgrade(async (transaction) => {
      try {
        await transaction.table<StorageReaderStateRecord, string>("readerStates").toCollection().modify((record) => {
          if (record.anchor !== undefined && !isStorageSemanticAnchor(record.anchor)) {
            delete record.anchor;
          }
        });
      } catch (error) {
        throw new StorageSpikeOperationError({
          code: "MIGRATION_FAILED",
          message: error instanceof Error ? error.message : "Reader-state migration failed.",
        });
      }
    });

  return database;
}

export async function deleteStorageAtomicitySpikeDatabase(databaseName: string): Promise<void> {
  await Dexie.delete(databaseName);
}

export async function seedStorageAtomicityLegacyV1Database(input: {
  readonly databaseName: string;
  readonly document: StorageDocumentRecord;
  readonly version: Omit<
    StorageDocumentVersionRecord,
    "pipelineVersion" | "nextBatchOrdinal" | "stagedChunkCount" | "lastStagedOrdinal"
  >;
  readonly chunks: readonly Omit<StorageChunkRecord, "pipelineVersion" | "jobId" | "batchOrdinal">[];
}): Promise<void> {
  const database = new Dexie(input.databaseName);
  database.version(1).stores({
    chunks: "[versionId+ordinal], versionId, [versionId+sourceStart]",
    documentVersions:
      "id, documentId, state, contentHash, [documentId+state], jobId, importedAt",
    documents: "id, normalizedTitle, normalizedFileName, lastOpenedAt, updatedAt",
    preferences: "key",
    readerStates: "documentId, updatedAt",
  });

  const documents = database.table<StorageDocumentRecord, string>("documents");
  const versions = database.table<typeof input.version, string>("documentVersions");
  const chunks = database.table<(typeof input.chunks)[number], [string, number]>("chunks");

  await database.open();

  try {
    await database.transaction("rw", documents, versions, chunks, async () => {
      await documents.add(input.document);
      await versions.add(input.version);
      await chunks.bulkAdd(input.chunks);
    });
  } finally {
    database.close();
  }
}

export function createSingleSectionLayouts(chunkCount: number): Record<SplitStrategy, SectionLayout> {
  const sections: readonly SectionRef[] =
    chunkCount > 0
      ? [
          {
            estimatedCost: chunkCount,
            endChunkOrdinalInclusive: chunkCount - 1,
            id: "section-1",
            startChunkOrdinal: 0,
            title: "Document",
          },
        ]
      : [];
  const createLayout = (strategy: SplitStrategy): SectionLayout => ({
    safeForSelection: true,
    sectionIds: sections.map((section) => section.id),
    sections,
    strategy,
  });

  return {
    auto: createLayout("auto"),
    h1: createLayout("h1"),
    h2: createLayout("h2"),
    h3: createLayout("h3"),
    whole: createLayout("whole"),
  };
}

function createStagingVersionRecord(
  input: StageStorageVersionInput,
): StorageDocumentVersionRecord {
  const record: StorageDocumentVersionRecord = {
    byteLength: input.byteLength,
    charLength: input.charLength,
    chunkCount: input.chunkCount,
    contentHash: input.contentHash,
    documentId: input.documentId,
    encoding: "utf-8",
    fileName: input.fileName,
    id: input.versionId,
    importedAt: input.importedAt,
    jobId: input.jobId,
    lastStagedOrdinal: -1,
    layouts: input.layouts,
    nextBatchOrdinal: 0,
    normalizedFileName: input.normalizedFileName,
    normalizedTitle: input.normalizedTitle,
    outline: input.outline,
    pipelineVersion: input.pipelineVersion,
    sourceBlob: input.sourceBlob,
    stagedChunkCount: 0,
    state: "staging",
    title: input.title,
  };

  if (input.expectedCurrentVersionId !== undefined) {
    return { ...record, expectedCurrentVersionId: input.expectedCurrentVersionId };
  }

  return record;
}

function makeReadyVersion(
  version: StorageDocumentVersionRecord,
  readyAt: number,
): StorageDocumentVersionRecord {
  return {
    ...version,
    readyAt,
    state: "ready",
  };
}

function createCommittedDocumentRecord(
  version: StorageDocumentVersionRecord,
  now: number,
): StorageDocumentRecord {
  return {
    createdAt: now,
    currentVersionId: version.id,
    fileName: version.fileName,
    id: version.documentId,
    normalizedFileName: version.normalizedFileName,
    normalizedTitle: version.normalizedTitle,
    title: version.title,
    updatedAt: now,
  };
}

function createDefaultReaderState(
  documentId: string,
  now: number,
): StorageReaderStateRecord {
  return {
    documentId,
    modeOrigin: "auto",
    progressRatio: 0,
    readingMode: "continuous",
    splitStrategy: "auto",
    updatedAt: now,
  };
}

function isStorageSemanticAnchor(value: unknown): value is StorageSemanticAnchor {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.versionId) && isNonEmptyString(record.headingPathKey) && isNonEmptyString(record.blockId)
    && isSafeNonNegativeInteger(record.blockOrdinalWithinHeading) && isRatio(record.intraBlockRatio) && isRatio(record.overallSourceRatio);
}

function isRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function assertStageInput(input: StageStorageVersionInput): void {
  if (!isNonEmptyString(input.documentId) || !isNonEmptyString(input.versionId)) {
    throwStorageError("INVALID_VERSION_METADATA", "Document and version ids are required.");
  }

  if (!isNonEmptyString(input.jobId)) {
    throwStorageError("INVALID_VERSION_METADATA", "Job id is required.");
  }

  if (!isLowercaseSha256(input.contentHash)) {
    throwStorageError("INVALID_VERSION_METADATA", "Content hash must be lowercase SHA-256 hex.");
  }

  if (
    !isSafeNonNegativeInteger(input.byteLength) ||
    !isSafeNonNegativeInteger(input.charLength) ||
    !isSafeNonNegativeInteger(input.chunkCount) ||
    !isSafeNonNegativeInteger(input.pipelineVersion) ||
    !isSafeNonNegativeInteger(input.importedAt)
  ) {
    throwStorageError("INVALID_VERSION_METADATA", "Numeric version metadata is invalid.");
  }

  if (!isBlobLike(input.sourceBlob)) {
    throwStorageError("INVALID_VERSION_METADATA", "Source blob is invalid.");
  }

  if (!hasCompleteLayouts(input.layouts, input.chunkCount)) {
    throwStorageError("INVALID_LAYOUT", "Layouts must cover all chunks.");
  }
}

function assertAppendInput(input: AppendStorageChunkBatchInput): void {
  if (!isNonEmptyString(input.versionId) || !isNonEmptyString(input.jobId)) {
    throwStorageError("INVALID_VERSION_METADATA", "Version and job ids are required.");
  }

  if (!isSafeNonNegativeInteger(input.batchOrdinal)) {
    throwStorageError("OUT_OF_ORDER_BATCH", "Batch ordinal must be a safe non-negative integer.");
  }
}

function assertBatchOrdinal(version: StorageDocumentVersionRecord, batchOrdinal: number): void {
  if (batchOrdinal < version.nextBatchOrdinal) {
    throwStorageError("DUPLICATE_BATCH", "Batch ordinal was already staged.");
  }

  if (batchOrdinal > version.nextBatchOrdinal) {
    throwStorageError("OUT_OF_ORDER_BATCH", "Batch ordinal skipped the next expected batch.");
  }
}

function assertChunkOrdinals(
  version: StorageDocumentVersionRecord,
  chunks: readonly PersistablePipelineChunk[],
): void {
  const seen = new Set<number>();
  let previousOrdinal = version.lastStagedOrdinal;
  let previousSourceEnd: number | undefined;

  for (const chunk of chunks) {
    if (seen.has(chunk.ordinal) || chunk.ordinal <= version.lastStagedOrdinal) {
      throwStorageError("DUPLICATE_CHUNK_ORDINAL", "Chunk ordinal was already staged.");
    }

    if (chunk.ordinal !== previousOrdinal + 1) {
      throwStorageError("OUT_OF_ORDER_CHUNK", "Chunk ordinals must be contiguous within staging.");
    }

    if (chunk.ordinal >= version.chunkCount) {
      throwStorageError("CHUNK_COUNT_MISMATCH", "Chunk ordinal exceeds expected chunk count.");
    }

    if (!isValidChunkRange(chunk.sourceStart, chunk.sourceEnd, previousSourceEnd)) {
      throwStorageError("INVALID_CHUNK_RANGE", "Chunk source ranges must be ordered.");
    }

    if (chunk.pipelineVersion !== version.pipelineVersion) {
      throwStorageError(
        "PIPELINE_VERSION_MISMATCH",
        "Chunk pipeline version must match staging version.",
      );
    }

    seen.add(chunk.ordinal);
    previousOrdinal = chunk.ordinal;
    previousSourceEnd = chunk.sourceEnd;
  }
}

function assertCompleteReadyVersion(
  version: StorageDocumentVersionRecord,
  chunks: readonly StorageChunkRecord[],
): void {
  const validationError = validateReadyVersion(version, chunks);

  if (validationError !== undefined) {
    throwStorageError(validationError.code, validationError.message);
  }
}

function isCompleteReadyVersion(
  version: StorageDocumentVersionRecord,
  chunks: readonly StorageChunkRecord[],
): boolean {
  return validateReadyVersion(version, chunks) === undefined;
}

function validateReadyVersion(
  version: StorageDocumentVersionRecord,
  chunks: readonly StorageChunkRecord[],
): StorageSpikeError | undefined {
  if (chunks.length < version.chunkCount || version.stagedChunkCount < version.chunkCount) {
    return {
      code: "MISSING_CHUNK_RANGE",
      message: "Version has fewer chunks than expected.",
    };
  }

  if (version.chunkCount !== chunks.length || version.stagedChunkCount !== version.chunkCount) {
    return {
      code: "CHUNK_COUNT_MISMATCH",
      message: "Staged chunks do not match expected chunk count.",
    };
  }

  if (!hasCompleteLayouts(version.layouts, version.chunkCount)) {
    return {
      code: "INVALID_LAYOUT",
      message: "Version layouts do not cover all chunks.",
    };
  }

  let previousSourceEnd: number | undefined;

  for (let index = 0; index < version.chunkCount; index += 1) {
    const chunk = chunks[index];

    if (chunk?.ordinal !== index) {
      return {
        code: "MISSING_CHUNK_RANGE",
        message: "Version has missing or non-contiguous chunks.",
      };
    }

    if (chunk.versionId !== version.id) {
      return {
        code: "INVALID_CHUNK_RANGE",
        message: "Chunk belongs to another version.",
      };
    }

    if (!isValidChunkRange(chunk.sourceStart, chunk.sourceEnd, previousSourceEnd)) {
      return {
        code: "INVALID_CHUNK_RANGE",
        message: "Chunk source ranges overlap or are invalid.",
      };
    }

    if (chunk.pipelineVersion !== version.pipelineVersion) {
      return {
        code: "PIPELINE_VERSION_MISMATCH",
        message: "Chunk pipeline version differs from version metadata.",
      };
    }

    previousSourceEnd = chunk.sourceEnd;
  }

  return undefined;
}

function hasCompleteLayouts(
  layouts: unknown,
  chunkCount: unknown,
): layouts is Record<SplitStrategy, SectionLayout> {
  if (!isSafeNonNegativeInteger(chunkCount) || typeof layouts !== "object" || layouts === null) {
    return false;
  }

  const layoutRecord = layouts as Partial<Record<SplitStrategy, unknown>>;

  return splitStrategies.every((strategy) => {
    const layout = layoutRecord[strategy];

    if (!isSectionLayout(layout, strategy)) {
      return false;
    }

    if (chunkCount === 0) {
      return layout.sections.length === 0;
    }

    if (layout.sections.length === 0) {
      return false;
    }

    let nextChunkOrdinal = 0;
    const sectionIds = new Set<string>();

    for (const section of layout.sections) {
      if (sectionIds.has(section.id) || !layout.sectionIds.includes(section.id)) {
        return false;
      }

      if (
        section.startChunkOrdinal !== nextChunkOrdinal ||
        section.startChunkOrdinal > section.endChunkOrdinalInclusive ||
        section.endChunkOrdinalInclusive >= chunkCount
      ) {
        return false;
      }

      sectionIds.add(section.id);
      nextChunkOrdinal = section.endChunkOrdinalInclusive + 1;
    }

    return nextChunkOrdinal === chunkCount;
  });
}

function isSectionLayout(value: unknown, strategy: SplitStrategy): value is SectionLayout {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SectionLayout>;

  return (
    candidate.strategy === strategy &&
    typeof candidate.safeForSelection === "boolean" &&
    Array.isArray(candidate.sectionIds) &&
    candidate.sectionIds.every((sectionId) => typeof sectionId === "string") &&
    Array.isArray(candidate.sections) &&
    candidate.sections.every(isSectionRef)
  );
}

function isSectionRef(value: unknown): value is SectionRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SectionRef>;

  return (
    typeof candidate.id === "string" &&
    isSafeNonNegativeInteger(candidate.startChunkOrdinal) &&
    isSafeNonNegativeInteger(candidate.endChunkOrdinalInclusive) &&
    typeof candidate.estimatedCost === "number" &&
    Number.isFinite(candidate.estimatedCost)
  );
}

function isValidChunkRange(
  sourceStart: number,
  sourceEnd: number,
  previousSourceEnd: number | undefined,
): boolean {
  if (!isSafeNonNegativeInteger(sourceStart) || !isSafeNonNegativeInteger(sourceEnd)) {
    return false;
  }

  if (sourceEnd < sourceStart) {
    return false;
  }

  return previousSourceEnd === undefined || sourceStart >= previousSourceEnd;
}

function isLowercaseSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isBlobLike(value: unknown): value is Blob {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeBlob = value as Record<string, unknown>;
  return typeof maybeBlob.size === "number" && typeof maybeBlob.arrayBuffer === "function";
}

function recoverSourceBlob(version: StorageDocumentVersionRecord): Blob | undefined {
  if (isBlobLike(version.sourceBlob)) {
    return version.sourceBlob;
  }

  const sourceBytes = recoverSourceBytes(version.sourceBytes);

  if (sourceBytes !== undefined) {
    return new Blob([toOwnedArrayBuffer(sourceBytes)], {
      type: "text/markdown;charset=utf-8",
    });
  }

  return undefined;
}

function recoverSourceBytes(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  if (
    !value.every(
      (byte) => typeof byte === "number" && Number.isInteger(byte) && byte >= 0 && byte <= 255,
    )
  ) {
    return undefined;
  }

  return new Uint8Array(value);
}

function toOwnedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function succeeded<T>(value: T): StorageSpikeResult<T> {
  return { ok: true, value };
}

function failed(error: StorageSpikeError): StorageSpikeResult<never> {
  return { error, ok: false };
}

function unwrapStorageResult<T>(result: StorageSpikeResult<T>): T {
  if (result.ok) {
    return result.value;
  }

  throw new StorageSpikeOperationError(result.error);
}

function throwStorageError(code: StorageSpikeErrorCode, message: string): never {
  throw new StorageSpikeOperationError({ code, message });
}

class StorageSpikeOperationError extends Error {
  public readonly storageError: StorageSpikeError;

  public constructor(storageError: StorageSpikeError) {
    super(storageError.message);
    this.name = "StorageSpikeOperationError";
    this.storageError = storageError;
  }
}

function mapStorageError(error: unknown): StorageSpikeError {
  if (error instanceof StorageSpikeOperationError) {
    return error.storageError;
  }

  const name = getErrorName(error);

  if (name === "QuotaExceededError") {
    return {
      code: "QUOTA_EXCEEDED",
      message: "IndexedDB quota-like failure rolled back the active transaction.",
    };
  }

  if (name === "ConstraintError") {
    return {
      code: "DUPLICATE_CHUNK_ORDINAL",
      message: "IndexedDB rejected a duplicate primary key.",
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_STORAGE_ERROR",
      message: error.message,
    };
  }

  return {
    code: "UNKNOWN_STORAGE_ERROR",
    message: "Unknown storage error.",
  };
}

function getErrorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }

  const maybeName = (error as Record<"name", unknown>).name;
  return typeof maybeName === "string" ? maybeName : undefined;
}
