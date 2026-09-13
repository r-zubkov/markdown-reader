import type {
  AppPreferencesSnapshot,
  CurrentDocumentSnapshot,
  DocumentRepository,
  DocumentSummary,
  ImportIdentityMatches,
  ReaderChunk,
  RebuildSourceSnapshot,
  ReaderStateSnapshot,
  RepositoryErrorCode,
  RepositoryResult,
  SanitizedHtml,
  SemanticAnchorSnapshot,
  StageDocumentVersionInput,
} from "@/application/ports/document-repository";
import { PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import type { BlockAnchor, OutlineItem } from "@/domain/content/pipeline-types";
import {
  StorageAtomicitySpikeRepository,
  type StorageSpikeResult,
} from "@/infrastructure/db/storage-atomicity-spike";

export const DB_SCHEMA_VERSION = 3;
export { PIPELINE_VERSION };
export const MARKDOWN_READER_DATABASE_NAME = "markdown-reader";

/** The sole production persistence adapter. Feature code only sees DocumentRepository. */
export class DexieDocumentRepository implements DocumentRepository {
  private readonly storage: StorageAtomicitySpikeRepository;

  public constructor(databaseName = MARKDOWN_READER_DATABASE_NAME) {
    this.storage = new StorageAtomicitySpikeRepository(databaseName);
  }

  public close(): void { this.storage.close(); }

  public async stageVersion(input: StageDocumentVersionInput): Promise<RepositoryResult<void>> {
    if (input.pipelineVersion !== PIPELINE_VERSION) return failure("STALE_DERIVED");
    return discard(await this.storage.stageVersion(input));
  }

  public async appendChunkBatch(input: Parameters<DocumentRepository["appendChunkBatch"]>[0]): Promise<RepositoryResult<void>> {
    if (input.chunks.some((chunk) => chunk.pipelineVersion !== PIPELINE_VERSION)) return failure("STALE_DERIVED");
    if (input.chunks.some((chunk) => !isPersistableChunk(chunk))) return failure("INVALID_PERSISTED_RECORD");
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

  public async findImportIdentityMatches(input: Parameters<DocumentRepository["findImportIdentityMatches"]>[0]): Promise<RepositoryResult<ImportIdentityMatches>> {
    const result = await this.storage.findReadyImportIdentityMatches(input);
    if (!result.ok) return failure(result.error.code);
    const exactDuplicates = result.value.exactDuplicates.filter(isIdentityMatch);
    const possibleUpdates = result.value.possibleUpdates.filter(isIdentityMatch);
    if (exactDuplicates.length !== result.value.exactDuplicates.length || possibleUpdates.length !== result.value.possibleUpdates.length) {
      return failure("INVALID_PERSISTED_RECORD");
    }
    return success({
      exactDuplicates: exactDuplicates.map(toIdentityMatch),
      possibleUpdates: possibleUpdates.map(toIdentityMatch),
    });
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
    if (!nonEmpty(current.documentId) || !nonEmpty(current.id) || !nonEmpty(current.title) || !nonNegative(current.chunkCount) || !nonNegative(current.pipelineVersion) || !isOutline(current.outline, current.chunkCount)) {
      return failure("INVALID_PERSISTED_RECORD");
    }
    return success({ documentId: current.documentId, versionId: current.id, title: current.title, chunkCount: current.chunkCount, outline: current.outline, pipelineVersion: current.pipelineVersion });
  }

  public async getCurrentSourceForRebuild(documentId: string): Promise<RepositoryResult<RebuildSourceSnapshot>> {
    const result = await this.storage.readCurrentSourceBlobForRebuild(documentId);
    if (!result.ok) return failure(result.error.code);
    const source = result.value;
    if (!nonEmpty(source.documentId) || !nonEmpty(source.versionId) || !nonEmpty(source.fileName) || !nonNegative(source.pipelineVersion) || !isBlobLike(source.sourceBlob)) {
      return failure("INVALID_PERSISTED_RECORD");
    }
    return success({
      currentVersionId: source.versionId,
      documentId: source.documentId,
      fileName: source.fileName,
      previousPipelineVersion: source.pipelineVersion,
      sourceBlob: source.sourceBlob,
    });
  }

  public async getCurrentChunkWindow(input: Parameters<DocumentRepository["getCurrentChunkWindow"]>[0]): Promise<RepositoryResult<readonly ReaderChunk[]>> {
    const version = await this.storage.getCurrentReadyVersion(input.documentId);
    if (!version.ok) return failure(version.error.code);
    if (input.pipelineVersion !== PIPELINE_VERSION || version.value.pipelineVersion !== PIPELINE_VERSION) return failure("STALE_DERIVED");
    const chunks = await this.storage.getChunkRange(
      version.value.id,
      input.startOrdinal,
      input.endOrdinalInclusive,
    );
    if (!chunks.ok) return failure(chunks.error.code);
    if (!isChunkWindow(chunks.value, input)) return failure("INVALID_PERSISTED_RECORD");
    return success(chunks.value.map((chunk) => ({
      anchors: chunk.blockAnchors.map((anchor) => ({
        blockId: anchor.blockId,
        blockOrdinalWithinHeading: anchor.blockOrdinalWithinHeading,
        headingPathKey: anchor.headingPathKey,
        intraBlockRatio: 0,
        overallSourceRatio: version.value.chunkCount <= 1 ? 0 : chunk.ordinal / (version.value.chunkCount - 1),
        versionId: version.value.id,
      })),
      ...(chunk.diagnosticCode === undefined ? {} : { diagnosticCode: chunk.diagnosticCode }),
      estimatedCost: chunk.estimatedCost,
      html: makeSanitizedHtml(chunk.html, chunk.pipelineVersion),
      ordinal: chunk.ordinal,
      renderState: chunk.renderState,
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
function isIdentityMatch(value: { readonly documentId: unknown; readonly currentVersionId: unknown; readonly title: unknown; readonly fileName: unknown }): value is ImportIdentityMatches["exactDuplicates"][number] {
  return nonEmpty(value.documentId) && nonEmpty(value.currentVersionId) && nonEmpty(value.title) && nonEmpty(value.fileName);
}
function toIdentityMatch(value: ImportIdentityMatches["exactDuplicates"][number]): ImportIdentityMatches["exactDuplicates"][number] {
  return { currentVersionId: value.currentVersionId, documentId: value.documentId, fileName: value.fileName, title: value.title };
}
function isPersistableChunk(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!nonNegative(value.sourceStart) || !nonNegative(value.sourceEnd)) return false;
  const headingIds = value.headingIds;
  const blockAnchors = value.blockAnchors;
  const sourceStart = value.sourceStart;
  const sourceEnd = value.sourceEnd;
  return nonNegative(value.ordinal) && typeof value.html === "string" && sourceEnd >= sourceStart && typeof value.estimatedCost === "number" && Number.isFinite(value.estimatedCost) && value.estimatedCost >= 0 && Array.isArray(headingIds) && headingIds.every(nonEmpty) && Array.isArray(blockAnchors) && blockAnchors.every((anchor) => isBlockAnchor(anchor, sourceStart, sourceEnd)) && (value.renderState === "ready" || value.renderState === "safe-fallback") && (value.diagnosticCode === undefined || typeof value.diagnosticCode === "string" && ["FRAGMENT_FALLBACK", "HIGHLIGHT_FAILED", "OVERSIZED_NODE"].includes(value.diagnosticCode));
}
function isChunkWindow(chunks: readonly { readonly ordinal: number; readonly html: string; readonly pipelineVersion: number; readonly sourceStart: number; readonly sourceEnd: number; readonly estimatedCost: number; readonly blockAnchors: readonly unknown[]; readonly renderState: unknown; readonly diagnosticCode?: unknown; }[], input: { readonly startOrdinal: number; readonly endOrdinalInclusive: number; readonly pipelineVersion: number }): boolean {
  if (!nonNegative(input.startOrdinal) || !nonNegative(input.endOrdinalInclusive) || input.endOrdinalInclusive < input.startOrdinal) return false;
  if (chunks.length !== input.endOrdinalInclusive - input.startOrdinal + 1) return false;
  let expectedOrdinal = input.startOrdinal;
  let previousEnd = -1;
  return chunks.every((chunk) => {
    const valid = chunk.ordinal === expectedOrdinal && typeof chunk.html === "string" && chunk.pipelineVersion === input.pipelineVersion && nonNegative(chunk.sourceStart) && nonNegative(chunk.sourceEnd) && chunk.sourceEnd >= chunk.sourceStart && chunk.sourceStart >= previousEnd && typeof chunk.estimatedCost === "number" && Number.isFinite(chunk.estimatedCost) && chunk.estimatedCost >= 0 && (chunk.renderState === "ready" || chunk.renderState === "safe-fallback") && (chunk.diagnosticCode === undefined || typeof chunk.diagnosticCode === "string" && ["FRAGMENT_FALLBACK", "HIGHLIGHT_FAILED", "OVERSIZED_NODE"].includes(chunk.diagnosticCode)) && chunk.blockAnchors.every((anchor) => isBlockAnchor(anchor, chunk.sourceStart, chunk.sourceEnd));
    expectedOrdinal += 1; previousEnd = chunk.sourceEnd; return valid;
  });
}
function isBlockAnchor(value: unknown, chunkStart: number, chunkEnd: number): value is BlockAnchor { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.blockId) && hash(record.contentFingerprint) && nonNegative(record.blockOrdinalWithinHeading) && nonEmpty(record.headingPathKey) && nonNegative(record.sourceStart) && nonNegative(record.sourceEnd) && record.sourceStart >= chunkStart && record.sourceEnd >= record.sourceStart && record.sourceEnd <= chunkEnd; }
function isOutline(value: unknown, chunkCount: number): value is readonly OutlineItem[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (!isRecord(item) || !nonEmpty(item.id) || !nonEmpty(item.text) || !nonEmpty(item.pathKey) || (item.level !== 1 && item.level !== 2 && item.level !== 3) || !nonNegative(item.sourceStart) || !nonNegative(item.chunkOrdinal) || item.chunkOrdinal >= chunkCount || !Array.isArray(item.childIds) || !item.childIds.every(nonEmpty) || ids.has(item.id)) return false;
    ids.add(item.id); return true;
  });
}
function isReaderState(value: unknown): value is ReaderStateSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.documentId) && (record.readingMode === "continuous" || record.readingMode === "sections") && (record.modeOrigin === "auto" || record.modeOrigin === "user") && ["auto", "h1", "h2", "h3", "whole"].includes(record.splitStrategy as string) && (record.anchor === undefined || isSemanticAnchor(record.anchor)) && ratio(record.progressRatio) && nonNegative(record.updatedAt); }
function isSemanticAnchor(value: unknown): value is SemanticAnchorSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.versionId) && nonEmpty(record.headingPathKey) && nonEmpty(record.blockId) && nonNegative(record.blockOrdinalWithinHeading) && ratio(record.intraBlockRatio) && ratio(record.overallSourceRatio); }
function isPreferences(value: unknown): value is AppPreferencesSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return (record.theme === "system" || record.theme === "light" || record.theme === "dark") && typeof record.remoteImagesEnabled === "boolean" && typeof record.desktopTocCollapsed === "boolean" && nonNegative(record.updatedAt); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function hash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function nonNegative(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function ratio(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isBlobLike(value: unknown): value is Blob { return typeof value === "object" && value !== null && "size" in value && typeof value.size === "number" && "arrayBuffer" in value && typeof value.arrayBuffer === "function"; }

/** The brand is applied only after this adapter has validated a current ready chunk. */
function makeSanitizedHtml(value: string, pipelineVersion: number): SanitizedHtml {
  return { value, pipelineVersion } as SanitizedHtml;
}
