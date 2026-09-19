import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import type { DocumentRepository, RepositoryErrorCode } from "@/application/ports/document-repository";
import { findSectionIndex, type ReaderPresentation } from "@/domain/reading/reader-presentation";
import type { RestoreConfidence } from "@/domain/reading/progress-mapping";
import { readerCopy } from "@/features/reader/copy";
import { ImportCoordinator, type ImportUiState, type ImportWorkerFactory } from "@/features/import/import-coordinator";
import { useReaderProgressFlusher } from "@/features/platform-status/PlatformStatusProvider";
import { ReaderLocationController, type LocationPersistenceStatus } from "@/features/reader/reader-location-controller";
import type { ObservedLocation } from "@/features/reader/reader-location-observer";
import { loadReader, type ReaderLoadResult } from "@/features/reader/reader-loader";
import { replaceReaderHash } from "@/features/reader/outline-resolver";
import { ReaderViewport } from "@/features/reader/ReaderViewport";
import { ReadingSettings } from "@/features/reader/ReadingSettings";
import { SectionReader } from "@/features/reader/SectionReader";
import { TableOfContents } from "@/features/reader/TableOfContents";
import { appCopy } from "@/shared/i18n/ru";

interface ReaderScreenProps {
  readonly documentId: string;
  readonly repository: DocumentRepository;
  readonly hash?: string;
  readonly workerFactory?: ImportWorkerFactory;
}

type ReaderViewState = { readonly status: "restoring" } | ReaderLoadResult;

interface NavigationTarget {
  readonly blockId?: string;
  readonly headingId?: string;
  readonly intraBlockRatio: number;
  readonly key: string;
  readonly ordinal: number;
}

