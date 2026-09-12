import { describe, expect, it } from "vitest";

import { resolveReaderHash } from "./outline-resolver";

const outline = [
  { id: "mdr-h-обзор-1", level: 1 as const, text: "Обзор", pathKey: "Обзор", sourceStart: 0, chunkOrdinal: 0, childIds: [] },
  { id: "mdr-h-repeat-2", level: 2 as const, text: "Repeat", pathKey: "Обзор/Repeat", sourceStart: 10, chunkOrdinal: 3, childIds: [] },
];

describe("reader hash resolution", () => {
  it("decodes a Unicode heading ID and resolves only the persisted outline", () => {
    expect(resolveReaderHash("#mdr-h-%D0%BE%D0%B1%D0%B7%D0%BE%D1%80-1", outline)).toEqual({ kind: "valid", heading: outline[0] });
    expect(resolveReaderHash("#not-a-heading", outline)).toEqual({ kind: "invalid" });
  });

  it("does not throw on malformed URL encoding", () => {
    expect(resolveReaderHash("#%E0%A4", outline)).toEqual({ kind: "invalid" });
  });
});
