import { useEffect, useReducer, useRef, useState } from "react";
import { Link } from "react-router";

import { importControllerReducer, type ImportControllerEvent, type ImportControllerVisibleState } from "./import-controller";
import { importCopy } from "./copy";
import type { ImportErrorCode, ImportHandle, ImportUiState, ImportWorkerFactory } from "./import-coordinator";
import { ImportCoordinator } from "./import-coordinator";
import type { DocumentRepository } from "@/application/ports/document-repository";
import { Button } from "@/ui/primitives/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitives/dialog";
import { FileDropField } from "@/ui/primitives/file-drop-field";
import { RadioGroup, RadioGroupItem } from "@/ui/primitives/radio-group";

interface ImportOverlayProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly repository: DocumentRepository;
  readonly workerFactory: ImportWorkerFactory;
}

const initialState: ImportControllerVisibleState = { status: "idle" };

export function ImportOverlay({ isOpen, onOpenChange, repository, workerFactory }: ImportOverlayProps) {
  const [state, dispatch] = useReducer(importControllerReducer, initialState);
  const [dismissNotice, setDismissNotice] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(undefined);
  const [selectedFileName, setSelectedFileName] = useState<string | undefined>(undefined);
  const activeFileRef = useRef<File | undefined>(undefined);
  const coordinatorRef = useRef<ImportCoordinator | undefined>(undefined);
  const handleRef = useRef<ImportHandle | undefined>(undefined);

  coordinatorRef.current ??= new ImportCoordinator(repository, workerFactory, (next) => { dispatch(fromCoordinator(next)); });

  useEffect(() => () => { coordinatorRef.current?.dispose(); }, []);

  function requestClose(nextOpen: boolean): void {
    if (!nextOpen && isBusy(state)) {
      setDismissNotice(true);
      return;
    }
    if (!nextOpen && state.status === "decision" && state.context.kind === "possible-update") {
      void coordinatorRef.current?.cancelDecision();
    }
    onOpenChange(nextOpen);
  }

  function selectFiles(files: readonly File[]): void {
    if (files.length !== 1) {
      activeFileRef.current = undefined;
      setSelectedFileName(undefined);
      dispatch({ type: "invalid-file", error: "MULTIPLE_FILES" });
      return;
    }
    const [file] = files;
    if (file === undefined) return;
    if (!/\.md$/iu.test(file.name)) {
      activeFileRef.current = undefined;
      setSelectedFileName(undefined);
      dispatch({ type: "invalid-file", error: "UNSUPPORTED_EXTENSION" });
      return;
    }
    activeFileRef.current = file;
    setSelectedFileName(file.name);
    dispatch({ type: "file-selected", file: { name: file.name, size: file.size } });
    handleRef.current = coordinatorRef.current?.start(file);
  }

  function retry(): void {
    const file = activeFileRef.current;
    if (file === undefined) {
      dispatch({ type: "retry" });
      return;
    }
    dispatch({ type: "retry" });
    handleRef.current = coordinatorRef.current?.start(file);
  }

  function cancel(): void {
    dispatch({ type: "cancel-requested" });
    void handleRef.current?.cancel();
  }

  if (!isOpen) return null;
  const fileName = state.status === "validating" ? state.file.name : selectedFileName;
  const title = state.status === "decision" ? importCopy.decisions.title : state.status === "replace-handoff" ? importCopy.decisions.replaceHandoffTitle : state.status === "succeeded" ? importCopy.succeeded : importCopy.title;
  const isFinalizing = state.status === "finalizing";

  return (
    <Dialog
      aria-label={title}
      isDismissable={!isBusy(state)}
      isKeyboardDismissDisabled={isBusy(state)}
      isOpen={isOpen}
      onOpenChange={requestClose}
      showCloseButton={false}
      className="import-overlay"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{state.status === "succeeded" ? importCopy.succeeded : importCopy.description}</DialogDescription>
      </DialogHeader>
      <div className="import-overlay__body">
        {state.status === "idle" ? <FilePicker onFilesSelected={selectFiles} /> : null}
        {state.status === "validating" || state.status === "running" || state.status === "cancelling" || isFinalizing ? (
          <ImportProgress fileName={fileName} state={state} />
        ) : null}
        {state.status === "failed" ? <ImportFailure error={state.error} retry={state.retry} /> : null}
        {state.status === "cancelled" ? <p className="import-overlay__notice" role="status">{importCopy.cancelled} {importCopy.noPartial}</p> : null}
        {state.status === "succeeded" ? <p className="import-overlay__notice" role="status">{importCopy.succeeded}</p> : null}
        {state.status === "decision" ? <ImportDecision state={state} selectedCandidateId={selectedCandidateId} onSelectedCandidateChange={setSelectedCandidateId} onOpenExisting={() => { requestClose(false); }} /> : null}
        {state.status === "replace-handoff" ? <p className="import-overlay__notice" role="status">{importCopy.decisions.replaceHandoffDescription(state.candidate.title)}</p> : null}
        {dismissNotice ? <p className="import-overlay__notice" role="status">{importCopy.runningHint}</p> : null}
      </div>
      <DialogFooter className="import-overlay__footer">
        {state.status === "idle" || state.status === "failed" || state.status === "cancelled" || state.status === "replace-handoff" ? <Button onPress={() => { requestClose(false); }} variant="outline">{importCopy.close}</Button> : null}
        {state.status === "running" && state.canCancel ? <Button onPress={cancel} variant="outline">{importCopy.cancel}</Button> : null}
        {state.status === "failed" && state.retry !== "select-file" ? <Button onPress={retry}>{importCopy.retry}</Button> : null}
        {state.status === "failed" && state.retry === "select-file" ? <Button onPress={() => { dispatch({ type: "retry" }); }}>{importCopy.chooseFile}</Button> : null}
        {state.status === "cancelled" ? <Button onPress={() => { dispatch({ type: "retry" }); }}>{importCopy.chooseFile}</Button> : null}
        {state.status === "succeeded" ? <><Button onPress={() => { requestClose(false); }} variant="outline">{importCopy.done}</Button><Link className="import-overlay__open" to={`/documents/${state.documentId}`}>{importCopy.open}</Link></> : null}
        {state.status === "decision" && state.context.kind === "exact-duplicate" ? <Button onPress={() => { requestClose(false); }} variant="outline">{importCopy.close}</Button> : null}
        {state.status === "decision" && state.context.kind === "possible-update" ? <DecisionActions context={state.context} selectedCandidateId={selectedCandidateId} onCancel={() => { void coordinatorRef.current?.cancelDecision(); }} onReplace={(documentId) => { coordinatorRef.current?.handoffReplace(documentId); }} onSeparate={() => { void coordinatorRef.current?.continueSeparately(); }} /> : null}
      </DialogFooter>
    </Dialog>
  );
}

