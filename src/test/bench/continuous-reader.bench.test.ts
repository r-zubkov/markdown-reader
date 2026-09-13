import "fake-indexeddb/auto";

import { afterAll, describe, expect, it } from "vitest";

import { ReaderWindowCache } from "@/features/reader/reader-window-cache";
import { READER_VIRTUAL_CONFIG } from "@/features/reader/reader-virtual-config";
import { runMarkdownPipelineFromText } from "@/domain/content/markdown-pipeline";
import { PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import { DexieDocumentRepository } from "@/infrastructure/db/document-repository";
import { deleteStorageAtomicitySpikeDatabase } from "@/infrastructure/db/storage-atomicity-spike";
import { createPipelineCorpus } from "@/test/corpus/pipeline-corpus";

const databaseName = `continuous-reader-bench-${crypto.randomUUID()}`;

afterAll(async () => { await deleteStorageAtomicitySpikeDatabase(databaseName); });

describe("P03-T02 real-pipeline continuous reader benchmark", () => {
  it("range-reads the large sanitized corpus in order while retaining at most 96 chunks", async () => {
    const fixture = createPipelineCorpus().find((entry) => entry.id === "large");
    if (fixture === undefined) throw new Error("Large corpus fixture is missing.");
    const pipeline = await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName);
    if (!pipeline.ok) throw new Error(`Pipeline failed: ${pipeline.error.code}`);

    const repository = new DexieDocumentRepository(databaseName);
    const documentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const startedAt = performance.now();
    expect(await repository.stageVersion({
      byteLength: pipeline.value.metadata.byteLength,
      charLength: pipeline.value.metadata.charLength,
      chunkCount: pipeline.value.metadata.chunkCount,
      contentHash: pipeline.value.metadata.contentHash,
      documentId,
      fileName: fixture.fileName,
      importedAt: Date.now(),
      jobId,
      layouts: pipeline.value.metadata.layouts,
      normalizedFileName: "large-generated",
      normalizedTitle: "generated large",
      outline: pipeline.value.metadata.outline,
      pipelineVersion: PIPELINE_VERSION,
      sourceBlob: new Blob([fixture.markdown], { type: "text/markdown" }),
      title: pipeline.value.metadata.title,
      versionId,
    })).toMatchObject({ ok: true });
    for (const batch of pipeline.value.batches) {
      expect(await repository.appendChunkBatch({ batchOrdinal: batch.batchOrdinal, chunks: batch.chunks, jobId, versionId })).toMatchObject({ ok: true });
    }
    expect(await repository.commitVersion({ jobId, readyAt: Date.now(), versionId })).toMatchObject({ ok: true });

    const cache = new ReaderWindowCache({ documentId, limit: READER_VIRTUAL_CONFIG.cacheLimit, pipelineVersion: PIPELINE_VERSION, repository });
    const seen: number[] = [];
    for (let start = 0; start < pipeline.value.metadata.chunkCount; start += READER_VIRTUAL_CONFIG.requestWindowSize) {
      const end = Math.min(pipeline.value.metadata.chunkCount - 1, start + READER_VIRTUAL_CONFIG.requestWindowSize - 1);
      const load = await cache.loadRange(start, end, []);
      expect(load.fatalCode).toBeUndefined();
      for (let ordinal = start; ordinal <= end; ordinal += 1) {
        expect(cache.peek(ordinal)).toMatchObject({ kind: "chunk", chunk: { ordinal } });
        seen.push(ordinal);
      }
      expect(cache.size).toBeLessThanOrEqual(READER_VIRTUAL_CONFIG.cacheLimit);
    }
    const elapsedMs = performance.now() - startedAt;
    console.info("P03-T02 production Reader measurement", JSON.stringify({ cacheCount: cache.size, chunkCount: seen.length, elapsedMs }));
    expect(seen).toEqual(Array.from({ length: pipeline.value.metadata.chunkCount }, (_, ordinal) => ordinal));
    expect(elapsedMs).toBeLessThan(5_000);
    repository.close();
  });
});
