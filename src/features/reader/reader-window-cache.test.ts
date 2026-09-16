import { describe, expect, it } from "vitest";

import type {
  AppPreferencesSnapshot,
  CurrentDocumentSnapshot,
  DocumentRepository,
  ImportIdentityMatches,
  ReaderChunk,
  ReaderStateSnapshot,
  RebuildSourceSnapshot,
  RepositoryResult,
} from "@/application/ports/document-repository";
import { PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import { ReaderWindowCache } from "@/features/reader/reader-window-cache";

describe("ReaderWindowCache", () => {
  it("keeps production range reads bounded and retains a protected focus ordinal", async () => {
    const repository = new CacheRepository();
    const cache = createCache(repository);
    cache.prime(createChunks(0, 23));

    for (let start = 0; start < 500; start += 32) {
      const end = Math.min(499, start + 31);
      await cache.loadRange(start, end, [7]);
      expect(cache.size).toBeLessThanOrEqual(96);
    }

    expect(cache.peek(7)).toMatchObject({ kind: "chunk", chunk: { ordinal: 7 } });
    expect(repository.maximumRequestSize).toBe(32);
  });

  it("localizes one corrupt chunk while retaining valid neighbors", async () => {
    const repository = new CacheRepository(5);
    const cache = createCache(repository);
    const result = await cache.loadRange(0, 9, []);

    expect(result.fatalCode).toBeUndefined();
    expect(cache.peek(4)).toMatchObject({ kind: "chunk" });
    expect(cache.peek(5)).toEqual({ code: "INVALID_PERSISTED_RECORD", kind: "error" });
    expect(cache.peek(6)).toMatchObject({ kind: "chunk" });
  });
});

class CacheRepository implements DocumentRepository {
  public maximumRequestSize = 0;
  public constructor(private readonly corruptOrdinal?: number) {}
  public stageVersion(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public appendChunkBatch(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public commitVersion(): Promise<RepositoryResult<{ readonly documentId: string; readonly versionId: string }>> { return Promise.resolve(ok({ documentId: "document", versionId: "version" })); }
  public abortVersion(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public cleanupAbandonedStaging(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public cleanupObsoleteReadyVersions(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public findImportIdentityMatches(): Promise<RepositoryResult<ImportIdentityMatches>> { return Promise.resolve(ok({ exactDuplicates: [], possibleUpdates: [] })); }
  public listDocuments(): Promise<RepositoryResult<readonly []>> { return Promise.resolve(ok([])); }
  public observeDocuments(): () => void { return () => undefined; }
  public deleteDocument(): Promise<RepositoryResult<{ readonly status: "not-found" }>> { return Promise.resolve(ok({ status: "not-found" })); }
  public getCurrentDocument(): Promise<RepositoryResult<CurrentDocumentSnapshot>> { return Promise.resolve({ ok: false, error: { code: "DOCUMENT_NOT_FOUND" } }); }
  public getCurrentSourceForRebuild(): Promise<RepositoryResult<RebuildSourceSnapshot>> { return Promise.resolve({ ok: false, error: { code: "DOCUMENT_NOT_FOUND" } }); }
  public getCurrentChunkWindow(input: { readonly startOrdinal: number; readonly endOrdinalInclusive: number }): Promise<RepositoryResult<readonly ReaderChunk[]>> {
    this.maximumRequestSize = Math.max(this.maximumRequestSize, input.endOrdinalInclusive - input.startOrdinal + 1);
    if (this.corruptOrdinal !== undefined && input.startOrdinal <= this.corruptOrdinal && input.endOrdinalInclusive >= this.corruptOrdinal) {
      return Promise.resolve({ ok: false, error: { code: "INVALID_PERSISTED_RECORD" } });
    }
    return Promise.resolve(ok(createChunks(input.startOrdinal, input.endOrdinalInclusive)));
  }
  public resolveCurrentAnchor(): Promise<RepositoryResult<{ readonly chunkOrdinal: 0; readonly confidence: "none"; readonly reason: "NO_RELIABLE_MATCH" }>> { return Promise.resolve(ok({ chunkOrdinal: 0, confidence: "none", reason: "NO_RELIABLE_MATCH" })); }
  public getReaderState(): Promise<RepositoryResult<ReaderStateSnapshot | undefined>> { return Promise.resolve(ok(undefined)); }
  public saveReaderAnchor(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public saveReaderPresentation(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public retryReplacementCleanup(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public dismissReaderRestoreNotice(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public getPreferences(): Promise<RepositoryResult<AppPreferencesSnapshot>> { return Promise.resolve(ok({ desktopTocCollapsed: false, remoteImagesEnabled: true, theme: "system", updatedAt: 0 })); }
  public saveTheme(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
}

function createCache(repository: DocumentRepository): ReaderWindowCache {
  return new ReaderWindowCache({ documentId: "document", limit: 96, pipelineVersion: PIPELINE_VERSION, repository });
}

function createChunks(start: number, end: number): readonly ReaderChunk[] {
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const ordinal = start + index;
    return {
      anchors: [],
      estimatedCost: 100,
      html: { pipelineVersion: PIPELINE_VERSION, value: `<p>Chunk ${String(ordinal)}</p>` } as ReaderChunk["html"],
      ordinal,
      renderState: "ready" as const,
    };
  });
}

function ok<T>(value: T): RepositoryResult<T> { return { ok: true, value }; }