function ImportDecision({ state, selectedCandidateId, onSelectedCandidateChange, onOpenExisting }: {
  readonly state: Extract<ImportControllerVisibleState, { readonly status: "decision" }>;
  readonly selectedCandidateId: string | undefined;
  readonly onSelectedCandidateChange: (value: string) => void;
  readonly onOpenExisting: () => void;
}) {
  if (state.context.kind === "exact-duplicate") {
    return <section className="import-overlay__decision" aria-live="polite"><p>{importCopy.decisions.exactDescription}</p><ul>{state.context.duplicates.map((document) => <li key={document.documentId}><Link className="import-overlay__decision-link" onClick={onOpenExisting} to={`/documents/${document.documentId}`}>{importCopy.decisions.openExisting(document.title)}</Link><small>{document.fileName}</small></li>)}</ul></section>;
  }
  const { candidates } = state.context;
  const selected = selectedCandidateId ?? (candidates.length === 1 ? candidates[0]?.documentId : undefined);
  return <section className="import-overlay__decision" aria-live="polite"><p>{importCopy.decisions.updateDescription(state.context.title, state.context.file.name)}</p><p>{candidates.length === 1 ? importCopy.decisions.oneCandidate : importCopy.decisions.manyCandidates}</p><RadioGroup aria-label={importCopy.decisions.candidateLabel} onChange={onSelectedCandidateChange} value={selected ?? null}>{candidates.map((document) => <RadioGroupItem key={document.documentId} value={document.documentId}><span><strong>{document.title}</strong><small>{document.fileName}</small></span></RadioGroupItem>)}</RadioGroup></section>;
}

