import { describe, expect, it } from "vitest";

import {
  previewAutoDetect,
  runMarkdownPipelineFromText,
} from "@/domain/content/markdown-pipeline";
import { PIPELINE_LIMITS } from "@/domain/content/pipeline-limits";
import type {
  PipelineRunResult,
  PipelineStageTimings,
  PipelineSuccess,
} from "@/domain/content/pipeline-types";
import {
  collectFixtureMarkers,
  createPipelineCorpus,
  type PipelineCorpusFixture,
  type PipelineCorpusFixtureId,
} from "@/test/corpus/pipeline-corpus";

interface PipelineMeasurement {
  readonly fixtureId: PipelineCorpusFixtureId;
  readonly byteLength: number;
  readonly topLevelNodeCount: number;
  readonly chunkCount: number;
  readonly batchCount: number;
  readonly htmlBytes: number;
  readonly warningCodes: readonly string[];
  readonly stageTimings: PipelineStageTimings;
  readonly elapsedMs: number;
  readonly eventLoopDelayMs: number;
}

const measuredFixtureIds = [
  "small",
  "medium",
  "large",
  "long-code",
  "wide-table",
  "huge-single-node",
] as const satisfies readonly PipelineCorpusFixtureId[];

describe("P00-T02 pipeline benchmark proxy", () => {
  it("measures deterministic corpus without losing semantic markers", async () => {
    const measurements: PipelineMeasurement[] = [];

    for (const fixtureId of measuredFixtureIds) {
      const fixture = getFixture(fixtureId);
      const { result, elapsedMs, eventLoopDelayMs } = await measurePipeline(fixture);
      const success = expectPipelineSuccess(result);
      const renderedMarkers = collectFixtureMarkers(
        success.chunks.map((chunk) => chunk.html).join("\n"),
      );
      const htmlBytes = success.chunks.reduce(
        (total, chunk) => total + new TextEncoder().encode(chunk.html).byteLength,
        0,
      );

      expect(renderedMarkers).toEqual(fixture.expected.markers);
      expect(success.metadata.chunkCount).toBe(success.chunks.length);
      expect(success.batches.map((batch) => batch.batchOrdinal)).toEqual(
        success.batches.map((_, index) => index),
      );

      for (const batch of success.batches) {
        expect(batch.chunks.length).toBeLessThanOrEqual(PIPELINE_LIMITS.batchMaxChunks);
      }

      measurements.push({
        fixtureId,
        byteLength: fixture.expected.byteLength,
        topLevelNodeCount: fixture.expected.topLevelNodeCount,
        chunkCount: success.chunks.length,
        batchCount: success.batches.length,
        htmlBytes,
        warningCodes: success.metadata.warnings.map((warning) => warning.code),
        stageTimings: success.timings,
        elapsedMs,
        eventLoopDelayMs,
      });
    }

    console.info("P00-T02 pipeline measurements", JSON.stringify(measurements, null, 2));

    expect(measurements.every((measurement) => measurement.elapsedMs < 30_000)).toBe(true);
    expect(measurements.some((measurement) => measurement.chunkCount > 1)).toBe(true);
  });

  it("records auto-detect cost and keeps ambiguous samples below confidence", () => {
    const ambiguous = previewAutoDetect("title: value\n- item\nplain prose");
    const javascript = previewAutoDetect(
      "function answer(value) {\n  return value.map((item) => item.id).join(',')\n}",
    );

    console.info(
      "P00-T02 auto-detect measurements",
      JSON.stringify({ ambiguous, javascript }, null, 2),
    );

    expect(ambiguous.accepted).toBe(false);
    expect(ambiguous.relevance).toBeLessThan(PIPELINE_LIMITS.autoDetectMinRelevance);
    expect(Math.max(ambiguous.elapsedMs, javascript.elapsedMs)).toBeLessThan(1_000);
  });
});

async function measurePipeline(fixture: PipelineCorpusFixture): Promise<{
  readonly result: PipelineRunResult;
  readonly elapsedMs: number;
  readonly eventLoopDelayMs: number;
}> {
  const scheduledAt = performance.now();
  const timer = new Promise<number>((resolve) => {
    setTimeout(() => {
      resolve(performance.now() - scheduledAt);
    }, 0);
  });
  const startedAt = performance.now();
  const result = await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName);
  const elapsedMs = performance.now() - startedAt;
  const eventLoopDelayMs = await timer;

  return { result, elapsedMs, eventLoopDelayMs };
}

function getFixture(id: PipelineCorpusFixtureId): PipelineCorpusFixture {
  const fixture = createPipelineCorpus().find((candidate) => candidate.id === id);

  if (fixture === undefined) {
    throw new Error(`Missing pipeline corpus fixture ${id}.`);
  }

  return fixture;
}

function expectPipelineSuccess(result: PipelineRunResult): PipelineSuccess {
  if (!result.ok) {
    throw new Error(`Pipeline failed with ${result.error.code}.`);
  }

  return result.value;
}
