import type {
  CurrentDocumentSnapshot,
  DocumentRepository,
  ReaderChunk,
  ReaderStateSnapshot,
  ResolvedReaderAnchor,
  SemanticAnchorSnapshot,
} from "@/application/ports/document-repository";
import { resolveReaderHash, type HashResolution } from "@/features/reader/outline-resolver";
import { READER_VIRTUAL_CONFIG } from "@/features/reader/reader-virtual-config";
import { resolveReaderPresentation, type ReaderPresentation } from "@/domain/reading/reader-presentation";

export const READER_INITIAL_WINDOW_SIZE = READER_VIRTUAL_CONFIG.initialWindowSize;

export type ReaderLoadResult =
  | { readonly status: "ready"; readonly document: CurrentDocumentSnapshot; readonly chunks: readonly ReaderChunk[]; readonly targetOrdinal: number; readonly targetAnchor?: SemanticAnchorSnapshot; readonly restore?: ResolvedReaderAnchor; readonly readerState?: ReaderStateSnapshot; readonly hashResolution: HashResolution; readonly requestHash: string; readonly presentation: ReaderPresentation }
  | { readonly status: "empty"; readonly document: CurrentDocumentSnapshot }
  | { readonly status: "missing"; readonly code: "DOCUMENT_NOT_FOUND" }
  | { readonly status: "stale"; readonly code: "STALE_DERIVED" }
  | { readonly status: "corrupt"; readonly code: string };

/** Resolves entry priority and primes only a bounded range for the production viewport. */
export async function loadReader(repository: DocumentRepository, documentId: string, hash = ""): Promise<ReaderLoadResult> {
  const documentResult = await repository.getCurrentDocument(documentId);
  if (!documentResult.ok) return loadFailure(documentResult.error.code);
  const document = documentResult.value;
  if (document.chunkCount === 0) return { status: "empty", document };

  const hashResolution = resolveReaderHash(hash, document.outline);
  const stateResult = await repository.getReaderState(documentId);
  if (!stateResult.ok) return loadFailure(stateResult.error.code);
  let restore: ResolvedReaderAnchor | undefined;
  if (hashResolution.kind !== "valid" && stateResult.value?.anchor !== undefined) {
    const restoreResult = await repository.resolveCurrentAnchor({ anchor: stateResult.value.anchor, documentId });
    if (!restoreResult.ok) return loadFailure(restoreResult.error.code);
    restore = restoreResult.value;
  }
  const targetOrdinal = hashResolution.kind === "valid" ? hashResolution.heading.chunkOrdinal : restore?.chunkOrdinal ?? 0;
  const window = boundedWindow(document.chunkCount, targetOrdinal);
  const chunksResult = await repository.getCurrentChunkWindow({
    documentId,
    endOrdinalInclusive: window.endOrdinalInclusive,
    pipelineVersion: document.pipelineVersion,
    startOrdinal: window.startOrdinal,
  });
  if (!chunksResult.ok) return loadFailure(chunksResult.error.code);
  return {
    chunks: chunksResult.value,
    document,
    hashResolution,
    presentation: resolveReaderPresentation(document.layouts, stateResult.value),
    ...(stateResult.value === undefined ? {} : { readerState: stateResult.value }),
    requestHash: hash,
    ...(restore === undefined ? {} : { restore }),
    ...(restore?.anchor === undefined ? {} : { targetAnchor: restore.anchor }),
    status: "ready",
    targetOrdinal,
  };
}

export function boundedWindow(chunkCount: number, targetOrdinal: number): { readonly startOrdinal: number; readonly endOrdinalInclusive: number } {
  const cappedTarget = Math.min(Math.max(targetOrdinal, 0), chunkCount - 1);
  const startOrdinal = Math.max(0, Math.min(cappedTarget - Math.floor(READER_INITIAL_WINDOW_SIZE / 2), Math.max(0, chunkCount - READER_INITIAL_WINDOW_SIZE)));
  return { startOrdinal, endOrdinalInclusive: Math.min(chunkCount - 1, startOrdinal + READER_INITIAL_WINDOW_SIZE - 1) };
}

function loadFailure(code: string): Exclude<ReaderLoadResult, { readonly status: "ready" } | { readonly status: "empty" }> {
  if (code === "DOCUMENT_NOT_FOUND") return { code, status: "missing" };
  if (code === "STALE_DERIVED") return { code, status: "stale" };
  return { code, status: "corrupt" };
}
