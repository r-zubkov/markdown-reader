import type {
  AppPreferencesSnapshot,
  CurrentDocumentSnapshot,
  DocumentRepository,
  DocumentSummary,
  ReaderChunk,
  ReaderStateSnapshot,
  RepositoryErrorCode,
  RepositoryResult,
  SanitizedHtml,
  SemanticAnchorSnapshot,
  StageDocumentVersionInput,
} from "@/application/ports/document-repository";
import {
  StorageAtomicitySpikeRepository,
  type StorageSpikeResult,
} from "@/infrastructure/db/storage-atomicity-spike";

export const DB_SCHEMA_VERSION = 3;
export const PIPELINE_VERSION = 3;
export const MARKDOWN_READER_DATABASE_NAME = "markdown-reader";

/** The sole production persistence adapter. Feature code only sees DocumentRepository. */
export class DexieDocumentRepository implements DocumentRepository {
  private readonly storage: StorageAtomicitySpikeRepository;

  public constructor(databaseName = MARKDOWN_READER_DATABASE_NAME) {
    this.storage = new StorageAtomicitySpikeRepository(databaseName);
  }

  public close(): void { this.storage.close(); }

  public async stageVersion(input: StageDocumentVersionInput): Promise<RepositoryResult<void>> {
    return discard(await this.storage.stageVersion(input));
  }

  public async appendChunkBatch(input: Parameters<DocumentRepository["appendChunkBatch"]>[0]): Promise<RepositoryResult<void>> {
    return discard(await this.storage.appendChunkBatch(input));
  }

  public async commitVersion(input: Parameters<DocumentRepository["commitVersion"]>[0]): Promise<RepositoryResult<{ readonly documentId: string; readonly versionId: string }>> {
    const result = await this.storage.commitVersion(input);
    if (!result.ok) return failure(result.error.code);
    return success({ documentId: result.value.documentId, versionId: result.value.versionId });
  }

  public async abortVersion(jobId: string): Promise<RepositoryResult<void>> { return discard(await this.storage.abortVersion(jobId)); }

  public async cleanupAbandonedStaging(input: Parameters<DocumentRepository["cleanupAbandonedStaging"]>[0]): Promise<RepositoryResult<void>> {
    return discard(await this.storage.cleanupAbandonedStaging(input));
  }

  public async listDocuments(): Promise<RepositoryResult<readonly DocumentSummary[]>> {
    const result = await this.storage.listVisibleDocuments();
    if (!result.ok) return failure(result.error.code);
    const summaries = result.value.filter(isDocumentSummary);
    return summaries.length === result.value.length ? success(summaries) : failure("INVALID_PERSISTED_RECORD");
  }

  public observeDocuments(listener: (result: RepositoryResult<readonly DocumentSummary[]>) => void): () => void {
    return this.storage.observeVisibleDocuments((result) => {
      if (!result.ok) { listener(failure(result.error.code)); return; }
      const summaries = result.value.filter(isDocumentSummary);
      listener(summaries.length === result.value.length ? success(summaries) : failure("INVALID_PERSISTED_RECORD"));
    });
  }

  public async getCurrentDocument(documentId: string): Promise<RepositoryResult<CurrentDocumentSnapshot>> {
    const version = await this.storage.getCurrentReadyVersion(documentId);
    if (!version.ok) return failure(version.error.code);
    const current = version.value;
    if (current.pipelineVersion !== PIPELINE_VERSION) return failure("STALE_DERIVED");
    if (!nonEmpty(current.documentId) || !nonEmpty(current.id) || !nonEmpty(current.title) || !nonNegative(current.chunkCount) || !nonNegative(current.pipelineVersion)) {
      return failure("INVALID_PERSISTED_RECORD");
    }
    return success({ documentId: current.documentId, versionId: current.id, title: current.title, chunkCount: current.chunkCount, pipelineVersion: current.pipelineVersion });
  }

