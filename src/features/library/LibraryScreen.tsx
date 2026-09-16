import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { EllipsisIcon } from "lucide-react";

import type { DocumentRepository, DocumentSummary, RepositoryErrorCode } from "@/application/ports/document-repository";
import { ImportOverlay } from "@/features/import/ImportOverlay";
import type { ImportWorkerFactory } from "@/features/import/import-coordinator";
import { appCopy } from "@/shared/i18n/ru";
import { Button } from "@/ui/primitives/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuList } from "@/ui/primitives/dropdown-menu";
import { DeleteDocumentFlow } from "./DeleteDocumentFlow";
import { libraryCopy } from "./copy";

interface LibraryScreenProps { readonly repository: DocumentRepository; readonly workerFactory?: ImportWorkerFactory; }
type LibraryState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly documents: readonly DocumentSummary[] }
  | { readonly status: "failed"; readonly error: RepositoryErrorCode };
type FocusTarget = { readonly kind: "item"; readonly documentId: string } | { readonly kind: "empty" };

export function LibraryScreen({ repository, workerFactory = createImportWorker }: LibraryScreenProps) {
  const [library, setLibrary] = useState<LibraryState>({ status: "loading" });
  const [importOpen, setImportOpen] = useState(false);
  const [replaceDocument, setReplaceDocument] = useState<DocumentSummary | undefined>(undefined);
  const [deleteDocument, setDeleteDocument] = useState<DocumentSummary | undefined>(undefined);
  const [menuFocusTarget, setMenuFocusTarget] = useState<{ readonly documentId: string } | undefined>(undefined);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | undefined>(undefined);
  const handledMenuFocusTarget = useRef<{ readonly documentId: string } | undefined>(undefined);
  const handledFocusTarget = useRef<FocusTarget | undefined>(undefined);

  useEffect(() => repository.observeDocuments((result) => {
    setLibrary(result.ok ? { status: "ready", documents: result.value } : { status: "failed", error: result.error.code });
  }), [repository]);

  useEffect(() => {
    if (menuFocusTarget === undefined || handledMenuFocusTarget.current === menuFocusTarget) return;
    const trigger = Array.from(document.querySelectorAll<HTMLElement>("[data-delete-menu-trigger]")).find((element) => element.dataset.deleteMenuTrigger === menuFocusTarget.documentId);
    if (trigger !== undefined) { trigger.focus(); handledMenuFocusTarget.current = menuFocusTarget; }
  }, [library, menuFocusTarget]);

  useEffect(() => {
    if (focusTarget === undefined || handledFocusTarget.current === focusTarget) return;
    const target = focusTarget.kind === "empty"
      ? document.querySelector<HTMLElement>("[data-library-empty-cta]")
      : Array.from(document.querySelectorAll<HTMLElement>("[data-document-focus-id]")).find((element) => element.dataset.documentFocusId === focusTarget.documentId);
    if (target !== null && target !== undefined) { target.focus(); handledFocusTarget.current = focusTarget; }
  }, [focusTarget, library]);

  async function retryLibrary(): Promise<void> {
    setLibrary({ status: "loading" });
    const result = await repository.listDocuments();
    setLibrary(result.ok ? { status: "ready", documents: result.value } : { status: "failed", error: result.error.code });
  }

  function cancelDelete(): void {
    if (deleteDocument !== undefined) setMenuFocusTarget({ documentId: deleteDocument.documentId });
    setDeleteDocument(undefined);
  }
  function finishDelete(documentId: string): void {
    const documents = library.status === "ready" ? library.documents : [];
    const index = documents.findIndex((item) => item.documentId === documentId);
    const next = index >= 0 ? documents[index + 1] ?? documents[index - 1] : documents[0];
    setFocusTarget(next === undefined ? { kind: "empty" } : { documentId: next.documentId, kind: "item" });
    setDeleteDocument(undefined);
    void retryLibrary();
  }
  function openImport(): void {
    setReplaceDocument(undefined);
    setImportOpen(true);
  }
  function openReplacement(document: DocumentSummary): void {
    setReplaceDocument(document);
    setImportOpen(true);
  }
  function changeImportOpen(open: boolean): void {
    if (!open && replaceDocument !== undefined) setMenuFocusTarget({ documentId: replaceDocument.documentId });
    setImportOpen(open);
    if (!open) setReplaceDocument(undefined);
  }

  const importDisabled = library.status === "failed" && (library.error === "DB_UNAVAILABLE" || library.error === "MIGRATION_FAILED");
  return <main className="screen screen--library" id="main-content" tabIndex={-1}>
    <section aria-labelledby="library-title" className="screen__content">
      <header className="library-header">
        <div><p className="screen__eyebrow">{appCopy.library.eyebrow}</p><h1 data-route-heading="true" id="library-title" tabIndex={-1}>{appCopy.library.title}</h1></div>
        <Button data-testid="library-import-trigger" isDisabled={importDisabled} onPress={openImport}>{appCopy.library.import}</Button>
      </header>
      <p className="screen__description">{appCopy.library.localOnly}</p>
      {importDisabled ? <p className="library-state library-state--error" role="alert">{appCopy.library.storageUnavailable}</p> : null}
      <LibraryList library={library} onImport={openImport} onRequestDelete={setDeleteDocument} onRequestReplace={openReplacement} onRetry={() => { void retryLibrary(); }} />
    </section>
    {importOpen && !importDisabled ? <ImportOverlay isOpen onOpenChange={changeImportOpen} repository={repository} {...(replaceDocument === undefined ? {} : { replacementTarget: replaceDocument })} workerFactory={workerFactory} /> : null}
    {deleteDocument !== undefined ? <DeleteDocumentFlow document={deleteDocument} key={deleteDocument.documentId} onCancelled={cancelDelete} onSucceeded={finishDelete} repository={repository} /> : null}
  </main>;
}

