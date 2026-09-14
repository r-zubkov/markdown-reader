import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
} from "react";

import type {
  CurrentDocumentSnapshot,
  DocumentRepository,
  ReaderChunk,
  RepositoryErrorCode,
} from "@/application/ports/document-repository";
import {
  isPageEndReached,
  observeTopMeaningfulLocation,
  READER_LOCATION_LINE_PX,
  type ObservedLocation,
} from "@/features/reader/reader-location-observer";
import {
  createReaderRangeExtractor,
  estimateReaderChunkSize,
  READER_VIRTUAL_CONFIG,
} from "@/features/reader/reader-virtual-config";
import { ReaderWindowCache } from "@/features/reader/reader-window-cache";
import { appCopy } from "@/shared/i18n/ru";
import { SafeHtmlChunk } from "@/ui/primitives/SafeHtmlChunk";

export type { ObservedLocation } from "@/features/reader/reader-location-observer";

interface ReaderViewportProps {
  readonly document: CurrentDocumentSnapshot;
  readonly focusTarget: boolean;
  readonly initialChunks: readonly ReaderChunk[];
  readonly onFatalError: (code: RepositoryErrorCode) => void;
  readonly onLocationChange: (location: ObservedLocation) => void;
  readonly onTargetSettled: () => void;
  readonly repository: DocumentRepository;
  readonly targetBlockId?: string;
  readonly targetId?: string;
  readonly targetIntraBlockRatio?: number;
  readonly targetOrdinal: number;
  readonly targetRequestKey: string;
}

interface PendingLayoutAnchor {
  readonly ordinal: number;
  readonly top: number;
}

interface LockedTarget {
  readonly blockId: string | undefined;
  readonly id: string | undefined;
  readonly intraBlockRatio: number;
  readonly key: string;
  readonly ordinal: number;
}

