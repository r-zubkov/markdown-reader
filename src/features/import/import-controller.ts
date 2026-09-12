import type { ImportErrorCode, ImportUiState, RetryKind } from "./import-coordinator";
import type { ImportStage } from "@/workers/import-protocol";

export interface ImportDecisionContext {
  readonly kind: "exact-duplicate" | "possible-update";
}

export type ImportControllerState = ImportUiState | { readonly status: "decision"; readonly context: ImportDecisionContext };
export type ImportControllerError = ImportErrorCode | "MULTIPLE_FILES";
export type ImportControllerVisibleState =
  | Exclude<ImportControllerState, { readonly status: "failed" }>
  | { readonly status: "failed"; readonly error: ImportControllerError; readonly retry: RetryKind };

export type ImportControllerEvent =
  | { readonly type: "opened" }
  | { readonly type: "closed" }
  | { readonly type: "file-selected"; readonly file: { readonly name: string; readonly size: number } }
  | { readonly type: "invalid-file"; readonly error: "MULTIPLE_FILES" | "UNSUPPORTED_EXTENSION" }
  | { readonly type: "worker-progress"; readonly stage: ImportStage; readonly ratio?: number }
  | { readonly type: "finalizing" }
  | { readonly type: "cancel-requested" }
  | { readonly type: "cancelled" }
  | { readonly type: "succeeded"; readonly documentId: string }
  | { readonly type: "failed"; readonly error: ImportErrorCode; readonly retry: RetryKind }
  | { readonly type: "decision"; readonly context: ImportDecisionContext }
  | { readonly type: "retry" };

/** The overlay ignores impossible and late transitions rather than guessing. */
export function importControllerReducer(
  state: ImportControllerVisibleState,
  event: ImportControllerEvent,
): ImportControllerVisibleState {
  switch (event.type) {
    case "opened": return state.status === "idle" ? state : { status: "idle" };
    case "closed": return canClose(state) ? { status: "idle" } : state;
    case "file-selected": return canStart(state) ? { status: "validating", file: event.file } : state;
    case "invalid-file": return canStart(state) ? { status: "failed", error: event.error, retry: "select-file" } : state;
    case "worker-progress":
      return state.status === "validating" || state.status === "running"
        ? event.ratio === undefined
          ? { status: "running", stage: event.stage, canCancel: true }
          : { status: "running", stage: event.stage, ratio: event.ratio, canCancel: true }
        : state;
    case "finalizing": return state.status === "validating" || state.status === "running" ? { status: "finalizing" } : state;
    case "cancel-requested": return state.status === "validating" || state.status === "running" ? { status: "cancelling" } : state;
    case "cancelled": return state.status === "cancelling" ? { status: "cancelled" } : state;
    case "succeeded": return state.status === "finalizing" ? { status: "succeeded", documentId: event.documentId } : state;
    case "failed":
      return state.status === "validating" || state.status === "running" || state.status === "finalizing" || state.status === "cancelling"
        ? { status: "failed", error: event.error, retry: event.retry }
        : state;
    case "decision": return state.status === "finalizing" ? { status: "decision", context: event.context } : state;
    case "retry": return state.status === "failed" || state.status === "cancelled" ? { status: "idle" } : state;
  }
}

function canClose(state: ImportControllerVisibleState): boolean {
  return state.status === "idle" || state.status === "failed" || state.status === "cancelled" || state.status === "succeeded" || state.status === "decision";
}

function canStart(state: ImportControllerVisibleState): boolean {
  return state.status === "idle" || state.status === "failed" || state.status === "cancelled";
}
