import type { RepositoryResult } from "@/application/ports/document-repository";
import type { ObservedLocation } from "@/features/reader/reader-location-observer";

export const LOCATION_UI_THROTTLE_MS = 120;
export const LOCATION_WRITE_THROTTLE_MS = 800;

export type LocationPersistenceStatus = "idle" | "saving" | "failed";

interface LocationClock {
  readonly clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
  readonly now: () => number;
  readonly setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
}

interface ReaderLocationControllerOptions {
  readonly onPersistenceStatus: (status: LocationPersistenceStatus) => void;
  readonly onUiLocation: (location: ObservedLocation) => void;
  readonly persist: (location: ObservedLocation, updatedAt: number) => Promise<RepositoryResult<void>>;
  readonly clock?: LocationClock;
  readonly uiThrottleMs?: number;
  readonly writeThrottleMs?: number;
}

export interface ReaderLocationMetrics {
  readonly observations: number;
  readonly uiUpdates: number;
  readonly writes: number;
}

/** Keeps scroll-rate state outside React and serializes trailing persistence. */
export class ReaderLocationController {
  private readonly clock: LocationClock;
  private readonly onPersistenceStatus: ReaderLocationControllerOptions["onPersistenceStatus"];
  private readonly onUiLocation: ReaderLocationControllerOptions["onUiLocation"];
  private readonly persist: ReaderLocationControllerOptions["persist"];
  private readonly uiThrottleMs: number;
  private readonly writeThrottleMs: number;
  private currentLocation: ObservedLocation | undefined;
  private uiTimer: ReturnType<typeof setTimeout> | undefined;
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private writeChain: Promise<boolean> = Promise.resolve(true);
  private lastPersistedKey = "";
  private observations = 0;
  private uiUpdates = 0;
  private writes = 0;

  public constructor(options: ReaderLocationControllerOptions) {
    this.clock = options.clock ?? browserClock;
    this.onPersistenceStatus = options.onPersistenceStatus;
    this.onUiLocation = options.onUiLocation;
    this.persist = options.persist;
    this.uiThrottleMs = options.uiThrottleMs ?? LOCATION_UI_THROTTLE_MS;
    this.writeThrottleMs = options.writeThrottleMs ?? LOCATION_WRITE_THROTTLE_MS;
  }

  public observe(location: ObservedLocation): void {
    this.observations += 1;
    if (locationKey(this.currentLocation) === locationKey(location)) return;
    this.currentLocation = location;
    this.uiTimer ??= this.clock.setTimeout(() => {
        this.uiTimer = undefined;
        this.publishUi();
      }, this.uiThrottleMs);
    if (this.writeTimer !== undefined) this.clock.clearTimeout(this.writeTimer);
    this.writeTimer = this.clock.setTimeout(() => {
      this.writeTimer = undefined;
      void this.enqueueWrite();
    }, this.writeThrottleMs);
  }

  public getCurrentLocation(): ObservedLocation | undefined {
    return this.currentLocation;
  }

  public getMetrics(): ReaderLocationMetrics {
    return { observations: this.observations, uiUpdates: this.uiUpdates, writes: this.writes };
  }

  public flush(): Promise<boolean> {
    this.cancelTimers();
    this.publishUi();
    return this.enqueueWrite();
  }

  public cancelScheduled(): void {
    this.cancelTimers();
  }

  private publishUi(): void {
    if (this.currentLocation === undefined) return;
    this.uiUpdates += 1;
    this.onUiLocation(this.currentLocation);
  }

  private enqueueWrite(): Promise<boolean> {
    const location = this.currentLocation;
    if (location === undefined) return this.writeChain;
    const key = locationKey(location);
    if (key === this.lastPersistedKey) return this.writeChain;
    this.writeChain = this.writeChain.then(async () => {
      if (key === this.lastPersistedKey) return true;
      this.writes += 1;
      this.onPersistenceStatus("saving");
      const result = await this.persist(location, this.clock.now());
      if (result.ok) {
        this.lastPersistedKey = key;
        this.onPersistenceStatus("idle");
        return true;
      }
      this.onPersistenceStatus("failed");
      return false;
    });
    return this.writeChain;
  }

  private cancelTimers(): void {
    if (this.uiTimer !== undefined) this.clock.clearTimeout(this.uiTimer);
    if (this.writeTimer !== undefined) this.clock.clearTimeout(this.writeTimer);
    this.uiTimer = undefined;
    this.writeTimer = undefined;
  }
}

const browserClock: LocationClock = {
  clearTimeout: (handle) => { clearTimeout(handle); },
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
};

function locationKey(location: ObservedLocation | undefined): string {
  if (location === undefined) return "";
  return [
    location.anchor.versionId,
    location.anchor.blockId,
    location.anchor.intraBlockRatio.toFixed(4),
    location.progressRatio.toFixed(4),
    location.lastSectionId ?? "",
  ].join(":");
}
