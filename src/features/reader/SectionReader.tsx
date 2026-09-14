import { useEffect, useRef, useState } from "react";

import type { CurrentDocumentSnapshot, DocumentRepository, ReaderChunk, RepositoryErrorCode } from "@/application/ports/document-repository";
import type { SectionRef } from "@/domain/content/pipeline-types";
import { appCopy } from "@/shared/i18n/ru";
import { SafeHtmlChunk } from "@/ui/primitives/SafeHtmlChunk";
import { readerCopy } from "@/features/reader/copy";
import {
  isPageEndReached,
  observeTopMeaningfulLocation,
  READER_LOCATION_LINE_PX,
  type ObservedLocation,
} from "@/features/reader/reader-location-observer";

const SECTION_CHUNK_WINDOW_SIZE = 24;

interface SectionReaderProps {
  readonly document: CurrentDocumentSnapshot;
  readonly onFatalError: (code: RepositoryErrorCode) => void;
  readonly onLocationChange: (location: ObservedLocation) => void;
  readonly onTargetSettled: () => void;
  readonly repository: DocumentRepository;
  readonly section: SectionRef;
  readonly focusTarget: boolean;
  readonly targetBlockId?: string;
  readonly targetId?: string;
  readonly targetIntraBlockRatio?: number;
  readonly targetOrdinal: number;
  readonly targetRequestKey: string;
}

export function SectionReader({ document, focusTarget, onFatalError, onLocationChange, onTargetSettled, repository, section, targetBlockId, targetId, targetIntraBlockRatio = 0, targetOrdinal, targetRequestKey }: SectionReaderProps) {
  const [sectionWindow, setSectionWindow] = useState(() => createSectionWindow(section, targetOrdinal));
  const [chunks, setChunks] = useState<readonly ReaderChunk[] | undefined>(undefined);
  const rootRef = useRef<HTMLElement>(null);
  const settledTargetRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void repository.getCurrentChunkWindow({
      documentId: document.documentId,
      endOrdinalInclusive: sectionWindow.end,
      pipelineVersion: document.pipelineVersion,
      startOrdinal: sectionWindow.start,
    }).then((result) => {
      if (!active) return;
      if (!result.ok) { onFatalError(result.error.code); return; }
      setChunks(result.value);
    });
    return () => { active = false; };
  }, [document.documentId, document.pipelineVersion, onFatalError, repository, sectionWindow.end, sectionWindow.start]);

  useEffect(() => {
    if (chunks === undefined || settledTargetRef.current === targetRequestKey) return;
    let frame = 0;
    let attempts = 0;
    const settle = () => {
      attempts += 1;
      const target = findSectionTarget(rootRef.current, targetOrdinal, targetId, targetBlockId);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: "start", behavior: "auto" });
        const offset = targetBlockId === undefined ? 0 : Math.max(0, target.getBoundingClientRect().height) * Math.min(1, Math.max(0, targetIntraBlockRatio)) - READER_LOCATION_LINE_PX;
        if (offset !== 0) window.scrollBy(0, offset);
        if (focusTarget) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      }
      if (attempts < 30 && !(target instanceof HTMLElement)) { frame = requestAnimationFrame(settle); return; }
      if (!(target instanceof HTMLElement)) return;
      settledTargetRef.current = targetRequestKey;
      onTargetSettled();
      emitSectionLocation(rootRef.current, chunks, document.chunkCount, section.id, onLocationChange);
    };
    frame = requestAnimationFrame(settle);
    return () => { cancelAnimationFrame(frame); };
  }, [chunks, document.chunkCount, focusTarget, onLocationChange, onTargetSettled, section.id, targetBlockId, targetId, targetIntraBlockRatio, targetOrdinal, targetRequestKey]);

  useEffect(() => {
    if (chunks === undefined) return;
    let frame = 0;
    const observe = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { emitSectionLocation(rootRef.current, chunks, document.chunkCount, section.id, onLocationChange); });
    };
    window.addEventListener("scroll", observe, { passive: true });
    observe();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", observe); };
  }, [chunks, document.chunkCount, onLocationChange, section.id]);

  const canMoveBack = sectionWindow.start > section.startChunkOrdinal;
  const canMoveForward = sectionWindow.end < section.endChunkOrdinalInclusive;
  const loading = chunks === undefined;
  return <section aria-busy={loading} className="section-reader" data-target-block-id={targetBlockId ?? ""} data-testid="section-reader" ref={rootRef}>
    {loading ? <p className="reader__notice" role="status">{appCopy.reader.loadingWindow}</p> : chunks.map((chunk) => <div className="reader-chunk" data-reader-ordinal={chunk.ordinal} key={chunk.ordinal}>
      {chunk.renderState === "safe-fallback" ? <p className="reader-chunk__local-status" role="note">{appCopy.reader.safeFallback}</p> : null}
      <SafeHtmlChunk anchors={chunk.anchors} html={chunk.html} ordinal={chunk.ordinal} />
    </div>)}
    {canMoveBack || canMoveForward ? <nav aria-label={readerCopy.sectionWindowNavigation} className="section-reader__window-nav">
      <button disabled={!canMoveBack || loading} onClick={() => { setChunks(undefined); setSectionWindow((current) => moveSectionWindow(section, current, "back")); }} type="button">{readerCopy.previousPart}</button>
      <button disabled={!canMoveForward || loading} onClick={() => { setChunks(undefined); setSectionWindow((current) => moveSectionWindow(section, current, "forward")); }} type="button">{readerCopy.nextPart}</button>
    </nav> : null}
  </section>;
}

