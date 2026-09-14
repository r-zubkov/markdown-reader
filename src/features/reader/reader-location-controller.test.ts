import { afterEach, describe, expect, it, vi } from "vitest";

import type { RepositoryResult } from "@/application/ports/document-repository";
import {
  LOCATION_UI_THROTTLE_MS,
  LOCATION_WRITE_THROTTLE_MS,
  ReaderLocationController,
} from "@/features/reader/reader-location-controller";
import type { ObservedLocation } from "@/features/reader/reader-location-observer";

afterEach(() => { vi.useRealTimers(); });

describe("ReaderLocationController", () => {
  it("throttles React-facing updates and trailing writes below the scroll observation rate", async () => {
    vi.useFakeTimers();
    const ui = vi.fn();
    const persist = vi.fn<(location: ObservedLocation, updatedAt: number) => Promise<RepositoryResult<void>>>().mockResolvedValue({ ok: true, value: undefined });
    const controller = new ReaderLocationController({ onPersistenceStatus: vi.fn(), onUiLocation: ui, persist });

    for (let index = 0; index < 50; index += 1) controller.observe(location(index / 100));
    expect(controller.getMetrics()).toEqual({ observations: 50, uiUpdates: 0, writes: 0 });

    await vi.advanceTimersByTimeAsync(LOCATION_UI_THROTTLE_MS);
    expect(ui).toHaveBeenCalledTimes(1);
    expect(ui).toHaveBeenLastCalledWith(location(0.49));
    expect(persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(LOCATION_WRITE_THROTTLE_MS - LOCATION_UI_THROTTLE_MS);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(controller.getMetrics()).toEqual({ observations: 50, uiUpdates: 1, writes: 1 });
  });

  it("flushes a pending location immediately and reports a failed durable write", async () => {
    vi.useFakeTimers();
    const statuses = vi.fn();
    const persist = vi.fn().mockResolvedValue({ ok: false, error: { code: "QUOTA_EXCEEDED" } } as const);
    const controller = new ReaderLocationController({ onPersistenceStatus: statuses, onUiLocation: vi.fn(), persist });
    controller.observe(location(0.4));

    await expect(controller.flush()).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(statuses).toHaveBeenNthCalledWith(1, "saving");
    expect(statuses).toHaveBeenNthCalledWith(2, "failed");
    await vi.runAllTimersAsync();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

function location(ratio: number): ObservedLocation {
  return {
    anchor: {
      blockId: "block",
      blockOrdinalWithinHeading: 0,
      headingPathKey: "root",
      intraBlockRatio: ratio,
      overallSourceRatio: ratio,
      versionId: "version",
    },
    chunkOrdinal: 0,
    progressRatio: ratio,
  };
}
