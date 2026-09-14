import { describe, expect, it, vi } from "vitest";

import type { ReaderBlockAnchorSnapshot } from "@/application/ports/document-repository";
import {
  FINAL_BLOCK_COMPLETION_RATIO,
  markMeaningfulBlocks,
  observeTopMeaningfulLocation,
} from "@/features/reader/reader-location-observer";

describe("reader semantic block observation", () => {
  it("selects the top visible meaningful block and derives intra/source progress", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-reader-ordinal="0"><div class="reader-content"><p>First</p><p>Second</p></div></div>';
    const content = root.querySelector<HTMLElement>(".reader-content");
    if (content === null) throw new Error("Expected content fixture.");
    const anchors = [block("first", 0, 0.2), block("second", 0.2, 0.6)];
    markMeaningfulBlocks(content, anchors);
    const elements = content.querySelectorAll<HTMLElement>("[data-reader-block-index]");
    vi.spyOn(requireElement(elements, 0), "getBoundingClientRect").mockReturnValue(rect(-100, 40));
    vi.spyOn(requireElement(elements, 1), "getBoundingClientRect").mockReturnValue(rect(20, 200));

    const observed = observeTopMeaningfulLocation({
      line: 70,
      resolveAnchor: (_ordinal, index) => ({ block: requireAnchor(anchors, index), isFinalBlock: false }),
      root,
    });

    expect(observed).toMatchObject({ anchor: { blockId: "second", intraBlockRatio: 0.25, overallSourceRatio: 0.3 }, chunkOrdinal: 0, progressRatio: 0.3 });
  });

  it("reports 100 percent only for the final meaningful block at its semantic threshold or page end", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-reader-ordinal="4"><div class="reader-content"><p>Final</p></div></div>';
    const content = root.querySelector<HTMLElement>(".reader-content");
    if (content === null) throw new Error("Expected content fixture.");
    const final = block("final", 0.8, 1);
    markMeaningfulBlocks(content, [final]);
    const element = content.querySelector<HTMLElement>("[data-reader-block-index]");
    if (element === null) throw new Error("Expected semantic marker.");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect(70 - 100 * FINAL_BLOCK_COMPLETION_RATIO, 100));

    expect(observeTopMeaningfulLocation({ line: 70, resolveAnchor: () => ({ block: final, isFinalBlock: true }), root })?.progressRatio).toBe(1);
  });
});

function block(id: string, sourceStartRatio: number, sourceEndRatio: number): ReaderBlockAnchorSnapshot {
  return {
    anchor: { blockId: id, blockOrdinalWithinHeading: 0, headingPathKey: "root", intraBlockRatio: 0, overallSourceRatio: sourceStartRatio, versionId: "version" },
    sourceEndRatio,
    sourceStartRatio,
  };
}

function rect(top: number, height: number): DOMRect {
  return { bottom: top + height, height, left: 0, right: 100, top, width: 100, x: 0, y: top, toJSON: () => ({}) };
}

function requireElement(elements: NodeListOf<HTMLElement>, index: number): HTMLElement {
  const element = elements[index];
  if (element === undefined) throw new Error("Expected semantic element fixture.");
  return element;
}

function requireAnchor(anchors: readonly ReaderBlockAnchorSnapshot[], index: number): ReaderBlockAnchorSnapshot {
  const anchor = anchors[index];
  if (anchor === undefined) throw new Error("Expected semantic anchor fixture.");
  return anchor;
}
