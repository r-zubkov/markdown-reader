import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { DocumentRepository, RepositoryErrorCode } from "@/application/ports/document-repository";
import { loadReader, type ReaderLoadResult } from "@/features/reader/reader-loader";
import { replaceReaderHash } from "@/features/reader/outline-resolver";
import { ReaderViewport, type ObservedLocation } from "@/features/reader/ReaderViewport";
import { TableOfContents } from "@/features/reader/TableOfContents";
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

  useEffect(() => {
    let active = true;
    void loadReader(repository, documentId, requestedHash).then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [documentId, repository, requestedHash]);

  function selectHeading(id: string, shouldFocus: boolean): void {
    setShouldFocusTarget(shouldFocus);
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
        <p className="screen__eyebrow">{appCopy.reader.eyebrow}</p>
        <h1 data-route-heading="true" id="reader-title" tabIndex={-1}>{state.document.title}</h1>
        <TableOfContents activeId={activeHeadingId(state, observedLocation)} outline={state.document.outline} onSelect={selectHeading} />
        {state.hashResolution.kind === "invalid" ? <ReaderNotice text={appCopy.reader.invalidHeading} /> : null}
        <p className="reader__window-status">{appCopy.reader.continuousWindow}</p>
        {state.requestHash === requestedHash ? null : <ReaderNotice text={appCopy.reader.restoring} />}
        <button className="reader-chunk__save" data-testid={`reader-save-block-${String(observedLocation?.chunkOrdinal ?? state.targetOrdinal)}`} disabled={observedLocation?.anchor === undefined || saveState === "saving"} onClick={() => { void saveAnchor(); }} type="button">{appCopy.reader.savePosition}</button>
        <ReaderViewport
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
        />
        {saveState === "failed" ? <ReaderNotice text={appCopy.reader.saveFailed} /> : null}
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
