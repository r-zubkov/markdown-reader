export type VirtualChunkKind =
  | "code"
  | "heading"
  | "huge"
  | "list"
  | "media"
  | "paragraph"
  | "table";

export interface VirtualChunkFixture {
  readonly bodyLines: readonly string[];
  readonly estimatedSize: number;
  readonly hasFocusTarget: boolean;
  readonly id: string;
  readonly index: number;
  readonly kind: VirtualChunkKind;
  readonly marker: "first" | "last" | "middle" | null;
  readonly title: string;
}

const WORDS = [
  "anchor",
  "browser",
  "cache",
  "document",
  "estimate",
  "focus",
  "heading",
  "layout",
  "marker",
  "reader",
  "semantic",
  "viewport",
] as const;

export function createVirtualChunkKey(index: number): string {
  return `virtual-spike-v1:${String(index)}`;
}

export function estimateVirtualChunkSize(index: number, count: number): number {
  if (index === 0 || index === count - 1) {
    return 840;
  }

  // Deliberately exercise poor estimates without allowing a zero-sized item.
  if (index % 997 === 0) {
    return 1;
  }

  if (index % 1_999 === 0) {
    return 720;
  }

  const kind = chunkKind(index);
  switch (kind) {
    case "code":
      return 224;
    case "heading":
      return 132;
    case "huge":
      return 840;
    case "list":
      return 176;
    case "media":
      return 248;
    case "paragraph":
      return 128 + seededValue(index, 4) * 28;
    case "table":
      return 216;
  }
}

export function createVirtualChunk(
  index: number,
  count: number,
): VirtualChunkFixture {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(
      `Chunk index ${String(index)} is outside 0..${String(count - 1)}.`,
    );
  }

  const kind = chunkKind(index, count);
  const lineCount = kind === "huge" ? 18 : 1 + seededValue(index, 5);
  const bodyLines = Array.from({ length: lineCount }, (_, lineIndex) =>
    createLine(index, lineIndex),
  );

  return {
    bodyLines,
    estimatedSize: estimateVirtualChunkSize(index, count),
    hasFocusTarget: index % 47 === 0,
    id: createVirtualChunkKey(index),
    index,
    kind,
    marker: markerFor(index, count),
    title: `Chunk ${index.toLocaleString("en-US")} · ${kind}`,
  };
}

function chunkKind(index: number, count = Number.POSITIVE_INFINITY): VirtualChunkKind {
  if (index === 0 || index === count - 1 || index % 1_237 === 0) {
    return "huge";
  }

  const selector = seededValue(index, 17);
  if (selector <= 1) return "heading";
  if (selector <= 3) return "list";
  if (selector === 4) return "code";
  if (selector === 5) return "table";
  if (selector === 6) return "media";
  return "paragraph";
}

function markerFor(
  index: number,
  count: number,
): "first" | "last" | "middle" | null {
  if (index === 0) return "first";
  if (index === Math.floor(count / 2)) return "middle";
  if (index === count - 1) return "last";
  return null;
}

function seededValue(index: number, modulo: number): number {
  let value = (index + 1) * 2_654_435_761;
  value ^= value >>> 16;
  value = Math.imul(value, 2_246_822_519);
  value ^= value >>> 13;
  return (value >>> 0) % modulo;
}

function createLine(index: number, lineIndex: number): string {
  const first = WORDS[seededValue(index + lineIndex * 3, WORDS.length)] ?? "anchor";
  const second = WORDS[seededValue(index * 7 + lineIndex, WORDS.length)] ?? "reader";
  const third = WORDS[seededValue(index * 11 + lineIndex * 5, WORDS.length)] ?? "viewport";

  return `${first} ${second} ${third}: deterministic content line ${String(lineIndex + 1)} for chunk ${String(index)}.`;
}
