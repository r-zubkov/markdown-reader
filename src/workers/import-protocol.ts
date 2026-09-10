import type {
  PersistablePipelineChunk,
  PipelineMetadata,
  PipelineLimits,
} from "@/domain/content/pipeline-types";

export const WORKER_PROTOCOL_VERSION = 1;

export type ImportStage = "validating" | "processing" | "staging" | "finalizing";

export type ImportFailureCode =
  | "UNSUPPORTED_EXTENSION"
  | "FILE_TOO_LARGE"
  | "INVALID_UTF8"
  | "PROTOCOL_MISMATCH"
  | "WORKER_CRASH"
  | "CANCELLED"
  | "DB_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "COMMIT_CONFLICT"
  | "UNKNOWN_STORAGE_ERROR";

export type MainToImportWorker =
  | {
      readonly type: "import.request";
      readonly protocolVersion: number;
      readonly jobId: string;
      readonly file: File;
      readonly limits: PipelineLimits;
    }
  | {
      readonly type: "import.cancel";
      readonly protocolVersion: number;
      readonly jobId: string;
    };

export type ImportWorkerToMain =
  | {
      readonly type: "import.progress";
      readonly protocolVersion: number;
      readonly jobId: string;
      readonly stage: ImportStage;
      readonly ratio?: number;
    }
  | {
      readonly type: "import.metadata";
      readonly protocolVersion: number;
      readonly jobId: string;
      readonly metadata: PipelineMetadata;
    }
  | {
      readonly type: "import.chunkBatch";
      readonly protocolVersion: number;
      readonly jobId: string;
      readonly batchOrdinal: number;
      readonly chunks: readonly PersistablePipelineChunk[];
    }
  | {
      readonly type: "import.complete";
      readonly protocolVersion: number;
      readonly jobId: string;
    }
  | {
      readonly type: "import.failure";
      readonly protocolVersion: number;
      readonly jobId: string;
      readonly error: ImportFailureCode;
    }
  | {
      readonly type: "import.cancelled";
      readonly protocolVersion: number;
      readonly jobId: string;
    };

export function isMainToImportWorker(value: unknown): value is MainToImportWorker {
  if (!isEnvelope(value) || value.protocolVersion !== WORKER_PROTOCOL_VERSION) return false;
  if (value.type === "import.cancel") return true;
  return value.type === "import.request" && isFile(value.file) && isPipelineLimits(value.limits);
}

export function isImportWorkerToMain(value: unknown): value is ImportWorkerToMain {
  if (!isEnvelope(value) || value.protocolVersion !== WORKER_PROTOCOL_VERSION) return false;
  switch (value.type) {
    case "import.progress":
      return isImportStage(value.stage) && (value.ratio === undefined || isRatio(value.ratio));
    case "import.metadata":
      return isPipelineMetadata(value.metadata);
    case "import.chunkBatch":
      return isNonNegativeInteger(value.batchOrdinal) && Array.isArray(value.chunks) && value.chunks.every(isChunk);
    case "import.complete":
    case "import.cancelled":
      return true;
    case "import.failure":
      return isImportFailureCode(value.error);
    default:
      return false;
  }
}

export function getMessageJobId(value: unknown): string | undefined {
  return isRecord(value) && isNonEmptyString(value.jobId) ? value.jobId : undefined;
}

function isEnvelope(value: unknown): value is Record<string, unknown> & { readonly protocolVersion: number; readonly jobId: string; readonly type: string } {
  return isRecord(value) && typeof value.protocolVersion === "number" && isNonEmptyString(value.jobId) && typeof value.type === "string";
}

function isPipelineMetadata(value: unknown): value is PipelineMetadata {
  if (!isRecord(value)) return false;
  const { layouts, outline, warnings } = value;
  if (!isHash(value.contentHash) || !isNonNegativeInteger(value.byteLength) || !isNonNegativeInteger(value.charLength) || typeof value.title !== "string" || !isNonNegativeInteger(value.chunkCount) || !Array.isArray(outline) || !isRecord(layouts) || !Array.isArray(warnings)) return false;
  return outline.every(isOutlineItem) && warnings.every(isWarning) && ["auto", "h1", "h2", "h3", "whole"].every((strategy) => isLayout(layouts[strategy]));
}

