import { describe, expect, it } from "vitest";

import { runMarkdownPipelineFromText } from "@/domain/content/markdown-pipeline";
import type {
  BlockAnchor,
  PipelineRunResult,
  PipelineSuccess,
  SplitStrategy,
} from "@/domain/content/pipeline-types";
import {
  MAPPING_REASON_CODES,
  MAPPING_REASON_CONFIDENCE,
  MIN_RATIO_FALLBACK_SIMILARITY,
  RESTORE_UI_TRIGGER_MATRIX,
  calculateStructuralSimilarity,
  mapSemanticAnchor,
  type MappingDocument,
  type SemanticAnchor,
} from "./progress-mapping";
import {
  createProgressMappingPairs,
  type ProgressMappingPair,
} from "@/test/corpus/progress-mapping-corpus";

const strategies = ["auto", "h1", "h2", "h3", "whole"] as const satisfies readonly SplitStrategy[];

describe("semantic progress mapping spike", () => {
  it("keeps start, middle and end anchors exact across every same-version layout", async () => {
    const markdown = documentLines(
      "# Start [[MDR:SAME_START]]",
      "Opening block.",
      "## Middle",
      "Middle block [[MDR:SAME_MIDDLE]].",
      "## End",
      "Final block [[MDR:SAME_END]].",
    );
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(markdown, "same-version.md"),
    );
    const document = mappingDocument("same-version", success);

    for (const marker of [
      "[[MDR:SAME_START]]",
      "[[MDR:SAME_MIDDLE]]",
      "[[MDR:SAME_END]]",
    ]) {
      const savedAnchor = anchorAtMarker(document, markdown, marker, 0.5);

      for (const strategy of strategies) {
        for (const mode of ["continuous", "sections"] as const) {
          const result = mapSemanticAnchor(savedAnchor, document, document);
          const located = locateBlock(success, requireMappedAnchor(result).blockId);
          const layout = success.metadata.layouts[strategy];

          expect(result.confidence, `${mode}/${strategy}/${marker}`).toBe("exact");
          expect(result.reason, `${mode}/${strategy}/${marker}`).toBe(
            "SAME_VERSION_BLOCK_ID",
          );
          expect(requireMappedAnchor(result).blockId).toBe(savedAnchor.blockId);
          expect(
            layout.sections.some(
              (section) =>
                section.startChunkOrdinal <= located.chunkOrdinal &&
                located.chunkOrdinal <= section.endChunkOrdinalInclusive,
            ),
            `${mode}/${strategy}/${marker}`,
          ).toBe(true);
        }
      }
    }
  });

  it("uses same-version path/ordinal before nearest-heading and ratio fallbacks", async () => {
    const markdown = documentLines(
      "# Root",
      "Opening.",
      "## Target",
      "First target block.",
      "Second target block [[MDR:SAME_PATH]].",
    );
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(markdown, "same-version-fallback.md"),
    );
    const document = mappingDocument("same-fallback", success);
    const savedAnchor = anchorAtMarker(document, markdown, "[[MDR:SAME_PATH]]");
    const withoutBlockId = { ...savedAnchor, blockId: "missing-block" };
    const pathResult = mapSemanticAnchor(withoutBlockId, document, document);
    const nearestResult = mapSemanticAnchor(
      {
        ...withoutBlockId,
        blockOrdinalWithinHeading: 99,
      },
      document,
      document,
    );

    expect(pathResult.confidence).toBe("exact");
    expect(pathResult.reason).toBe("SAME_VERSION_PATH_ORDINAL");
    expect(requireMappedAnchor(pathResult).blockId).toBe(savedAnchor.blockId);
    expect(nearestResult.confidence).toBe("approximate");
    expect(nearestResult.reason).toBe("SAME_VERSION_NEAREST_HEADING");
  });

  for (const pair of createProgressMappingPairs()) {
    it(`maps update pair ${pair.id} within its recorded tolerance`, async () => {
      const measured = await measurePair(pair);

      expect(measured.result.confidence).toBe(pair.expectedConfidence);
      expect(measured.result.reason).toBe(pair.expectedReason);
      expect(measured.blockDistance).toBeLessThanOrEqual(pair.maxBlockDistance);

      if (measured.result.confidence === "exact") {
        expect(measured.blockDistance).toBe(0);
      }
    });
  }

  it("does not call a repeated heading exact when its fingerprint is ambiguous", async () => {
    const pair = requirePair("reordered-repeated-heading");
    const source = expectPipelineSuccess(
      await runMarkdownPipelineFromText(pair.sourceMarkdown, "repeated-source.md"),
    );
    const target = expectPipelineSuccess(
      await runMarkdownPipelineFromText(pair.targetMarkdown, "repeated-target.md"),
    );
    const sourceDocument = mappingDocument("repeated-source", source);
    const targetDocument = mappingDocument("repeated-target", target);
    const secondHeadingOffset = nthIndexOf(pair.sourceMarkdown, "## Topic", 2);
    const sourceHeading = blockAtOffset(sourceDocument, secondHeadingOffset);
    const savedAnchor = anchorForBlock(sourceDocument, sourceHeading, 0);
    const result = mapSemanticAnchor(savedAnchor, sourceDocument, targetDocument);

    expect(result.confidence).toBe("approximate");
    expect(result.reason).toBe("CROSS_VERSION_PATH_ORDINAL");
  });

  it("does not accept an invalid persisted fingerprint as exact evidence", () => {
    const source = syntheticDocument("invalid-fingerprint-source", 3);
    const targetBase = syntheticDocument("invalid-fingerprint-target", 3);
    const sourceBlock = source.blocks[1];

    if (sourceBlock === undefined) {
      throw new Error("Synthetic source block is missing.");
    }

    const target: MappingDocument = {
      ...targetBase,
      blocks: targetBase.blocks.map((block, index) =>
        index === 1 ? { ...block, contentFingerprint: "not-a-sha256" } : block,
      ),
    };
    const result = mapSemanticAnchor(anchorForBlock(source, sourceBlock, 0.5), source, target);

    expect(result.confidence).toBe("approximate");
    expect(result.reason).toBe("CROSS_VERSION_PATH_ORDINAL");
  });

  it("preserves a clamped intra-block ratio for an unchanged oversized block", async () => {
    const oversizedBlock = `${"large block content ".repeat(1_900)}[[MDR:OVERSIZED_ANCHOR]]`;
    const sourceMarkdown = documentLines("# Oversized", oversizedBlock, "Closing.");
    const targetMarkdown = documentLines(
      "# Oversized",
      "Inserted context.",
      oversizedBlock,
      "Closing.",
    );
    const source = expectPipelineSuccess(
      await runMarkdownPipelineFromText(sourceMarkdown, "oversized-source.md"),
    );
    const target = expectPipelineSuccess(
      await runMarkdownPipelineFromText(targetMarkdown, "oversized-target.md"),
    );
    const sourceDocument = mappingDocument("oversized-source", source);
    const targetDocument = mappingDocument("oversized-target", target);
    const savedAnchor = anchorAtMarker(
      sourceDocument,
      sourceMarkdown,
      "[[MDR:OVERSIZED_ANCHOR]]",
      1.4,
    );
    const result = mapSemanticAnchor(savedAnchor, sourceDocument, targetDocument);

    expect(result.confidence).toBe("exact");
    expect(result.reason).toBe("CROSS_VERSION_CONTENT_FINGERPRINT");
    expect(requireMappedAnchor(result).intraBlockRatio).toBe(1);
    expect(requireMappedAnchor(result).overallSourceRatio).toBeGreaterThanOrEqual(0);
    expect(requireMappedAnchor(result).overallSourceRatio).toBeLessThanOrEqual(1);
  });

  it("returns none at start for a nonempty radical rewrite and no anchor for empty target", async () => {
    const radical = await measurePair(requirePair("radical-rewrite"));
    const emptyDocument: MappingDocument = {
      versionId: "empty-target",
      sourceLength: 0,
      blocks: [],
    };
    const emptyResult = mapSemanticAnchor(
      radical.savedAnchor,
      radical.sourceDocument,
      emptyDocument,
    );

    expect(radical.result.structuralSimilarity).toBeLessThan(
      MIN_RATIO_FALLBACK_SIMILARITY,
    );
    expect(requireMappedAnchor(radical.result).overallSourceRatio).toBe(0);
    expect(emptyResult).toEqual({
      confidence: "none",
      reason: "TARGET_EMPTY",
      structuralSimilarity: 0,
    });
  });

  it("clamps same-version ratio fallback to the first and last meaningful blocks", () => {
    const document = syntheticDocument("ratio-boundary", 5);
    const missingAnchor: SemanticAnchor = {
      versionId: document.versionId,
      headingPathKey: "9:missing[1]",
      blockOrdinalWithinHeading: 999,
      blockId: "missing-block",
      intraBlockRatio: Number.NaN,
      overallSourceRatio: -10,
    };
    const startResult = mapSemanticAnchor(missingAnchor, document, document);
    const endResult = mapSemanticAnchor(
      { ...missingAnchor, overallSourceRatio: 10 },
      document,
      document,
    );

    expect(startResult.reason).toBe("OVERALL_SOURCE_RATIO");
    expect(requireMappedAnchor(startResult).blockId).toBe(document.blocks[0]?.blockId);
    expect(requireMappedAnchor(startResult).overallSourceRatio).toBe(0);
    expect(requireMappedAnchor(endResult).blockId).toBe(document.blocks.at(-1)?.blockId);
    expect(requireMappedAnchor(endResult).overallSourceRatio).toBe(1);
  });

  it("is deterministic and keeps generated ratios and target references in range", () => {
    let randomState = 42;
    const random = (): number => {
      randomState = Math.imul(randomState, 1_664_525) + 1_013_904_223;
      return (randomState >>> 0) / 4_294_967_296;
    };

    for (let sample = 0; sample < 250; sample += 1) {
      const blockCount = 1 + Math.floor(random() * 24);
      const source = syntheticDocument("property-source", blockCount);
      const target = syntheticDocument("property-target", blockCount + (sample % 3));
      const sourceBlock = source.blocks[Math.floor(random() * source.blocks.length)];

      if (sourceBlock === undefined) {
        throw new Error("Generated source block is missing.");
      }

      const rawRatio = sample % 5 === 0 ? Number.NaN : random() * 3 - 1;
      const savedAnchor = anchorForBlock(source, sourceBlock, rawRatio);
      const first = mapSemanticAnchor(savedAnchor, source, target);
      const second = mapSemanticAnchor(savedAnchor, source, target);
      const mappedAnchor = requireMappedAnchor(first);

      expect(first).toEqual(second);
      expect(mappedAnchor.intraBlockRatio).toBeGreaterThanOrEqual(0);
      expect(mappedAnchor.intraBlockRatio).toBeLessThanOrEqual(1);
      expect(mappedAnchor.overallSourceRatio).toBeGreaterThanOrEqual(0);
      expect(mappedAnchor.overallSourceRatio).toBeLessThanOrEqual(1);
      expect(mappedAnchor.versionId).toBe(target.versionId);
      expect(target.blocks.some((block) => block.blockId === mappedAnchor.blockId)).toBe(true);
    }
  });

  it("keeps every reason code exhaustively assigned to confidence and UI triggers", () => {
    expect(Object.keys(MAPPING_REASON_CONFIDENCE).sort()).toEqual(
      [...MAPPING_REASON_CODES].sort(),
    );
    expect(Object.keys(RESTORE_UI_TRIGGER_MATRIX).sort()).toEqual([
      "approximate",
      "exact",
      "none",
    ]);
    expect(RESTORE_UI_TRIGGER_MATRIX.exact.notice).toBe("none");
    expect(RESTORE_UI_TRIGGER_MATRIX.approximate.actions).toEqual([
      "continue",
      "start",
    ]);
    expect(RESTORE_UI_TRIGGER_MATRIX.none.actions).toEqual(["start"]);
  });

  it("computes symmetric structural similarity bounded to zero through one", () => {
    const left = syntheticDocument("left", 4).blocks;
    const right = syntheticDocument("right", 7).blocks;
    const forward = calculateStructuralSimilarity(left, right);
    const reverse = calculateStructuralSimilarity(right, left);

    expect(forward).toBe(reverse);
    expect(forward).toBeGreaterThanOrEqual(0);
    expect(forward).toBeLessThanOrEqual(1);
    expect(calculateStructuralSimilarity([], right)).toBe(0);
  });
});

