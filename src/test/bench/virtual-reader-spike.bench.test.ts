import { describe, expect, it } from "vitest";

import { BoundedChunkWindow } from "@/features/reader-spike/bounded-chunk-window";
import { VIRTUAL_READER_SPIKE_CONFIG } from "@/features/reader-spike/virtual-reader-config";
import { createVirtualChunk } from "@/features/reader-spike/virtual-reader-fixture";

describe("P00-T04 virtual reader benchmark proxy", () => {
  it("generates and range-reads 20k heterogeneous chunks within a bounded cache", () => {
    const startedAt = performance.now();
    const repositoryWindow = new BoundedChunkWindow(
      VIRTUAL_READER_SPIKE_CONFIG.chunkCount,
      VIRTUAL_READER_SPIKE_CONFIG.cacheLimit,
    );
    const kinds = new Set<string>();

    for (let index = 0; index < VIRTUAL_READER_SPIKE_CONFIG.chunkCount; index += 1) {
      kinds.add(createVirtualChunk(index, VIRTUAL_READER_SPIKE_CONFIG.chunkCount).kind);
    }

    for (let start = 0; start < VIRTUAL_READER_SPIKE_CONFIG.chunkCount; start += 48) {
      const range = Array.from({ length: 32 }, (_, offset) =>
        Math.min(VIRTUAL_READER_SPIKE_CONFIG.chunkCount - 1, start + offset),
      );
      repositoryWindow.readIndexes(range, [47]);
    }

    const elapsedMs = performance.now() - startedAt;
    console.info(
      "P00-T04 virtual reader proxy measurement",
      JSON.stringify({
        cacheCount: repositoryWindow.size,
        chunkCount: VIRTUAL_READER_SPIKE_CONFIG.chunkCount,
        elapsedMs,
        kindCount: kinds.size,
      }),
    );

    expect(kinds.size).toBe(7);
    expect(repositoryWindow.size).toBeLessThanOrEqual(
      VIRTUAL_READER_SPIKE_CONFIG.cacheLimit,
    );
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