export function ReaderViewport({
  document: documentSnapshot,
  focusTarget,
  initialChunks,
  onFatalError,
  onLocationChange,
  onTargetSettled,
  repository,
  targetBlockId,
  targetId,
  targetIntraBlockRatio = 0,
  targetOrdinal,
  targetRequestKey,
}: ReaderViewportProps) {
  const cache = useMemo(() => {
    const next = new ReaderWindowCache({
      documentId: documentSnapshot.documentId,
      limit: READER_VIRTUAL_CONFIG.cacheLimit,
      pipelineVersion: documentSnapshot.pipelineVersion,
      repository,
    });
    next.prime(initialChunks, [targetOrdinal]);
    return next;
  }, [documentSnapshot.documentId, documentSnapshot.pipelineVersion, initialChunks, repository, targetOrdinal]);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingRequestsRef = useRef(new Set<string>());
  const pendingLayoutAnchorRef = useRef<PendingLayoutAnchor | null>(null);
  const lastLayoutAnchorRef = useRef<PendingLayoutAnchor | null>(null);
  const layoutFrameRef = useRef(0);
  const settledTargetRef = useRef<string | null>(null);
  const targetLockRef = useRef<LockedTarget | null>(null);
  const [cacheRevision, setCacheRevision] = useState(0);
  const [fetchCount, setFetchCount] = useState(0);
  const [isJumping, setIsJumping] = useState(true);
  const [isRemeasuring, setIsRemeasuring] = useState(false);
  const [lastDriftPx, setLastDriftPx] = useState(0);
  const [listOffset, setListOffset] = useState(0);
  const [pinnedOrdinal, setPinnedOrdinal] = useState<number | null>(null);

  const rangeExtractor = useMemo(
    () => createReaderRangeExtractor(pinnedOrdinal),
    [pinnedOrdinal],
  );
  const estimateSize = useCallback((ordinal: number) => {
    const entry = cache.peek(ordinal);
    return estimateReaderChunkSize(entry?.kind === "chunk" ? entry.chunk.estimatedCost : undefined);
  }, [cache]);
  const getItemKey = useCallback(
    (ordinal: number) => `${documentSnapshot.versionId}:${String(ordinal)}`,
    [documentSnapshot.versionId],
  );
  const measureElement = useCallback((element: HTMLDivElement): number => {
    const height = element.getBoundingClientRect().height;
    if (height > 0) return height;
    const ordinal = Number(element.dataset.index);
    return Number.isInteger(ordinal) ? estimateSize(ordinal) : 1;
  }, [estimateSize]);

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: documentSnapshot.chunkCount,
    estimateSize,
    getItemKey,
    initialRect: { height: window.innerHeight, width: window.innerWidth },
    measureElement,
    overscan: READER_VIRTUAL_CONFIG.overscan,
    rangeExtractor,
    scrollMargin: listOffset,
    scrollPaddingStart: READER_VIRTUAL_CONFIG.scrollPaddingStart,
    useFlushSync: false,
  });

  useLayoutEffect(() => {
    const updateOffset = () => {
      const element = listRef.current;
      if (element === null) return;
      const next = element.getBoundingClientRect().top + window.scrollY;
      setListOffset((current) => current === next ? current : next);
    };
    updateOffset();
  }, []);

  const virtualItems = virtualizer.getVirtualItems();
  const virtualOrdinals = virtualItems.map((item) => item.index);
  const virtualOrdinalsKey = virtualOrdinals.join(",");
  const visibleCluster = virtualOrdinals.filter((ordinal) => ordinal !== pinnedOrdinal);
  const visibleClusterKey = visibleCluster.join(",");
  const range = createRequestRange(
    visibleClusterKey.length > 0 ? parseOrdinals(visibleClusterKey) : parseOrdinals(virtualOrdinalsKey),
    documentSnapshot.chunkCount,
  );
  const rangeStart = range?.start ?? -1;
  const rangeEnd = range?.end ?? -1;

  useEffect(() => {
    if (rangeStart < 0 || rangeEnd < rangeStart || cache.hasRange(rangeStart, rangeEnd)) return;
    const key = `${String(rangeStart)}:${String(rangeEnd)}`;
    if (pendingRequestsRef.current.has(key)) return;
    pendingRequestsRef.current.add(key);
    setFetchCount((count) => count + 1);
    let active = true;
    const protectedOrdinals = [...parseOrdinals(virtualOrdinalsKey)];
    if (settledTargetRef.current !== targetRequestKey && !protectedOrdinals.includes(targetOrdinal)) protectedOrdinals.push(targetOrdinal);
    void cache.loadRange(rangeStart, rangeEnd, protectedOrdinals).then((result) => {
      pendingRequestsRef.current.delete(key);
      setFetchCount((count) => Math.max(0, count - 1));
      if (!active) return;
      if (result.fatalCode !== undefined) {
        onFatalError(result.fatalCode);
        return;
      }
      setCacheRevision((revision) => revision + 1);
      queueMicrotask(() => { virtualizer.measure(); });
    });
    return () => { active = false; };
  }, [cache, onFatalError, rangeEnd, rangeStart, targetOrdinal, targetRequestKey, virtualOrdinalsKey, virtualizer]);

  useLayoutEffect(() => {
    if (settledTargetRef.current === targetRequestKey) return;
    targetLockRef.current = { blockId: targetBlockId, id: targetId, intraBlockRatio: targetIntraBlockRatio, key: targetRequestKey, ordinal: targetOrdinal };
    setIsJumping(true);
    virtualizer.scrollToIndex(targetOrdinal, { align: "start", behavior: "auto" });
    let frame = 0;
    let attempts = 0;
    const settle = () => {
      attempts += 1;
      virtualizer.measure();
      const target = findTargetElement(targetOrdinal, targetId, targetBlockId);
      if (!(target instanceof HTMLElement)) virtualizer.scrollToIndex(targetOrdinal, { align: "start", behavior: "auto" });
      const modalOverlayOpen = document.querySelector('[role="dialog"]') !== null;
      if (target instanceof HTMLElement) {
        alignTarget(target, targetBlockId === undefined ? 0 : targetIntraBlockRatio);
        if (focusTarget && !modalOverlayOpen) {
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }
      if (attempts < 120 && (!(target instanceof HTMLElement) || fetchCount > 0 || attempts < (focusTarget ? 30 : 6))) {
        frame = window.requestAnimationFrame(settle);
        return;
      }
      if (!(target instanceof HTMLElement) || fetchCount > 0) return;
      settledTargetRef.current = targetRequestKey;
      setIsJumping(false);
      onTargetSettled();
      emitObservedLocation(cache, documentSnapshot.chunkCount, onLocationChange);
      lastLayoutAnchorRef.current = snapshotTopChunk();
    };
    frame = window.requestAnimationFrame(settle);
    return () => { window.cancelAnimationFrame(frame); };
  }, [cache, cacheRevision, documentSnapshot.chunkCount, fetchCount, focusTarget, onLocationChange, onTargetSettled, targetBlockId, targetId, targetIntraBlockRatio, targetOrdinal, targetRequestKey, virtualizer]);

  useEffect(() => {
    let frame = 0;
    const alignLockedTarget = () => {
      const locked = targetLockRef.current;
      if (locked === null) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const target = findTargetElement(locked.ordinal, locked.id, locked.blockId);
        if (target instanceof HTMLElement) alignTarget(target, locked.blockId === undefined ? 0 : locked.intraBlockRatio);
        else virtualizer.scrollToIndex(locked.ordinal, { align: "start", behavior: "auto" });
      });
    };
    const container = listRef.current?.querySelector(".reader-viewport__size-container");
    if (!(container instanceof HTMLElement)) return;
    const observer = new ResizeObserver(alignLockedTarget);
    observer.observe(container);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cacheRevision, virtualizer]);

  useEffect(() => {
    const release = () => { targetLockRef.current = null; };
    const releaseForKey = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "].includes(event.key)) release();
    };
    window.addEventListener("keydown", releaseForKey);
    window.addEventListener("pointerdown", release);
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("wheel", release, { passive: true });
    return () => {
      window.removeEventListener("keydown", releaseForKey);
      window.removeEventListener("pointerdown", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("wheel", release);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const observe = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        emitObservedLocation(cache, documentSnapshot.chunkCount, onLocationChange);
        lastLayoutAnchorRef.current = snapshotTopChunk();
      });
    };
    window.addEventListener("scroll", observe, { passive: true });
    observe();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", observe);
    };
  }, [cache, cacheRevision, documentSnapshot.chunkCount, onLocationChange]);

  useEffect(() => {
    const captureAnchor = () => {
      const anchor = findTopChunkElement();
      if (anchor === null) return;
      pendingLayoutAnchorRef.current = {
        ordinal: Number(anchor.dataset.readerVirtualOrdinal),
        top: anchor.getBoundingClientRect().top,
      };
      setIsRemeasuring(true);
      setPinnedOrdinal(Number(anchor.dataset.readerVirtualOrdinal));
    };
    window.addEventListener("markdown-reader:before-layout-change", captureAnchor);
    return () => { window.removeEventListener("markdown-reader:before-layout-change", captureAnchor); };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      virtualizer.measure();
      const pending = pendingLayoutAnchorRef.current;
      if (pending === null) return;
      let frame = 0;
      let attempts = 0;
      const restore = () => {
        attempts += 1;
        const element = getChunkElement(pending.ordinal);
        if (element !== null) {
          const drift = element.getBoundingClientRect().top - pending.top;
          if (Math.abs(drift) > 0.5) window.scrollBy(0, drift);
          if (attempts === 6) setLastDriftPx(Math.abs(element.getBoundingClientRect().top - pending.top));
        }
        if (attempts < 6) {
          frame = window.requestAnimationFrame(restore);
          return;
        }
        pendingLayoutAnchorRef.current = null;
        setPinnedOrdinal(null);
        setIsRemeasuring(false);
      };
      frame = window.requestAnimationFrame(restore);
      return () => { window.cancelAnimationFrame(frame); };
    });
    observer.observe(document.documentElement, { attributeFilter: ["data-theme"], attributes: true });
    return () => { observer.disconnect(); };
  }, [virtualizer]);

  useEffect(() => {
    const restoreAfterResize = () => {
      const list = listRef.current;
      if (list !== null) {
        const nextOffset = list.getBoundingClientRect().top + window.scrollY;
        setListOffset((current) => current === nextOffset ? current : nextOffset);
      }
      const pending = lastLayoutAnchorRef.current;
      if (pending === null) return;
      pendingLayoutAnchorRef.current = pending;
      setIsRemeasuring(true);
      setPinnedOrdinal(pending.ordinal);
      window.cancelAnimationFrame(layoutFrameRef.current);
      virtualizer.measure();
      let attempts = 0;
      const restore = () => {
        attempts += 1;
        const element = getChunkElement(pending.ordinal);
        if (element !== null) {
          const drift = element.getBoundingClientRect().top - pending.top;
          if (Math.abs(drift) > 0.5) window.scrollBy(0, drift);
          if (attempts === 12) setLastDriftPx(Math.abs(element.getBoundingClientRect().top - pending.top));
        }
        if (attempts < 12) {
          layoutFrameRef.current = window.requestAnimationFrame(restore);
          return;
        }
        pendingLayoutAnchorRef.current = null;
        lastLayoutAnchorRef.current = snapshotTopChunk();
        setPinnedOrdinal(null);
        setIsRemeasuring(false);
      };
      layoutFrameRef.current = window.requestAnimationFrame(restore);
    };
    window.addEventListener("resize", restoreAfterResize);
    return () => {
      window.cancelAnimationFrame(layoutFrameRef.current);
      window.removeEventListener("resize", restoreAfterResize);
    };
  }, [virtualizer]);

  function handleFocus(event: ReactFocusEvent<HTMLDivElement>): void {
    if (!(event.target instanceof Element)) return;
    const chunk = event.target.closest<HTMLElement>("[data-reader-virtual-ordinal]");
    const ordinal = Number(chunk?.dataset.readerVirtualOrdinal);
    if (Number.isInteger(ordinal)) setPinnedOrdinal(ordinal);
  }

  function handleBlur(event: ReactFocusEvent<HTMLDivElement>): void {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setPinnedOrdinal(null);
  }

  function retryOrdinal(ordinal: number): void {
    cache.delete(ordinal);
    setCacheRevision((revision) => revision + 1);
  }

  const containerStyle: CSSProperties = {
    height: virtualizer.getTotalSize(),
    position: "relative",
  };

  return <div
    aria-busy={isJumping || isRemeasuring || fetchCount > 0}
    className="reader-viewport"
    data-cache-count={cache.size}
    data-focus-target={String(focusTarget)}
    data-first-mounted={virtualOrdinals[0] ?? -1}
    data-last-mounted={virtualOrdinals.at(-1) ?? -1}
    data-last-drift-px={lastDriftPx.toFixed(2)}
    data-mounted-count={virtualItems.length}
    data-remeasuring={String(isRemeasuring)}
    data-target-ordinal={targetOrdinal}
    data-target-block-id={targetBlockId ?? ""}
    data-testid="reader-viewport"
    onBlurCapture={handleBlur}
    onFocusCapture={handleFocus}
    ref={listRef}
  >
    {fetchCount > 0 ? <p className="reader-viewport__fetch-status" role="status">{appCopy.reader.loadingWindow}</p> : null}
    <div className="reader-viewport__size-container" style={containerStyle}>
      {virtualItems.map((virtualItem) => {
        const entry = cache.peek(virtualItem.index);
        return <div
          className="reader-chunk reader-virtual__chunk"
          data-index={virtualItem.index}
          data-reader-virtual-ordinal={virtualItem.index}
          id={`reader-chunk-${String(virtualItem.index)}`}
          key={virtualItem.key}
          ref={virtualizer.measureElement}
          style={{
            insetInlineStart: 0,
            position: "absolute",
            top: 0,
            transform: `translateY(${String(virtualItem.start - listOffset)}px)`,
            width: "100%",
          }}
        >
          {entry === undefined ? <ReaderChunkPlaceholder ordinal={virtualItem.index} /> : null}
          {entry?.kind === "error" ? <ReaderChunkError onRetry={() => { retryOrdinal(virtualItem.index); }} ordinal={virtualItem.index} /> : null}
          {entry?.kind === "chunk" ? <>
            {entry.chunk.renderState === "safe-fallback" ? <p className="reader-chunk__local-status" role="note">{appCopy.reader.safeFallback}</p> : null}
            <SafeHtmlChunk
              anchors={entry.chunk.anchors}
              html={entry.chunk.html}
              ordinal={entry.chunk.ordinal}
            />
          </> : null}
        </div>;
      })}
    </div>
  </div>;
}

