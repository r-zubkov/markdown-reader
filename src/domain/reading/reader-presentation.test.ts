import { describe, expect, it } from "vitest";

import type { SectionLayout, SplitStrategy } from "@/domain/content/pipeline-types";
import { resolveReaderPresentation, findSectionIndex } from "./reader-presentation";

describe("reader presentation", () => {
  it("uses the measured automatic mode until a user selection exists", () => {
    const layouts = createLayouts(24_001);
    expect(resolveReaderPresentation(layouts, undefined)).toEqual({ mode: "sections", modeOrigin: "auto", splitStrategy: "auto" });
    expect(resolveReaderPresentation(layouts, { documentId: "doc", modeOrigin: "user", progressRatio: 0, readingMode: "continuous", splitStrategy: "h2", updatedAt: 1 })).toEqual({ mode: "continuous", modeOrigin: "user", splitStrategy: "h2" });
  });

  it("resolves a section by its persisted chunk range without recomputing layouts", () => {
    const sections = [{ endChunkOrdinalInclusive: 1, estimatedCost: 10, id: "one", startChunkOrdinal: 0 }, { endChunkOrdinalInclusive: 3, estimatedCost: 10, id: "two", startChunkOrdinal: 2 }];
    expect(findSectionIndex(sections, 0)).toBe(0);
    expect(findSectionIndex(sections, 3)).toBe(1);
    expect(findSectionIndex(sections, 99)).toBe(0);
  });
});

function createLayouts(estimatedCost: number): Record<SplitStrategy, SectionLayout> {
  return {
    auto: createLayout("auto", estimatedCost),
    h1: createLayout("h1", estimatedCost),
    h2: createLayout("h2", estimatedCost),
    h3: createLayout("h3", estimatedCost),
    whole: createLayout("whole", estimatedCost),
  };
}
function createLayout(strategy: SplitStrategy, estimatedCost: number): SectionLayout { return { safeForSelection: true, sectionIds: [strategy], sections: [{ endChunkOrdinalInclusive: 0, estimatedCost, id: strategy, startChunkOrdinal: 0 }], strategy }; }
