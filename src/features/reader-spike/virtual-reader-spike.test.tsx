import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BoundedChunkWindow } from "./bounded-chunk-window";
import {
  createPinnedRangeExtractor,
  VIRTUAL_READER_SPIKE_CONFIG,
} from "./virtual-reader-config";
import {
  createVirtualChunk,
  createVirtualChunkKey,
  estimateVirtualChunkSize,
} from "./virtual-reader-fixture";
import { VirtualReaderSpike } from "./VirtualReaderSpike";

class ResizeObserverStub {
  disconnect(): void {
    return undefined;
  }
  observe(): void {
    return undefined;
  }
  unobserve(): void {
    return undefined;
  }
}

describe("P00-T04 deterministic virtual reader fixture", () => {
  it("creates stable heterogeneous chunks and boundary markers", () => {
    const count = 20_000;
    const first = createVirtualChunk(0, count);
    const middle = createVirtualChunk(10_000, count);
    const last = createVirtualChunk(count - 1, count);
    const repeated = createVirtualChunk(10_000, count);
    const kinds = new Set(
      Array.from({ length: 200 }, (_, index) => createVirtualChunk(index, count).kind),
    );

    expect(first.marker).toBe("first");
    expect(middle.marker).toBe("middle");
    expect(last.marker).toBe("last");
    expect(repeated).toEqual(middle);
    expect(createVirtualChunkKey(10_000)).toBe(middle.id);
    expect(kinds.size).toBeGreaterThanOrEqual(6);
    expect(estimateVirtualChunkSize(997, count)).toBe(1);
    expect(estimateVirtualChunkSize(1_999, count)).toBe(720);
  });

  it("keeps repository-like range reads bounded while retaining a focus pin", () => {
    const window = new BoundedChunkWindow(20_000, 96);

    for (let start = 0; start < 20_000; start += 64) {
      const indexes = Array.from({ length: 32 }, (_, offset) =>
        Math.min(19_999, start + offset),
      );
      window.readIndexes(indexes, [47]);
      expect(window.size).toBeLessThanOrEqual(96);
    }

    const focused = window.readIndexes([47]);
    expect(focused[0]?.hasFocusTarget).toBe(true);
    expect(window.size).toBeLessThanOrEqual(96);
  });

  it("adds one valid pinned index without disturbing ordinal order", () => {
    const range = { count: 20_000, endIndex: 108, overscan: 8, startIndex: 100 };

    expect(createPinnedRangeExtractor(47)(range)).toEqual([
      47,
      ...Array.from({ length: 25 }, (_, index) => 92 + index),
    ]);
    expect(createPinnedRangeExtractor(null)(range)).toEqual(
      Array.from({ length: 25 }, (_, index) => 92 + index),
    );
    expect(createPinnedRangeExtractor(20_000)(range)).not.toContain(20_000);
  });
});

describe("P00-T04 virtual reader harness", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  it("mounts a bounded first range and pins focused content", async () => {
    render(<VirtualReaderSpike chunkCount={5_000} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Continuous virtual reader" }),
    ).toBeVisible();
    expect(await screen.findByText("FIRST MARKER — chunk 0")).toBeVisible();

    const metrics = screen.getByTestId("virtual-reader-metrics");
    expect(Number(metrics.dataset.mountedCount)).toBeLessThanOrEqual(
      VIRTUAL_READER_SPIKE_CONFIG.mountedItemBudget,
    );
    expect(Number(metrics.dataset.cacheCount)).toBeLessThanOrEqual(
      VIRTUAL_READER_SPIKE_CONFIG.cacheLimit,
    );

    const focusTarget = screen.getByRole("button", { name: "Focus target 0" });
    fireEvent.focus(focusTarget);
    await waitFor(() => {
      expect(metrics).toHaveAttribute("data-pinned-index", "0");
    });

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(document.querySelector(".virtual-reader-spike--dark")).not.toBeNull();
  });
});
