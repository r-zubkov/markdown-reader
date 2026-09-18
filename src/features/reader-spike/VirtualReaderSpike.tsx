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
  type ReactNode,
} from "react";

import { BoundedChunkWindow } from "./bounded-chunk-window";
import {
  clampSpikeChunkCount,
  createPinnedRangeExtractor,
  VIRTUAL_READER_SPIKE_CONFIG,
} from "./virtual-reader-config";
import {
  createVirtualChunkKey,
  estimateVirtualChunkSize,
  type VirtualChunkFixture,
} from "./virtual-reader-fixture";

interface PendingAnchor {
  readonly index: number;
  readonly top: number;
}

interface VirtualReaderSpikeProps {
  readonly chunkCount?: number;
  readonly directDomUpdates?: boolean;
  readonly useFlushSync?: boolean;
}

interface LongTaskMetrics {
  readonly count: number;
  readonly longestMs: number;
}

const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function VirtualReaderSpikeFromLocation() {
  const parameters = new URLSearchParams(window.location.search);
  const countParameter = parameters.get("count");
  const requestedCount =
    countParameter === null
      ? VIRTUAL_READER_SPIKE_CONFIG.chunkCount
      : Number(countParameter);

  return (
    <VirtualReaderSpike
      chunkCount={clampSpikeChunkCount(requestedCount)}
      directDomUpdates={parameters.get("direct") === "1"}
      useFlushSync={parameters.get("flush") === "1"}
    />
  );
}