function LibraryList({ library, onImport, onRequestDelete, onRequestReplace, onRetry }: { readonly library: LibraryState; readonly onImport: () => void; readonly onRequestDelete: (document: DocumentSummary) => void; readonly onRequestReplace: (document: DocumentSummary) => void; readonly onRetry: () => void }) {
  if (library.status === "loading") return <ul aria-busy="true" aria-label={appCopy.library.loading} className="library-list library-list--skeleton">{[0, 1, 2].map((item) => <li aria-hidden="true" className="library-skeleton" key={item} />)}</ul>;
  if (library.status === "failed") return <section aria-label={appCopy.library.placeholderLabel} className="library-state library-state--error"><p role="alert">{appCopy.library.unavailable}</p><Button onPress={onRetry} variant="outline">{appCopy.library.retry}</Button></section>;
  if (library.documents.length === 0) return <section aria-label={appCopy.library.placeholderLabel} className="screen__placeholder"><h2>{appCopy.library.emptyTitle}</h2><p>{appCopy.library.emptyDescription}</p><Button data-library-empty-cta onPress={onImport}>{appCopy.library.import}</Button></section>;
  return <ul aria-label={appCopy.library.title} className="library-list">{library.documents.map((item) => <DocumentItem document={item} key={item.documentId} onRequestDelete={onRequestDelete} onRequestReplace={onRequestReplace} />)}</ul>;
}

function DocumentItem({ document, onRequestDelete, onRequestReplace }: { readonly document: DocumentSummary; readonly onRequestDelete: (document: DocumentSummary) => void; readonly onRequestReplace: (document: DocumentSummary) => void }) {
  const itemLabel = `${appCopy.library.open}: ${document.title}${document.fileName === document.title ? "" : ` — ${document.fileName}`}`;
  const progress = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0, style: "percent" }).format(document.progressRatio);
  return <li className="library-item">
    <Link aria-label={itemLabel} className="library-list__link" data-document-focus-id={document.documentId} to={`/documents/${document.documentId}`}><span className="library-item__title">{document.title}</span>{document.fileName === document.title ? null : <small>{document.fileName}</small>}<span className="library-item__metadata">{appCopy.library.ready} · {document.chunkCount} {appCopy.library.fragments}</span><span className="library-item__progress">{appCopy.library.progress}: {progress}<progress aria-label={`${appCopy.library.progress}: ${document.title}`} max={1} value={document.progressRatio} /></span></Link>
    <div className="library-item__actions"><Link aria-label={`${libraryCopy.continue}: ${document.title}`} className="library-item__continue" to={`/documents/${document.documentId}`}>{libraryCopy.continue}</Link><DropdownMenu><Button aria-label={`${libraryCopy.actions}: ${document.title}`} data-delete-menu-trigger={document.documentId} variant="outline"><EllipsisIcon aria-hidden size={18} /></Button><DropdownMenuContent><DropdownMenuList aria-label={`${libraryCopy.actions}: ${document.title}`}><DropdownMenuItem id="replace" onAction={() => { onRequestReplace(document); }}>{libraryCopy.replaceDocument}</DropdownMenuItem><DropdownMenuItem id="delete" onAction={() => { onRequestDelete(document); }}>{libraryCopy.deleteDocument.action}</DropdownMenuItem></DropdownMenuList></DropdownMenuContent></DropdownMenu></div>
  </li>;
}

function createImportWorker() { return new Worker(new URL("../../workers/import-worker.ts", import.meta.url), { type: "module" }); }
