import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { platformStatusCopy as copy } from "./copy";
import { PwaUpdateController, type FlushReaderProgress } from "./pwa-update-controller";
import { registerPromptServiceWorker } from "@/infrastructure/pwa/register-service-worker";
import { Button } from "@/ui/primitives/button";

const PlatformStatusContext = createContext<PwaUpdateController | null>(null);

interface PlatformStatusProviderProps {
  readonly children: ReactNode;
  readonly controller?: PwaUpdateController;
}

export function PlatformStatusProvider({ children, controller: injectedController }: PlatformStatusProviderProps) {
  const [controller] = useState(() => injectedController ?? new PwaUpdateController({
    online: navigator.onLine,
    reload: () => { window.location.reload(); },
  }));

  useEffect(() => {
    const online = () => { controller.setOnline(true); };
    const offline = () => { controller.setOnline(false); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [controller]);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return undefined;
    return registerPromptServiceWorker({
      onNeedReload: () => { controller.notifyReloadRequired(); },
      onOfflineReady: () => { /* Offline readiness needs no transient announcement. */ },
      onRegisterError: () => { /* The current app remains usable; update attempts surface their own failure. */ },
      onUpdateAvailable: (apply) => { controller.notifyUpdateAvailable(apply); },
    });
  }, [controller]);

  return <PlatformStatusContext.Provider value={controller}>{children}<PlatformStatusBanner controller={controller} /></PlatformStatusContext.Provider>;
}

export function useImportLifecycleActivity(active: boolean): void {
  const controller = useContext(PlatformStatusContext);
  useLayoutEffect(() => {
    if (controller === null || !active) return undefined;
    controller.setImportActive(true);
    return () => { controller.setImportActive(false); };
  }, [active, controller]);
}

export function useReaderProgressFlusher(flush: FlushReaderProgress): void {
  const controller = useContext(PlatformStatusContext);
  useEffect(() => controller?.setProgressFlusher(flush), [controller, flush]);
}

export function PlatformStatusBanner({ controller }: { readonly controller: PwaUpdateController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { update } = snapshot;

  if (update.status === "none" && snapshot.online) return null;
  if (update.status === "none") {
    return <aside aria-labelledby="platform-status-title" aria-live="polite" className="platform-status platform-status--offline" data-platform-status="offline" data-testid="platform-status">
      <div><h2 id="platform-status-title">{copy.offlineTitle}</h2><p>{copy.offlineMessage}</p></div>
    </aside>;
  }

  const applying = update.status === "applying";
  const failedMessage = update.status === "failed"
    ? update.reason === "offline"
      ? copy.updateFailedOffline
      : update.reason === "progress"
        ? copy.updateFailedProgress
        : copy.updateFailed
    : undefined;
  const message = applying
    ? copy.updateApplying
    : failedMessage ?? (snapshot.importActive ? `${copy.updateAvailable} ${copy.updateBlocked}` : copy.updateAvailable);

  return <aside aria-labelledby="platform-status-title" aria-live="polite" className="platform-status platform-status--update" data-platform-status={update.status} data-testid="platform-status">
    <div><h2 id="platform-status-title">{copy.updateTitle}</h2><p>{message}</p></div>
    <div className="platform-status__actions">
      <Button isDisabled={applying || snapshot.importActive} onPress={() => { void controller.applyUpdate(); }}>
        {update.status === "failed" ? copy.retryAction : copy.updateAction}
      </Button>
      <Button isDisabled={applying} onPress={() => { controller.deferUpdate(); }} variant="outline">{copy.laterAction}</Button>
    </div>
  </aside>;
}
