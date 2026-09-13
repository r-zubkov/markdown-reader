import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { DocumentRepository, RepositoryErrorCode } from "@/application/ports/document-repository";
import { loadReader, type ReaderLoadResult } from "@/features/reader/reader-loader";
import { replaceReaderHash } from "@/features/reader/outline-resolver";
import { ReaderViewport, type ObservedLocation } from "@/features/reader/ReaderViewport";
import { ReadingSettings } from "@/features/reader/ReadingSettings";
import { SectionReader } from "@/features/reader/SectionReader";
import { TableOfContents } from "@/features/reader/TableOfContents";
import { readerCopy } from "@/features/reader/copy";
import { findSectionIndex, type ReaderPresentation } from "@/domain/reading/reader-presentation";
import { appCopy } from "@/shared/i18n/ru";

interface ReaderScreenProps {
  readonly documentId: string;
  readonly repository: DocumentRepository;
  readonly hash?: string;
}

type ReaderViewState = { readonly status: "restoring" } | ReaderLoadResult;

export function ReaderScreen({ documentId, repository, hash = "" }: ReaderScreenProps) {
  const [state, setState] = useState<ReaderViewState>({ status: "restoring" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "failed">("idle");
  const [requestedHash, setRequestedHash] = useState(hash);
  const [shouldFocusTarget, setShouldFocusTarget] = useState(false);
  const [observedLocation, setObservedLocation] = useState<ObservedLocation | undefined>(undefined);
  const [presentationOverride, setPresentationOverride] = useState<ReaderPresentation | undefined>(undefined);
  const [settingsState, setSettingsState] = useState<"idle" | "applying" | "failed">("idle");
  const [sectionIndex, setSectionIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void loadReader(repository, documentId, requestedHash).then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [documentId, repository, requestedHash]);

  function selectHeading(id: string, shouldFocus: boolean): void {
    setShouldFocusTarget(shouldFocus);
    if (state.status === "ready") {
      const target = state.document.outline.find((item) => item.id === id);
      if (target !== undefined) setSectionIndex(findSectionIndex(state.document.layouts[(presentationOverride ?? state.presentation).splitStrategy].sections, target.chunkOrdinal));
    }
    replaceReaderHash(id);
    setRequestedHash(`#${encodeURIComponent(id)}`);
  }

  async function saveAnchor(): Promise<void> {
    const anchor = observedLocation?.anchor;
    if (anchor === undefined) { setSaveState("failed"); return; }
    setSaveState("saving");
    const result = await repository.saveReaderAnchor({
      anchor,
      documentId,
      progressRatio: anchor.overallSourceRatio,
      updatedAt: currentTimestamp(),
    });
    setSaveState(result.ok ? "idle" : "failed");
  }

  async function applyPresentation(change: Partial<Pick<ReaderPresentation, "mode" | "splitStrategy">>): Promise<void> {
    if (state.status !== "ready") return;
    const current = presentationOverride ?? state.presentation;
    const next: ReaderPresentation = { mode: change.mode ?? current.mode, modeOrigin: change.mode === undefined ? current.modeOrigin : "user", splitStrategy: change.splitStrategy ?? current.splitStrategy };
    if (next.splitStrategy === "whole" && !state.document.layouts.whole.safeForSelection) { setSettingsState("failed"); return; }
    window.dispatchEvent(new Event("markdown-reader:before-layout-change"));
    setSettingsState("applying");
    const result = await repository.saveReaderPresentation({ documentId, modeOrigin: next.modeOrigin, readingMode: next.mode, splitStrategy: next.splitStrategy, updatedAt: currentTimestamp() });
    if (!result.ok) { setSettingsState("failed"); return; }
    setPresentationOverride(next);
    setSectionIndex(findSectionIndex(state.document.layouts[next.splitStrategy].sections, observedLocation?.chunkOrdinal ?? state.targetOrdinal));
    setSettingsState("idle");
  }

  const handleLocationChange = useCallback((location: ObservedLocation): void => {
    setObservedLocation((current) => current?.chunkOrdinal === location.chunkOrdinal && current.anchor?.blockId === location.anchor?.blockId ? current : location);
  }, []);
  const handleFatalError = useCallback((code: RepositoryErrorCode): void => {
    setState(code === "DOCUMENT_NOT_FOUND" ? { status: "missing" } : code === "STALE_DERIVED" ? { status: "stale" } : { status: "corrupt" });
  }, []);
  const handleTargetSettled = useCallback((): void => { setShouldFocusTarget(false); }, []);

  return <main className="screen screen--reader" id="main-content">
    <article aria-busy={state.status === "restoring"} aria-labelledby="reader-title" className="screen__content reader" id="document-content" tabIndex={-1}>
      {state.status === "restoring" ? <ReaderNotice text={appCopy.reader.restoring} /> : null}
      {state.status === "ready" ? <>
        {(() => {
          const presentation = presentationOverride ?? state.presentation;
          const sections = state.document.layouts[presentation.splitStrategy].sections;
          const activeIndex = sectionIndex ?? findSectionIndex(sections, state.targetOrdinal);
          const activeSection = sections[activeIndex] ?? sections[0];
          return <>
        <p className="screen__eyebrow">{appCopy.reader.eyebrow}</p>
        <h1 data-route-heading="true" id="reader-title" tabIndex={-1}>{state.document.title}</h1>
        <TableOfContents activeId={activeHeadingId(state, observedLocation)} outline={state.document.outline} onSelect={selectHeading} />
        {state.hashResolution.kind === "invalid" ? <ReaderNotice text={appCopy.reader.invalidHeading} /> : null}
        <div className="reader__controls"><ReadingSettings applying={settingsState === "applying"} layouts={state.document.layouts} onModeChange={(mode) => { void applyPresentation({ mode }); }} onStrategyChange={(splitStrategy) => { void applyPresentation({ splitStrategy }); }} presentation={presentation} />{settingsState === "failed" ? <ReaderNotice text={readerCopy.settingsFailed} /> : null}</div>
        {presentation.mode === "continuous" ? <p className="reader__window-status">{appCopy.reader.continuousWindow}</p> : null}
        {state.requestHash === requestedHash ? null : <ReaderNotice text={appCopy.reader.restoring} />}
        {presentation.mode === "continuous" ? <><button className="reader-chunk__save" data-testid={`reader-save-block-${String(observedLocation?.chunkOrdinal ?? state.targetOrdinal)}`} disabled={observedLocation?.anchor === undefined || saveState === "saving"} onClick={() => { void saveAnchor(); }} type="button">{appCopy.reader.savePosition}</button><ReaderViewport
          document={state.document}
          focusTarget={shouldFocusTarget}
          initialChunks={state.chunks}
          onFatalError={handleFatalError}
          onLocationChange={handleLocationChange}
          onTargetSettled={handleTargetSettled}
          repository={repository}
          {...(state.hashResolution.kind === "valid" ? { targetId: state.hashResolution.heading.id } : {})}
          targetOrdinal={state.targetOrdinal}
          targetRequestKey={`${state.requestHash}:${String(state.targetOrdinal)}`}
        /></> : activeSection === undefined ? <ReaderNotice text={appCopy.reader.emptyDocument} /> : <><SectionContext index={activeIndex} section={activeSection} total={sections.length} /><SectionReader document={state.document} key={`${activeSection.id}:${String(state.targetOrdinal)}`} onFatalError={handleFatalError} repository={repository} section={activeSection} {...(state.hashResolution.kind === "valid" ? { targetId: state.hashResolution.heading.id } : {})} targetOrdinal={state.targetOrdinal} /><SectionPager index={activeIndex} onChange={setSectionIndex} sections={sections} /></>}
        {saveState === "failed" ? <ReaderNotice text={appCopy.reader.saveFailed} /> : null}
          </>;
        })()}
      </> : null}
      {state.status === "empty" ? <ReaderNotice text={appCopy.reader.emptyDocument} /> : null}
      {state.status === "missing" ? <ReaderRecovery text={appCopy.reader.missingDocument} /> : null}
      {state.status === "stale" ? <ReaderRecovery text={appCopy.reader.staleDocument} /> : null}
      {state.status === "corrupt" ? <ReaderRecovery text={appCopy.reader.corruptDocument} /> : null}
    </article>
  </main>;
}

export function ReaderToolbar({ title }: { readonly title?: string }) {
  return <nav aria-label={appCopy.a11y.readerToolbar} className="reader-toolbar"><Link to="/">{appCopy.navigation.backToLibrary}</Link><span className="reader-toolbar__title">{title ?? appCopy.reader.toolbarTitle}</span></nav>;
}

function ReaderNotice({ text }: { readonly text: string }) { return <p className="reader__notice" role="status">{text}</p>; }
function ReaderRecovery({ text }: { readonly text: string }) { return <section aria-labelledby="reader-title" className="reader__recovery"><h1 data-route-heading="true" id="reader-title" tabIndex={-1}>{appCopy.reader.title}</h1><p>{text}</p><Link className="screen__link" to="/">{appCopy.navigation.backToLibrary}</Link></section>; }
function currentTimestamp(): number { return Date.now(); }

function activeHeadingId(state: Extract<ReaderLoadResult, { readonly status: "ready" }>, observed: ObservedLocation | undefined): string | undefined {
  if (observed === undefined) return state.hashResolution.kind === "valid" ? state.hashResolution.heading.id : undefined;
  return [...state.document.outline].reverse().find((item) => item.chunkOrdinal <= observed.chunkOrdinal)?.id;
}

function SectionContext({ index, section, total }: { readonly index: number; readonly section: { readonly title?: string }; readonly total: number }) { return <p className="section-context" role="status">{readerCopy.sectionContext.replace("{current}", String(index + 1)).replace("{total}", String(total)).replace("{title}", section.title ?? readerCopy.untitledSection)}</p>; }
function SectionPager({ index, onChange, sections }: { readonly index: number; readonly onChange: (index: number) => void; readonly sections: readonly { readonly title?: string }[] }) { const previous = sections[index - 1]; const next = sections[index + 1]; return <nav aria-label={readerCopy.sectionNavigation} className="section-pager"><button disabled={previous === undefined} onClick={() => { onChange(index - 1); }} type="button">{readerCopy.previousSection}{previous?.title === undefined ? "" : `: ${previous.title}`}</button><button disabled={next === undefined} onClick={() => { onChange(index + 1); }} type="button">{readerCopy.nextSection}{next?.title === undefined ? "" : `: ${next.title}`}</button></nav>; }