  public async getCurrentChunkWindow(input: Parameters<DocumentRepository["getCurrentChunkWindow"]>[0]): Promise<RepositoryResult<readonly ReaderChunk[]>> {
    const version = await this.storage.getCurrentReadyVersion(input.documentId);
    if (!version.ok) return failure(version.error.code);
    if (input.pipelineVersion !== PIPELINE_VERSION || version.value.pipelineVersion !== PIPELINE_VERSION) return failure("STALE_DERIVED");
    const chunks = await this.storage.getChunks(version.value.id);
    if (!chunks.ok) return failure(chunks.error.code);
    const selected = chunks.value.filter((chunk) => chunk.ordinal >= input.startOrdinal && chunk.ordinal <= input.endOrdinalInclusive);
    if (!isChunkWindow(selected, input)) return failure("INVALID_PERSISTED_RECORD");
    return success(selected.map((chunk) => ({
      anchors: chunk.blockAnchors.map((anchor) => ({
        blockId: anchor.blockId,
        blockOrdinalWithinHeading: anchor.blockOrdinalWithinHeading,
        headingPathKey: anchor.headingPathKey,
        intraBlockRatio: 0,
        overallSourceRatio: version.value.chunkCount <= 1 ? 0 : chunk.ordinal / (version.value.chunkCount - 1),
        versionId: version.value.id,
      })),
      html: makeSanitizedHtml(chunk.html, chunk.pipelineVersion),
      ordinal: chunk.ordinal,
    })));
  }

  public async resolveCurrentAnchor(input: Parameters<DocumentRepository["resolveCurrentAnchor"]>[0]): Promise<RepositoryResult<number | undefined>> {
    const version = await this.storage.getCurrentReadyVersion(input.documentId);
    if (!version.ok) return failure(version.error.code);
    if (input.anchor.versionId !== version.value.id || !isSemanticAnchor(input.anchor)) return success(undefined);
    const result = await this.storage.findChunkOrdinalByBlockId(version.value.id, input.anchor.blockId);
    return result.ok ? success(result.value) : failure(result.error.code);
  }

  public async getReaderState(documentId: string): Promise<RepositoryResult<ReaderStateSnapshot | undefined>> {
    const result = await this.storage.getReaderState(documentId);
    if (!result.ok) return failure(result.error.code);
    const record: unknown = result.value;
    return record === undefined || isReaderState(record) ? success(record) : failure("INVALID_PERSISTED_RECORD");
  }

  public async saveReaderAnchor(input: Parameters<DocumentRepository["saveReaderAnchor"]>[0]): Promise<RepositoryResult<void>> {
    if (!isSemanticAnchor(input.anchor) || !ratio(input.progressRatio) || !nonNegative(input.updatedAt)) return failure("INVALID_PERSISTED_RECORD");
    return discard(await this.storage.saveReaderAnchor(input));
  }

  public async getPreferences(): Promise<RepositoryResult<AppPreferencesSnapshot>> {
    const result = await this.storage.getPreferences();
    if (!result.ok) return failure(result.error.code);
    const record: unknown = result.value;
    return isPreferences(record) ? success(record) : failure("INVALID_PERSISTED_RECORD");
  }

  public async saveTheme(theme: AppPreferencesSnapshot["theme"], updatedAt: number): Promise<RepositoryResult<void>> {
    return discard(await this.storage.saveTheme(theme, updatedAt));
  }
}

