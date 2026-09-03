export type SplitStrategy = "auto" | "h1" | "h2" | "whole";

export type PipelineFailureCode = "FILE_TOO_LARGE" | "INVALID_UTF8";

export type PipelineWarningCode =
  | "AUTO_DETECT_LOW_CONFIDENCE"
  | "CODE_HIGHLIGHT_SKIPPED"
  | "HIGHLIGHT_FAILED"
  | "OVERSIZED_NODE"
  | "RAW_HTML_ESCAPED"
  | "UNSAFE_URL_BLOCKED"
  | "UNSUPPORTED_IMAGE";

export type ChunkDiagnosticCode =
  | "FRAGMENT_FALLBACK"
  | "HIGHLIGHT_FAILED"
  | "OVERSIZED_NODE";

export interface PipelineLimits {
  readonly maxFileBytes: number;
  readonly targetChunkCost: number;
  readonly maxChunkCostBeforeFallback: number;
  readonly oversizedNodeCost: number;
  readonly maxCodeHighlightChars: number;
  readonly maxAutoDetectChars: number;
  readonly autoDetectMinRelevance: number;
  readonly safeDataImageBytes: number;
  readonly batchMaxChunks: number;
  readonly batchMaxHtmlBytes: number;
}

export interface PipelineFailure {
  readonly code: PipelineFailureCode;
  readonly limit?: number;
  readonly actual?: number;
}

export interface PipelineWarning {
  readonly code: PipelineWarningCode;
  readonly count: number;
}

export interface OutlineItem {
  readonly id: string;
  readonly level: 1 | 2 | 3;
  readonly text: string;
  readonly pathKey: string;
  readonly sourceStart: number;
  readonly chunkOrdinal: number;
  readonly childIds: readonly string[];
}

export interface SectionLayout {
  readonly strategy: SplitStrategy;
  readonly sectionIds: readonly string[];
  readonly sections: readonly SectionRef[];
  readonly safeForSelection: boolean;
  readonly unavailableReason?: "DOM_BUDGET" | "OVERSIZED_NODE" | "POC_LIMIT_UNKNOWN";
}

export interface SectionRef {
  readonly id: string;
  readonly title?: string;
  readonly startChunkOrdinal: number;
  readonly endChunkOrdinalInclusive: number;
  readonly headingId?: string;
  readonly estimatedCost: number;
}

export interface BlockAnchor {
  readonly blockId: string;
  readonly headingPathKey: string;
  readonly blockOrdinalWithinHeading: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface PersistablePipelineChunk {
  readonly ordinal: number;
  readonly html: string;
  readonly pipelineVersion: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly estimatedCost: number;
  readonly headingIds: readonly string[];
  readonly blockAnchors: readonly BlockAnchor[];
  readonly renderState: "ready" | "safe-fallback";
  readonly diagnosticCode?: ChunkDiagnosticCode;
}

export interface PipelineChunkBatch {
  readonly batchOrdinal: number;
  readonly chunks: readonly PersistablePipelineChunk[];
  readonly htmlBytes: number;
}

export interface PipelineStageTimings {
  readonly decodeMs: number;
  readonly hashMs: number;
  readonly parseMs: number;
  readonly metadataMs: number;
  readonly partitionMs: number;
  readonly renderMs: number;
  readonly layoutMs: number;
  readonly batchMs: number;
  readonly totalMs: number;
}

export interface PipelineMetadata {
  readonly contentHash: string;
  readonly byteLength: number;
  readonly charLength: number;
  readonly title: string;
  readonly outline: readonly OutlineItem[];
  readonly layouts: Record<SplitStrategy, SectionLayout>;
  readonly chunkCount: number;
  readonly warnings: readonly PipelineWarning[];
}

export interface PipelineSuccess {
  readonly metadata: PipelineMetadata;
  readonly chunks: readonly PersistablePipelineChunk[];
  readonly batches: readonly PipelineChunkBatch[];
  readonly timings: PipelineStageTimings;
}

export type PipelineRunResult =
  | { readonly ok: true; readonly value: PipelineSuccess }
  | { readonly ok: false; readonly error: PipelineFailure };

export interface AutoDetectPreview {
  readonly accepted: boolean;
  readonly language?: string;
  readonly relevance: number;
  readonly elapsedMs: number;
}
