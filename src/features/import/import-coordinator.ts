import type { DocumentRepository, ImportIdentityMatch, RepositoryErrorCode, RepositoryResult } from "@/application/ports/document-repository";
import { PIPELINE_LIMITS, PIPELINE_VERSION } from "@/domain/content/pipeline-limits";
import type { PipelineMetadata } from "@/domain/content/pipeline-types";
import { normalizeIdentityFileName, normalizeIdentityText } from "@/domain/documents/import-identity";
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
export type RetryKind = "select-file" | "retry" | "free-space" | "reload";

export type ImportDecisionContext =
  | { readonly kind: "exact-duplicate"; readonly duplicates: readonly ImportIdentityMatch[] }
  | {
    readonly kind: "possible-update";
    readonly candidates: readonly ImportIdentityMatch[];
    readonly file: FileSummary;
    readonly title: string;
  };

export type ImportUiState =
  | { readonly status: "idle" }
  | { readonly status: "validating"; readonly file: FileSummary }
  | { readonly status: "running"; readonly stage: ImportStage; readonly ratio?: number; readonly canCancel: boolean }
  | { readonly status: "cancelling" }
  | { readonly status: "finalizing" }
  | { readonly status: "decision"; readonly context: ImportDecisionContext }
  | { readonly status: "replace-handoff"; readonly candidate: ImportIdentityMatch }
  | { readonly status: "succeeded"; readonly documentId: string }
  | { readonly status: "failed"; readonly error: ImportErrorCode; readonly retry: RetryKind }
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
  documentId: string;
  readonly file: File;
  readonly jobId: string;
  readonly versionId: string;
  readonly worker: ImportWorkerPort;
  expectedCurrentVersionId?: string;
  expectedBatchOrdinal: number;
  receivedChunkCount: number;
  metadata?: PipelineMetadata;
  queue: Promise<void>;
  cancelling: boolean;
  terminal: boolean;
  decision?: { readonly metadata: PipelineMetadata; readonly context: ImportDecisionContext };
  readonly deferredMessages: ImportWorkerToMain[];
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
    return this.startJob(file, this.createId());
  }

  public async rebuild(documentId: string): Promise<RepositoryResult<ImportHandle>> {
    const source = await this.repository.getCurrentSourceForRebuild(documentId);

    if (!source.ok) {
      this.publish({ status: "failed", error: source.error.code, retry: retryKind(source.error.code) });
      return source;
    }

    const file = new File([source.value.sourceBlob], source.value.fileName, {
      type: source.value.sourceBlob.type || "text/markdown",
    });
    return {
      ok: true,
      value: this.startJob(file, source.value.documentId, source.value.currentVersionId),
    };
  }

  private startJob(file: File, documentId: string, expectedCurrentVersionId?: string): ImportHandle {
    if (this.activeJob !== undefined) return { cancel: () => Promise.resolve({ status: "already-terminal" }) };
    const worker = this.workerFactory();
    const job: ActiveJob = {
      documentId, file, jobId: this.createId(), versionId: this.createId(), worker,
      expectedBatchOrdinal: 0, receivedChunkCount: 0, queue: Promise.resolve(), cancelling: false, terminal: false,
      deferredMessages: [],
      ...(expectedCurrentVersionId === undefined ? {} : { expectedCurrentVersionId }),
    };
    this.activeJob = job;
    worker.onmessage = (event) => { this.enqueue(job, () => this.receive(job, event.data)); };
    worker.onerror = () => { this.enqueue(job, () => this.fail(job, "WORKER_CRASH")); };
    this.publish({ status: "validating", file: { name: file.name, size: file.size } });
    worker.postMessage({ type: "import.request", protocolVersion: WORKER_PROTOCOL_VERSION, pipelineVersion: PIPELINE_VERSION, jobId: job.jobId, file, limits: PIPELINE_LIMITS });
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

  public async continueSeparately(): Promise<void> {
    const job = this.activeJob;
    if (job?.decision?.context.kind !== "possible-update") return;
    const metadata = job.decision.metadata;
    delete job.decision;
    await this.stageReadyMetadata(job, metadata);
    this.replayDeferredMessages(job);
  }

  /**
   * P04-T02 owns mapped replacement. This handoff records the explicitly
   * chosen target without claiming a replacement was committed.
   */
  public handoffReplace(documentId: string): void {
    const job = this.activeJob;
    if (job?.decision?.context.kind !== "possible-update") return;
    const candidate = job.decision.context.candidates.find((entry) => entry.documentId === documentId);
    if (candidate === undefined) return;
    job.terminal = true;
    job.worker.terminate();
    this.activeJob = undefined;
    this.publish({ status: "replace-handoff", candidate });
  }

  public async cancelDecision(): Promise<void> {
    const job = this.activeJob;
    if (job?.decision === undefined) return;
    job.terminal = true;
    job.worker.terminate();
    await this.repository.abortVersion(job.jobId);
    if (this.activeJob === job) this.activeJob = undefined;
    this.publish({ status: "cancelled" });
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
    if (job.decision !== undefined) {
      job.deferredMessages.push(message);
      return;
    }
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
        await this.commit(job, message);
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
    job.metadata = metadata;
    const matches = await this.repository.findImportIdentityMatches({
      contentHash: metadata.contentHash,
      normalizedFileName: normalizeIdentityFileName(job.file.name),
      normalizedTitle: normalizeIdentityText(metadata.title),
    });
    if (!matches.ok) { await this.fail(job, matches.error.code); return; }
    if (matches.value.exactDuplicates.length > 0) {
      job.terminal = true;
      job.worker.terminate();
      if (this.activeJob === job) this.activeJob = undefined;
      this.publish({ status: "decision", context: { kind: "exact-duplicate", duplicates: matches.value.exactDuplicates } });
      return;
    }
    if (matches.value.possibleUpdates.length > 0) {
      const context: ImportDecisionContext = {
        candidates: matches.value.possibleUpdates,
        file: { name: job.file.name, size: job.file.size },
        kind: "possible-update",
        title: metadata.title,
      };
      job.decision = { context, metadata };
      this.publish({ status: "decision", context });
      return;
    }
    await this.stageReadyMetadata(job, metadata);
  }

  private async stageReadyMetadata(job: ActiveJob, metadata: PipelineMetadata): Promise<void> {
    const result = await this.repository.stageVersion({
      documentId: job.documentId, versionId: job.versionId, jobId: job.jobId,
      fileName: job.file.name, normalizedFileName: normalizeIdentityFileName(job.file.name),
      title: metadata.title, normalizedTitle: normalizeIdentityText(metadata.title),
      contentHash: metadata.contentHash, byteLength: metadata.byteLength, charLength: metadata.charLength,
      sourceBlob: job.file, outline: metadata.outline, layouts: metadata.layouts,
      chunkCount: metadata.chunkCount, pipelineVersion: metadata.pipelineVersion, importedAt: this.now(),
      ...(job.expectedCurrentVersionId === undefined ? {} : { expectedCurrentVersionId: job.expectedCurrentVersionId }),
    });
    if (!result.ok) { await this.fail(job, result.error.code); return; }
  }

  private replayDeferredMessages(job: ActiveJob): void {
    const messages = job.deferredMessages.splice(0);
    for (const message of messages) this.enqueue(job, () => this.receive(job, message));
  }

  private async append(job: ActiveJob, message: Extract<ImportWorkerToMain, { readonly type: "import.chunkBatch" }>): Promise<void> {
    if (job.metadata === undefined || message.batchOrdinal !== job.expectedBatchOrdinal || message.chunks[0]?.ordinal !== job.receivedChunkCount) { await this.fail(job, "PROTOCOL_MISMATCH"); return; }
    const result = await this.repository.appendChunkBatch({ versionId: job.versionId, jobId: job.jobId, batchOrdinal: message.batchOrdinal, chunks: message.chunks });
    if (!result.ok) { await this.fail(job, result.error.code); return; }
    job.expectedBatchOrdinal += 1;
    job.receivedChunkCount += message.chunks.length;
  }

  private async commit(job: ActiveJob, message: Extract<ImportWorkerToMain, { readonly type: "import.complete" }>): Promise<void> {
    if (job.metadata === undefined) {
      await this.fail(job, "PROTOCOL_MISMATCH");
      return;
    }

    if (
      message.result.pipelineVersion !== job.metadata.pipelineVersion ||
      message.result.contentHash !== job.metadata.contentHash ||
      message.result.chunkCount !== job.metadata.chunkCount ||
      message.result.chunkCount !== job.receivedChunkCount ||
      message.result.batchCount !== job.expectedBatchOrdinal
    ) { await this.fail(job, "PROTOCOL_MISMATCH"); return; }
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
    this.publish({ status: "failed", error, retry: retryKind(error) });
  }
}

function retryKind(error: ImportErrorCode): RetryKind {
  if (error === "UNSUPPORTED_EXTENSION" || error === "FILE_TOO_LARGE" || error === "INVALID_UTF8") return "select-file";
  if (error === "QUOTA_EXCEEDED") return "free-space";
  if (error === "PROTOCOL_MISMATCH") return "reload";
  return "retry";
}
