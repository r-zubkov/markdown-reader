import type {
  AppPreferencesSnapshot,
  CommitVersionResult,
  CurrentDocumentSnapshot,
  DeleteDocumentResult,
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
import { selectInitialReadingMode } from "@/domain/reading/reading-mode";
import {
  MAPPING_REASON_CODES,
  MAPPING_REASON_CONFIDENCE,
  mapSemanticAnchor,
  type MappingDocument,
  type MappingResult,
} from "@/domain/reading/progress-mapping";
import {
  StorageAtomicitySpikeRepository,
  type StorageAtomicityFailureHooks,
  type StorageChunkRecord,
  type StorageDocumentVersionRecord,
  type StorageSpikeResult,
} from "@/infrastructure/db/storage-atomicity-spike";

export const DB_SCHEMA_VERSION = 4;
export { PIPELINE_VERSION };
export const MARKDOWN_READER_DATABASE_NAME = "markdown-reader";
const FINGERPRINT_PIPELINE_VERSION = 3;

/** The sole production persistence adapter. Feature code only sees DocumentRepository. */
export class DexieDocumentRepository implements DocumentRepository {
  private readonly storage: StorageAtomicitySpikeRepository;

  public constructor(databaseName = MARKDOWN_READER_DATABASE_NAME, failureHooks?: StorageAtomicityFailureHooks) {
    this.storage = new StorageAtomicitySpikeRepository(databaseName, failureHooks);
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

  public async commitVersion(input: Parameters<DocumentRepository["commitVersion"]>[0]): Promise<RepositoryResult<CommitVersionResult>> {
    if (input.replacementReaderState !== undefined) {
      return this.commitMappedReplacement({ ...input, replacementReaderState: input.replacementReaderState });
    }
    const result = await this.storage.commitVersion(input);
    if (!result.ok) return failure(result.error.code);
    return success({ documentId: result.value.documentId, versionId: result.value.versionId });
  }

  public async abortVersion(jobId: string): Promise<RepositoryResult<void>> { return discard(await this.storage.abortVersion(jobId)); }

  public async cleanupAbandonedStaging(input: Parameters<DocumentRepository["cleanupAbandonedStaging"]>[0]): Promise<RepositoryResult<void>> {
    return discard(await this.storage.cleanupAbandonedStaging(input));
  }

  public async cleanupObsoleteReadyVersions(): Promise<RepositoryResult<void>> {
    return discard(await this.storage.cleanupObsoleteReadyVersions());
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

  public async deleteDocument(documentId: string): Promise<RepositoryResult<DeleteDocumentResult>> {
    if (!nonEmpty(documentId)) return failure("INVALID_PERSISTED_RECORD");
    const result = await this.storage.deleteDocument(documentId);
    if (!result.ok) return failure(result.error.code);
    return success({ status: result.value.deleted ? "deleted" : "not-found" });
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

  public async retryReplacementCleanup(versionId: string): Promise<RepositoryResult<void>> {
    if (!nonEmpty(versionId)) return failure("INVALID_PERSISTED_RECORD");
    return discard(await this.storage.cleanupReadyVersion(versionId));
  }

  public async dismissReaderRestoreNotice(input: Parameters<DocumentRepository["dismissReaderRestoreNotice"]>[0]): Promise<RepositoryResult<void>> {
    if (!nonEmpty(input.documentId) || !nonEmpty(input.versionId)) return failure("INVALID_PERSISTED_RECORD");
    return discard(await this.storage.dismissReaderRestoreNotice(input));
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

  public async saveRemoteImagesEnabled(enabled: boolean, updatedAt: number): Promise<RepositoryResult<void>> {
    if (typeof enabled !== "boolean" || !nonNegative(updatedAt)) return failure("INVALID_PERSISTED_RECORD");
    return discard(await this.storage.saveRemoteImagesEnabled(enabled, updatedAt));
  }

  private async commitMappedReplacement(
    input: Parameters<DocumentRepository["commitVersion"]>[0] & { readonly replacementReaderState: ReaderStateSnapshot },
  ): Promise<RepositoryResult<CommitVersionResult>> {
    const stagedResult = await this.storage.getVersion(input.versionId);
    if (!stagedResult.ok) return failure(stagedResult.error.code);
    const staged = stagedResult.value;
    if (staged?.state !== "staging" || staged.jobId !== input.jobId || staged.expectedCurrentVersionId === undefined) {
      return failure("INVALID_PERSISTED_RECORD");
    }
    if (!isReaderState(input.replacementReaderState) || input.replacementReaderState.documentId !== staged.documentId) {
      return failure("INVALID_PERSISTED_RECORD");
    }
    const expectedVersionId = staged.expectedCurrentVersionId;
    if (input.replacementReaderState.anchor !== undefined && input.replacementReaderState.anchor.versionId !== expectedVersionId) {
      return failure("COMMIT_CONFLICT");
    }

    const currentResult = await this.storage.getCurrentReadyVersion(staged.documentId);
    if (!currentResult.ok) return failure(currentResult.error.code);
    if (currentResult.value.id !== expectedVersionId) return failure("COMMIT_CONFLICT");
    const sourceVersion = currentResult.value;
    if (sourceVersion.pipelineVersion < FINGERPRINT_PIPELINE_VERSION || sourceVersion.pipelineVersion > PIPELINE_VERSION) {
      return failure("STALE_DERIVED");
    }
    const [sourceChunksResult, targetChunksResult] = await Promise.all([
      this.storage.getChunks(sourceVersion.id),
      this.storage.getChunks(staged.id),
    ]);
    if (!sourceChunksResult.ok) return failure(sourceChunksResult.error.code);
    if (!targetChunksResult.ok) return failure(targetChunksResult.error.code);
    const sourceDocument = mappingDocument(sourceVersion, sourceChunksResult.value);
    const targetDocument = mappingDocument(staged, targetChunksResult.value);
    if (sourceDocument === undefined || targetDocument === undefined || staged.pipelineVersion !== PIPELINE_VERSION) {
      return failure("INVALID_PERSISTED_RECORD");
    }

    const mapping = input.replacementReaderState.anchor === undefined
      ? mappingFromStart(targetDocument)
      : mapSemanticAnchor(input.replacementReaderState.anchor, sourceDocument, targetDocument);
    const mappedReaderState = mapReplacementReaderState(
      input.replacementReaderState,
      staged,
      targetChunksResult.value,
      mapping,
      input.readyAt,
    );
    const commit = await this.storage.commitVersion({
      jobId: input.jobId,
      readyAt: input.readyAt,
      replacementReaderState: mappedReaderState,
      versionId: input.versionId,
    });
    if (!commit.ok) return failure(commit.error.code);

    const cleanup = await this.storage.cleanupReadyVersion(expectedVersionId);
    return success({
      documentId: commit.value.documentId,
      replacement: {
        cleanup: cleanup.ok ? "complete" : "pending",
        confidence: mapping.confidence,
        reason: mapping.reason,
        replacedVersionId: expectedVersionId,
        structuralSimilarity: mapping.structuralSimilarity,
      },
      versionId: commit.value.versionId,
    });
  }
}

function discard<T>(result: StorageSpikeResult<T>): RepositoryResult<void> {
  return result.ok ? success(undefined) : failure(result.error.code);
}

function mappingDocument(
  version: StorageDocumentVersionRecord,
  chunks: readonly StorageChunkRecord[],
): MappingDocument | undefined {
  if (
    !nonEmpty(version.id)
    || !nonNegative(version.charLength)
    || !nonNegative(version.chunkCount)
    || chunks.length !== version.chunkCount
    || version.stagedChunkCount !== version.chunkCount
  ) return undefined;
  const blocks: BlockAnchor[] = [];
  for (let ordinal = 0; ordinal < chunks.length; ordinal += 1) {
    const chunk = chunks[ordinal];
    if (
      chunk?.ordinal !== ordinal
      || chunk.versionId !== version.id
      || chunk.pipelineVersion !== version.pipelineVersion
      || !nonNegative(chunk.sourceStart)
      || !nonNegative(chunk.sourceEnd)
      || chunk.sourceEnd < chunk.sourceStart
      || chunk.blockAnchors.some((anchor) => !isBlockAnchor(anchor, chunk.sourceStart, chunk.sourceEnd))
    ) return undefined;
    blocks.push(...chunk.blockAnchors);
  }
  return { blocks, sourceLength: version.charLength, versionId: version.id };
}

function mappingFromStart(target: MappingDocument): MappingResult {
  const first = [...target.blocks]
    .filter((block) => isBlockAnchor(block, 0, Number.MAX_SAFE_INTEGER))
    .sort((left, right) => left.sourceStart - right.sourceStart || left.blockId.localeCompare(right.blockId))[0];
  if (first === undefined) {
    return { confidence: "none", reason: "TARGET_EMPTY", structuralSimilarity: 0 };
  }
  return {
    anchor: {
      blockId: first.blockId,
      blockOrdinalWithinHeading: first.blockOrdinalWithinHeading,
      headingPathKey: first.headingPathKey,
      intraBlockRatio: 0,
      overallSourceRatio: 0,
      versionId: target.versionId,
    },
    confidence: "none",
    reason: "NO_RELIABLE_MATCH",
    structuralSimilarity: 0,
  };
}

function mapReplacementReaderState(
  captured: ReaderStateSnapshot,
  target: StorageDocumentVersionRecord,
  targetChunks: readonly StorageChunkRecord[],
  mapping: MappingResult,
  updatedAt: number,
): ReaderStateSnapshot {
  const splitStrategy = target.layouts[captured.splitStrategy].safeForSelection ? captured.splitStrategy : "auto";
  const readingMode = captured.modeOrigin === "auto"
    ? selectInitialReadingMode(target.layouts.whole.sections[0]?.estimatedCost ?? 0)
    : captured.readingMode;
  const targetOrdinal = mapping.anchor === undefined
    ? 0
    : targetChunks.find((chunk) => chunk.blockAnchors.some((anchor) => anchor.blockId === mapping.anchor?.blockId))?.ordinal ?? 0;
  const sections = target.layouts[splitStrategy].sections;
  const section = sections.find((candidate) => candidate.startChunkOrdinal <= targetOrdinal && targetOrdinal <= candidate.endChunkOrdinalInclusive) ?? sections[0];
  return {
    ...(mapping.anchor === undefined ? {} : { anchor: mapping.anchor }),
    documentId: captured.documentId,
    ...(section === undefined ? {} : { lastSectionId: section.id }),
    modeOrigin: captured.modeOrigin,
    ...(mapping.confidence === "exact" ? {} : {
      pendingRestoreNotice: {
        confidence: mapping.confidence,
        reason: mapping.reason,
        versionId: target.id,
      },
    }),
    progressRatio: mapping.anchor?.overallSourceRatio ?? 0,
    readingMode,
    splitStrategy,
    updatedAt,
  };
}

function success<T>(value: T): RepositoryResult<T> { return { ok: true, value }; }
function failure(storageCode: string): RepositoryResult<never> {
  const code: RepositoryErrorCode = isRepositoryErrorCode(storageCode) ? storageCode : storageCode === "QUOTA_EXCEEDED" ? "QUOTA_EXCEEDED" : storageCode === "MIGRATION_FAILED" ? "MIGRATION_FAILED" : storageCode === "DOCUMENT_NOT_FOUND" ? "DOCUMENT_NOT_FOUND" : storageCode === "CURRENT_VERSION_CONFLICT" ? "COMMIT_CONFLICT" : "UNKNOWN_STORAGE_ERROR";
  return { ok: false, error: { code } };
}
function isRepositoryErrorCode(value: string): value is RepositoryErrorCode { return ["DB_UNAVAILABLE", "MIGRATION_FAILED", "STALE_DERIVED", "QUOTA_EXCEEDED", "COMMIT_CONFLICT", "CLEANUP_FAILED", "DOCUMENT_NOT_FOUND", "INVALID_PERSISTED_RECORD", "UNKNOWN_STORAGE_ERROR"].includes(value); }
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
function isReaderState(value: unknown): value is ReaderStateSnapshot { if (typeof value !== "object" || value === null) return false; const record = value as Record<string, unknown>; return nonEmpty(record.documentId) && (record.readingMode === "continuous" || record.readingMode === "sections") && (record.modeOrigin === "auto" || record.modeOrigin === "user") && ["auto", "h1", "h2", "h3", "whole"].includes(record.splitStrategy as string) && (record.anchor === undefined || isSemanticAnchor(record.anchor)) && ratio(record.progressRatio) && (record.lastSectionId === undefined || nonEmpty(record.lastSectionId)) && (record.pendingRestoreNotice === undefined || isReaderRestoreNotice(record.pendingRestoreNotice)) && nonNegative(record.updatedAt); }
function isReaderRestoreNotice(value: unknown): boolean { if (!isRecord(value)) return false; const reason = value.reason; return nonEmpty(value.versionId) && (value.confidence === "approximate" || value.confidence === "none") && typeof reason === "string" && MAPPING_REASON_CODES.includes(reason as (typeof MAPPING_REASON_CODES)[number]) && MAPPING_REASON_CONFIDENCE[reason as (typeof MAPPING_REASON_CODES)[number]] === value.confidence; }
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
