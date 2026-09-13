import { describe, expect, it } from "vitest";

import type { DocumentRepository, RepositoryResult } from "@/application/ports/document-repository";
import { PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import { createSingleSectionLayouts } from "@/infrastructure/db/storage-atomicity-spike";
import { boundedWindow, loadReader } from "./reader-loader";

describe("P03 production reader loader", () => {
  it("requests one bounded range around the restored semantic anchor", async () => {
    const repository = new ReaderRepository();
    const result = await loadReader(repository, "document-id");
    expect(result).toMatchObject({ status: "ready", targetOrdinal: 12 });
    expect(repository.windowRequest).toEqual({ documentId: "document-id", endOrdinalInclusive: 23, pipelineVersion: PIPELINE_VERSION, startOrdinal: 0 });
  });

  it("keeps the initial reader window bounded at document edges", () => {
    expect(boundedWindow(100, 0)).toEqual({ startOrdinal: 0, endOrdinalInclusive: 23 });
    expect(boundedWindow(100, 99)).toEqual({ startOrdinal: 76, endOrdinalInclusive: 99 });
  });
});

class ReaderRepository implements DocumentRepository {
  public windowRequest: unknown;
  public stageVersion(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public appendChunkBatch(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public commitVersion(): Promise<RepositoryResult<{ readonly documentId: string; readonly versionId: string }>> { return Promise.resolve(ok({ documentId: "document-id", versionId: "version-id" })); }
  public abortVersion(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public cleanupAbandonedStaging(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public findImportIdentityMatches(): Promise<RepositoryResult<{ readonly exactDuplicates: readonly []; readonly possibleUpdates: readonly [] }>> { return Promise.resolve(ok({ exactDuplicates: [], possibleUpdates: [] })); }
  public listDocuments(): Promise<RepositoryResult<readonly []>> { return Promise.resolve(ok([])); }
  public observeDocuments(): () => void { return () => undefined; }
  public getCurrentDocument(): Promise<RepositoryResult<{ readonly documentId: string; readonly versionId: string; readonly title: string; readonly chunkCount: number; readonly pipelineVersion: number; readonly outline: readonly []; readonly layouts: ReturnType<typeof createSingleSectionLayouts> }>> { return Promise.resolve(ok({ chunkCount: 100, documentId: "document-id", layouts: createSingleSectionLayouts(100), outline: [], pipelineVersion: PIPELINE_VERSION, title: "Reader document", versionId: "version-id" })); }
  public getCurrentSourceForRebuild(): Promise<RepositoryResult<never>> { return Promise.resolve({ ok: false, error: { code: "DOCUMENT_NOT_FOUND" } }); }
  public getCurrentChunkWindow(input: { readonly documentId: string; readonly startOrdinal: number; readonly endOrdinalInclusive: number; readonly pipelineVersion: number }): Promise<RepositoryResult<readonly []>> { this.windowRequest = input; return Promise.resolve(ok([])); }
  public resolveCurrentAnchor(): Promise<RepositoryResult<number | undefined>> { return Promise.resolve(ok(12)); }
  public getReaderState(): Promise<RepositoryResult<{ readonly documentId: string; readonly readingMode: "continuous"; readonly modeOrigin: "auto"; readonly splitStrategy: "auto"; readonly anchor: { readonly versionId: string; readonly headingPathKey: string; readonly blockOrdinalWithinHeading: number; readonly blockId: string; readonly intraBlockRatio: number; readonly overallSourceRatio: number }; readonly progressRatio: 0; readonly updatedAt: 0 }>> { return Promise.resolve(ok({ anchor: { blockId: "block-12", blockOrdinalWithinHeading: 12, headingPathKey: "path", intraBlockRatio: 0, overallSourceRatio: 0.63, versionId: "version-id" }, documentId: "document-id", modeOrigin: "auto", progressRatio: 0, readingMode: "continuous", splitStrategy: "auto", updatedAt: 0 })); }
  public saveReaderAnchor(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public saveReaderPresentation(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public getPreferences(): Promise<RepositoryResult<{ readonly theme: "system"; readonly remoteImagesEnabled: true; readonly desktopTocCollapsed: false; readonly updatedAt: 0 }>> { return Promise.resolve(ok({ desktopTocCollapsed: false, remoteImagesEnabled: true, theme: "system", updatedAt: 0 })); }
  public saveTheme(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
}

function ok<T>(value: T): RepositoryResult<T> { return { ok: true, value }; }
