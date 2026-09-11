import type { PipelineLimits } from "./pipeline-types";

export const PIPELINE_VERSION = 4;

export const HEADING_ID_PREFIX = "mdr-h-";
export const FOOTNOTE_ID_PREFIX = "mdr-fn-";

export const PIPELINE_SUPPORTED_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "go",
  "graphql",
  "ini",
  "java",
  "javascript",
  "json",
  "kotlin",
  "less",
  "lua",
  "makefile",
  "markdown",
  "objectivec",
  "perl",
  "php",
  "plaintext",
  "python",
  "r",
  "ruby",
  "rust",
  "scss",
  "shell",
  "sql",
  "swift",
  "typescript",
  "wasm",
  "xml",
  "yaml",
] as const;

export type SupportedHighlightLanguage =
  (typeof PIPELINE_SUPPORTED_LANGUAGES)[number];

// Production import budgets. Changes require corpus, security and browser reruns.
export const PIPELINE_LIMITS: PipelineLimits = {
  maxFileBytes: 1_250_000,
  maxAstNodes: 100_000,
  maxAstDepth: 128,
  maxTopLevelBlocks: 20_000,
  maxTitleChars: 240,
  targetChunkCost: 8_000,
  maxChunkCostBeforeFallback: 24_000,
  oversizedNodeCost: 32_000,
  maxCodeHighlightChars: 8_000,
  maxAutoDetectChars: 1_200,
  autoDetectMinRelevance: 8,
  safeDataImageBytes: 4_096,
  batchMaxChunks: 8,
  batchMaxHtmlBytes: 64_000,
};

export const PIPELINE_MARKER_PATTERN = /\[\[MDR:([A-Z0-9_-]+)\]\]/g;
