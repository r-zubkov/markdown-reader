import { describe, expect, it } from "vitest";

import { getMessageJobId, isImportWorkerToMain, isMainToImportWorker, WORKER_PROTOCOL_VERSION } from "./import-protocol";

describe("import worker protocol", () => {
  it("accepts the minimal terminal message and rejects a stale protocol version", () => {
    expect(isImportWorkerToMain({ type: "import.complete", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: "job" })).toBe(true);
    expect(isImportWorkerToMain({ type: "import.complete", protocolVersion: 0, jobId: "job" })).toBe(false);
    expect(getMessageJobId({ jobId: "job" })).toBe("job");
  });

  it("requires a real File and all pipeline limits for an import request", () => {
    const file = new File(["# Document"], "document.md");
    expect(isMainToImportWorker({ type: "import.request", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: "job", file, limits: { maxFileBytes: 1, targetChunkCost: 1, maxChunkCostBeforeFallback: 1, oversizedNodeCost: 1, maxCodeHighlightChars: 1, maxAutoDetectChars: 1, autoDetectMinRelevance: 1, safeDataImageBytes: 1, batchMaxChunks: 1, batchMaxHtmlBytes: 1 } })).toBe(true);
    expect(isMainToImportWorker({ type: "import.request", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: "job", file: {}, limits: {} })).toBe(false);
  });
});
