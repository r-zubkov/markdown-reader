import { describe, expect, it } from "vitest";

import { collectFixtureMarkers } from "@/test/corpus/pipeline-corpus";
import { runMarkdownPipelineFromText } from "./markdown-pipeline";
import { PIPELINE_LIMITS } from "./pipeline-limits";
import type { PipelineSuccess, SplitStrategy } from "./pipeline-types";

const strategies = ["auto", "h1", "h2", "h3", "whole"] as const satisfies readonly SplitStrategy[];

describe("Markdown pipeline deterministic properties", () => {
  it("preserves generated markers, block order and complete layouts across fixed seeds", async () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const markdown = generateMarkdown(seed);
      const first = expectSuccess(await runMarkdownPipelineFromText(markdown, `property-${String(seed)}.md`));
      const second = expectSuccess(await runMarkdownPipelineFromText(markdown, `property-${String(seed)}.md`));
      const expectedMarkers = collectFixtureMarkers(markdown);
      const renderedMarkers = collectFixtureMarkers(first.chunks.map((chunk) => chunk.html).join("\n"));
      const anchors = first.chunks.flatMap((chunk) => chunk.blockAnchors);

      expect(renderedMarkers, `seed ${String(seed)}`).toEqual(expectedMarkers);
      expect(anchors.map((anchor) => anchor.sourceStart), `seed ${String(seed)}`).toEqual(
        [...anchors].map((anchor) => anchor.sourceStart).sort((left, right) => left - right),
      );
      expect(first.metadata, `seed ${String(seed)}`).toEqual(second.metadata);
      expect(first.chunks, `seed ${String(seed)}`).toEqual(second.chunks);

      for (const strategy of strategies) {
        const layout = first.metadata.layouts[strategy];
        let expectedStart = 0;

        for (const section of layout.sections) {
          expect(section.startChunkOrdinal, `seed ${String(seed)} ${strategy}`).toBe(expectedStart);
          expectedStart = section.endChunkOrdinalInclusive + 1;
        }

        expect(expectedStart, `seed ${String(seed)} ${strategy}`).toBe(first.metadata.chunkCount);
      }
    }
  });

  it("fails with stable structural limit details at AST node and depth boundaries", async () => {
    const nodeLimited = await runMarkdownPipelineFromText("# Heading", "nodes.md", {
      ...PIPELINE_LIMITS,
      maxAstNodes: 2,
    });
    expect(nodeLimited).toMatchObject({
      ok: false,
      error: { code: "PIPELINE_LIMIT", limitName: "maxAstNodes", limit: 2, actual: 3 },
    });

    const depthLimited = await runMarkdownPipelineFromText("# Heading", "depth.md", {
      ...PIPELINE_LIMITS,
      maxAstDepth: 1,
      maxAstNodes: 100,
    });
    expect(depthLimited).toMatchObject({
      ok: false,
      error: { code: "PIPELINE_LIMIT", limitName: "maxAstDepth", limit: 1, actual: 2 },
    });
  });

  it("keeps every worker batch within count and byte budgets except one indivisible chunk", async () => {
    const markdown = generateMarkdown(8, 80);
    const success = expectSuccess(await runMarkdownPipelineFromText(markdown, "batches.md", {
      ...PIPELINE_LIMITS,
      batchMaxChunks: 3,
      batchMaxHtmlBytes: 900,
      targetChunkCost: 180,
    }));

    expect(success.batches.length).toBeGreaterThan(1);
    expect(success.batches.flatMap((batch) => batch.chunks)).toEqual(success.chunks);

    for (const batch of success.batches) {
      const measuredBytes = batch.chunks.reduce(
        (total, chunk) => total + new TextEncoder().encode(chunk.html).byteLength,
        0,
      );
      expect(batch.htmlBytes).toBe(measuredBytes);
      expect(batch.chunks.length).toBeLessThanOrEqual(3);
      expect(batch.htmlBytes <= 900 || batch.chunks.length === 1).toBe(true);
    }
  });
});

function generateMarkdown(seed: number, blockCount = 12): string {
  const random = seededRandom(seed);
  const lines: string[] = [`# Property ${String(seed)} [[MDR:P${String(seed)}_TITLE]]`, ""];

  for (let index = 0; index < blockCount; index += 1) {
    if (index % 5 === 0) {
      const depth = 2 + Math.floor(random() * 2);
      lines.push(`${"#".repeat(depth)} Section ${String(index)}`);
      lines.push("");
    }

    lines.push(`Paragraph ${String(index)} [[MDR:P${String(seed)}_${String(index)}]] value ${String(Math.floor(random() * 1_000_000))}.`);
    lines.push("");

    if (index % 7 === 0) {
      lines.push("- [x] complete");
      lines.push("- [ ] pending");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1_664_525) + 1_013_904_223;
    return (state >>> 0) / 4_294_967_296;
  };
}

function expectSuccess(result: Awaited<ReturnType<typeof runMarkdownPipelineFromText>>): PipelineSuccess {
  if (!result.ok) throw new Error(`Unexpected pipeline failure: ${result.error.code}`);
  return result.value;
}