export function ReaderScreen({ documentId, repository, hash = "", workerFactory = createImportWorker }: ReaderScreenProps) {
  const [state, setState] = useState<ReaderViewState>({ status: "restoring" });
  const [requestedHash, setRequestedHash] = useState(hash);
  const [shouldFocusTarget, setShouldFocusTarget] = useState(false);
  const [observedLocation, setObservedLocation] = useState<ObservedLocation | undefined>(undefined);
  const [presentationOverride, setPresentationOverride] = useState<ReaderPresentation | undefined>(undefined);
  const [settingsState, setSettingsState] = useState<"idle" | "applying" | "failed">("idle");
  const [persistenceState, setPersistenceState] = useState<LocationPersistenceStatus>("idle");
  const [sectionIndex, setSectionIndex] = useState<number | undefined>(undefined);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | undefined>(undefined);
  const [restoreNotice, setRestoreNotice] = useState<Exclude<RestoreConfidence, "exact"> | undefined>(undefined);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [reprocessState, setReprocessState] = useState<ImportUiState | undefined>(undefined);
  const navigationSequenceRef = useRef(0);
  const applyingRef = useRef(false);
  const hashPropRef = useRef(hash);
  const settingsAnchorRef = useRef<ObservedLocation | undefined>(undefined);
  const handleReprocessState = useCallback((next: ImportUiState): void => {
    setReprocessState(next);
    if (next.status === "succeeded" && next.documentId === documentId) setLoadAttempt((attempt) => attempt + 1);
  }, [documentId]);
  const reprocessCoordinator = useMemo(
    () => new ImportCoordinator(repository, workerFactory, handleReprocessState),
    [handleReprocessState, repository, workerFactory],
  );

  const controller = useMemo(() => new ReaderLocationController({
    onPersistenceStatus: setPersistenceState,
    onUiLocation: setObservedLocation,
    persist: (location, updatedAt) => repository.saveReaderAnchor({
      anchor: location.anchor,
      documentId,
      ...(location.lastSectionId === undefined ? {} : { lastSectionId: location.lastSectionId }),
      progressRatio: location.progressRatio,
      updatedAt,
    }),
  }), [documentId, repository]);
  const flushReaderProgress = useCallback(() => controller.flush(), [controller]);
  useReaderProgressFlusher(flushReaderProgress);

  useEffect(() => {
    let active = true;
    void loadReader(repository, documentId, requestedHash).then((result) => {
      if (!active) return;
      setState(result);
      setNavigationTarget(undefined);
      setObservedLocation(undefined);
      setPresentationOverride(undefined);
      setSectionIndex(undefined);
      const pendingNotice = result.status === "ready" ? result.readerState?.pendingRestoreNotice : undefined;
      setRestoreNotice(pendingNotice?.confidence ?? (result.status === "ready" && result.restore !== undefined && result.restore.confidence !== "exact" ? result.restore.confidence : undefined));
      if (pendingNotice !== undefined) {
        void repository.dismissReaderRestoreNotice({ documentId, versionId: pendingNotice.versionId });
      }
    });
    return () => { active = false; };
  }, [documentId, loadAttempt, repository, requestedHash]);

  useEffect(() => () => { reprocessCoordinator.dispose(); }, [reprocessCoordinator]);

  useEffect(() => {
    if (state.status === "restoring" || state.status === "ready") return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-reader-state-heading]")?.focus();
    });
    return () => { window.cancelAnimationFrame(frame); };
  }, [state.status]);

  useEffect(() => {
    if (hashPropRef.current === hash) return;
    hashPropRef.current = hash;
    setRequestedHash(hash);
  }, [hash]);

  useEffect(() => {
    const flush = () => { void controller.flush(); };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      void controller.flush();
    };
  }, [controller]);

  function selectHeading(id: string, shouldFocus: boolean): void {
    void controller.flush();
    setShouldFocusTarget(shouldFocus);
    if (state.status === "ready") {
      const target = state.document.outline.find((item) => item.id === id);
      if (target !== undefined) {
        const presentation = presentationOverride ?? state.presentation;
        setSectionIndex(findSectionIndex(state.document.layouts[presentation.splitStrategy].sections, target.chunkOrdinal));
      }
    }
    setRestoreNotice(undefined);
    replaceReaderHash(id);
    setRequestedHash(`#${encodeURIComponent(id)}`);
  }

  async function applyPresentation(change: Partial<Pick<ReaderPresentation, "mode" | "splitStrategy">>): Promise<void> {
    if (state.status !== "ready" || applyingRef.current) return;
    const current = presentationOverride ?? state.presentation;
    const next: ReaderPresentation = {
      mode: change.mode ?? current.mode,
      modeOrigin: change.mode === undefined ? current.modeOrigin : "user",
      splitStrategy: change.splitStrategy ?? current.splitStrategy,
    };
    if (next.splitStrategy === "whole" && !state.document.layouts.whole.safeForSelection) { setSettingsState("failed"); return; }

    applyingRef.current = true;
    setSettingsState("applying");
    const location = settingsAnchorRef.current ?? controller.getCurrentLocation() ?? observedLocation;
    const locationSaved = await controller.flush();
    if (!locationSaved) {
      applyingRef.current = false;
      setSettingsState("failed");
      return;
    }
    const result = await repository.saveReaderPresentation({
      documentId,
      modeOrigin: next.modeOrigin,
      readingMode: next.mode,
      splitStrategy: next.splitStrategy,
      updatedAt: currentTimestamp(),
    });
    if (!result.ok) {
      applyingRef.current = false;
      setSettingsState("failed");
      return;
    }
    setPresentationOverride(next);
    const targetOrdinal = location?.chunkOrdinal ?? state.targetOrdinal;
    setSectionIndex(findSectionIndex(state.document.layouts[next.splitStrategy].sections, targetOrdinal));
    if (location !== undefined) setNavigationTarget(createBlockTarget(location, nextNavigationKey(navigationSequenceRef)));
    setRestoreNotice(undefined);
    setSettingsState("idle");
    applyingRef.current = false;
  }

  function startAtBeginning(): void {
    if (state.status !== "ready") return;
    setRestoreNotice(undefined);
    setSectionIndex(0);
    setNavigationTarget({ intraBlockRatio: 0, key: nextNavigationKey(navigationSequenceRef), ordinal: 0 });
  }

  function changeSection(index: number, sections: readonly { readonly id: string; readonly startChunkOrdinal: number }[]): void {
    const section = sections[index];
    if (section === undefined) return;
    void controller.flush();
    setSectionIndex(index);
    setNavigationTarget({ intraBlockRatio: 0, key: nextNavigationKey(navigationSequenceRef), ordinal: section.startChunkOrdinal });
  }

  const handleLocationChange = useCallback((location: ObservedLocation): void => {
    controller.observe(location);
  }, [controller]);
  const handleFatalError = useCallback((code: RepositoryErrorCode): void => {
    setState(code === "DOCUMENT_NOT_FOUND" ? { code, status: "missing" } : code === "STALE_DERIVED" ? { code, status: "stale" } : { code, status: "corrupt" });
  }, []);
  const handleTargetSettled = useCallback((): void => { setShouldFocusTarget(false); }, []);

  return <main className="screen screen--reader" id="main-content">
    <article
      aria-busy={state.status === "restoring"}
      aria-labelledby="reader-title"
      className="screen__content reader"
      data-current-block-id={controller.getCurrentLocation()?.anchor.blockId ?? ""}
      data-location-observations={controller.getMetrics().observations}
      data-location-ui-updates={controller.getMetrics().uiUpdates}
      data-location-writes={controller.getMetrics().writes}
      id="document-content"
      tabIndex={-1}
    >
      {state.status === "restoring" ? <ReaderNotice text={appCopy.reader.restoring} /> : null}
      {state.status === "ready" ? <>{(() => {
        const presentation = presentationOverride ?? state.presentation;
        const sections = state.document.layouts[presentation.splitStrategy].sections;
        const targetOrdinal = navigationTarget?.ordinal ?? state.targetOrdinal;
        const targetHeadingId = navigationTarget?.headingId ?? (state.hashResolution.kind === "valid" ? state.hashResolution.heading.id : undefined);
        const targetBlockId = navigationTarget?.blockId ?? (state.hashResolution.kind === "valid" ? undefined : state.targetAnchor?.blockId);
        const targetIntraBlockRatio = navigationTarget?.intraBlockRatio ?? state.targetAnchor?.intraBlockRatio ?? 0;
        const targetRequestKey = navigationTarget?.key ?? `${state.requestHash}:${targetBlockId ?? targetHeadingId ?? String(targetOrdinal)}`;
        const activeIndex = sectionIndex ?? findSectionIndex(sections, targetOrdinal);
        const activeSection = sections[activeIndex] ?? sections[0];
        const progressRatio = observedLocation?.progressRatio ?? state.readerState?.progressRatio ?? 0;
        return <>
          <p className="screen__eyebrow">{appCopy.reader.eyebrow}</p>
          <h1 data-route-heading="true" id="reader-title" tabIndex={-1}>{state.document.title}</h1>
          <ReaderProgress ratio={progressRatio} />
          {state.document.outline.length === 0 ? <p className="reader__notice" role="note">{readerCopy.noHeadings}</p> : <TableOfContents activeId={activeHeadingId(state, observedLocation)} outline={state.document.outline} onSelect={selectHeading} />}
          {state.hashResolution.kind === "invalid" ? <ReaderNotice text={appCopy.reader.invalidHeading} /> : null}
          <RestoreStatus confidence={restoreNotice} onContinue={() => { setRestoreNotice(undefined); }} onStart={startAtBeginning} />
          <div className="reader__controls"><ReadingSettings applying={settingsState === "applying"} layouts={state.document.layouts} onModeChange={(mode) => { void applyPresentation({ mode }); }} onOpenChange={(open) => { if (open) settingsAnchorRef.current = controller.getCurrentLocation() ?? observedLocation; }} onStrategyChange={(splitStrategy) => { void applyPresentation({ splitStrategy }); }} presentation={presentation} />{settingsState === "failed" ? <ReaderNotice text={readerCopy.settingsFailed} /> : null}</div>
          {presentation.mode === "continuous" ? <p className="reader__window-status">{appCopy.reader.continuousWindow}</p> : null}
          {state.requestHash === requestedHash ? null : <ReaderNotice text={appCopy.reader.restoring} />}
          {presentation.mode === "continuous" ? <ReaderViewport
            document={state.document}
            focusTarget={shouldFocusTarget}
            initialChunks={state.chunks}
            onFatalError={handleFatalError}
            onLocationChange={handleLocationChange}
            onTargetSettled={handleTargetSettled}
            repository={repository}
            {...(targetBlockId === undefined ? {} : { targetBlockId })}
            {...(targetHeadingId === undefined ? {} : { targetId: targetHeadingId })}
            targetIntraBlockRatio={targetIntraBlockRatio}
            targetOrdinal={targetOrdinal}
            targetRequestKey={targetRequestKey}
          /> : activeSection === undefined ? <ReaderNotice text={appCopy.reader.emptyDocument} /> : <>
            <SectionContext index={activeIndex} section={activeSection} total={sections.length} />
            <SectionReader
              document={state.document}
              focusTarget={shouldFocusTarget}
              key={`${activeSection.id}:${targetRequestKey}`}
              onFatalError={handleFatalError}
              onLocationChange={handleLocationChange}
              onTargetSettled={handleTargetSettled}
              repository={repository}
              section={activeSection}
              {...(targetBlockId === undefined ? {} : { targetBlockId })}
              {...(targetHeadingId === undefined ? {} : { targetId: targetHeadingId })}
              targetIntraBlockRatio={targetIntraBlockRatio}
              targetOrdinal={targetOrdinal}
              targetRequestKey={targetRequestKey}
            />
            <SectionPager index={activeIndex} onChange={(index) => { changeSection(index, sections); }} sections={sections} />
          </>}
          {persistenceState === "failed" ? <ReaderNotice text={readerCopy.persistenceFailed} /> : null}
        </>;
      })()}</> : null}
      {state.status === "empty" ? <ReaderRecovery code="EMPTY_DOCUMENT" text={appCopy.reader.emptyDocument} /> : null}
      {state.status === "missing" ? <ReaderRecovery code={state.code} text={appCopy.reader.missingDocument} /> : null}
      {state.status === "stale" ? <ReaderRecovery code={state.code} onReprocess={() => { void reprocessCoordinator.rebuild(documentId); }} {...(reprocessState === undefined ? {} : { reprocessState })} text={appCopy.reader.staleDocument} /> : null}
      {state.status === "corrupt" ? <ReaderRecovery code={state.code} text={appCopy.reader.corruptDocument} /> : null}
    </article>
  </main>;
}