function discard<T>(result: StorageSpikeResult<T>): RepositoryResult<void> {
  return result.ok ? success(undefined) : failure(result.error.code);
}
function success<T>(value: T): RepositoryResult<T> { return { ok: true, value }; }
function failure(storageCode: string): RepositoryResult<never> {
  const code: RepositoryErrorCode = isRepositoryErrorCode(storageCode) ? storageCode : storageCode === "QUOTA_EXCEEDED" ? "QUOTA_EXCEEDED" : storageCode === "MIGRATION_FAILED" ? "MIGRATION_FAILED" : storageCode === "DOCUMENT_NOT_FOUND" ? "DOCUMENT_NOT_FOUND" : storageCode === "CURRENT_VERSION_CONFLICT" ? "COMMIT_CONFLICT" : "UNKNOWN_STORAGE_ERROR";
  return { ok: false, error: { code } };
}
function isRepositoryErrorCode(value: string): value is RepositoryErrorCode { return ["DB_UNAVAILABLE", "MIGRATION_FAILED", "STALE_DERIVED", "QUOTA_EXCEEDED", "COMMIT_CONFLICT", "DOCUMENT_NOT_FOUND", "INVALID_PERSISTED_RECORD", "UNKNOWN_STORAGE_ERROR"].includes(value); }
function isDocumentSummary(value: DocumentSummary): boolean {
  return nonEmpty(value.documentId) && nonEmpty(value.currentVersionId) && nonEmpty(value.title) && nonEmpty(value.fileName) && hash(value.contentHash) && nonNegative(value.activityAt) && nonNegative(value.chunkCount);
}
function isChunkWindow(chunks: readonly { readonly ordinal: number; readonly html: string; readonly pipelineVersion: number; readonly sourceStart: number; readonly sourceEnd: number; readonly blockAnchors: readonly unknown[]; }[], input: { readonly startOrdinal: number; readonly endOrdinalInclusive: number; readonly pipelineVersion: number }): boolean {
  if (!nonNegative(input.startOrdinal) || !nonNegative(input.endOrdinalInclusive) || input.endOrdinalInclusive < input.startOrdinal) return false;
  if (chunks.length !== input.endOrdinalInclusive - input.startOrdinal + 1) return false;
  let expectedOrdinal = input.startOrdinal;
  let previousEnd = -1;
  return chunks.every((chunk) => {
    const valid = chunk.ordinal === expectedOrdinal && typeof chunk.html === "string" && chunk.pipelineVersion === input.pipelineVersion && nonNegative(chunk.sourceStart) && nonNegative(chunk.sourceEnd) && chunk.sourceEnd >= chunk.sourceStart && chunk.sourceStart >= previousEnd && chunk.blockAnchors.every(isBlockAnchor);
    expectedOrdinal += 1; previousEnd = chunk.sourceEnd; return valid;
  });
}
function isBlockAnchor(value: unknown): value is { readonly blockId: string; readonly blockOrdinalWithinHeading: number; readonly headingPathKey: string } { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.blockId) && nonNegative(record.blockOrdinalWithinHeading) && nonEmpty(record.headingPathKey); }
function isReaderState(value: unknown): value is ReaderStateSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.documentId) && (record.readingMode === "continuous" || record.readingMode === "sections") && (record.modeOrigin === "auto" || record.modeOrigin === "user") && ["auto", "h1", "h2", "h3", "whole"].includes(record.splitStrategy as string) && (record.anchor === undefined || isSemanticAnchor(record.anchor)) && ratio(record.progressRatio) && nonNegative(record.updatedAt); }
function isSemanticAnchor(value: unknown): value is SemanticAnchorSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.versionId) && nonEmpty(record.headingPathKey) && nonEmpty(record.blockId) && nonNegative(record.blockOrdinalWithinHeading) && ratio(record.intraBlockRatio) && ratio(record.overallSourceRatio); }
function isPreferences(value: unknown): value is AppPreferencesSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return (record.theme === "system" || record.theme === "light" || record.theme === "dark") && typeof record.remoteImagesEnabled === "boolean" && typeof record.desktopTocCollapsed === "boolean" && nonNegative(record.updatedAt); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function hash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function nonNegative(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function ratio(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }

/** The brand is applied only after this adapter has validated a current ready chunk. */
function makeSanitizedHtml(value: string, pipelineVersion: number): SanitizedHtml {
  return { value, pipelineVersion } as SanitizedHtml;
}