function createRequestRange(ordinals: readonly number[], chunkCount: number): { readonly end: number; readonly start: number } | undefined {
  if (ordinals.length === 0 || chunkCount < 1) return undefined;
  const first = Math.min(...ordinals);
  const last = Math.max(...ordinals);
  const desired = READER_VIRTUAL_CONFIG.requestWindowSize;
  const padding = Math.max(0, desired - (last - first + 1));
  const start = Math.max(0, first - Math.floor(padding / 2));
  const end = Math.min(chunkCount - 1, Math.max(last, start + desired - 1));
  return { end, start: Math.max(0, Math.min(start, end - desired + 1)) };
}

function parseOrdinals(value: string): readonly number[] {
  if (value.length === 0) return [];
  return value.split(",").map(Number).filter(Number.isInteger);
}

function getChunkElement(ordinal: number): HTMLDivElement | null {
  return document.querySelector<HTMLDivElement>(`[data-reader-virtual-ordinal="${String(ordinal)}"]`);
}

function findTopChunkElement(): HTMLElement | null {
  const line = READER_VIRTUAL_CONFIG.scrollPaddingStart;
  return [...document.querySelectorAll<HTMLElement>("[data-reader-virtual-ordinal]")]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.bottom > line)
    .sort((left, right) => left.rect.top - right.rect.top)[0]?.element ?? null;
}