export function ReaderToolbar({ title }: { readonly title?: string }) {
  return <nav aria-label={appCopy.a11y.readerToolbar} className="reader-toolbar"><Link to="/">{appCopy.navigation.backToLibrary}</Link><span className="reader-toolbar__title">{title ?? appCopy.reader.toolbarTitle}</span></nav>;
}

export function RestoreStatus({ confidence, onContinue, onStart }: { readonly confidence: Exclude<RestoreConfidence, "exact"> | undefined; readonly onContinue: () => void; readonly onStart: () => void }) {
  if (confidence === undefined) return null;
  return <section className="reader__restore-notice">
    <p aria-live="polite" role="status">{confidence === "approximate" ? readerCopy.restoreApproximate : readerCopy.restoreNotFound}</p>
    <div>{confidence === "approximate" ? <button onClick={onContinue} type="button">{readerCopy.continueReading}</button> : null}<button onClick={onStart} type="button">{readerCopy.startReading}</button></div>
  </section>;
}

function ReaderProgress({ ratio }: { readonly ratio: number }) {
  const safeRatio = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const label = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0, style: "percent" }).format(safeRatio);
  return <div className="reader-progress"><span>{readerCopy.readingProgress}: {label}</span><progress aria-label={readerCopy.readingProgress} max={1} value={safeRatio} /></div>;
}

