import { describe, expect, it, vi } from "vitest";

import { STORAGE_NEAR_QUOTA_RATIO, StorageHealthService } from "./storage-health-service";

const indexedDb = {} as IDBFactory;

describe("StorageHealthService", () => {
  it("normalizes advisory estimates, persistence denial, and absent APIs without making a retention promise", async () => {
    const denied = new StorageHealthService({ indexedDB: indexedDb, storage: {
      estimate: () => Promise.resolve({ quota: 1_000, usage: 12 }),
      persisted: () => Promise.resolve(false),
    } });
    await expect(denied.inspect()).resolves.toEqual({ quota: 1_000, reason: "not-persisted", status: "risk", usage: 12 });

    const nearQuota = new StorageHealthService({ indexedDB: indexedDb, storage: {
      estimate: () => Promise.resolve({ quota: 1_000, usage: 1_000 * STORAGE_NEAR_QUOTA_RATIO }),
      persisted: () => Promise.resolve(true),
    } });
    await expect(nearQuota.inspect()).resolves.toEqual({ quota: 1_000, reason: "near-quota", status: "risk", usage: 900 });
    await expect(new StorageHealthService({ indexedDB: indexedDb }).inspect()).resolves.toEqual({ reason: "storage-api", status: "unavailable" });
    await expect(new StorageHealthService({ storage: { estimate: () => Promise.resolve({}) } }).inspect()).resolves.toEqual({ reason: "indexeddb", status: "unavailable" });
  });

  it("requests persistence only when the caller explicitly invokes it and reports a later denial honestly", async () => {
    const persist = vi.fn(() => Promise.resolve(false));
    const service = new StorageHealthService({ indexedDB: indexedDb, storage: {
      estimate: () => Promise.resolve({ quota: 1_000, usage: 0 }),
      persist,
      persisted: () => Promise.resolve(false),
    } });
    await service.inspect();
    expect(persist).not.toHaveBeenCalled();
    await expect(service.requestPersistence()).resolves.toMatchObject({ reason: "not-persisted", status: "risk" });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
