import { useEffect, useState } from "react";

import type { CurrentDocumentSnapshot, DocumentRepository, ReaderChunk, RepositoryErrorCode } from "@/application/ports/document-repository";
import type { SectionRef } from "@/domain/content/pipeline-types";
import { appCopy } from "@/shared/i18n/ru";
import { SafeHtmlChunk } from "@/ui/primitives/SafeHtmlChunk";
import { readerCopy } from "@/features/reader/copy";

const SECTION_CHUNK_WINDOW_SIZE = 24;

interface SectionReaderProps {
  readonly document: CurrentDocumentSnapshot;
  readonly onFatalError: (code: RepositoryErrorCode) => void;
  readonly repository: DocumentRepository;
  readonly section: SectionRef;
  readonly targetId?: string;
  readonly targetOrdinal: number;
}

export function SectionReader({ document, onFatalError, repository, section, targetId, targetOrdinal }: SectionReaderProps) {
  const [window, setWindow] = useState(() => createSectionWindow(section, targetOrdinal));
  const [chunks, setChunks] = useState<readonly ReaderChunk[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void repository.getCurrentChunkWindow({
      documentId: document.documentId,
      endOrdinalInclusive: window.end,
      pipelineVersion: document.pipelineVersion,
      startOrdinal: window.start,
    }).then((result) => {
      if (!active) return;
      if (!result.ok) { onFatalError(result.error.code); return; }
      setChunks(result.value);
    });
    return () => { active = false; };
  }, [document.documentId, document.pipelineVersion, onFatalError, repository, window.end, window.start]);

  useEffect(() => {
    if (targetId === undefined || chunks === undefined) return;
    const target = globalThis.document.getElementById(targetId);
    if (target instanceof HTMLElement) target.scrollIntoView({ block: "start", behavior: "auto" });
  }, [chunks, targetId]);

  const canMoveBack = window.start > section.startChunkOrdinal;
  const canMoveForward = window.end < section.endChunkOrdinalInclusive;
  const loading = chunks === undefined;
  return <section aria-busy={loading} className="section-reader" data-testid="section-reader">
    {loading ? <p className="reader__notice" role="status">{appCopy.reader.loadingWindow}</p> : chunks.map((chunk) => <div className="reader-chunk" data-reader-ordinal={chunk.ordinal} key={chunk.ordinal}>
      {chunk.renderState === "safe-fallback" ? <p className="reader-chunk__local-status" role="note">{appCopy.reader.safeFallback}</p> : null}
      <SafeHtmlChunk html={chunk.html} ordinal={chunk.ordinal} />
    </div>)}
    {canMoveBack || canMoveForward ? <nav aria-label={readerCopy.sectionWindowNavigation} className="section-reader__window-nav">
      <button disabled={!canMoveBack || loading} onClick={() => { setChunks(undefined); setWindow((current) => moveSectionWindow(section, current, "back")); }} type="button">{readerCopy.previousPart}</button>
      <button disabled={!canMoveForward || loading} onClick={() => { setChunks(undefined); setWindow((current) => moveSectionWindow(section, current, "forward")); }} type="button">{readerCopy.nextPart}</button>
    </nav> : null}
  </section>;
}

function createSectionWindow(section: SectionRef, targetOrdinal: number): { readonly start: number; readonly end: number } {
  const target = Math.min(Math.max(targetOrdinal, section.startChunkOrdinal), section.endChunkOrdinalInclusive);
  const start = Math.max(section.startChunkOrdinal, Math.min(target - Math.floor(SECTION_CHUNK_WINDOW_SIZE / 2), section.endChunkOrdinalInclusive - SECTION_CHUNK_WINDOW_SIZE + 1));
  return { end: Math.min(section.endChunkOrdinalInclusive, start + SECTION_CHUNK_WINDOW_SIZE - 1), start };
}
function moveSectionWindow(section: SectionRef, current: { readonly start: number; readonly end: number }, direction: "back" | "forward"): { readonly start: number; readonly end: number } {
  return createSectionWindow(section, direction === "back" ? current.start - SECTION_CHUNK_WINDOW_SIZE : current.end + 1);
}
