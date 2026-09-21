import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type RepositoryResult } from "@/application/ports/document-repository";
import { StorageHealthService } from "@/infrastructure/platform/storage-health-service";
import { PlatformStatusProvider, RemoteImagesToggle, useRemoteImagesPolicy } from "./PlatformStatusProvider";
import { PwaUpdateController } from "./pwa-update-controller";

const indexedDb = {} as IDBFactory;

describe("PlatformStatusProvider", () => {
  it("loads and persists the remote-image choice without an automatic persistence request", async () => {
    const saveRemoteImagesEnabled = vi.fn(() => Promise.resolve(ok(undefined)));
    const persist = vi.fn(() => Promise.resolve(false));
    const storageHealthService = new StorageHealthService({ indexedDB: indexedDb, storage: {
      estimate: () => Promise.resolve({ quota: 1_000, usage: 1 }),
      persist,
      persisted: () => Promise.resolve(true),
    } });
    render(<PlatformStatusProvider controller={new PwaUpdateController({ online: true, reload: vi.fn() })} preferenceStore={{
      getPreferences: () => Promise.resolve(ok({ remoteImagesEnabled: false })),
      saveRemoteImagesEnabled,
    }} storageHealthService={storageHealthService}><PolicyProbe /><RemoteImagesToggle /></PlatformStatusProvider>);

    await waitFor(() => { expect(screen.getByTestId("media-policy")).toHaveTextContent("off"); });
    expect(persist).not.toHaveBeenCalled();
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Внешние изображения: выключены/u })); });
    await waitFor(() => { expect(saveRemoteImagesEnabled).toHaveBeenCalledWith(true, expect.any(Number)); });
    expect(screen.getByTestId("media-policy")).toHaveTextContent("on");
  });

  it("only invokes StorageManager.persist after the explicit banner action", async () => {
    const persist = vi.fn(() => Promise.resolve(false));
    const service = new StorageHealthService({ indexedDB: indexedDb, storage: {
      estimate: () => Promise.resolve({ quota: 1_000, usage: 1 }),
      persist,
      persisted: () => Promise.resolve(false),
    } });
    render(<PlatformStatusProvider controller={new PwaUpdateController({ online: true, reload: vi.fn() })} storageHealthService={service}><PolicyProbe /></PlatformStatusProvider>);
    await screen.findByRole("button", { name: "Запросить постоянное хранение" });
    expect(persist).not.toHaveBeenCalled();
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Запросить постоянное хранение" })); });
    await waitFor(() => { expect(persist).toHaveBeenCalledTimes(1); });
  });
});

function PolicyProbe() {
  const { enabled } = useRemoteImagesPolicy();
  return <output data-testid="media-policy">{enabled ? "on" : "off"}</output>;
}

function ok<T>(value: T): RepositoryResult<T> { return { ok: true, value }; }
