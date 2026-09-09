import { expect, it } from "vitest";

import { runMarkdownPipelineFromText } from "@/domain/content/markdown-pipeline";
import type {
  BlockAnchor,
  PipelineRunResult,
  PipelineSuccess,
} from "@/domain/content/pipeline-types";
import {
  mapSemanticAnchor,
  type MappingDocument,
  type MappingResult,
  type SemanticAnchor,
} from "@/domain/reading/progress-mapping";
import { createProgressMappingPairs } from "@/test/corpus/progress-mapping-corpus";

const measuredIterations = 2_000;

it("records deterministic progress-mapping corpus results", async () => {
  const rows: Record<string, number | string>[] = [];

  for (const pair of createProgressMappingPairs()) {
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
    const startedAt = performance.now();
    let result: MappingResult | undefined;

    for (let iteration = 0; iteration < measuredIterations; iteration += 1) {
      result = mapSemanticAnchor(savedAnchor, sourceDocument, targetDocument);
    }

    if (result?.anchor === undefined) {
      throw new Error(`Mapping pair ${pair.id} did not produce a target anchor.`);
    }

    const elapsedMs = performance.now() - startedAt;
    const mappedBlockId = result.anchor.blockId;

    const mappedIndex = targetDocument.blocks.findIndex(
      (block) => block.blockId === mappedBlockId,
    );
    const expectedIndex = targetDocument.blocks.findIndex(
      (block) => block.blockId === expectedTarget.blockId,
    );
    const blockDistance = Math.abs(mappedIndex - expectedIndex);

    expect(result.confidence).toBe(pair.expectedConfidence);
    expect(result.reason).toBe(pair.expectedReason);
    expect(blockDistance).toBeLessThanOrEqual(pair.maxBlockDistance);

    rows.push({
      pair: pair.id,
      confidence: result.confidence,
      reason: result.reason,
      similarity: Number(result.structuralSimilarity.toFixed(3)),
      blockDistance,
      averageMicroseconds: Number(
        ((elapsedMs * 1_000) / measuredIterations).toFixed(3),
      ),
    });
  }

  console.table(rows);
});

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
): SemanticAnchor {
  const markerOffset = requiredMarkerOffset(markdown, marker);
  const block = blockAtOffset(document, markerOffset);
  const blockLength = Math.max(1, block.sourceEnd - block.sourceStart);
  const intraBlockRatio = (markerOffset - block.sourceStart) / blockLength;

  return {
    versionId: document.versionId,
    headingPathKey: block.headingPathKey,
    blockOrdinalWithinHeading: block.blockOrdinalWithinHeading,
    blockId: block.blockId,
    intraBlockRatio,
    overallSourceRatio: markerOffset / Math.max(1, document.sourceLength),
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

function requiredMarkerOffset(markdown: string, marker: string): number {
  const offset = markdown.indexOf(marker);

  if (offset < 0) {
    throw new Error(`Missing marker ${marker}.`);
  }

  return offset;
}

function expectPipelineSuccess(result: PipelineRunResult): PipelineSuccess {
  if (!result.ok) {
    throw new Error(`Pipeline failed with ${result.error.code}.`);
  }

  return result.value;
}