export function VirtualReaderSpike({
  chunkCount = VIRTUAL_READER_SPIKE_CONFIG.chunkCount,
  directDomUpdates = false,
  useFlushSync = false,
}: VirtualReaderSpikeProps) {
  const count = clampSpikeChunkCount(chunkCount);
  const chunkWindow = useMemo(
    () => new BoundedChunkWindow(count, VIRTUAL_READER_SPIKE_CONFIG.cacheLimit),
    [count],
  );
  const listRef = useRef<HTMLElement>(null);
  const pendingAnchorRef = useRef<PendingAnchor | null>(null);
  const [listOffset, setListOffset] = useState(0);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [compactMeasure, setCompactMeasure] = useState(false);
  const [lateMediaIndex, setLateMediaIndex] = useState<number | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [lastDriftPx, setLastDriftPx] = useState(0);
  const [maximumMounted, setMaximumMounted] = useState(0);
  const [maximumCached, setMaximumCached] = useState(0);
  const longTasks = useLongTaskMetrics();

  const rangeExtractor = useMemo(
    () => createPinnedRangeExtractor(pinnedIndex),
    [pinnedIndex],
  );
  const getItemKey = useCallback((index: number) => createVirtualChunkKey(index), []);
  const estimateSize = useCallback(
    (index: number) => estimateVirtualChunkSize(index, count),
    [count],
  );
  const measureElement = useCallback(
    (element: HTMLDivElement): number => {
      const measuredHeight = element.getBoundingClientRect().height;
      if (measuredHeight > 0) return measuredHeight;

      const index = Number(element.dataset.index);
      return Number.isInteger(index) ? estimateSize(index) : 1;
    },
    [estimateSize],
  );

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count,
    directDomUpdates,
    estimateSize,
    getItemKey,
    initialRect: {
      height: window.innerHeight,
      width: window.innerWidth,
    },
    measureElement,
    overscan: VIRTUAL_READER_SPIKE_CONFIG.overscan,
    rangeExtractor,
    scrollMargin: listOffset,
    scrollPaddingStart: VIRTUAL_READER_SPIKE_CONFIG.scrollPaddingStart,
    useFlushSync,
  });

  useLayoutEffect(() => {
    const nextOffset = listRef.current?.offsetTop ?? 0;
    setListOffset((currentOffset) =>
      currentOffset === nextOffset ? currentOffset : nextOffset,
    );
  }, []);

  useLayoutEffect(() => {
    const pendingAnchor = pendingAnchorRef.current;
    if (pendingAnchor === null) return;

    virtualizer.measure();
    let frame = 0;
    let frameCount = 0;
    const restoreAnchor = () => {
      const anchorElement = getChunkElement(pendingAnchor.index);
      if (anchorElement === null) return;

      const drift = anchorElement.getBoundingClientRect().top - pendingAnchor.top;
      if (Math.abs(drift) > 0.5) window.scrollBy(0, drift);
      frameCount += 1;

      if (frameCount < 6) {
        frame = window.requestAnimationFrame(restoreAnchor);
        return;
      }

      const stabilizedElement = getChunkElement(pendingAnchor.index);
      if (stabilizedElement !== null) {
        setLastDriftPx(
          Math.abs(stabilizedElement.getBoundingClientRect().top - pendingAnchor.top),
        );
      }
      pendingAnchorRef.current = null;
      setPinnedIndex(null);
    };
    frame = window.requestAnimationFrame(restoreAnchor);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [layoutRevision, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const virtualIndexes = virtualItems.map((item) => item.index);
  const chunks = chunkWindow.readIndexes(
    virtualIndexes,
    pinnedIndex === null ? [] : [pinnedIndex],
  );
  const chunksByIndex = new Map(chunks.map((chunk) => [chunk.index, chunk]));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMaximumMounted((current) => Math.max(current, virtualItems.length));
      setMaximumCached((current) => Math.max(current, chunkWindow.size));
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [chunkWindow, virtualItems.length]);

  function beginLayoutChange(change: () => void) {
    const anchor = findViewportAnchor();
    if (anchor !== null) {
      const element = getChunkElement(anchor.index);
      if (element !== null) {
        pendingAnchorRef.current = {
          index: anchor.index,
          top: element.getBoundingClientRect().top,
        };
        setPinnedIndex(anchor.index);
      }
    }

    change();
    setLayoutRevision((revision) => revision + 1);
  }

  function jumpTo(index: number) {
    setPinnedIndex(null);
    virtualizer.scrollToIndex(index, { align: "start", behavior: "auto" });
    let attempts = 0;
    const settleTarget = () => {
      attempts += 1;
      virtualizer.measure();
      virtualizer.scrollToIndex(index, { align: "start", behavior: "auto" });
      const target = getChunkElement(index);
      if (target !== null) {
        const drift = target.getBoundingClientRect().top - VIRTUAL_READER_SPIKE_CONFIG.scrollPaddingStart;
        if (Math.abs(drift) > 0.5) window.scrollBy(0, drift);
      }
      if (attempts < 6) {
        window.requestAnimationFrame(settleTarget);
        return;
      }
      const stabilizedTarget = getChunkElement(index);
      if (stabilizedTarget !== null) {
        setLastDriftPx(Math.abs(
          stabilizedTarget.getBoundingClientRect().top - VIRTUAL_READER_SPIKE_CONFIG.scrollPaddingStart,
        ));
      }
    };
    window.requestAnimationFrame(settleTarget);
  }

  function handleFocus(event: ReactFocusEvent<HTMLElement>) {
    if (!(event.target instanceof Element)) return;
    const chunkElement = event.target.closest<HTMLElement>("[data-index]");
    if (chunkElement === null) return;

    const index = Number(chunkElement.dataset.index);
    if (Number.isInteger(index)) setPinnedIndex(index);
  }

  function handleBlur(event: ReactFocusEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setPinnedIndex(null);
  }

  const middleIndex = Math.floor(count / 2);
  const firstRendered = virtualIndexes.at(0) ?? -1;
  const lastRendered = virtualIndexes.at(-1) ?? -1;
  const containerStyle: CSSProperties = directDomUpdates
    ? { position: "relative" }
    : { height: virtualizer.getTotalSize(), position: "relative" };

  return (
    <div className={`virtual-reader-spike virtual-reader-spike--${theme}`}>
      <header className="virtual-reader-spike__toolbar" id="spike-controls">
        <div>
          <p className="virtual-reader-spike__eyebrow">P00-T04 diagnostic</p>
          <h1>Continuous virtual reader</h1>
        </div>
        <nav aria-label="Virtual reader diagnostic controls">
          <button type="button" onClick={() => { jumpTo(0); }}>
            First
          </button>
          <button type="button" onClick={() => { jumpTo(middleIndex); }}>
            Middle
          </button>
          <button type="button" onClick={() => { jumpTo(count - 1); }}>
            Last
          </button>
          <button
            type="button"
            onClick={() => {
              beginLayoutChange(() => {
                setTheme((value) => (value === "light" ? "dark" : "light"));
              });
            }}
          >
            Toggle theme
          </button>
          <button
            type="button"
            onClick={() => {
              beginLayoutChange(() => {
                setCompactMeasure((value) => !value);
              });
            }}
          >
            Toggle width
          </button>
          <button
            type="button"
            onClick={() => {
              const anchor = findViewportAnchor();
              const imageIndex = Math.max(0, (anchor?.index ?? middleIndex) - 2);
              beginLayoutChange(() => {
                setLateMediaIndex(imageIndex);
              });
            }}
          >
            Load image above
          </button>
        </nav>
        <output
          aria-label="Virtual reader metrics"
          className="virtual-reader-spike__metrics"
          data-cache-count={chunkWindow.size}
          data-direct-dom-updates={String(directDomUpdates)}
          data-first-rendered={firstRendered}
          data-flush-sync={String(useFlushSync)}
          data-last-drift-px={lastDriftPx.toFixed(2)}
          data-last-rendered={lastRendered}
          data-long-task-count={longTasks.count}
          data-longest-task-ms={longTasks.longestMs.toFixed(2)}
          data-max-cache-count={maximumCached}
          data-max-mounted-count={maximumMounted}
          data-mounted-count={virtualItems.length}
          data-pinned-index={pinnedIndex ?? ""}
          data-testid="virtual-reader-metrics"
        >
          mounted {virtualItems.length}/{VIRTUAL_READER_SPIKE_CONFIG.mountedItemBudget} · cached{" "}
          {chunkWindow.size}/{VIRTUAL_READER_SPIKE_CONFIG.cacheLimit} · drift {lastDriftPx.toFixed(1)} px
        </output>
      </header>

      <main className="virtual-reader-spike__main">
        <p className="virtual-reader-spike__notice">
          Diagnostic fixture: {count.toLocaleString("en-US")} deterministic chunks. Configuration:{" "}
          flushSync {String(useFlushSync)}, direct DOM updates {String(directDomUpdates)}.
        </p>
        <article
          aria-label="Virtualized diagnostic document"
          className={compactMeasure ? "virtual-reader-spike__article is-compact" : "virtual-reader-spike__article"}
          onBlurCapture={handleBlur}
          onFocusCapture={handleFocus}
          ref={listRef}
        >
          <div
            className="virtual-reader-spike__size-container"
            ref={directDomUpdates ? virtualizer.containerRef : undefined}
            style={containerStyle}
          >
            {virtualItems.map((virtualItem) => {
              const chunk = chunksByIndex.get(virtualItem.index);
              if (chunk === undefined) return null;

              const itemStyle: CSSProperties = directDomUpdates
                ? {
                    insetInlineStart: 0,
                    position: "absolute",
                    top: 0,
                    width: "100%",
                  }
                : {
                    insetInlineStart: 0,
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${String(virtualItem.start - listOffset)}px)`,
                    width: "100%",
                  };

              return (
                <div
                  className="virtual-reader-spike__chunk"
                  data-index={virtualItem.index}
                  data-kind={chunk.kind}
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  style={itemStyle}
                >
                  <ChunkContent
                    chunk={chunk}
                    imageExpanded={lateMediaIndex === chunk.index}
                  />
                </div>
              );
            })}
          </div>
        </article>
      </main>
    </div>
  );
}

function ChunkContent({
  chunk,
  imageExpanded,
}: {
  readonly chunk: VirtualChunkFixture;
  readonly imageExpanded: boolean;
}) {
  return (
    <section className="reader-content" data-chunk-id={chunk.id}>
      {chunk.marker === null ? null : (
        <strong className="virtual-reader-spike__marker" data-marker={chunk.marker}>
          {chunk.marker.toUpperCase()} MARKER — chunk {chunk.index}
        </strong>
      )}
      <h2>{chunk.title}</h2>
      {renderChunkBody(chunk)}
      {imageExpanded ? (
        <img
          alt={`Late-loading diagnostic for chunk ${String(chunk.index)}`}
          className="virtual-reader-spike__late-image"
          height="420"
          src={TRANSPARENT_PIXEL}
          width="720"
        />
      ) : null}
      {chunk.hasFocusTarget ? (
        <button className="virtual-reader-spike__focus-target" data-focus-target type="button">
          Focus target {chunk.index}
        </button>
      ) : null}
    </section>
  );
}

function renderChunkBody(chunk: VirtualChunkFixture): ReactNode {
  switch (chunk.kind) {
    case "code":
      return <pre><code>{chunk.bodyLines.join("\n")}</code></pre>;
    case "heading":
      return <p><strong>{chunk.bodyLines.join(" ")}</strong></p>;
    case "huge":
      return chunk.bodyLines.map((line, index) => <p key={`${chunk.id}:${String(index)}`}>{line}</p>);
    case "list":
      return <ul>{chunk.bodyLines.map((line, index) => <li key={`${chunk.id}:${String(index)}`}>{line}</li>)}</ul>;
    case "media":
      return (
        <figure>
          <div aria-label="Reserved diagnostic media" className="virtual-reader-spike__media" role="img" />
          <figcaption>{chunk.bodyLines[0]}</figcaption>
        </figure>
      );
    case "paragraph":
      return chunk.bodyLines.map((line, index) => <p key={`${chunk.id}:${String(index)}`}>{line}</p>);
    case "table":
      return (
        <div aria-label={`Scrollable table for chunk ${String(chunk.index)}`} className="virtual-reader-spike__table" role="region" tabIndex={0}>
          <table><tbody>{chunk.bodyLines.map((line, index) => <tr key={`${chunk.id}:${String(index)}`}><th scope="row">{index + 1}</th><td>{line}</td><td>wide-column-{chunk.id}</td></tr>)}</tbody></table>
        </div>
      );
  }
}

function findViewportAnchor(): { readonly index: number } | null {
  const viewportStart = VIRTUAL_READER_SPIKE_CONFIG.scrollPaddingStart;
  const candidates = [...document.querySelectorAll<HTMLElement>(".virtual-reader-spike__chunk")]
    .map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
    }))
    .filter(({ rect }) => rect.bottom > viewportStart && rect.top < window.innerHeight)
    .sort((left, right) => left.rect.top - right.rect.top);
  const index = Number(candidates[0]?.element.dataset.index);
  return Number.isInteger(index) ? { index } : null;
}

function getChunkElement(index: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.virtual-reader-spike__chunk[data-index="${String(index)}"]`);
}

function useLongTaskMetrics(): LongTaskMetrics {
  const [metrics, setMetrics] = useState<LongTaskMetrics>({ count: 0, longestMs: 0 });

  useEffect(() => {
    if (
      typeof PerformanceObserver === "undefined" ||
      !PerformanceObserver.supportedEntryTypes.includes("longtask")
    ) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      setMetrics((current) => ({
        count: current.count + entries.length,
        longestMs: Math.max(current.longestMs, ...entries.map((entry) => entry.duration)),
      }));
    });
    observer.observe({ buffered: true, type: "longtask" });
    return () => {
      observer.disconnect();
    };
  }, []);

  return metrics;
}
