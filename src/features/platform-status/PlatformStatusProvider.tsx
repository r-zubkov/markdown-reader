import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { platformStatusCopy as copy } from "./copy";
import type { RepositoryResult } from "@/application/ports/document-repository";
import { PwaUpdateController, type FlushReaderProgress } from "./pwa-update-controller";
import { StorageHealthService, type StorageHealth } from "@/infrastructure/platform/storage-health-service";
import { registerPromptServiceWorker } from "@/infrastructure/pwa/register-service-worker";
import { Button } from "@/ui/primitives/button";

const PlatformStatusContext = createContext<PwaUpdateController | null>(null);
const RemoteImagesContext = createContext<{ readonly enabled: boolean; readonly online: boolean; readonly setEnabled: (enabled: boolean) => void }>({ enabled: true, online: true, setEnabled: () => undefined });

interface RemoteImagesPreferenceStore {
  getPreferences(): Promise<RepositoryResult<{ readonly remoteImagesEnabled: boolean }>>;
  saveRemoteImagesEnabled(enabled: boolean, updatedAt: number): Promise<RepositoryResult<void>>;
}

interface PlatformStatusProviderProps {
  readonly children: ReactNode;
  readonly controller?: PwaUpdateController;
  readonly preferenceStore?: RemoteImagesPreferenceStore;
  readonly storageHealthService?: StorageHealthService;
}

export function PlatformStatusProvider({ children, controller: injectedController, preferenceStore, storageHealthService }: PlatformStatusProviderProps) {
  const [controller] = useState(() => injectedController ?? new PwaUpdateController({
    online: navigator.onLine,
    reload: () => { window.location.reload(); },
  }));
  const [storageHealth, setStorageHealth] = useState<StorageHealth>({ status: "unknown" });
  const [remoteImagesEnabled, setRemoteImagesEnabled] = useState(true);
  const hasRemoteImagesSelection = useRef(false);
  const [service] = useState(() => storageHealthService ?? new StorageHealthService());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

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
    let active = true;
    const inspect = () => { void service.inspect().then((next) => { if (active) setStorageHealth((previous) => sameStorageHealth(previous, next) ? previous : next); }); };
    inspect();
    window.addEventListener("focus", inspect);
    return () => { active = false; window.removeEventListener("focus", inspect); };
  }, [service]);

  useEffect(() => {
    if (preferenceStore === undefined) return;
    let active = true;
    void preferenceStore.getPreferences().then((result) => { if (active && result.ok && !hasRemoteImagesSelection.current) setRemoteImagesEnabled(result.value.remoteImagesEnabled); });
    return () => { active = false; };
  }, [preferenceStore]);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return undefined;
    return registerPromptServiceWorker({
      onNeedReload: () => { controller.notifyReloadRequired(); },
      onOfflineReady: () => { /* Offline readiness needs no transient announcement. */ },
      onRegisterError: () => { /* The current app remains usable; update attempts surface their own failure. */ },
      onUpdateAvailable: (apply) => { controller.notifyUpdateAvailable(apply); },
    });
  }, [controller]);

  const setRemoteImages = (enabled: boolean) => {
    if (enabled === remoteImagesEnabled) return;
    hasRemoteImagesSelection.current = true;
    setRemoteImagesEnabled(enabled);
    if (preferenceStore !== undefined) void preferenceStore.saveRemoteImagesEnabled(enabled, Date.now()).then((result) => { if (!result.ok) setRemoteImagesEnabled(!enabled); });
  };
  const requestPersistence = () => { void service.requestPersistence().then(setStorageHealth); };
  return <PlatformStatusContext.Provider value={controller}><RemoteImagesContext.Provider value={{ enabled: remoteImagesEnabled, online: snapshot.online, setEnabled: setRemoteImages }}>{children}<PlatformStatusBanner controller={controller} onRequestPersistence={requestPersistence} storageHealth={storageHealth} /></RemoteImagesContext.Provider></PlatformStatusContext.Provider>;
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

export function useRemoteImagesPolicy(): { readonly enabled: boolean; readonly online: boolean } {
  const { enabled, online } = useContext(RemoteImagesContext);
  return { enabled, online };
}

export function RemoteImagesToggle() {
  const { enabled, setEnabled } = useContext(RemoteImagesContext);
  return <Button aria-label={enabled ? copy.remoteImagesOn : copy.remoteImagesOff} onPress={() => { setEnabled(!enabled); }} size="sm" variant="ghost">{enabled ? "Изобр. вкл" : "Изобр. выкл"}</Button>;
}

export function PlatformStatusBanner({ controller, storageHealth = { status: "healthy" }, onRequestPersistence }: { readonly controller: PwaUpdateController; readonly storageHealth?: StorageHealth; readonly onRequestPersistence?: () => void }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { update } = snapshot;

  if (storageHealth.status === "unavailable") return <StorageBanner health={storageHealth} />;
  if (storageHealth.status === "risk") return <StorageBanner health={storageHealth} {...(onRequestPersistence === undefined ? {} : { onRequestPersistence })} />;

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

function StorageBanner({ health, onRequestPersistence }: { readonly health: Extract<StorageHealth, { readonly status: "risk" | "unavailable" }>; readonly onRequestPersistence?: () => void }) {
  const unavailable = health.status === "unavailable";
  const requestable = !unavailable && health.reason === "not-persisted";
  return <aside aria-labelledby="platform-status-title" aria-live="polite" className={`platform-status platform-status--storage-${unavailable ? "fatal" : "risk"}`} data-platform-status={unavailable ? "storage-unavailable" : `storage-${health.reason}`} data-testid="platform-status">
    <div><h2 id="platform-status-title">{unavailable ? copy.storageUnavailableTitle : copy.storageRiskTitle}</h2><p>{unavailable ? copy.storageUnavailable : health.reason === "near-quota" ? copy.storageNearQuota : copy.storageNotPersisted}</p></div>
    {requestable && onRequestPersistence !== undefined ? <div className="platform-status__actions"><Button onPress={onRequestPersistence}>{copy.requestPersistence}</Button></div> : null}
  </aside>;
}

function sameStorageHealth(left: StorageHealth, right: StorageHealth): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
