import { describe, expect, it } from "vitest";

import { importControllerReducer, type ImportControllerVisibleState } from "./import-controller";

describe("importControllerReducer", () => {
  it("accepts the normal import path and rejects late worker updates", () => {
    const validating = importControllerReducer({ status: "idle" }, { type: "file-selected", file: { name: "guide.md", size: 12 } });
    const running = importControllerReducer(validating, { type: "worker-progress", stage: "processing", ratio: 0.5 });
    const finalizing = importControllerReducer(running, { type: "finalizing" });
    const succeeded = importControllerReducer(finalizing, { type: "succeeded", documentId: "document-1" });

    expect(succeeded).toEqual({ status: "succeeded", documentId: "document-1" });
    expect(importControllerReducer(succeeded, { type: "worker-progress", stage: "staging" })).toBe(succeeded);
  });

  it("keeps a running flow open until cancellation completes", () => {
    const running: ImportControllerVisibleState = { status: "running", stage: "processing", canCancel: true };
    expect(importControllerReducer(running, { type: "closed" })).toBe(running);
    const cancelling = importControllerReducer(running, { type: "cancel-requested" });
    expect(cancelling).toEqual({ status: "cancelling" });
    expect(importControllerReducer(cancelling, { type: "cancelled" })).toEqual({ status: "cancelled" });
  });

  it("keeps picker validation local and does not start a multi-file import", () => {
    expect(importControllerReducer({ status: "idle" }, { type: "invalid-file", error: "MULTIPLE_FILES" })).toEqual({
      status: "failed", error: "MULTIPLE_FILES", retry: "select-file",
    });
  });
});
