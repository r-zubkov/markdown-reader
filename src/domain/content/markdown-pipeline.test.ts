import { describe, expect, it } from "vitest";

import {
  previewAutoDetect,
  runMarkdownPipeline,
  runMarkdownPipelineFromText,
} from "./markdown-pipeline";
import {
  PIPELINE_LIMITS,
  PIPELINE_SUPPORTED_LANGUAGES,
  PIPELINE_VERSION,
} from "./pipeline-limits";
import type {
  PipelineRunResult,
  PipelineSuccess,
  SectionLayout,
  SplitStrategy,
} from "./pipeline-types";
import {
  collectFixtureMarkers,
  createByteLimitFixtures,
  createPipelineCorpus,
  type PipelineCorpusFixture,
  type PipelineCorpusFixtureId,
} from "@/test/corpus/pipeline-corpus";

const semanticFixtureIds = [
  "small",
  "medium",
  "no-headings",
  "repeated-unicode-headings",
  "long-code",
  "single-long-line",
  "wide-table",
  "huge-single-node",
] as const satisfies readonly PipelineCorpusFixtureId[];

const layoutStrategies = ["auto", "h1", "h2", "h3", "whole"] as const satisfies readonly SplitStrategy[];

describe("Production Markdown pipeline", () => {
  for (const fixtureId of semanticFixtureIds) {
    it(`preserves marker order and top-level block anchors for ${fixtureId}`, async () => {
      const fixture = getFixture(fixtureId);
      const success = expectPipelineSuccess(
        await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
      );
      const renderedMarkers = collectFixtureMarkers(renderText(success));
      const blockAnchorCount = success.chunks.reduce(
        (count, chunk) => count + chunk.blockAnchors.length,
        0,
      );

      expect(renderedMarkers).toEqual(fixture.expected.markers);
      expect(blockAnchorCount).toBe(fixture.expected.topLevelNodeCount);
      expect(success.metadata.byteLength).toBe(fixture.expected.byteLength);
    });
  }

  it("renders CommonMark and GFM semantics through the sanitized output", async () => {
    const fixture = getFixture("small");
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
    );
    const root = renderRoot(success);

    expect(root.querySelector("h1[id^='mdr-h-']")).toHaveTextContent("Small Fixture");
    expect(root.querySelector("table th")).toHaveTextContent("Feature");
    expect(root.querySelector("input[type='checkbox'][disabled]")).not.toBeNull();
    expect(root.querySelector("section.footnotes")).not.toBeNull();
    expect(root.querySelector("code.hljs.language-typescript")).not.toBeNull();
    expect(success.metadata.title).toContain("Small Fixture");
    expect(success.metadata.pipelineVersion).toBe(PIPELINE_VERSION);
  });

  it("resolves cross-chunk footnotes once with Russian accessible labels and unique ids", async () => {
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText([
        "# First",
        "",
        "First reference.[^shared]",
        "",
        "# Second",
        "",
        "Repeated reference.[^shared]",
        "",
        "# Notes",
        "",
        "[^shared]: Shared footnote body.",
      ].join("\n"), "footnotes.md"),
    );
    const root = renderRoot(success);
    const ids = Array.from(root.querySelectorAll("[id]"), (element) => element.id);

    expect(root.querySelectorAll("section.footnotes")).toHaveLength(1);
    expect(root.querySelector("section.footnotes")).toHaveTextContent("Shared footnote body");
    expect(root.querySelector("section.footnotes h2.sr-only")).toHaveTextContent("Сноски");
    expect(root.querySelectorAll("a[data-footnote-backref]")).toHaveLength(2);
    expect(Array.from(root.querySelectorAll("a[data-footnote-backref]"), (link) => link.getAttribute("aria-label"))).toEqual([
      "Вернуться к сноске 1",
      "Вернуться к сноске 1, ссылка 2",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("highlights every configured explicit grammar and expanded aliases", async () => {
    const aliasSamples = [
      { label: "c++", language: "cpp" },
      { label: "c#", language: "csharp" },
      { label: "gql", language: "graphql" },
      { label: "kt", language: "kotlin" },
      { label: "rb", language: "ruby" },
      { label: "rs", language: "rust" },
      { label: "shellsession", language: "shell" },
      { label: "txt", language: "plaintext" },
    ] as const;
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(
        [
          "# Expanded languages",
          "",
          ...PIPELINE_SUPPORTED_LANGUAGES.flatMap((language) => [
            `\`\`\`${language}`,
            "value = 1",
            "```",
            "",
          ]),
          ...aliasSamples.flatMap(({ label }) => [
            `\`\`\`${label}`,
            "value = 1",
            "```",
            "",
          ]),
        ].join("\n"),
      ),
    );
    const root = renderRoot(success);

    for (const language of PIPELINE_SUPPORTED_LANGUAGES) {
      expect(root.querySelector(`code.hljs.language-${language}`)).not.toBeNull();
    }

    for (const { language } of aliasSamples) {
      expect(root.querySelector(`code.hljs.language-${language}`)).not.toBeNull();
    }
  });

  it("creates deterministic heading IDs, chunk HTML and metadata for same bytes", async () => {
    const fixture = getFixture("repeated-unicode-headings");
    const first = expectPipelineSuccess(
      await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
    );
    const second = expectPipelineSuccess(
      await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
    );
    const headingIds = first.metadata.outline.map((item) => item.id);

    expect(new Set(headingIds).size).toBe(headingIds.length);
    expect(first.metadata.contentHash).toBe(second.metadata.contentHash);
    expect(first.metadata.outline).toEqual(second.metadata.outline);
    expect(first.chunks.map((chunk) => chunk.html)).toEqual(
      second.chunks.map((chunk) => chunk.html),
    );
    expect(first.chunks.map((chunk) => chunk.blockAnchors)).toEqual(
      second.chunks.map((chunk) => chunk.blockAnchors),
    );
    expect(
      first.chunks
        .flatMap((chunk) => chunk.blockAnchors)
        .every((anchor) => /^[a-f0-9]{64}$/u.test(anchor.contentFingerprint)),
    ).toBe(true);
    for (const item of first.metadata.outline) {
      expect(first.chunks[item.chunkOrdinal]?.html).toContain(`id="${item.id}"`);
    }
  });

  it("covers all chunks in every layout and keeps whole as a logical section", async () => {
    const fixture = getFixture("medium");
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(fixture.markdown, fixture.fileName),
    );

    expect(success.chunks.length).toBeGreaterThan(1);

    for (const strategy of layoutStrategies) {
      expectLayoutCoversAllChunks(success.metadata.layouts[strategy], success.chunks.length);
    }

    const wholeLayout = success.metadata.layouts.whole;
    expect(wholeLayout.sections).toHaveLength(1);
    expect(wholeLayout.sections[0]?.startChunkOrdinal).toBe(0);
    expect(wholeLayout.sections[0]?.endChunkOrdinalInclusive).toBe(
      success.chunks.length - 1,
    );
  });

  it("uses H3 headings as persisted section boundaries", async () => {
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(
        [
          "# Root",
          "",
          "R".repeat(50),
          "",
          "## Group",
          "",
          "G".repeat(50),
          "",
          "### First detail",
          "",
          "F".repeat(50),
          "",
          "### Second detail",
          "",
          "S".repeat(50),
        ].join("\n"),
        "h3-layout.md",
        {
          ...PIPELINE_LIMITS,
          maxChunkCostBeforeFallback: 120,
          oversizedNodeCost: 10_000,
          targetChunkCost: 10_000,
        },
      ),
    );

    expect(success.metadata.layouts.h3.sections.map((section) => section.title)).toEqual([
      "Root",
      "Group",
      "First detail",
      "Second detail",
    ]);
    expect(success.metadata.layouts.h3.sections.length).toBeGreaterThan(
      success.metadata.layouts.h2.sections.length,
    );
    expect(success.metadata.layouts.auto.sections.map((section) => section.title)).toEqual(
      success.metadata.layouts.h3.sections.map((section) => section.title),
    );
    expect(success.metadata.layouts.auto.safeForSelection).toBe(true);
    expect(success.chunks.every((chunk) => chunk.pipelineVersion === PIPELINE_VERSION)).toBe(true);
  });

  it("uses SHA-256 over the full UTF-8 byte buffer", async () => {
    const result = expectPipelineSuccess(
      await runMarkdownPipeline(new TextEncoder().encode("abc"), "abc.md"),
    );

    expect(result.metadata.contentHash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(result.metadata.byteLength).toBe(3);
    expect(result.metadata.charLength).toBe(3);
  });

  it("fails closed for invalid UTF-8 and enforces byte limits at the boundary", async () => {
    const tightLimits = {
      ...PIPELINE_LIMITS,
      maxFileBytes: 96,
    };
    const [below, at, above] = createByteLimitFixtures(tightLimits);

    expect(below?.expected.byteLength).toBe(tightLimits.maxFileBytes - 1);
    expect(at?.expected.byteLength).toBe(tightLimits.maxFileBytes);
    expect(above?.expected.byteLength).toBe(tightLimits.maxFileBytes + 1);

    expect(
      (await runMarkdownPipelineFromText(requireFixture(below).markdown, "below.md", tightLimits))
        .ok,
    ).toBe(true);
    expect(
      (await runMarkdownPipelineFromText(requireFixture(at).markdown, "at.md", tightLimits)).ok,
    ).toBe(true);

    const aboveResult = await runMarkdownPipelineFromText(
      requireFixture(above).markdown,
      "above.md",
      tightLimits,
    );
    expect(aboveResult.ok).toBe(false);
    expect(aboveResult.ok ? undefined : aboveResult.error.code).toBe("FILE_TOO_LARGE");

    const invalid = await runMarkdownPipeline(new Uint8Array([0xc3, 0x28]), "invalid.md");
    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? undefined : invalid.error.code).toBe("INVALID_UTF8");
  });

  it("keeps oversized code and nodes readable with explicit fallback diagnostics", async () => {
    const longCode = expectPipelineSuccess(
      await runMarkdownPipelineFromText(
        getFixture("long-code").markdown,
        getFixture("long-code").fileName,
      ),
    );
    const hugeNode = expectPipelineSuccess(
      await runMarkdownPipelineFromText(
        getFixture("huge-single-node").markdown,
        getFixture("huge-single-node").fileName,
      ),
    );

    expect(warningCount(longCode, "CODE_HIGHLIGHT_SKIPPED")).toBeGreaterThan(0);
    expect(longCode.chunks.some((chunk) => chunk.diagnosticCode === "HIGHLIGHT_FAILED")).toBe(
      true,
    );
    expect(renderText(longCode)).toContain("[[MDR:LONG_CODE_TITLE]]");

    expect(warningCount(hugeNode, "OVERSIZED_NODE")).toBeGreaterThan(0);
    expect(hugeNode.chunks.some((chunk) => chunk.diagnosticCode === "OVERSIZED_NODE")).toBe(
      true,
    );
    expect(renderText(hugeNode)).toContain("[[MDR:HUGE_NODE_BODY]]");
  });

  it("keeps low-confidence auto-detect out of rendered code", () => {
    const preview = previewAutoDetect("title: value\n- item\nplain words");

    expect(preview.accepted).toBe(false);
    expect(preview.relevance).toBeLessThan(PIPELINE_LIMITS.autoDetectMinRelevance);
    expect(preview.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("keeps an unknown explicit language as escaped plain code with a stable warning", async () => {
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText("```unknownlang\n<script>alert(1)</script>\n```"),
    );
    const root = renderRoot(success);

    expect(root.querySelector("code.language-plaintext")).toHaveTextContent("<script>alert(1)</script>");
    expect(root.querySelector("script")).toBeNull();
    expect(warningCount(success, "UNSUPPORTED_LANGUAGE")).toBe(1);
    expect(success.chunks[0]?.diagnosticCode).toBe("HIGHLIGHT_FAILED");
  });

  it("rewrites safe local heading links and blocks unresolved fragments", async () => {
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText([
        "# Start",
        "",
        "[Jump](#target-heading) and [missing](#missing-heading).",
        "",
        "## Target Heading",
      ].join("\n")),
    );
    const root = renderRoot(success);
    const links = Array.from(root.querySelectorAll("a"));

    expect(links.find((link) => link.textContent === "Jump")?.getAttribute("href")).toBe("#mdr-h-target-heading-1");
    expect(links.find((link) => link.textContent === "missing")?.hasAttribute("href")).toBe(false);
    expect(warningCount(success, "UNSAFE_URL_BLOCKED")).toBe(1);
  });

  it("enforces structural limits and bounds derived titles without dropping body content", async () => {
    const limited = await runMarkdownPipelineFromText("# Heading\n\nParagraph", "limited.md", {
      ...PIPELINE_LIMITS,
      maxTopLevelBlocks: 1,
    });
    expect(limited).toMatchObject({
      ok: false,
      error: { code: "PIPELINE_LIMIT", limitName: "maxTopLevelBlocks", limit: 1, actual: 2 },
    });

    const longTitle = "T".repeat(40);
    const success = expectPipelineSuccess(
      await runMarkdownPipelineFromText(`# ${longTitle}\n\nBody remains visible.`, "title.md", {
        ...PIPELINE_LIMITS,
        maxTitleChars: 16,
      }),
    );
    expect(success.metadata.title).toBe("T".repeat(16));
    expect(warningCount(success, "TITLE_TRUNCATED")).toBe(1);
    expect(renderText(success)).toContain(longTitle);
    expect(renderText(success)).toContain("Body remains visible");
  });

  it("keeps whole selectable through bounded chunks unless one chunk is itself oversized", async () => {
    const medium = expectPipelineSuccess(
      await runMarkdownPipelineFromText(getFixture("medium").markdown, "medium.md"),
    );
    const huge = expectPipelineSuccess(
      await runMarkdownPipelineFromText(getFixture("huge-single-node").markdown, "huge.md"),
    );

    expect(medium.metadata.layouts.whole.safeForSelection).toBe(true);
    expect(huge.metadata.layouts.whole).toMatchObject({
      safeForSelection: false,
      unavailableReason: "OVERSIZED_NODE",
    });
  });
});

