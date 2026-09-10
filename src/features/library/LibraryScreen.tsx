import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { DocumentRepository, DocumentSummary } from "@/application/ports/document-repository";
import { importCopy } from "@/features/import/copy";
import { ImportCoordinator, type ImportHandle, type ImportUiState, type ImportWorkerFactory } from "@/features/import/import-coordinator";
import { appCopy } from "@/shared/i18n/ru";
import { Button } from "@/ui/primitives/button";
import { FileDropField } from "@/ui/primitives/file-drop-field";

interface LibraryScreenProps { readonly repository: DocumentRepository; readonly workerFactory?: ImportWorkerFactory; }
type LibraryState = { readonly status: "loading" } | { readonly status: "ready"; readonly documents: readonly DocumentSummary[] } | { readonly status: "failed" };

export function LibraryScreen({ repository, workerFactory = createImportWorker }: LibraryScreenProps) {
  const [library, setLibrary] = useState<LibraryState>({ status: "loading" });
  const [importState, setImportState] = useState<ImportUiState>({ status: "idle" });
  const coordinatorRef = useRef<ImportCoordinator | undefined>(undefined);
  const handleRef = useRef<ImportHandle | undefined>(undefined);
  coordinatorRef.current ??= new ImportCoordinator(repository, workerFactory, setImportState);
  useEffect(() => {
    const unsubscribe = repository.observeDocuments((result) => { setLibrary(result.ok ? { status: "ready", documents: result.value } : { status: "failed" }); });
    return () => { unsubscribe(); coordinatorRef.current?.dispose(); };
  }, [repository]);
  function start(file: File): void { handleRef.current = coordinatorRef.current?.start(file); }
  return <main className="screen screen--library" id="main-content" tabIndex={-1}><section aria-labelledby="library-title" className="screen__content"><p className="screen__eyebrow">{appCopy.library.eyebrow}</p><h1 data-route-heading="true" id="library-title" tabIndex={-1}>{appCopy.library.title}</h1><p className="screen__description">{appCopy.library.localOnly}</p><section aria-label={importCopy.label} className="library-import"><FileDropField accept=".md,text/markdown" buttonLabel={importCopy.chooseFile} description={importCopy.description} inputTestId="import-file-input" label={importCopy.label} onFileSelected={start} selectedFileName={importState.status === "validating" ? importState.file.name : undefined} selectedLabel={importCopy.selectedFile} /><ImportStatus onCancel={() => { void handleRef.current?.cancel(); }} state={importState} /></section><LibraryList library={library} /></section></main>;
}

function LibraryList({ library }: { readonly library: LibraryState }) {
  if (library.status === "loading") return <p className="library-state" role="status">Загружаем библиотеку…</p>;
  if (library.status === "failed") return <p className="library-state library-state--error" role="alert">Библиотека временно недоступна.</p>;
  if (library.documents.length === 0) return <section aria-label={appCopy.library.placeholderLabel} className="screen__placeholder"><h2>{appCopy.library.emptyTitle}</h2><p>{appCopy.library.emptyDescription}</p></section>;
  return <ul aria-label="Документы" className="library-list">{library.documents.map((document) => <li key={document.documentId}><Link className="library-list__link" to={`/documents/${document.documentId}`}><span>{document.title}</span><small>{document.fileName}</small></Link></li>)}</ul>;
}

function ImportStatus({ state, onCancel }: { readonly state: ImportUiState; readonly onCancel: () => void }) {
  if (state.status === "idle" || state.status === "validating") return null;
  if (state.status === "running") return <div className="import-status" role="status"><p>{importCopy.stages[state.stage]}</p>{state.canCancel ? <Button onPress={onCancel} variant="outline">{importCopy.cancel}</Button> : null}</div>;
  if (state.status === "finalizing") return <p className="import-status" role="status">{importCopy.stages.finalizing}</p>;
  if (state.status === "cancelling") return <p className="import-status" role="status">{importCopy.cancelling}</p>;
  if (state.status === "cancelled") return <p className="import-status" role="status">{importCopy.cancelled}</p>;
  if (state.status === "failed") return <p className="import-status import-status--error" role="alert">{importCopy.errors[state.error]}</p>;
  return <p className="import-status" role="status">{importCopy.succeeded} <Link to={`/documents/${state.documentId}`}>{importCopy.open}</Link></p>;
}

function createImportWorker() { return new Worker(new URL("../../workers/import-worker.ts", import.meta.url), { type: "module" }); }