function snapshotTopChunk(): PendingLayoutAnchor | null {
  const element = findTopChunkElement();
  if (element === null) return null;
  const ordinal = Number(element.dataset.readerVirtualOrdinal);
  if (!Number.isInteger(ordinal)) return null;
  return { ordinal, top: element.getBoundingClientRect().top };
}

function emitObservedLocation(
  cache: ReaderWindowCache,
  chunkCount: number,
  callback: (location: ObservedLocation) => void,
): void {
  const root = document.querySelector<HTMLElement>(".reader-viewport");
  if (root === null) return;
  const location = observeTopMeaningfulLocation({
    pageEndReached: isPageEndReached(),
    resolveAnchor: (ordinal, blockIndex) => {
      const entry = cache.peek(ordinal);
      if (entry?.kind !== "chunk") return undefined;
      const block = entry.chunk.anchors[blockIndex];
      if (block === undefined) return undefined;
      return { block, isFinalBlock: ordinal === chunkCount - 1 && blockIndex === entry.chunk.anchors.length - 1 };
    },
    root,
  });
  if (location !== undefined) callback(location);
}

function findTargetElement(ordinal: number, id: string | undefined, blockId: string | undefined): HTMLElement | null {
  if (id !== undefined) return document.getElementById(id);
  if (blockId !== undefined) return [...document.querySelectorAll<HTMLElement>("[data-reader-block-id]")].find((element) => element.dataset.readerBlockId === blockId) ?? null;
  return getChunkElement(ordinal);
}

function alignTarget(target: HTMLElement, intraBlockRatio: number): void {
  target.scrollIntoView({ block: "start", behavior: "auto" });
  const offset = Math.max(0, target.getBoundingClientRect().height) * Math.min(1, Math.max(0, intraBlockRatio)) - READER_LOCATION_LINE_PX;
  if (offset !== 0) window.scrollBy(0, offset);
}

function ReaderChunkPlaceholder({ ordinal }: { readonly ordinal: number }) {
  return <div aria-hidden="true" className="reader-chunk__placeholder" data-placeholder-ordinal={ordinal} />;
}

function ReaderChunkError({ onRetry, ordinal }: { readonly onRetry: () => void; readonly ordinal: number }) {
  return <div className="reader-chunk__error" role="group">
    <p>{appCopy.reader.chunkUnavailable}</p>
    <button onClick={onRetry} type="button">{appCopy.reader.retryChunk} {String(ordinal + 1)}</button>
  </div>;
}
