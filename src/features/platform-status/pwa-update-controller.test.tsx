import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlatformStatusBanner } from "./PlatformStatusProvider";
import { PwaUpdateController } from "./pwa-update-controller";

describe("PwaUpdateController", () => {
  it("waits for import, flushes ReaderState and authorizes exactly one prompted reload", async () => {
    const events: string[] = [];
    const reload = vi.fn();
    const controller = new PwaUpdateController({ online: true, reload });
    controller.setProgressFlusher(() => { events.push("flush"); return Promise.resolve(true); });
    controller.notifyUpdateAvailable(() => { events.push("update"); return Promise.resolve(); });
    controller.setImportActive(true);

    await expect(controller.applyUpdate()).resolves.toBe(false);
    expect(events).toEqual([]);
    controller.notifyReloadRequired();
    expect(reload).not.toHaveBeenCalled();

    act(() => { controller.setImportActive(false); });
    await expect(controller.applyUpdate()).resolves.toBe(true);
    await expect(controller.applyUpdate()).resolves.toBe(false);
    expect(events).toEqual(["flush", "update"]);
    controller.notifyReloadRequired();
    controller.notifyReloadRequired();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("keeps the current app when offline, progress flush fails or update rejects", async () => {
    const controller = new PwaUpdateController({ online: false, reload: vi.fn() });
    const update = vi.fn().mockResolvedValue(undefined);
    controller.notifyUpdateAvailable(update);
    await expect(controller.applyUpdate()).resolves.toBe(false);
    expect(controller.getSnapshot().update).toEqual({ reason: "offline", status: "failed" });
    expect(update).not.toHaveBeenCalled();

    controller.setOnline(true);
    controller.setProgressFlusher(() => Promise.resolve(false));
    await expect(controller.applyUpdate()).resolves.toBe(false);
    expect(controller.getSnapshot().update).toEqual({ reason: "progress", status: "failed" });
    expect(update).not.toHaveBeenCalled();

    controller.setProgressFlusher(() => Promise.resolve(true));
    controller.notifyUpdateAvailable(() => Promise.reject(new Error("update failed")));
    await expect(controller.applyUpdate()).resolves.toBe(false);
    expect(controller.getSnapshot().update).toEqual({ reason: "update", status: "failed" });
  });

  it("returns to a retryable failure when an activated worker never takes control", async () => {
    let timeoutCallback: (() => void) | undefined;
    const timeoutHandle = setTimeout(() => undefined, 0);
    clearTimeout(timeoutHandle);
    const controller = new PwaUpdateController({
      clock: {
        clearTimeout: () => { timeoutCallback = undefined; },
        setTimeout: (callback) => { timeoutCallback = callback; return timeoutHandle; },
      },
      online: true,
      reload: vi.fn(),
      updateTimeoutMs: 10,
    });
    controller.notifyUpdateAvailable(() => Promise.resolve());
    await expect(controller.applyUpdate()).resolves.toBe(true);
    expect(controller.getSnapshot().update.status).toBe("applying");
    timeoutCallback?.();
    expect(controller.getSnapshot().update).toEqual({ reason: "update", status: "failed" });
  });

  it("renders one persistent update/offline banner with disabled import gating", async () => {
    const controller = new PwaUpdateController({ online: true, reload: vi.fn() });
    const update = vi.fn().mockResolvedValue(undefined);
    controller.notifyUpdateAvailable(update);
    controller.setImportActive(true);
    render(<PlatformStatusBanner controller={controller} />);

    expect(screen.getByTestId("platform-status")).toHaveAttribute("data-platform-status", "available");
    expect(screen.getByRole("button", { name: "Обновить" })).toBeDisabled();
    expect(screen.getByText(/завершите или отмените/u)).toBeVisible();

    act(() => { controller.setImportActive(false); });
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => { expect(update).toHaveBeenCalledTimes(1); });
    expect(screen.getByTestId("platform-status")).toHaveAttribute("data-platform-status", "applying");

    act(() => { controller.notifyUpdateAvailable(update); });
    fireEvent.click(screen.getByRole("button", { name: "Позже" }));
    act(() => { controller.setOnline(false); });
    expect(screen.getByTestId("platform-status")).toHaveAttribute("data-platform-status", "offline");
    expect(screen.getByText(/Сохранённые документы доступны/u)).toBeVisible();
  });
});
