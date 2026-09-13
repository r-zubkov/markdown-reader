import type {
  DocumentRepository,
  ReaderChunk,
  RepositoryErrorCode,
} from "@/application/ports/document-repository";

export type ReaderWindowEntry =
  | { readonly kind: "chunk"; readonly chunk: ReaderChunk }
  | { readonly kind: "error"; readonly code: RepositoryErrorCode };

export interface ReaderWindowLoadResult {
  readonly fatalCode?: RepositoryErrorCode;
  readonly loadedOrdinals: readonly number[];
}

const fatalCodes = new Set<RepositoryErrorCode>([
  "DB_UNAVAILABLE",
  "DOCUMENT_NOT_FOUND",
  "MIGRATION_FAILED",
  "STALE_DERIVED",
]);

export class ReaderWindowCache {
  readonly #entries = new Map<number, ReaderWindowEntry>();
  readonly #limit: number;
  readonly #repository: DocumentRepository;
  readonly #documentId: string;
  readonly #pipelineVersion: number;

  public constructor(input: {
    readonly documentId: string;
    readonly limit: number;
    readonly pipelineVersion: number;
    readonly repository: DocumentRepository;
  }) {
    if (!Number.isInteger(input.limit) || input.limit < 1) {
      throw new RangeError("Reader cache limit must be a positive integer.");
    }
    this.#documentId = input.documentId;
    this.#limit = input.limit;
    this.#pipelineVersion = input.pipelineVersion;
    this.#repository = input.repository;
  }

  public get size(): number {
    return this.#entries.size;
  }

  public get(ordinal: number): ReaderWindowEntry | undefined {
    const entry = this.#entries.get(ordinal);
    if (entry === undefined) return undefined;
    this.#entries.delete(ordinal);
    this.#entries.set(ordinal, entry);
    return entry;
  }

  public peek(ordinal: number): ReaderWindowEntry | undefined {
    return this.#entries.get(ordinal);
  }

  public delete(ordinal: number): void {
    this.#entries.delete(ordinal);
  }

  public prime(chunks: readonly ReaderChunk[], protectedOrdinals: readonly number[] = []): void {
    for (const chunk of chunks) this.#entries.set(chunk.ordinal, { chunk, kind: "chunk" });
    this.#evict(new Set([...protectedOrdinals, ...chunks.map((chunk) => chunk.ordinal)]));
  }

  public hasRange(startOrdinal: number, endOrdinalInclusive: number): boolean {
    for (let ordinal = startOrdinal; ordinal <= endOrdinalInclusive; ordinal += 1) {
      if (!this.#entries.has(ordinal)) return false;
    }
    return true;
  }

  public async loadRange(
    startOrdinal: number,
    endOrdinalInclusive: number,
    protectedOrdinals: readonly number[],
  ): Promise<ReaderWindowLoadResult> {
    if (this.hasRange(startOrdinal, endOrdinalInclusive)) {
      return { loadedOrdinals: [] };
    }

    const result = await this.#repository.getCurrentChunkWindow({
      documentId: this.#documentId,
      endOrdinalInclusive,
      pipelineVersion: this.#pipelineVersion,
      startOrdinal,
    });
    if (result.ok) {
      this.prime(result.value, protectedOrdinals);
      return { loadedOrdinals: result.value.map((chunk) => chunk.ordinal) };
    }
    if (fatalCodes.has(result.error.code)) return { fatalCode: result.error.code, loadedOrdinals: [] };

    // A corrupt/missing record must not hide otherwise valid neighbors.
    if (startOrdinal !== endOrdinalInclusive) {
      const loadedOrdinals: number[] = [];
      for (let ordinal = startOrdinal; ordinal <= endOrdinalInclusive; ordinal += 1) {
        if (this.#entries.has(ordinal)) continue;
        const item = await this.loadRange(ordinal, ordinal, protectedOrdinals);
        if (item.fatalCode !== undefined) return { fatalCode: item.fatalCode, loadedOrdinals };
        loadedOrdinals.push(...item.loadedOrdinals);
      }
      this.#evict(new Set(protectedOrdinals));
      return { loadedOrdinals };
    }

    this.#entries.set(startOrdinal, { code: result.error.code, kind: "error" });
    this.#evict(new Set([...protectedOrdinals, startOrdinal]));
    return { loadedOrdinals: [] };
  }

  #evict(protectedOrdinals: ReadonlySet<number>): void {
    for (const ordinal of this.#entries.keys()) {
      if (this.#entries.size <= this.#limit) return;
      if (!protectedOrdinals.has(ordinal)) this.#entries.delete(ordinal);
    }
    if (this.#entries.size > this.#limit) {
      throw new RangeError("Protected Reader chunks exceed the cache limit.");
    }
  }
}
