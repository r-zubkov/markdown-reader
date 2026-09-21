export const STORAGE_NEAR_QUOTA_RATIO = 0.9;

export type StorageHealth =
  | { readonly status: "unknown" }
  | { readonly status: "healthy"; readonly persisted?: boolean; readonly usage?: number; readonly quota?: number }
  | { readonly status: "risk"; readonly reason: "not-persisted" | "near-quota"; readonly usage?: number; readonly quota?: number }
  | { readonly status: "unavailable"; readonly reason: "indexeddb" | "storage-api" };

export interface StorageManagerLike {
  estimate(): Promise<{ readonly quota?: number; readonly usage?: number }>;
  persist?(): Promise<boolean>;
  persisted?(): Promise<boolean>;
}

export interface StorageHealthEnvironment {
  readonly indexedDB?: IDBFactory;
  readonly storage?: StorageManagerLike;
}

/** Browser storage APIs are advisory: this service never deletes data or promises retention. */
export class StorageHealthService {
  public constructor(private readonly browser: StorageHealthEnvironment = { indexedDB: window.indexedDB, storage: navigator.storage }) {}

  public async inspect(): Promise<StorageHealth> {
    if (this.browser.indexedDB === undefined) return { reason: "indexeddb", status: "unavailable" };
    const storage = this.browser.storage;
    if (storage === undefined) return { reason: "storage-api", status: "unavailable" };
    try {
      const estimate = await storage.estimate();
      const usage = safeStorageNumber(estimate.usage);
      const quota = safeStorageNumber(estimate.quota);
      const persisted = storage.persisted === undefined ? undefined : await safelyReadPersisted(storage);
      if (usage !== undefined && quota !== undefined && quota > 0 && usage / quota >= STORAGE_NEAR_QUOTA_RATIO) {
        return storageRisk("near-quota", usage, quota);
      }
      if (persisted === false) return storageRisk("not-persisted", usage, quota);
      return withHealthValues({ status: "healthy" }, persisted, usage, quota);
    } catch {
      return { reason: "storage-api", status: "unavailable" };
    }
  }

  /** This is called only by an explicit user action in the status banner. */
  public async requestPersistence(): Promise<StorageHealth> {
    const storage = this.browser.storage;
    if (this.browser.indexedDB === undefined) return { reason: "indexeddb", status: "unavailable" };
    if (storage?.persist === undefined) return { reason: "storage-api", status: "unavailable" };
    try {
      await storage.persist();
    } catch {
      // A denied/rejected request is represented by the following advisory inspection.
    }
    return this.inspect();
  }
}

async function safelyReadPersisted(storage: StorageManagerLike): Promise<boolean | undefined> {
  try { return await storage.persisted?.(); } catch { return undefined; }
}

function safeStorageNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function storageRisk(reason: Extract<StorageHealth, { readonly status: "risk" }>["reason"], usage: number | undefined, quota: number | undefined): Extract<StorageHealth, { readonly status: "risk" }> {
  return { reason, status: "risk", ...(usage === undefined ? {} : { usage }), ...(quota === undefined ? {} : { quota }) };
}

function withHealthValues(health: Extract<StorageHealth, { readonly status: "healthy" }>, persisted: boolean | undefined, usage: number | undefined, quota: number | undefined): StorageHealth {
  return { ...health, ...(persisted === undefined ? {} : { persisted }), ...(usage === undefined ? {} : { usage }), ...(quota === undefined ? {} : { quota }) };
}