async function measurePair(pair: ProgressMappingPair) {
  const source = expectPipelineSuccess(
    await runMarkdownPipelineFromText(pair.sourceMarkdown, `${pair.id}-source.md`),
  );
  const target = expectPipelineSuccess(
    await runMarkdownPipelineFromText(pair.targetMarkdown, `${pair.id}-target.md`),
  );
  const sourceDocument = mappingDocument(`${pair.id}-source`, source);
  const targetDocument = mappingDocument(`${pair.id}-target`, target);
  const savedAnchor = anchorAtMarker(
    sourceDocument,
    pair.sourceMarkdown,
    pair.sourceMarker,
  );
  const expectedTarget = blockAtMarker(
    targetDocument,
    pair.targetMarkdown,
    pair.expectedTargetMarker,
  );
  const result = mapSemanticAnchor(savedAnchor, sourceDocument, targetDocument);
  const mappedAnchor = requireMappedAnchor(result);
  const mappedIndex = targetDocument.blocks.findIndex(
    (block) => block.blockId === mappedAnchor.blockId,
  );
  const expectedIndex = targetDocument.blocks.findIndex(
    (block) => block.blockId === expectedTarget.blockId,
  );

  return {
    blockDistance: Math.abs(mappedIndex - expectedIndex),
    result,
    savedAnchor,
    sourceDocument,
    targetDocument,
  };
}

