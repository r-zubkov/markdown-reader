import type { DocumentRepository, RepositoryErrorCode } from "@/application/ports/document-repository";
import { PIPELINE_LIMITS, PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import type { PipelineMetadata } from "@/domain/content/pipeline-types";
import {
  getMessageJobId,
  isImportWorkerToMain,
  type ImportFailureCode,
  type ImportStage,
  type ImportWorkerToMain,
  type MainToImportWorker,
  WORKER_PROTOCOL_VERSION,
} from "@/workers/import-protocol";

export interface FileSummary {
  readonly name: string;
  readonly size: number;
}

export type ImportErrorCode = ImportFailureCode | RepositoryErrorCode;

export type ImportUiState =
  | { readonly status: "idle" }
  | { readonly status: "validating"; readonly file: FileSummary }
  | { readonly status: "running"; readonly stage: ImportStage; readonly ratio?: number; readonly canCancel: boolean }
  | { readonly status: "cancelling" }
  | { readonly status: "finalizing" }
  | { readonly status: "succeeded"; readonly documentId: string }
  | { readonly status: "failed"; readonly error: ImportErrorCode }
  | { readonly status: "cancelled" };

export interface ImportHandle {
  cancel(): Promise<CancelResult>;
}

export interface CancelResult { readonly status: "cancelled" | "already-terminal"; }

export interface ImportWorkerPort {
  postMessage(message: MainToImportWorker): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export type ImportWorkerFactory = () => ImportWorkerPort;

interface ActiveJob {
  readonly documentId: string;
  readonly file: File;
  readonly jobId: string;
  readonly versionId: string;
  readonly worker: ImportWorkerPort;
  expectedBatchOrdinal: number;
  metadata?: PipelineMetadata;
  queue: Promise<void>;
  cancelling: boolean;
  terminal: boolean;
}

const CANCEL_HANDSHAKE_TIMEOUT_MS = 500;

export class ImportCoordinator {
  private activeJob: ActiveJob | undefined;

  public constructor(
    private readonly repository: DocumentRepository,
    private readonly workerFactory: ImportWorkerFactory,
    private readonly publish: (state: ImportUiState) => void,
    private readonly now: () => number = Date.now,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  public start(file: File): ImportHandle {
    if (this.activeJob !== undefined) return { cancel: () => Promise.resolve({ status: "already-terminal" }) };
    const worker = this.workerFactory();
    const job: ActiveJob = {
      documentId: this.createId(), file, jobId: this.createId(), versionId: this.createId(), worker,
      expectedBatchOrdinal: 0, queue: Promise.resolve(), cancelling: false, terminal: false,
    };
    this.activeJob = job;
    worker.onmessage = (event) => { this.enqueue(job, () => this.receive(job, event.data)); };
    worker.onerror = () => { this.enqueue(job, () => this.fail(job, "WORKER_CRASH")); };
    this.publish({ status: "validating", file: { name: file.name, size: file.size } });
    worker.postMessage({ type: "import.request", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: job.jobId, file, limits: PIPELINE_LIMITS });
    return { cancel: () => this.cancel(job) };
  }

  public dispose(): void {
    const job = this.activeJob;
    if (job !== undefined) {
      job.worker.terminate();
      void this.repository.abortVersion(job.jobId);
      this.activeJob = undefined;
    }
  }

  private enqueue(job: ActiveJob, action: () => Promise<void>): void {
    job.queue = job.queue.then(action).catch(() => this.fail(job, "UNKNOWN_STORAGE_ERROR"));
  }

  private async receive(job: ActiveJob, value: unknown): Promise<void> {
    if (job.terminal || this.activeJob !== job) return;
    const messageJobId = getMessageJobId(value);
    if (messageJobId !== job.jobId) return;
    if (!isImportWorkerToMain(value)) {
      await this.fail(job, "PROTOCOL_MISMATCH");
      return;
    }
    const message = value;
    if (job.cancelling && message.type !== "import.cancelled") return;
    switch (message.type) {
      case "import.progress":
        this.publishRunning(message);
        return;
      case "import.metadata":
        await this.stage(job, message.metadata);
        return;
      case "import.chunkBatch":
        await this.append(job, message);
        return;
      case "import.complete":
        await this.commit(job);
        return;
      case "import.failure":
        await this.fail(job, message.error);
        return;
      case "import.cancelled":
        await this.finishCancelled(job);
        return;
    }
  }

  private publishRunning(message: Extract<ImportWorkerToMain, { readonly type: "import.progress" }>): void {
    if (message.stage === "finalizing") this.publish({ status: "finalizing" });
    else this.publish(message.ratio === undefined ? { status: "running", stage: message.stage, canCancel: true } : { status: "running", stage: message.stage, ratio: message.ratio, canCancel: true });
  }

  private async stage(job: ActiveJob, metadata: PipelineMetadata): Promise<void> {
    if (job.metadata !== undefined) { await this.fail(job, "PROTOCOL_MISMATCH"); return; }
    const result = await this.repository.stageVersion({
      documentId: job.documentId, versionId: job.versionId, jobId: job.jobId,
      fileName: job.file.name, normalizedFileName: normalizeName(job.file.name),
      title: metadata.title, normalizedTitle: normalizeName(metadata.title),
      contentHash: metadata.contentHash, byteLength: metadata.byteLength, charLength: metadata.charLength,
      sourceBlob: job.file, outline: metadata.outline, layouts: metadata.layouts,
      chunkCount: metadata.chunkCount, pipelineVersion: PIPELINE_VERSION, importedAt: this.now(),
    });
    if (!result.ok) { await this.fail(job, result.error.code); return; }
    job.metadata = metadata;
  }

  private async append(job: ActiveJob, message: Extract<ImportWorkerToMain, { readonly type: "import.chunkBatch" }>): Promise<void> {
    if (job.metadata === undefined || message.batchOrdinal !== job.expectedBatchOrdinal) { await this.fail(job, "PROTOCOL_MISMATCH"); return; }
    const result = await this.repository.appendChunkBatch({ versionId: job.versionId, jobId: job.jobId, batchOrdinal: message.batchOrdinal, chunks: message.chunks });
    if (!result.ok) { await this.fail(job, result.error.code); return; }
    job.expectedBatchOrdinal += 1;
  }

  private async commit(job: ActiveJob): Promise<void> {
    if (job.metadata === undefined) { await this.fail(job, "PROTOCOL_MISMATCH"); return; }
    this.publish({ status: "finalizing" });
    const result = await this.repository.commitVersion({ versionId: job.versionId, jobId: job.jobId, readyAt: this.now() });
    if (!result.ok) { await this.fail(job, result.error.code); return; }
    job.terminal = true;
    job.worker.terminate();
    this.activeJob = undefined;
    this.publish({ status: "succeeded", documentId: result.value.documentId });
  }

  private cancel(job: ActiveJob): Promise<CancelResult> {
    if (this.activeJob !== job || job.terminal) return Promise.resolve({ status: "already-terminal" });
    if (job.cancelling) return Promise.resolve({ status: "cancelled" });
    job.cancelling = true;
    this.publish({ status: "cancelling" });
    job.worker.postMessage({ type: "import.cancel", protocolVersion: WORKER_PROTOCOL_VERSION, jobId: job.jobId });
    setTimeout(() => {
      if (this.activeJob === job && !job.terminal) {
        job.worker.terminate();
        this.enqueue(job, () => this.finishCancelled(job));
      }
    }, CANCEL_HANDSHAKE_TIMEOUT_MS);
    return Promise.resolve({ status: "cancelled" });
  }

  private async finishCancelled(job: ActiveJob): Promise<void> {
    if (job.terminal) return;
    job.terminal = true;
    job.worker.terminate();
    await this.repository.abortVersion(job.jobId);
    if (this.activeJob === job) this.activeJob = undefined;
    this.publish({ status: "cancelled" });
  }

  private async fail(job: ActiveJob, error: ImportErrorCode): Promise<void> {
    if (job.terminal) return;
    job.terminal = true;
    job.worker.terminate();
    await this.repository.abortVersion(job.jobId);
    if (this.activeJob === job) this.activeJob = undefined;
    this.publish({ status: "failed", error });
  }
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US").replace(/\.md$/iu, "");
}
