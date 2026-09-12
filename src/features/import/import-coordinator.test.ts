import { describe, expect, it } from "vitest";

import type { DocumentRepository, RebuildSourceSnapshot, RepositoryResult, StageDocumentVersionInput } from "@/application/ports/document-repository";
import { runMarkdownPipeline } from "@/domain/content/markdown-pipeline";
import { PIPELINE_LIMITS, PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import { ImportCoordinator, type ImportWorkerPort, type ImportUiState } from "./import-coordinator";
import { WORKER_PROTOCOL_VERSION } from "@/workers/import-protocol";

describe("ImportCoordinator", () => {
  it("stages worker output, commits it, and publishes only a ready document", async () => {
    const repository = new MemoryRepository();
    const worker = new FakeWorker();
    const states: ImportUiState[] = [];
    const coordinator = new ImportCoordinator(repository, () => worker, (state) => states.push(state), () => 100, ids());
    const file = new File(["# Walking document\n\nSafe paragraph."], "walking.md", { type: "text/markdown" });
    coordinator.start(file);
    const pipeline = await pipelineFor(file);

    worker.emit({ type: "import.metadata", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), metadata: pipeline.metadata });
    for (const batch of pipeline.batches) worker.emit({ type: "import.chunkBatch", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), batchOrdinal: batch.batchOrdinal, chunks: batch.chunks, htmlBytes: batch.htmlBytes });
    worker.emit({ type: "import.complete", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), result: { pipelineVersion: PIPELINE_VERSION, contentHash: pipeline.metadata.contentHash, chunkCount: pipeline.metadata.chunkCount, batchCount: pipeline.batches.length } });
    await settle();

    expect(repository.stage).toHaveLength(1);
    expect(repository.commitCalls).toBe(1);
    expect(repository.abortCalls).toHaveLength(0);
    expect(states.at(-1)).toEqual({ status: "succeeded", documentId: "document-id" });
  });

  it("fails closed on a protocol mismatch and aborts staging", async () => {
    const repository = new MemoryRepository();
    const worker = new FakeWorker();
    const states: ImportUiState[] = [];
    const coordinator = new ImportCoordinator(repository, () => worker, (state) => states.push(state), () => 100, ids());
    coordinator.start(new File(["# Document"], "document.md"));
    worker.emit({ type: "import.progress", protocolVersion: 0, jobId: worker.jobId(), stage: "processing" });
    await settle();

    expect(repository.abortCalls).toEqual([worker.jobId()]);
    expect(states.at(-1)).toEqual({ status: "failed", error: "PROTOCOL_MISMATCH", retry: "reload" });
  });

  it("makes cancel idempotent and removes a staged version after the worker acknowledgement", async () => {
    const repository = new MemoryRepository();
    const worker = new FakeWorker();
    const states: ImportUiState[] = [];
    const coordinator = new ImportCoordinator(repository, () => worker, (state) => states.push(state), () => 100, ids());
    const handle = coordinator.start(new File(["# Document"], "document.md"));
    await expect(handle.cancel()).resolves.toEqual({ status: "cancelled" });
    worker.emit({ type: "import.cancelled", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId() });
    await settle();

    expect(repository.abortCalls).toEqual([worker.jobId()]);
    expect(states.at(-1)).toEqual({ status: "cancelled" });
    await expect(handle.cancel()).resolves.toEqual({ status: "already-terminal" });
  });

  it("rejects a terminal summary when a batch is missing", async () => {
    const repository = new MemoryRepository();
    const worker = new FakeWorker();
    const states: ImportUiState[] = [];
    const coordinator = new ImportCoordinator(repository, () => worker, (state) => states.push(state), () => 100, ids());
    const file = new File(["# Incomplete\n\nBody."], "incomplete.md");
    coordinator.start(file);
    const pipeline = await pipelineFor(file);

    worker.emit({ type: "import.metadata", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), metadata: pipeline.metadata });
    worker.emit({ type: "import.complete", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), result: { pipelineVersion: PIPELINE_VERSION, contentHash: pipeline.metadata.contentHash, chunkCount: pipeline.metadata.chunkCount, batchCount: pipeline.batches.length } });
    await settle();

    expect(repository.commitCalls).toBe(0);
    expect(repository.abortCalls).toEqual([worker.jobId()]);
    expect(states.at(-1)).toEqual({ status: "failed", error: "PROTOCOL_MISMATCH", retry: "reload" });
  });

  it("rebuilds stale derived data from the repository source under a current-version precondition", async () => {
    const sourceBlob = new Blob(["# Rebuilt\n\nSafe source."], { type: "text/markdown" });
    const repository = new MemoryRepository({
      currentVersionId: "stale-version",
      documentId: "existing-document",
      fileName: "rebuild.md",
      previousPipelineVersion: PIPELINE_VERSION - 1,
      sourceBlob,
    });
    const worker = new FakeWorker();
    const states: ImportUiState[] = [];
    const coordinator = new ImportCoordinator(repository, () => worker, (state) => states.push(state), () => 100, ids());
    const started = await coordinator.rebuild("existing-document");
    expect(started.ok).toBe(true);
    const request = worker.sent[0];
    if (typeof request !== "object" || request === null || !("file" in request) || !(request.file instanceof File)) throw new Error("Expected rebuild File request.");
    const pipeline = await pipelineFor(request.file);

    worker.emit({ type: "import.metadata", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), metadata: pipeline.metadata });
    for (const batch of pipeline.batches) worker.emit({ type: "import.chunkBatch", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), batchOrdinal: batch.batchOrdinal, chunks: batch.chunks, htmlBytes: batch.htmlBytes });
    worker.emit({ type: "import.complete", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: worker.jobId(), result: { pipelineVersion: PIPELINE_VERSION, contentHash: pipeline.metadata.contentHash, chunkCount: pipeline.metadata.chunkCount, batchCount: pipeline.batches.length } });
    await settle();

    expect(repository.stage[0]).toMatchObject({
      documentId: "existing-document",
      expectedCurrentVersionId: "stale-version",
      pipelineVersion: PIPELINE_VERSION,
    });
    expect(states.at(-1)).toEqual({ status: "succeeded", documentId: "existing-document" });
  });
});