function isOutlineItem(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.id) && (value.level === 1 || value.level === 2 || value.level === 3) && typeof value.text === "string" && typeof value.pathKey === "string" && isNonNegativeInteger(value.sourceStart) && isNonNegativeInteger(value.chunkOrdinal) && Array.isArray(value.childIds) && value.childIds.every(isNonEmptyString);
}

function isLayout(value: unknown): boolean {
  return isRecord(value) && isSplitStrategy(value.strategy) && Array.isArray(value.sectionIds) && value.sectionIds.every(isNonEmptyString) && Array.isArray(value.sections) && typeof value.safeForSelection === "boolean" && value.sections.every(isSection);
}

function isSection(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.id) && (value.title === undefined || typeof value.title === "string") && isNonNegativeInteger(value.startChunkOrdinal) && isNonNegativeInteger(value.endChunkOrdinalInclusive) && value.startChunkOrdinal <= value.endChunkOrdinalInclusive && (value.headingId === undefined || isNonEmptyString(value.headingId)) && typeof value.estimatedCost === "number" && Number.isFinite(value.estimatedCost) && value.estimatedCost >= 0;
}

function isWarning(value: unknown): boolean {
  return isRecord(value) && typeof value.code === "string" && isNonNegativeInteger(value.count);
}

function isChunk(value: unknown): value is PersistablePipelineChunk {
  return isRecord(value) && isNonNegativeInteger(value.ordinal) && typeof value.html === "string" && isNonNegativeInteger(value.pipelineVersion) && isNonNegativeInteger(value.sourceStart) && isNonNegativeInteger(value.sourceEnd) && value.sourceEnd >= value.sourceStart && typeof value.estimatedCost === "number" && Number.isFinite(value.estimatedCost) && value.estimatedCost >= 0 && Array.isArray(value.headingIds) && value.headingIds.every(isNonEmptyString) && Array.isArray(value.blockAnchors) && value.blockAnchors.every(isBlockAnchor) && (value.renderState === "ready" || value.renderState === "safe-fallback") && (value.diagnosticCode === undefined || typeof value.diagnosticCode === "string" && ["FRAGMENT_FALLBACK", "HIGHLIGHT_FAILED", "OVERSIZED_NODE"].includes(value.diagnosticCode));
}

function isBlockAnchor(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.blockId) && isHash(value.contentFingerprint) && typeof value.headingPathKey === "string" && isNonNegativeInteger(value.blockOrdinalWithinHeading) && isNonNegativeInteger(value.sourceStart) && isNonNegativeInteger(value.sourceEnd) && value.sourceEnd >= value.sourceStart;
}

function isPipelineLimits(value: unknown): value is PipelineLimits {
  return isRecord(value) && ["maxFileBytes", "targetChunkCost", "maxChunkCostBeforeFallback", "oversizedNodeCost", "maxCodeHighlightChars", "maxAutoDetectChars", "autoDetectMinRelevance", "safeDataImageBytes", "batchMaxChunks", "batchMaxHtmlBytes"].every((key) => isNonNegativeInteger(value[key]));
}

function isImportStage(value: unknown): value is ImportStage { return value === "validating" || value === "processing" || value === "staging" || value === "finalizing"; }
function isImportFailureCode(value: unknown): value is ImportFailureCode { return typeof value === "string" && ["UNSUPPORTED_EXTENSION", "FILE_TOO_LARGE", "INVALID_UTF8", "PROTOCOL_MISMATCH", "WORKER_CRASH", "CANCELLED", "DB_UNAVAILABLE", "QUOTA_EXCEEDED", "COMMIT_CONFLICT", "UNKNOWN_STORAGE_ERROR"].includes(value); }
function isSplitStrategy(value: unknown): boolean { return value === "auto" || value === "h1" || value === "h2" || value === "h3" || value === "whole"; }
function isRatio(value: unknown): boolean { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }
function isHash(value: unknown): boolean { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function isNonNegativeInteger(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function isNonEmptyString(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isFile(value: unknown): value is File { return value instanceof File; }