function mappingDocument(versionId: string, success: PipelineSuccess): MappingDocument {
  return {
    versionId,
    sourceLength: success.metadata.charLength,
    blocks: success.chunks.flatMap((chunk) => chunk.blockAnchors),
  };
}

function anchorAtMarker(
  document: MappingDocument,
  markdown: string,
  marker: string,
  intraBlockRatio?: number,
): SemanticAnchor {
  const markerOffset = requiredMarkerOffset(markdown, marker);
  const block = blockAtOffset(document, markerOffset);
  const blockLength = Math.max(1, block.sourceEnd - block.sourceStart);
  const measuredIntraBlockRatio =
    intraBlockRatio ?? (markerOffset - block.sourceStart) / blockLength;

  return anchorForBlock(document, block, measuredIntraBlockRatio);
}

function anchorForBlock(
  document: MappingDocument,
  block: BlockAnchor,
  intraBlockRatio: number,
): SemanticAnchor {
  const safeIntraBlockRatio = Number.isFinite(intraBlockRatio)
    ? Math.min(1, Math.max(0, intraBlockRatio))
    : intraBlockRatio;
  const position =
    block.sourceStart +
    (Number.isFinite(safeIntraBlockRatio) ? safeIntraBlockRatio : 0) *
      Math.max(0, block.sourceEnd - block.sourceStart);

  return {
    versionId: document.versionId,
    headingPathKey: block.headingPathKey,
    blockOrdinalWithinHeading: block.blockOrdinalWithinHeading,
    blockId: block.blockId,
    intraBlockRatio,
    overallSourceRatio: position / Math.max(1, document.sourceLength),
  };
}