class FakeWorker implements ImportWorkerPort {
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public readonly sent: unknown[] = [];
  public terminated = false;
  public postMessage(message: unknown): void { this.sent.push(message); }
  public terminate(): void { this.terminated = true; }
  public emit(value: unknown): void { this.onmessage?.({ data: value } as MessageEvent<unknown>); }
  public jobId(): string {
    const request = this.sent.find((message): message is { readonly jobId: string; readonly type: string } => typeof message === "object" && message !== null && "type" in message && "jobId" in message && (message as { readonly type: unknown }).type === "import.request");
    if (request === undefined) throw new Error("Expected worker request.");
    return request.jobId;
  }
}

class MemoryRepository implements DocumentRepository {
  public readonly abortCalls: string[] = [];
  public readonly stage: StageDocumentVersionInput[] = [];
  public commitCalls = 0;
  public constructor(private readonly rebuildSource?: RebuildSourceSnapshot) {}
  public stageVersion(input: StageDocumentVersionInput): Promise<RepositoryResult<void>> { this.stage.push(input); return Promise.resolve(ok(undefined)); }
  public appendChunkBatch(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public commitVersion(input: { readonly versionId: string; readonly jobId: string; readonly readyAt: number }): Promise<RepositoryResult<{ readonly documentId: string; readonly versionId: string }>> { this.commitCalls += 1; const staged = this.stage[0]; if (staged?.versionId !== input.versionId || staged.jobId !== input.jobId) return Promise.resolve(fail("UNKNOWN_STORAGE_ERROR")); return Promise.resolve(ok({ documentId: staged.documentId, versionId: input.versionId })); }
  public abortVersion(jobId: string): Promise<RepositoryResult<void>> { this.abortCalls.push(jobId); return Promise.resolve(ok(undefined)); }
  public cleanupAbandonedStaging(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public listDocuments(): Promise<RepositoryResult<readonly []>> { return Promise.resolve(ok([])); }
  public observeDocuments(): () => void { return () => undefined; }
  public getCurrentDocument(): Promise<RepositoryResult<never>> { return Promise.resolve(fail("DOCUMENT_NOT_FOUND")); }
  public getCurrentSourceForRebuild(): Promise<RepositoryResult<RebuildSourceSnapshot>> { return Promise.resolve(this.rebuildSource === undefined ? fail("DOCUMENT_NOT_FOUND") : ok(this.rebuildSource)); }
  public getCurrentChunkWindow(): Promise<RepositoryResult<readonly []>> { return Promise.resolve(ok([])); }
  public resolveCurrentAnchor(): Promise<RepositoryResult<undefined>> { return Promise.resolve(ok(undefined)); }
  public getReaderState(): Promise<RepositoryResult<undefined>> { return Promise.resolve(ok(undefined)); }
  public saveReaderAnchor(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
  public getPreferences(): Promise<RepositoryResult<{ readonly theme: "system"; readonly remoteImagesEnabled: true; readonly desktopTocCollapsed: false; readonly updatedAt: 0 }>> { return Promise.resolve(ok({ theme: "system", remoteImagesEnabled: true, desktopTocCollapsed: false, updatedAt: 0 })); }
  public saveTheme(): Promise<RepositoryResult<void>> { return Promise.resolve(ok(undefined)); }
}

async function pipelineFor(file: File) {
  const result = await runMarkdownPipeline(new Uint8Array(await file.arrayBuffer()), file.name, PIPELINE_LIMITS);
  if (!result.ok) throw new Error(`Unexpected pipeline error: ${result.error.code}`);
  return result.value;
}
function ids(): () => string { const values = ["document-id", "job-id", "version-id"]; return () => values.shift() ?? "later-id"; }
function ok<T>(value: T): RepositoryResult<T> { return { ok: true, value }; }
function fail(code: "DOCUMENT_NOT_FOUND" | "UNKNOWN_STORAGE_ERROR"): RepositoryResult<never> { return { ok: false, error: { code } }; }
async function settle(): Promise<void> { await new Promise((resolve) => setTimeout(resolve, 0)); await new Promise((resolve) => setTimeout(resolve, 0)); }