function ReaderNotice({ text }: { readonly text: string }) { return <p className="reader__notice" role="status">{text}</p>; }
export function ReaderRecovery({ code, onReprocess, reprocessState, text }: {
  readonly code: string;
  readonly onReprocess?: () => void;
  readonly reprocessState?: ImportUiState;
  readonly text: string;
}) {
  const running = reprocessState?.status === "validating" || reprocessState?.status === "running" || reprocessState?.status === "finalizing";
  const failed = reprocessState?.status === "failed";
  const showRetry = code !== "EMPTY_DOCUMENT";
  return <section aria-labelledby="reader-title" className="reader__recovery">
    <h1 data-reader-state-heading="true" data-route-heading="true" id="reader-title" tabIndex={-1}>{appCopy.reader.title}</h1>
    <p>{text}</p>
    <p className="reader__diagnostic"><span>{readerCopy.diagnosticCode}</span> <code>{code}</code></p>
    {onReprocess === undefined ? null : <>
      {running ? <p aria-live="polite" role="status">{readerCopy.reprocessing}</p> : null}
      {failed ? <p className="reader__reprocess-error" role="alert">{readerCopy.reprocessFailed}</p> : null}
      <button disabled={running} onClick={onReprocess} type="button">{failed ? readerCopy.retryReprocess : readerCopy.reprocess}</button>
    </>}
    <div className="reader__recovery-actions">{showRetry ? <button onClick={() => { window.location.reload(); }} type="button">{readerCopy.retryOpen}</button> : null}<Link className="screen__link" to="/">{appCopy.navigation.backToLibrary}</Link><Link className="screen__link" to="/">{appCopy.library.import}</Link></div>
  </section>;
}
function currentTimestamp(): number { return Date.now(); }