function DecisionActions({ context, selectedCandidateId, onCancel, onReplace, onSeparate }: {
  readonly context: Extract<ImportControllerVisibleState, { readonly status: "decision" }>["context"];
  readonly selectedCandidateId: string | undefined;
  readonly onCancel: () => void;
  readonly onReplace: (documentId: string) => void;
  readonly onSeparate: () => void;
}) {
  if (context.kind !== "possible-update") return null;
  const selected = selectedCandidateId ?? (context.candidates.length === 1 ? context.candidates[0]?.documentId : undefined);
  return <><Button onPress={onSeparate}>{importCopy.decisions.addSeparately}</Button>{selected === undefined ? null : <Button onPress={() => { onReplace(selected); }} variant="outline">{importCopy.decisions.replace}</Button>}<Button onPress={onCancel} variant="outline">{importCopy.cancel}</Button></>;
}

function FilePicker({ onFilesSelected }: { readonly onFilesSelected: (files: readonly File[]) => void }) {
  return <FileDropField accept=".md,text/markdown" autoFocusButton buttonLabel={importCopy.chooseFile} description={importCopy.description} inputTestId="import-file-input" label={importCopy.label} onFileSelected={(file) => { onFilesSelected([file]); }} onFilesSelected={onFilesSelected} selectedLabel={importCopy.selectedFile} />;
}

function ImportProgress({ fileName, state }: { readonly fileName: string | undefined; readonly state: Extract<ImportControllerVisibleState, { readonly status: "validating" | "running" | "cancelling" | "finalizing" }> }) {
  const running = state.status === "running";
  const label = state.status === "cancelling" ? importCopy.cancelling : state.status === "finalizing" ? importCopy.stages.finalizing : state.status === "validating" ? importCopy.stages.validating : importCopy.stages[state.stage];
  const percent = running && state.ratio !== undefined ? Math.round(state.ratio * 100) : undefined;
  return <section aria-live="polite" aria-atomic="true" className="import-overlay__progress" role="status"><p className="import-overlay__file">{fileName}</p><p>{label}</p>{percent === undefined ? <div aria-label={label} className="import-progress import-progress--indeterminate" /> : <><progress aria-label={label} max={100} value={percent}>{percent}%</progress><span>{percent}%</span></>}<p>{importCopy.runningHint}</p></section>;
}

function ImportFailure({ error, retry }: { readonly error: "MULTIPLE_FILES" | ImportErrorCode; readonly retry: string }) {
  return <section className="import-overlay__failure" role="alert"><p>{importCopy.errors[error]}</p><p>{retry === "free-space" ? "Освободите место в браузере и повторите попытку." : retry === "reload" ? "Перезагрузите страницу и выберите файл снова." : importCopy.noPartial}</p></section>;
}

function isBusy(state: ImportControllerVisibleState): boolean {
  return state.status === "validating" || state.status === "running" || state.status === "cancelling" || state.status === "finalizing";
}

function fromCoordinator(state: ImportUiState): ImportControllerEvent {
  switch (state.status) {
    case "idle": return { type: "opened" };
    case "validating": return { type: "file-selected", file: state.file };
    case "running": return state.ratio === undefined ? { type: "worker-progress", stage: state.stage } : { type: "worker-progress", stage: state.stage, ratio: state.ratio };
    case "cancelling": return { type: "cancel-requested" };
    case "finalizing": return { type: "finalizing" };
    case "cancelled": return { type: "cancelled" };
    case "succeeded": return { type: "succeeded", documentId: state.documentId };
    case "failed": return { type: "failed", error: state.error, retry: state.retry };
    case "decision": return { type: "decision", context: state.context };
    case "replace-handoff": return { type: "replace-handoff", candidate: state.candidate };
  }
}
