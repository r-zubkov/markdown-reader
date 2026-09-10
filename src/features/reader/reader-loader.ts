import type {
  CurrentDocumentSnapshot,
  DocumentRepository,
  ReaderChunk,
  SemanticAnchorSnapshot,
} from "@/application/ports/document-repository";

export const P01_READER_WINDOW_SIZE = 8;

export type ReaderLoadResult =
  | { readonly status: "ready"; readonly document: CurrentDocumentSnapshot; readonly chunks: readonly ReaderChunk[]; readonly targetOrdinal: number }
  | { readonly status: "empty"; readonly document: CurrentDocumentSnapshot }
  | { readonly status: "missing" }
  | { readonly status: "stale" }
  | { readonly status: "corrupt" };

/** Loads only a small contiguous window. The production virtualizer expands this port in P03. */
export async function loadReader(repository: DocumentRepository, documentId: string): Promise<ReaderLoadResult> {
  const documentResult = await repository.getCurrentDocument(documentId);
  if (!documentResult.ok) return loadFailure(documentResult.error.code);
  const document = documentResult.value;
  if (document.chunkCount === 0) return { status: "empty", document };

  const stateResult = await repository.getReaderState(documentId);
  if (!stateResult.ok) return loadFailure(stateResult.error.code);
  const targetOrdinal = await resolveTargetOrdinal(repository, documentId, stateResult.value?.anchor);
  const window = boundedWindow(document.chunkCount, targetOrdinal);
  const chunksResult = await repository.getCurrentChunkWindow({
    documentId,
    endOrdinalInclusive: window.endOrdinalInclusive,
    pipelineVersion: document.pipelineVersion,
    startOrdinal: window.startOrdinal,
  });
  if (!chunksResult.ok) return loadFailure(chunksResult.error.code);
  return { status: "ready", chunks: chunksResult.value, document, targetOrdinal };
}

export function boundedWindow(chunkCount: number, targetOrdinal: number): { readonly startOrdinal: number; readonly endOrdinalInclusive: number } {
  const cappedTarget = Math.min(Math.max(targetOrdinal, 0), chunkCount - 1);
  const startOrdinal = Math.max(0, Math.min(cappedTarget - Math.floor(P01_READER_WINDOW_SIZE / 2), Math.max(0, chunkCount - P01_READER_WINDOW_SIZE)));
  return { startOrdinal, endOrdinalInclusive: Math.min(chunkCount - 1, startOrdinal + P01_READER_WINDOW_SIZE - 1) };
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
