import { describe, expect, it } from "vitest";

import { decideImportIdentity, normalizeIdentityFileName, normalizeIdentityText } from "./import-identity";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

describe("import identity policy", () => {
  it("normalizes Unicode, whitespace, case, and a Markdown filename extension", () => {
    expect(normalizeIdentityText("  Café\u00a0Guide  ")).toBe("café guide");
    expect(normalizeIdentityFileName(" GUIDE.MD ")).toBe("guide");
  });

  it("keeps every exact ready match and never turns it into an update candidate", () => {
    const result = decideImportIdentity({ contentHash: hashA, fileName: "renamed.md", title: "Another title" }, [
      document("one", hashA, "one", "one"),
      document("two", hashA, "two", "two"),
      document("three", hashB, "another title", "other"),
    ]);
    expect(result.exactDuplicates.map((entry) => entry.documentId)).toEqual(["one", "two"]);
    expect(result.possibleUpdates.map((entry) => entry.documentId)).toEqual(["three"]);
  });

  it("returns all normalized filename/title candidates without selecting one", () => {
    const result = decideImportIdentity({ contentHash: hashA, fileName: "  GUIDE.MD", title: "A new title" }, [
      document("one", hashB, "old", "guide"),
      document("two", hashB, "a new title", "other"),
    ]);
    expect(result.exactDuplicates).toEqual([]);
    expect(result.possibleUpdates.map((entry) => entry.documentId)).toEqual(["one", "two"]);
  });
});

function document(documentId: string, contentHash: string, normalizedTitle: string, normalizedFileName: string) {
  return { contentHash, currentVersionId: `${documentId}-version`, documentId, fileName: `${normalizedFileName}.md`, normalizedFileName, normalizedTitle, title: normalizedTitle };
}
