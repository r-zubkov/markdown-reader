import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImportSuccess } from "./ImportOverlay";

describe("replacement result", () => {
  it.each([
    ["exact", "Место чтения перенесено точно"],
    ["approximate", "Место чтения перенесено приблизительно"],
    ["none", "прежнее место чтения не найдено"],
  ] as const)("renders the %s mapping outcome", (confidence, copy) => {
    render(<ImportSuccess state={{
      documentId: "document-1",
      replacement: {
        cleanup: "complete",
        confidence,
        reason: confidence === "exact" ? "CROSS_VERSION_CONTENT_FINGERPRINT" : confidence === "approximate" ? "CROSS_VERSION_PATH_ORDINAL" : "NO_RELIABLE_MATCH",
        replacedVersionId: "old-version",
        structuralSimilarity: confidence === "none" ? 0 : 1,
      },
      status: "succeeded",
    }} />);

    expect(screen.getByRole("status")).toHaveTextContent(copy);
  });

  it("explains pending cleanup without changing replacement success", () => {
    render(<ImportSuccess state={{
      documentId: "document-1",
      replacement: {
        cleanup: "pending",
        confidence: "exact",
        reason: "CROSS_VERSION_CONTENT_FINGERPRINT",
        replacedVersionId: "old-version",
        structuralSimilarity: 1,
      },
      status: "succeeded",
    }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Новая версия уже активна");
  });

  it("keeps ordinary import success distinct", () => {
    render(<ImportSuccess state={{ documentId: "document-1", status: "succeeded" }} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Документ готов");
  });
});
