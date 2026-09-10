import { runMarkdownPipeline } from "@/domain/content/markdown-pipeline";
import type { PipelineMetadata } from "@/domain/content/pipeline-types";
import {
  getMessageJobId,
  isMainToImportWorker,
  type ImportFailureCode,
  type ImportWorkerToMain,
  type MainToImportWorker,
  WORKER_PROTOCOL_VERSION,
} from "@/workers/import-protocol";

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;
const cancelledJobIds = new Set<string>();

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!isMainToImportWorker(message)) {
    const jobId = getMessageJobId(message);
    if (jobId !== undefined) postFailure(jobId, "PROTOCOL_MISMATCH");
    return;
  }
  if (message.type === "import.cancel") {
    cancelledJobIds.add(message.jobId);
    return;
  }
  void processImport(message);
});

async function processImport(message: Extract<MainToImportWorker, { readonly type: "import.request" }>): Promise<void> {
  const { file, jobId, limits } = message;
  try {
    post({ type: "import.progress", protocolVersion: WORKER_PROTOCOL_VERSION, jobId, stage: "validating" });
    if (!file.name.toLocaleLowerCase("en-US").endsWith(".md")) {
      postFailure(jobId, "UNSUPPORTED_EXTENSION");
      return;
    }
    if (isCancelled(jobId)) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isCancelled(jobId)) return;
    post({ type: "import.progress", protocolVersion: WORKER_PROTOCOL_VERSION, jobId, stage: "processing" });
    const result = await runMarkdownPipeline(bytes, file.name, limits);
    if (isCancelled(jobId)) return;
    if (!result.ok) {
      postFailure(jobId, result.error.code);
      return;
    }
    postMetadata(jobId, result.value.metadata);
    for (const batch of result.value.batches) {
      if (isCancelled(jobId)) return;
      post({ type: "import.progress", protocolVersion: WORKER_PROTOCOL_VERSION, jobId, stage: "staging" });
      post({ type: "import.chunkBatch", protocolVersion: WORKER_PROTOCOL_VERSION, jobId, batchOrdinal: batch.batchOrdinal, chunks: batch.chunks });
    }
    if (isCancelled(jobId)) return;
    post({ type: "import.progress", protocolVersion: WORKER_PROTOCOL_VERSION, jobId, stage: "finalizing" });
    post({ type: "import.complete", protocolVersion: WORKER_PROTOCOL_VERSION, jobId });
  } catch {
    postFailure(jobId, "WORKER_CRASH");
  } finally {
    if (cancelledJobIds.delete(jobId)) {
      post({ type: "import.cancelled", protocolVersion: WORKER_PROTOCOL_VERSION, jobId });
    }
  }
}

function isCancelled(jobId: string): boolean { return cancelledJobIds.has(jobId); }
function postMetadata(jobId: string, metadata: PipelineMetadata): void { post({ type: "import.metadata", protocolVersion: WORKER_PROTOCOL_VERSION, jobId, metadata }); }
function postFailure(jobId: string, error: ImportFailureCode): void { post({ type: "import.failure", protocolVersion: WORKER_PROTOCOL_VERSION, jobId, error }); }
function post(message: ImportWorkerToMain): void { workerScope.postMessage(message); }
