import {
  createVirtualChunk,
  type VirtualChunkFixture,
} from "./virtual-reader-fixture";

export class BoundedChunkWindow {
  readonly #cache = new Map<number, VirtualChunkFixture>();
  readonly #chunkCount: number;
  readonly #limit: number;

  constructor(chunkCount: number, limit: number) {
    if (!Number.isInteger(chunkCount) || chunkCount < 1) {
      throw new RangeError("chunkCount must be a positive integer.");
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError("limit must be a positive integer.");
    }

    this.#chunkCount = chunkCount;
    this.#limit = limit;
  }

  get size(): number {
    return this.#cache.size;
  }

  readIndexes(
    indexes: readonly number[],
    protectedIndexes: readonly number[] = [],
  ): readonly VirtualChunkFixture[] {
    const protectedSet = new Set([...indexes, ...protectedIndexes]);
    if (protectedSet.size > this.#limit) {
      throw new RangeError("Requested and protected chunks exceed the cache limit.");
    }

    const seen = new Set<number>();
    const chunks = indexes.flatMap((index) => {
      if (seen.has(index)) return [];
      seen.add(index);
      return [this.#read(index)];
    });
    this.#evict(protectedSet);

    // Preserve the virtualizer's ordinal order even if callers supplied duplicates.
    return chunks;
  }

  #read(index: number): VirtualChunkFixture {
    const existing = this.#cache.get(index);
    if (existing !== undefined) {
      this.#cache.delete(index);
      this.#cache.set(index, existing);
      return existing;
    }

    const chunk = createVirtualChunk(index, this.#chunkCount);
    this.#cache.set(index, chunk);
    return chunk;
  }

  #evict(protectedIndexes: ReadonlySet<number>): void {
    for (const index of this.#cache.keys()) {
      if (this.#cache.size <= this.#limit) return;
      if (!protectedIndexes.has(index)) this.#cache.delete(index);
    }
  }
}
