import { useEffect, useRef, useState } from "react";

import type { DocumentRepository, DocumentSummary, RepositoryErrorCode } from "@/application/ports/document-repository";
import { libraryCopy } from "./copy";
import { Button } from "@/ui/primitives/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitives/dialog";

type DeleteState =
  | { readonly status: "confirm" }
  | { readonly status: "deleting" }
  | { readonly status: "failed"; readonly error: RepositoryErrorCode }
  | { readonly status: "succeeded" };

interface DeleteDocumentFlowProps {
  readonly document: DocumentSummary;
  readonly repository: DocumentRepository;
  readonly onCancelled: () => void;
  readonly onSucceeded: (documentId: string) => void;
}

export function DeleteDocumentFlow({ document, repository, onCancelled, onSucceeded }: DeleteDocumentFlowProps) {
  const [state, setState] = useState<DeleteState>({ status: "confirm" });
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state.status === "succeeded") onSucceeded(document.documentId);
  }, [document.documentId, onSucceeded, state.status]);

  useEffect(() => {
    if (state.status === "confirm") cancelRef.current?.focus();
  }, [state.status]);

  async function remove(): Promise<void> {
    setState({ status: "deleting" });
    const result = await repository.deleteDocument(document.documentId);
    if (result.ok) { setState({ status: "succeeded" }); return; }
    setState({ status: "failed", error: result.error.code });
  }

  const deleting = state.status === "deleting";
  return <Dialog aria-label={libraryCopy.deleteDocument.title(document.title)} className="delete-document-dialog" isDismissable={!deleting} isKeyboardDismissDisabled={deleting} isOpen onOpenChange={(isOpen) => { if (!isOpen && !deleting) onCancelled(); }} role="alertdialog" showCloseButton={false}>
    <DialogHeader><DialogTitle>{libraryCopy.deleteDocument.title(document.title)}</DialogTitle><DialogDescription>{libraryCopy.deleteDocument.description}</DialogDescription></DialogHeader>
    {deleting ? <p aria-live="polite" className="delete-document-dialog__status" role="status">{libraryCopy.deleteDocument.deleting}</p> : null}
    {state.status === "failed" ? <p className="delete-document-dialog__error" role="alert">{libraryCopy.deleteDocument.error}</p> : null}
    <DialogFooter className="delete-document-dialog__footer">
      <Button isDisabled={deleting} onPress={onCancelled} ref={cancelRef} variant="outline">{libraryCopy.deleteDocument.cancel}</Button>
      <Button isDisabled={deleting} onPress={() => { void remove(); }} variant="destructive">{state.status === "failed" ? libraryCopy.deleteDocument.retry : libraryCopy.deleteDocument.action}</Button>
    </DialogFooter>
  </Dialog>;
}