function getFixture(id: PipelineCorpusFixtureId): PipelineCorpusFixture {
  const fixture = createPipelineCorpus().find((candidate) => candidate.id === id);

  if (fixture === undefined) {
    throw new Error(`Missing pipeline corpus fixture ${id}.`);
  }

  return fixture;
}

function requireFixture(
  fixture: PipelineCorpusFixture | undefined,
): PipelineCorpusFixture {
  if (fixture === undefined) {
    throw new Error("Missing byte-limit fixture.");
  }

  return fixture;
}

function expectPipelineSuccess(result: PipelineRunResult): PipelineSuccess {
  if (!result.ok) {
    throw new Error(`Pipeline failed with ${result.error.code}.`);
  }

  return result.value;
}

function renderRoot(success: PipelineSuccess): HTMLElement {
  const root = document.createElement("main");
  root.innerHTML = success.chunks.map((chunk) => chunk.html).join("\n");
  return root;
}

function renderText(success: PipelineSuccess): string {
  return renderRoot(success).textContent;
}

function expectLayoutCoversAllChunks(layout: SectionLayout, chunkCount: number): void {
  if (chunkCount === 0) {
    expect(layout.sections).toHaveLength(0);
    return;
  }

  expect(layout.sections[0]?.startChunkOrdinal).toBe(0);

  for (let index = 0; index < layout.sections.length; index += 1) {
    const current = layout.sections[index];

    if (current === undefined) {
      throw new Error("Missing layout section.");
    }

    expect(current.startChunkOrdinal).toBeLessThanOrEqual(current.endChunkOrdinalInclusive);

    const next = layout.sections[index + 1];

    if (next !== undefined) {
      expect(next.startChunkOrdinal).toBe(current.endChunkOrdinalInclusive + 1);
    }
  }

  expect(layout.sections.at(-1)?.endChunkOrdinalInclusive).toBe(chunkCount - 1);
}

function warningCount(success: PipelineSuccess, code: string): number {
  return success.metadata.warnings.find((warning) => warning.code === code)?.count ?? 0;
}
