import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { DocumentRepository, DocumentSummary, RepositoryErrorCode } from "@/application/ports/document-repository";
import { ImportOverlay } from "@/features/import/ImportOverlay";
import type { ImportWorkerFactory } from "@/features/import/import-coordinator";
import { appCopy } from "@/shared/i18n/ru";
import { Button } from "@/ui/primitives/button";

interface LibraryScreenProps { readonly repository: DocumentRepository; readonly workerFactory?: ImportWorkerFactory; }
type LibraryState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly documents: readonly DocumentSummary[] }
  | { readonly status: "failed"; readonly error: RepositoryErrorCode };

export function LibraryScreen({ repository, workerFactory = createImportWorker }: LibraryScreenProps) {
  const [library, setLibrary] = useState<LibraryState>({ status: "loading" });
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => repository.observeDocuments((result) => {
    setLibrary(result.ok ? { status: "ready", documents: result.value } : { status: "failed", error: result.error.code });
  }), [repository]);

  async function retryLibrary(): Promise<void> {
    setLibrary({ status: "loading" });
    const result = await repository.listDocuments();
    setLibrary(result.ok ? { status: "ready", documents: result.value } : { status: "failed", error: result.error.code });
  }

  const importDisabled = library.status === "failed" && (library.error === "DB_UNAVAILABLE" || library.error === "MIGRATION_FAILED");
  return <main className="screen screen--library" id="main-content" tabIndex={-1}>
    <section aria-labelledby="library-title" className="screen__content">
      <header className="library-header">
        <div><p className="screen__eyebrow">{appCopy.library.eyebrow}</p><h1 data-route-heading="true" id="library-title" tabIndex={-1}>{appCopy.library.title}</h1></div>
        <Button data-testid="library-import-trigger" isDisabled={importDisabled} onPress={() => { setImportOpen(true); }}>{appCopy.library.import}</Button>
      </header>
      <p className="screen__description">{appCopy.library.localOnly}</p>
      {importDisabled ? <p className="library-state library-state--error" role="alert">{appCopy.library.storageUnavailable}</p> : null}
      <LibraryList library={library} onImport={() => { setImportOpen(true); }} onRetry={() => { void retryLibrary(); }} />
    </section>
    {importOpen && !importDisabled ? <ImportOverlay isOpen onOpenChange={setImportOpen} repository={repository} workerFactory={workerFactory} /> : null}
  </main>;
}

function LibraryList({ library, onImport, onRetry }: { readonly library: LibraryState; readonly onImport: () => void; readonly onRetry: () => void }) {
  if (library.status === "loading") return <ul aria-busy="true" aria-label={appCopy.library.loading} className="library-list library-list--skeleton">{[0, 1, 2].map((item) => <li aria-hidden="true" className="library-skeleton" key={item} />)}</ul>;
  if (library.status === "failed") return <section aria-label={appCopy.library.placeholderLabel} className="library-state library-state--error"><p role="alert">{appCopy.library.unavailable}</p><Button onPress={() => { onRetry(); }} variant="outline">{appCopy.library.retry}</Button></section>;
  if (library.documents.length === 0) return <section aria-label={appCopy.library.placeholderLabel} className="screen__placeholder"><h2>{appCopy.library.emptyTitle}</h2><p>{appCopy.library.emptyDescription}</p><Button onPress={onImport}>{appCopy.library.import}</Button></section>;
  return <ul aria-label={appCopy.library.title} className="library-list">{library.documents.map((document) => <DocumentItem document={document} key={document.documentId} />)}</ul>;
}

function DocumentItem({ document }: { readonly document: DocumentSummary }) {
  const itemLabel = `${appCopy.library.open}: ${document.title}${document.fileName === document.title ? "" : ` — ${document.fileName}`}`;
  return <li className="library-item"><Link aria-label={itemLabel} className="library-list__link" to={`/documents/${document.documentId}`}><span className="library-item__title">{document.title}</span>{document.fileName === document.title ? null : <small>{document.fileName}</small>}<span className="library-item__metadata">{appCopy.library.ready} · {document.chunkCount} {appCopy.library.fragments}</span><span className="library-item__progress">{appCopy.library.progress}</span></Link></li>;
}

function createImportWorker() { return new Worker(new URL("../../workers/import-worker.ts", import.meta.url), { type: "module" }); }
