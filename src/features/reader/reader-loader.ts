import type {
  CurrentDocumentSnapshot,
  DocumentRepository,
  ReaderChunk,
  SemanticAnchorSnapshot,
} from "@/application/ports/document-repository";
import { resolveReaderHash, type HashResolution } from "@/features/reader/outline-resolver";
import { READER_VIRTUAL_CONFIG } from "@/features/reader/reader-virtual-config";

export const READER_INITIAL_WINDOW_SIZE = READER_VIRTUAL_CONFIG.initialWindowSize;

export type ReaderLoadResult =
  | { readonly status: "ready"; readonly document: CurrentDocumentSnapshot; readonly chunks: readonly ReaderChunk[]; readonly targetOrdinal: number; readonly hashResolution: HashResolution; readonly requestHash: string }
  | { readonly status: "empty"; readonly document: CurrentDocumentSnapshot }
  | { readonly status: "missing" }
  | { readonly status: "stale" }
  | { readonly status: "corrupt" };

/** Resolves entry priority and primes only a bounded range for the production viewport. */
export async function loadReader(repository: DocumentRepository, documentId: string, hash = ""): Promise<ReaderLoadResult> {
  const documentResult = await repository.getCurrentDocument(documentId);
  if (!documentResult.ok) return loadFailure(documentResult.error.code);
  const document = documentResult.value;
  if (document.chunkCount === 0) return { status: "empty", document };

  const hashResolution = resolveReaderHash(hash, document.outline);
  const stateResult = await repository.getReaderState(documentId);
  if (!stateResult.ok) return loadFailure(stateResult.error.code);
  const targetOrdinal = hashResolution.kind === "valid" ? hashResolution.heading.chunkOrdinal : await resolveTargetOrdinal(repository, documentId, stateResult.value?.anchor);
  const window = boundedWindow(document.chunkCount, targetOrdinal);
  const chunksResult = await repository.getCurrentChunkWindow({
    documentId,
    endOrdinalInclusive: window.endOrdinalInclusive,
    pipelineVersion: document.pipelineVersion,
    startOrdinal: window.startOrdinal,
  });
  if (!chunksResult.ok) return loadFailure(chunksResult.error.code);
  return { status: "ready", chunks: chunksResult.value, document, hashResolution, requestHash: hash, targetOrdinal };
}

export function boundedWindow(chunkCount: number, targetOrdinal: number): { readonly startOrdinal: number; readonly endOrdinalInclusive: number } {
  const cappedTarget = Math.min(Math.max(targetOrdinal, 0), chunkCount - 1);
  const startOrdinal = Math.max(0, Math.min(cappedTarget - Math.floor(READER_INITIAL_WINDOW_SIZE / 2), Math.max(0, chunkCount - READER_INITIAL_WINDOW_SIZE)));
  return { startOrdinal, endOrdinalInclusive: Math.min(chunkCount - 1, startOrdinal + READER_INITIAL_WINDOW_SIZE - 1) };
}

async function resolveTargetOrdinal(repository: DocumentRepository, documentId: string, anchor: SemanticAnchorSnapshot | undefined): Promise<number> {
  if (anchor === undefined) return 0;
  const result = await repository.resolveCurrentAnchor({ anchor, documentId });
  return result.ok && result.value !== undefined ? result.value : 0;
}

function loadFailure(code: string): Exclude<ReaderLoadResult, { readonly status: "ready" } | { readonly status: "empty" }> {
  if (code === "DOCUMENT_NOT_FOUND") return { status: "missing" };
  if (code === "STALE_DERIVED") return { status: "stale" };
  return { status: "corrupt" };
}
