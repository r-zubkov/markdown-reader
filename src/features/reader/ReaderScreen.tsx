import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { DocumentRepository, ReaderChunk } from "@/application/ports/document-repository";
import { loadReader, type ReaderLoadResult } from "@/features/reader/reader-loader";
import { appCopy } from "@/shared/i18n/ru";
import { SafeHtmlChunk } from "@/ui/primitives/SafeHtmlChunk";

interface ReaderScreenProps {
  readonly documentId: string;
  readonly repository: DocumentRepository;
}

type ReaderViewState = { readonly status: "restoring" } | ReaderLoadResult;

export function ReaderScreen({ documentId, repository }: ReaderScreenProps) {
  const [state, setState] = useState<ReaderViewState>({ status: "restoring" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "failed">("idle");

  useEffect(() => {
    let active = true;
    void loadReader(repository, documentId).then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [documentId, repository]);

  useEffect(() => {
    if (state.status !== "ready") return;
    document.getElementById(`reader-chunk-${String(state.targetOrdinal)}`)?.scrollIntoView({ block: "start" });
  }, [state]);

  async function saveAnchor(chunk: ReaderChunk): Promise<void> {
    const anchor = chunk.anchors[0];
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

  return <main className="screen screen--reader" id="main-content">
    <article aria-busy={state.status === "restoring"} aria-labelledby="reader-title" className="screen__content reader" id="document-content" tabIndex={-1}>
      {state.status === "restoring" ? <ReaderNotice text={appCopy.reader.restoring} /> : null}
      {state.status === "ready" ? <>
        <p className="screen__eyebrow">{appCopy.reader.eyebrow}</p>
        <h1 data-route-heading="true" id="reader-title" tabIndex={-1}>{state.document.title}</h1>
        <p className="reader__window-status">{appCopy.reader.boundedWindow}</p>
        {state.chunks.map((chunk) => <section className="reader-chunk" id={`reader-chunk-${String(chunk.ordinal)}`} key={`${state.document.versionId}:${String(chunk.ordinal)}`}>
          <SafeHtmlChunk html={chunk.html} ordinal={chunk.ordinal} />
          <button className="reader-chunk__save" data-testid={`reader-save-block-${String(chunk.ordinal)}`} onClick={() => { void saveAnchor(chunk); }} type="button">{appCopy.reader.savePosition}</button>
        </section>)}
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
