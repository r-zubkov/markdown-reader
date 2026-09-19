import { registerSW } from "virtual:pwa-register";

import type { ApplyServiceWorkerUpdate } from "@/features/platform-status/pwa-update-controller";

interface ServiceWorkerPromptCallbacks {
  readonly onNeedReload: () => void;
  readonly onOfflineReady: () => void;
  readonly onRegisterError: () => void;
  readonly onUpdateAvailable: (apply: ApplyServiceWorkerUpdate) => void;
}

/** Registers the generated worker once. Callbacks are stable controller methods, not render closures. */
export function registerPromptServiceWorker(callbacks: ServiceWorkerPromptCallbacks): () => void {
  let active = true;
  let applyUpdate: ApplyServiceWorkerUpdate = () => Promise.resolve();

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      if (active) callbacks.onUpdateAvailable(applyUpdate);
    },
    onNeedReload: () => {
      if (active) callbacks.onNeedReload();
    },
    onOfflineReady: () => {
      if (active) callbacks.onOfflineReady();
    },
    onRegisterError: () => {
      if (active) callbacks.onRegisterError();
    },
  });
  applyUpdate = () => updateServiceWorker(false);

  return () => { active = false; };
}
