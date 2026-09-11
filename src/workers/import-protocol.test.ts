import { describe, expect, it } from "vitest";

import { PIPELINE_LIMITS, PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import { runMarkdownPipelineFromText } from "@/domain/content/markdown-pipeline";
import { getMessageJobId, isImportWorkerToMain, isMainToImportWorker, WORKER_PROTOCOL_VERSION } from "./import-protocol";

describe("import worker protocol", () => {
  it("accepts the minimal terminal message and rejects a stale protocol version", () => {
    const result = { pipelineVersion: PIPELINE_VERSION, contentHash: "a".repeat(64), chunkCount: 0, batchCount: 0 };
    expect(isImportWorkerToMain({ type: "import.complete", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: "job", result })).toBe(true);
    expect(isImportWorkerToMain({ type: "import.complete", protocolVersion: 0, jobId: "job", result })).toBe(false);
    expect(getMessageJobId({ jobId: "job" })).toBe("job");
  });

  it("requires a real File and all pipeline limits for an import request", () => {
    const file = new File(["# Document"], "document.md");
    expect(isMainToImportWorker({ type: "import.request", protocolVersion: WORKER_PROTOCOL_VERSION, pipelineVersion: PIPELINE_VERSION, jobId: "job", file, limits: PIPELINE_LIMITS })).toBe(true);
    expect(isMainToImportWorker({ type: "import.request", protocolVersion: WORKER_PROTOCOL_VERSION, pipelineVersion: PIPELINE_VERSION, jobId: "job", file, limits: { ...PIPELINE_LIMITS, batchMaxChunks: PIPELINE_LIMITS.batchMaxChunks + 1 } })).toBe(false);
    expect(isMainToImportWorker({ type: "import.request", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: "job", file: {}, limits: {} })).toBe(false);
  });

  it("validates pipeline-versioned metadata and exact bounded batch bytes", async () => {
    const pipeline = await runMarkdownPipelineFromText("# Protocol\n\nSafe body.");
    if (!pipeline.ok) throw new Error(pipeline.error.code);
    const batch = pipeline.value.batches[0];
    if (batch === undefined) throw new Error("Expected a batch.");

    expect(isImportWorkerToMain({
      type: "import.metadata",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      jobId: "job",
      metadata: pipeline.value.metadata,
    })).toBe(true);
    expect(isImportWorkerToMain({
      type: "import.metadata",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      jobId: "job",
      metadata: { ...pipeline.value.metadata, pipelineVersion: PIPELINE_VERSION + 1 },
    })).toBe(false);
    expect(isImportWorkerToMain({
      type: "import.chunkBatch",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      jobId: "job",
      batchOrdinal: batch.batchOrdinal,
      chunks: batch.chunks,
      htmlBytes: batch.htmlBytes,
    })).toBe(true);
    expect(isImportWorkerToMain({
      type: "import.chunkBatch",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      jobId: "job",
      batchOrdinal: batch.batchOrdinal,
      chunks: batch.chunks,
      htmlBytes: batch.htmlBytes + 1,
    })).toBe(false);
  });
});