function blockAtMarker(
  document: MappingDocument,
  markdown: string,
  marker: string,
): BlockAnchor {
  return blockAtOffset(document, requiredMarkerOffset(markdown, marker));
}

function blockAtOffset(document: MappingDocument, offset: number): BlockAnchor {
  const block = document.blocks.find(
    (candidate) => candidate.sourceStart <= offset && offset < candidate.sourceEnd,
  );

  if (block === undefined) {
    throw new Error(`No block contains source offset ${String(offset)}.`);
  }

  return block;
}

function locateBlock(success: PipelineSuccess, blockId: string) {
  for (const chunk of success.chunks) {
    const block = chunk.blockAnchors.find((candidate) => candidate.blockId === blockId);

    if (block !== undefined) {
      return { block, chunkOrdinal: chunk.ordinal };
    }
  }

  throw new Error(`Missing block ${blockId}.`);
}

function requiredMarkerOffset(markdown: string, marker: string): number {
  const offset = markdown.indexOf(marker);

  if (offset < 0) {
    throw new Error(`Missing marker ${marker}.`);
  }

  return offset;
}

function nthIndexOf(value: string, search: string, occurrence: number): number {
  let offset = -1;

  for (let index = 0; index < occurrence; index += 1) {
    offset = value.indexOf(search, offset + 1);
  }

  if (offset < 0) {
    throw new Error(`Missing occurrence ${String(occurrence)} of ${search}.`);
  }

  return offset;
}

function requireMappedAnchor(result: ReturnType<typeof mapSemanticAnchor>): SemanticAnchor {
  if (result.anchor === undefined) {
    throw new Error(`Mapping result ${result.reason} has no target anchor.`);
  }

  return result.anchor;
}

function requirePair(id: ProgressMappingPair["id"]): ProgressMappingPair {
  const pair = createProgressMappingPairs().find((candidate) => candidate.id === id);

  if (pair === undefined) {
    throw new Error(`Missing mapping pair ${id}.`);
  }

  return pair;
}

function syntheticDocument(versionId: string, blockCount: number): MappingDocument {
  return {
    versionId,
    sourceLength: blockCount * 10,
    blocks: Array.from({ length: blockCount }, (_, ordinal) => ({
      blockId: `${versionId}-block-${String(ordinal)}`,
      contentFingerprint: ordinal.toString(16).padStart(64, "0"),
      headingPathKey: `1:generated[1]/2:part-${String(Math.floor(ordinal / 4))}[1]`,
      blockOrdinalWithinHeading: ordinal % 4,
      sourceStart: ordinal * 10,
      sourceEnd: ordinal * 10 + 9,
    })),
  };
}

function expectPipelineSuccess(result: PipelineRunResult): PipelineSuccess {
  if (!result.ok) {
    throw new Error(`Pipeline failed with ${result.error.code}.`);
  }

  return result.value;
}

function documentLines(...blocks: readonly string[]): string {
  return `${blocks.join("\n\n")}\n`;
}
