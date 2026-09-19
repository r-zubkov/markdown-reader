export type UpdateFailureReason = "offline" | "progress" | "update";

export type UpdateState =
  | { readonly status: "none" }
  | { readonly status: "available" }
  | { readonly status: "applying" }
  | { readonly status: "failed"; readonly reason: UpdateFailureReason };

export interface PwaUpdateSnapshot {
  readonly importActive: boolean;
  readonly online: boolean;
  readonly update: UpdateState;
}

export type ApplyServiceWorkerUpdate = () => Promise<void>;
export type FlushReaderProgress = () => Promise<boolean>;

interface PwaUpdateControllerOptions {
  readonly clock?: UpdateClock;
  readonly online: boolean;
  readonly reload: () => void;
  readonly updateTimeoutMs?: number;
}

interface UpdateClock {
  readonly clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
  readonly setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
}

const UPDATE_ACTIVATION_TIMEOUT_MS = 15_000;

/** Coordinates prompt-based updates without retaining React state or document data. */
export class PwaUpdateController {
  private readonly listeners = new Set<() => void>();
  private readonly clock: UpdateClock;
  private readonly reload: () => void;
  private readonly updateTimeoutMs: number;
  private snapshot: PwaUpdateSnapshot;
  private applyServiceWorkerUpdate: ApplyServiceWorkerUpdate | undefined;
  private flushReaderProgress: FlushReaderProgress | undefined;
  private reloadAuthorized = false;
  private reloadStarted = false;
  private updateTimer: ReturnType<typeof setTimeout> | undefined;

  public constructor(options: PwaUpdateControllerOptions) {
    this.clock = options.clock ?? browserClock;
    this.reload = options.reload;
    this.updateTimeoutMs = options.updateTimeoutMs ?? UPDATE_ACTIVATION_TIMEOUT_MS;
    this.snapshot = {
      importActive: false,
      online: options.online,
      update: { status: "none" },
    };
  }

  public readonly getSnapshot = (): PwaUpdateSnapshot => this.snapshot;

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  public setImportActive(importActive: boolean): void {
    if (this.snapshot.importActive === importActive) return;
    this.publish({ ...this.snapshot, importActive });
  }

  public setOnline(online: boolean): void {
    if (this.snapshot.online === online) return;
    this.publish({ ...this.snapshot, online });
  }

  public setProgressFlusher(flush: FlushReaderProgress): () => void {
    this.flushReaderProgress = flush;
    return () => {
      if (this.flushReaderProgress === flush) this.flushReaderProgress = undefined;
    };
  }

  public notifyUpdateAvailable(apply: ApplyServiceWorkerUpdate): void {
    this.clearUpdateTimer();
    this.applyServiceWorkerUpdate = apply;
    this.reloadAuthorized = false;
    this.reloadStarted = false;
    this.publish({ ...this.snapshot, update: { status: "available" } });
  }

  public deferUpdate(): void {
    if (this.snapshot.update.status === "applying") return;
    this.clearUpdateTimer();
    this.reloadAuthorized = false;
    this.publish({ ...this.snapshot, update: { status: "none" } });
  }

  public async applyUpdate(): Promise<boolean> {
    if (this.snapshot.importActive || this.snapshot.update.status === "applying" || this.applyServiceWorkerUpdate === undefined) {
      return false;
    }
    if (!this.snapshot.online) {
      this.publish({ ...this.snapshot, update: { reason: "offline", status: "failed" } });
      return false;
    }

    this.publish({ ...this.snapshot, update: { status: "applying" } });
    try {
      const progressSaved = await (this.flushReaderProgress?.() ?? Promise.resolve(true));
      if (!progressSaved) {
        this.publish({ ...this.snapshot, update: { reason: "progress", status: "failed" } });
        return false;
      }
      this.reloadAuthorized = true;
      await this.applyServiceWorkerUpdate();
      if (!this.reloadStarted) {
        this.updateTimer = this.clock.setTimeout(() => {
          this.updateTimer = undefined;
          this.reloadAuthorized = false;
          this.publish({ ...this.snapshot, update: { reason: "update", status: "failed" } });
        }, this.updateTimeoutMs);
      }
      return true;
    } catch {
      this.clearUpdateTimer();
      this.reloadAuthorized = false;
      this.publish({ ...this.snapshot, update: { reason: "update", status: "failed" } });
      return false;
    }
  }

  /** Called by the SW adapter after the prompted worker becomes controlling. */
  public notifyReloadRequired(): void {
    if (!this.reloadAuthorized || this.reloadStarted) return;
    this.clearUpdateTimer();
    this.reloadStarted = true;
    this.reload();
  }

  private publish(snapshot: PwaUpdateSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  private clearUpdateTimer(): void {
    if (this.updateTimer === undefined) return;
    this.clock.clearTimeout(this.updateTimer);
    this.updateTimer = undefined;
  }
}

const browserClock: UpdateClock = {
  clearTimeout: (handle) => { clearTimeout(handle); },
  setTimeout: (callback, delay) => setTimeout(callback, delay),
};