function createImportWorker() { return new Worker(new URL("../../workers/import-worker.ts", import.meta.url), { type: "module" }); }

function activeHeadingId(state: Extract<ReaderLoadResult, { readonly status: "ready" }>, observed: ObservedLocation | undefined): string | undefined {
  if (observed === undefined) return state.hashResolution.kind === "valid" ? state.hashResolution.heading.id : undefined;
  return state.document.outline.find((item) => item.pathKey === observed.anchor.headingPathKey)?.id ?? [...state.document.outline].reverse().find((item) => item.chunkOrdinal <= observed.chunkOrdinal)?.id;
}

function createBlockTarget(location: ObservedLocation, key: string): NavigationTarget {
  return { blockId: location.anchor.blockId, intraBlockRatio: location.anchor.intraBlockRatio, key, ordinal: location.chunkOrdinal };
}

function nextNavigationKey(sequence: { current: number }): string {
  sequence.current += 1;
  return `reader-navigation-${String(sequence.current)}`;
}

function SectionContext({ index, section, total }: { readonly index: number; readonly section: { readonly title?: string }; readonly total: number }) { return <p className="section-context" role="status">{readerCopy.sectionContext.replace("{current}", String(index + 1)).replace("{total}", String(total)).replace("{title}", section.title ?? readerCopy.untitledSection)}</p>; }
function SectionPager({ index, onChange, sections }: { readonly index: number; readonly onChange: (index: number) => void; readonly sections: readonly { readonly title?: string }[] }) { const previous = sections[index - 1]; const next = sections[index + 1]; return <nav aria-label={readerCopy.sectionNavigation} className="section-pager"><button disabled={previous === undefined} onClick={() => { onChange(index - 1); }} type="button">{readerCopy.previousSection}{previous?.title === undefined ? "" : `: ${previous.title}`}</button><button disabled={next === undefined} onClick={() => { onChange(index + 1); }} type="button">{readerCopy.nextSection}{next?.title === undefined ? "" : `: ${next.title}`}</button></nav>; }