function emitSectionLocation(root: HTMLElement | null, chunks: readonly ReaderChunk[], chunkCount: number, sectionId: string, callback: (location: ObservedLocation) => void): void {
  if (root === null) return;
  const location = observeTopMeaningfulLocation({
    lastSectionId: sectionId,
    pageEndReached: isPageEndReached(),
    resolveAnchor: (ordinal, blockIndex) => {
      const chunk = chunks.find((candidate) => candidate.ordinal === ordinal);
      const block = chunk?.anchors[blockIndex];
      if (chunk === undefined || block === undefined) return undefined;
      return { block, isFinalBlock: ordinal === chunkCount - 1 && blockIndex === chunk.anchors.length - 1 };
    },
    root,
  });
  if (location !== undefined) callback(location);
}

function findSectionTarget(root: HTMLElement | null, ordinal: number, id: string | undefined, blockId: string | undefined): HTMLElement | null {
  if (id !== undefined) return document.getElementById(id);
  if (blockId !== undefined) return [...(root?.querySelectorAll<HTMLElement>("[data-reader-block-id]") ?? [])].find((element) => element.dataset.readerBlockId === blockId) ?? null;
  return root?.querySelector<HTMLElement>(`[data-reader-ordinal="${String(ordinal)}"]`) ?? null;
}

function createSectionWindow(section: SectionRef, targetOrdinal: number): { readonly start: number; readonly end: number } {
  const target = Math.min(Math.max(targetOrdinal, section.startChunkOrdinal), section.endChunkOrdinalInclusive);
  const start = Math.max(section.startChunkOrdinal, Math.min(target - Math.floor(SECTION_CHUNK_WINDOW_SIZE / 2), section.endChunkOrdinalInclusive - SECTION_CHUNK_WINDOW_SIZE + 1));
  return { end: Math.min(section.endChunkOrdinalInclusive, start + SECTION_CHUNK_WINDOW_SIZE - 1), start };
}
function moveSectionWindow(section: SectionRef, current: { readonly start: number; readonly end: number }, direction: "back" | "forward"): { readonly start: number; readonly end: number } {
  return createSectionWindow(section, direction === "back" ? current.start - SECTION_CHUNK_WINDOW_SIZE : current.end + 1);
}
