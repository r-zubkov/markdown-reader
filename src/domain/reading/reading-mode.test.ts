import { describe, expect, it } from "vitest";

import { runMarkdownPipelineFromText } from "@/domain/content/markdown-pipeline";
import { createPipelineCorpus } from "@/test/corpus/pipeline-corpus";
import { AUTO_SECTIONS_COST_THRESHOLD, selectInitialReadingMode } from "./reading-mode";

describe("initial reading-mode policy", () => {
  it("uses the inclusive safe section-cost budget and handles invalid analysis safely", () => {
    expect(selectInitialReadingMode(AUTO_SECTIONS_COST_THRESHOLD - 1)).toBe("continuous");
    expect(selectInitialReadingMode(AUTO_SECTIONS_COST_THRESHOLD)).toBe("continuous");
    expect(selectInitialReadingMode(AUTO_SECTIONS_COST_THRESHOLD + 1)).toBe("sections");
    expect(selectInitialReadingMode(Number.NaN)).toBe("sections");
  });

  it("classifies the deterministic production corpus from rendered chunk cost, not bytes", async () => {
    const measurements = await Promise.all(createPipelineCorpus().map(async (fixture) => {
      const result = await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName);
      if (!result.ok) return { id: fixture.id, mode: "rejected" as const, totalCost: 0 };
      const totalCost = result.value.chunks.reduce((sum, chunk) => sum + chunk.estimatedCost, 0);
      return { id: fixture.id, mode: selectInitialReadingMode(totalCost), totalCost };
    }));

    expect(measurements).toEqual([
      { id: "small", mode: "continuous", totalCost: 966 },
      { id: "medium", mode: "sections", totalCost: 36_512 },
      { id: "large", mode: "sections", totalCost: 177_090 },
      { id: "no-headings", mode: "continuous", totalCost: 272 },
      { id: "repeated-unicode-headings", mode: "continuous", totalCost: 398 },
      { id: "long-code", mode: "continuous", totalCost: 18_479 },
      { id: "single-long-line", mode: "sections", totalCost: 32_367 },
      { id: "wide-table", mode: "continuous", totalCost: 7_393 },
      { id: "huge-single-node", mode: "sections", totalCost: 34_439 },
      { id: "malicious", mode: "continuous", totalCost: 1_129 },
    ]);
  });
});
