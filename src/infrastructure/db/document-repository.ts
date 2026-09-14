import type {
  AppPreferencesSnapshot,
  CurrentDocumentSnapshot,
  DocumentRepository,
  DocumentSummary,
  ImportIdentityMatches,
  ReaderChunk,
  ResolvedReaderAnchor,
  RebuildSourceSnapshot,
  ReaderStateSnapshot,
  RepositoryErrorCode,
  RepositoryResult,
  SanitizedHtml,
  SemanticAnchorSnapshot,
  StageDocumentVersionInput,
} from "@/application/ports/document-repository";
import { PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import type { BlockAnchor, OutlineItem, SectionLayout, SplitStrategy } from "@/domain/content/pipeline-types";
import { mapSemanticAnchor } from "@/domain/reading/progress-mapping";
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
    if (!nonEmpty(current.documentId) || !nonEmpty(current.id) || !nonEmpty(current.title) || !nonNegative(current.chunkCount) || !nonNegative(current.pipelineVersion) || !isOutline(current.outline, current.chunkCount) || !isLayouts(current.layouts, current.chunkCount)) {
      return failure("INVALID_PERSISTED_RECORD");
    }
    return success({ chunkCount: current.chunkCount, documentId: current.documentId, layouts: current.layouts, outline: current.outline, pipelineVersion: current.pipelineVersion, title: current.title, versionId: current.id });
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
        anchor: {
          blockId: anchor.blockId,
          blockOrdinalWithinHeading: anchor.blockOrdinalWithinHeading,
          headingPathKey: anchor.headingPathKey,
          intraBlockRatio: 0,
          overallSourceRatio: clampRatio(anchor.sourceStart / Math.max(1, version.value.charLength)),
          versionId: version.value.id,
        },
        sourceEndRatio: clampRatio(anchor.sourceEnd / Math.max(1, version.value.charLength)),
        sourceStartRatio: clampRatio(anchor.sourceStart / Math.max(1, version.value.charLength)),
      })),
      ...(chunk.diagnosticCode === undefined ? {} : { diagnosticCode: chunk.diagnosticCode }),
      estimatedCost: chunk.estimatedCost,
      html: makeSanitizedHtml(chunk.html, chunk.pipelineVersion),
      ordinal: chunk.ordinal,
      renderState: chunk.renderState,
    })));
  }

  public async resolveCurrentAnchor(input: Parameters<DocumentRepository["resolveCurrentAnchor"]>[0]): Promise<RepositoryResult<ResolvedReaderAnchor>> {
    const version = await this.storage.getCurrentReadyVersion(input.documentId);
    if (!version.ok) return failure(version.error.code);
    if (!isSemanticAnchor(input.anchor)) return failure("INVALID_PERSISTED_RECORD");
    const indexResult = await this.storage.getChunkAnchorIndex(version.value.id);
    if (!indexResult.ok) return failure(indexResult.error.code);
    const index = indexResult.value;
    if (index.some((entry) => !nonNegative(entry.chunkOrdinal) || !isBlockAnchor(entry.anchor, 0, Number.MAX_SAFE_INTEGER))) return failure("INVALID_PERSISTED_RECORD");
    if (input.anchor.versionId !== version.value.id) return success({ chunkOrdinal: 0, confidence: "none", reason: index.length === 0 ? "TARGET_EMPTY" : "NO_RELIABLE_MATCH" });
    const blocks = index.map((entry) => entry.anchor);
    const mapping = mapSemanticAnchor(input.anchor, { blocks, sourceLength: version.value.charLength, versionId: version.value.id }, { blocks, sourceLength: version.value.charLength, versionId: version.value.id });
    const chunkOrdinal = mapping.anchor === undefined ? 0 : index.find((entry) => entry.anchor.blockId === mapping.anchor?.blockId)?.chunkOrdinal ?? 0;
    return success({ ...(mapping.anchor === undefined ? {} : { anchor: mapping.anchor }), chunkOrdinal, confidence: mapping.confidence, reason: mapping.reason });
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

  public async saveReaderPresentation(input: Parameters<DocumentRepository["saveReaderPresentation"]>[0]): Promise<RepositoryResult<void>> {
    if (!nonEmpty(input.documentId) || !isReadingMode(input.readingMode) || !isModeOrigin(input.modeOrigin) || !isSplitStrategy(input.splitStrategy) || !nonNegative(input.updatedAt)) return failure("INVALID_PERSISTED_RECORD");
    return discard(await this.storage.saveReaderPresentation(input));
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
  return nonEmpty(value.documentId) && nonEmpty(value.currentVersionId) && nonEmpty(value.title) && nonEmpty(value.fileName) && hash(value.contentHash) && nonNegative(value.activityAt) && nonNegative(value.chunkCount) && ratio(value.progressRatio);
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
function isLayouts(value: unknown, chunkCount: number): value is Record<SplitStrategy, SectionLayout> {
  if (!isRecord(value)) return false;
  const strategies = ["auto", "h1", "h2", "h3", "whole"] as const satisfies readonly SplitStrategy[];
  return strategies.every((strategy) => {
    const layout = value[strategy];
    if (!isRecord(layout) || layout.strategy !== strategy || !Array.isArray(layout.sectionIds) || !Array.isArray(layout.sections) || typeof layout.safeForSelection !== "boolean" || layout.sectionIds.length !== layout.sections.length) return false;
    const sectionIds = layout.sectionIds;
    const sections = layout.sections;
    let expectedStart = 0;
    return sections.every((section, index) => {
      if (!isRecord(section) || !nonEmpty(section.id) || sectionIds[index] !== section.id || !nonNegative(section.startChunkOrdinal) || !nonNegative(section.endChunkOrdinalInclusive) || section.startChunkOrdinal !== expectedStart || section.endChunkOrdinalInclusive < section.startChunkOrdinal || section.endChunkOrdinalInclusive >= chunkCount || typeof section.estimatedCost !== "number" || !Number.isFinite(section.estimatedCost) || section.estimatedCost < 0 || (section.title !== undefined && typeof section.title !== "string") || (section.headingId !== undefined && !nonEmpty(section.headingId))) return false;
      expectedStart = section.endChunkOrdinalInclusive + 1;
      return true;
    }) && (chunkCount === 0 ? layout.sections.length === 0 : expectedStart === chunkCount);
  });
}
function isSplitStrategy(value: string): value is SplitStrategy { return ["auto", "h1", "h2", "h3", "whole"].includes(value); }
function isReadingMode(value: unknown): value is ReaderStateSnapshot["readingMode"] { return value === "continuous" || value === "sections"; }
function isModeOrigin(value: unknown): value is ReaderStateSnapshot["modeOrigin"] { return value === "auto" || value === "user"; }
function isReaderState(value: unknown): value is ReaderStateSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.documentId) && (record.readingMode === "continuous" || record.readingMode === "sections") && (record.modeOrigin === "auto" || record.modeOrigin === "user") && ["auto", "h1", "h2", "h3", "whole"].includes(record.splitStrategy as string) && (record.anchor === undefined || isSemanticAnchor(record.anchor)) && ratio(record.progressRatio) && (record.lastSectionId === undefined || nonEmpty(record.lastSectionId)) && nonNegative(record.updatedAt); }
function isSemanticAnchor(value: unknown): value is SemanticAnchorSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.versionId) && nonEmpty(record.headingPathKey) && nonEmpty(record.blockId) && nonNegative(record.blockOrdinalWithinHeading) && ratio(record.intraBlockRatio) && ratio(record.overallSourceRatio); }
function isPreferences(value: unknown): value is AppPreferencesSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return (record.theme === "system" || record.theme === "light" || record.theme === "dark") && typeof record.remoteImagesEnabled === "boolean" && typeof record.desktopTocCollapsed === "boolean" && nonNegative(record.updatedAt); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function hash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function nonNegative(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function ratio(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }
function clampRatio(value: number): number { return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isBlobLike(value: unknown): value is Blob { return typeof value === "object" && value !== null && "size" in value && typeof value.size === "number" && "arrayBuffer" in value && typeof value.arrayBuffer === "function"; }

/** The brand is applied only after this adapter has validated a current ready chunk. */
function makeSanitizedHtml(value: string, pipelineVersion: number): SanitizedHtml {
  return { value, pipelineVersion } as SanitizedHtml;
}
