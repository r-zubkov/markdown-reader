import { defaultRangeExtractor, type Range } from "@tanstack/react-virtual";

export const VIRTUAL_READER_SPIKE_CONFIG = {
  anchorTolerancePx: 96,
  cacheLimit: 96,
  chunkCount: 20_000,
  mountedItemBudget: 48,
  overscan: 8,
  scrollPaddingStart: 72,
  sustainedGapMs: 100,
} as const;

export function clampSpikeChunkCount(value: number): number {
  if (!Number.isFinite(value)) {
    return VIRTUAL_READER_SPIKE_CONFIG.chunkCount;
  }

  return Math.min(20_000, Math.max(5_000, Math.trunc(value)));
}

export function createPinnedRangeExtractor(
  pinnedIndex: number | null,
): (range: Range) => number[] {
  return (range) => {
    const indexes = defaultRangeExtractor(range);

    if (
      pinnedIndex === null ||
      pinnedIndex < 0 ||
      pinnedIndex >= range.count ||
      indexes.includes(pinnedIndex)
    ) {
      return indexes;
    }

    return [...indexes, pinnedIndex].sort((left, right) => left - right);
  };
}
