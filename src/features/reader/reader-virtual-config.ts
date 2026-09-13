import { defaultRangeExtractor, type Range } from "@tanstack/react-virtual";

export const READER_VIRTUAL_CONFIG = {
  anchorTolerancePx: 96,
  cacheLimit: 96,
  initialWindowSize: 24,
  mountedItemBudget: 48,
  overscan: 8,
  requestWindowSize: 32,
  scrollPaddingStart: 72,
  sustainedGapMs: 100,
} as const;

export function createReaderRangeExtractor(
  pinnedOrdinal: number | null,
): (range: Range) => number[] {
  return (range) => {
    const ordinals = defaultRangeExtractor(range);
    if (
      pinnedOrdinal === null ||
      pinnedOrdinal < 0 ||
      pinnedOrdinal >= range.count ||
      ordinals.includes(pinnedOrdinal)
    ) {
      return ordinals;
    }

    return [...ordinals, pinnedOrdinal].sort((left, right) => left - right);
  };
}

export function estimateReaderChunkSize(estimatedCost: number | undefined): number {
  if (estimatedCost === undefined || !Number.isFinite(estimatedCost)) return 280;
  return Math.max(96, Math.min(1_400, 72 + estimatedCost * 0.055));
}
