import {
  countTopLevelMarkdownNodes,
  parseMarkdownForPipeline,
} from "@/domain/content/markdown-pipeline";
import { PIPELINE_LIMITS, PIPELINE_MARKER_PATTERN } from "@/domain/content/pipeline-limits";
import type { PipelineLimits } from "@/domain/content/pipeline-types";

export type PipelineCorpusFixtureId =
  | "byte-limit-at"
  | "byte-limit-below"
  | "byte-limit-above"
  | "huge-single-node"
  | "large"
  | "long-code"
  | "malicious"
  | "medium"
  | "no-headings"
  | "repeated-unicode-headings"
  | "single-long-line"
  | "small"
  | "wide-table";

export interface PipelineCorpusFixture {
  readonly id: PipelineCorpusFixtureId;
  readonly fileName: string;
  readonly description: string;
  readonly markdown: string;
  readonly expected: {
    readonly byteLength: number;
    readonly topLevelNodeCount: number;
    readonly markers: readonly string[];
  };
}

interface GeneratedDocumentOptions {
  readonly id: PipelineCorpusFixtureId;
  readonly fileName: string;
  readonly description: string;
  readonly sectionCount: number;
  readonly paragraphsPerSection: number;
  readonly seed: number;
}

const textEncoder = new TextEncoder();

export function createPipelineCorpus(
  limits: PipelineLimits = PIPELINE_LIMITS,
): readonly PipelineCorpusFixture[] {
  return [
    createSmallFixture(),
    createGeneratedDocument({
      id: "medium",
      fileName: "medium-generated.md",
      description: "Generated mixed headings, prose, code and tables.",
      sectionCount: 48,
      paragraphsPerSection: 3,
      seed: 12_345,
    }),
    createGeneratedDocument({
      id: "large",
      fileName: "large-generated.md",
      description: "Generated larger structure for spike wall-time and batching evidence.",
      sectionCount: 180,
      paragraphsPerSection: 4,
      seed: 98_765,
    }),
    createNoHeadingsFixture(),
    createRepeatedUnicodeHeadingsFixture(),
    createLongCodeFixture(limits),
    createSingleLongLineFixture(limits),
    createWideTableFixture(),
    createHugeSingleNodeFixture(limits),
    createMaliciousFixture(),
  ];
}

export function createByteLimitFixtures(
  limits: PipelineLimits = PIPELINE_LIMITS,
): readonly PipelineCorpusFixture[] {
  return [
    createByteSizedFixture("byte-limit-below", limits.maxFileBytes - 1),
    createByteSizedFixture("byte-limit-at", limits.maxFileBytes),
    createByteSizedFixture("byte-limit-above", limits.maxFileBytes + 1),
  ];
}

export function collectFixtureMarkers(value: string): readonly string[] {
  const markerPattern = new RegExp(PIPELINE_MARKER_PATTERN.source, "g");
  return [...value.matchAll(markerPattern)].map((match) => match[1] ?? "");
}

function createFixture(
  id: PipelineCorpusFixtureId,
  fileName: string,
  description: string,
  markdown: string,
): PipelineCorpusFixture {
  return {
    id,
    fileName,
    description,
    markdown,
    expected: {
      byteLength: textEncoder.encode(markdown).byteLength,
      topLevelNodeCount: countTopLevelMarkdownNodes(markdown),
      markers: collectFixtureMarkers(markdown),
    },
  };
}

function createSmallFixture(): PipelineCorpusFixture {
  const markdown = [
    "# Small Fixture [[MDR:SMALL_TITLE]]",
    "",
    "Intro paragraph with *emphasis*, **strong text**, a [safe link](https://example.com/docs), and [[MDR:SMALL_INTRO]].",
    "",
    "## Tasks [[MDR:SMALL_TASKS]]",
    "",
    "- [x] Checked item",
    "- [ ] Open item",
    "",
    "## Table [[MDR:SMALL_TABLE]]",
    "",
    "| Feature | State |",
    "| --- | --- |",
    "| CommonMark | ready |",
    "| GFM | measured |",
    "",
    "## Code [[MDR:SMALL_CODE]]",
    "",
    "```ts",
    "export const answer: number = 42;",
    "```",
    "",
    "Footnote reference.[^note]",
    "",
    "[^note]: Footnote body [[MDR:SMALL_FOOTNOTE]].",
    "",
  ].join("\n");

  return createFixture("small", "small-fixture.md", "CommonMark and GFM semantic fixture.", markdown);
}

function createGeneratedDocument(options: GeneratedDocumentOptions): PipelineCorpusFixture {
  const random = createSeededRandom(options.seed);
  const lines: string[] = [
    `# Generated ${options.id} [[MDR:${options.id.toUpperCase()}_TITLE]]`,
    "",
  ];

  for (let section = 0; section < options.sectionCount; section += 1) {
    const marker = `${options.id.toUpperCase()}_${section.toString().padStart(3, "0")}`;
    lines.push(`## Section ${String(section + 1)} [[MDR:${marker}]]`);
    lines.push("");

    for (let paragraph = 0; paragraph < options.paragraphsPerSection; paragraph += 1) {
      const weight = Math.floor(random() * 10_000);
      lines.push(
        `Paragraph ${String(paragraph + 1)} carries deterministic prose ${String(weight)} for chunking, links to [example](https://example.com/${String(section)}/${String(paragraph)}), and repeats enough words to exercise parser cost without using external content.`,
      );
      lines.push("");
    }

    if (section % 9 === 0) {
      const sectionText = String(section);
      lines.push("```js");
      lines.push(`const section${sectionText} = ${sectionText};`);
      lines.push(`console.log(section${sectionText});`);
      lines.push("```");
      lines.push("");
    }

    if (section % 13 === 0) {
      lines.push("| Column A | Column B | Column C |");
      lines.push("| --- | --- | --- |");
      lines.push(
        `| ${String(section)} | ${String(Math.floor(random() * 1_000))} | generated |`,
      );
      lines.push("");
    }
  }

  return createFixture(options.id, options.fileName, options.description, lines.join("\n"));
}

function createNoHeadingsFixture(): PipelineCorpusFixture {
  const markdown = [
    "Paragraph-only fixture [[MDR:NO_HEADINGS_START]] that forces cost-based sections.",
    "",
    "- List item one",
    "- List item two [[MDR:NO_HEADINGS_LIST]]",
    "",
    "> Quote block [[MDR:NO_HEADINGS_QUOTE]]",
    "",
  ].join("\n");

  return createFixture("no-headings", "no-headings.md", "No headings fallback fixture.", markdown);
}

function createRepeatedUnicodeHeadingsFixture(): PipelineCorpusFixture {
  const markdown = [
    "# Повтор [[MDR:UNICODE_H1_FIRST]]",
    "",
    "Text under first Russian heading.",
    "",
    "# Повтор [[MDR:UNICODE_H1_SECOND]]",
    "",
    "Text under second Russian heading.",
    "",
    "## Café Setup [[MDR:UNICODE_H2_FIRST]]",
    "",
    "Accent heading one.",
    "",
    "## Café Setup [[MDR:UNICODE_H2_SECOND]]",
    "",
    "Accent heading two after normalization.",
    "",
  ].join("\n");

  return createFixture(
    "repeated-unicode-headings",
    "unicode-headings.md",
    "Repeated Cyrillic and normalized accent headings.",
    markdown,
  );
}

function createLongCodeFixture(limits: PipelineLimits): PipelineCorpusFixture {
  const code = [
    "const prefix = 'long-code';",
    "const payload = [",
    ...Array.from({ length: Math.ceil(limits.maxCodeHighlightChars / 40) + 8 }, (_, index) => {
      return `  'line-${index.toString().padStart(4, "0")}-${"x".repeat(28)}',`;
    }),
    "];",
  ].join("\n");
  const markdown = [
    "# Long code [[MDR:LONG_CODE_TITLE]]",
    "",
    "```ts",
    code,
    "```",
    "",
  ].join("\n");

  return createFixture("long-code", "long-code.md", "Code fence above highlight threshold.", markdown);
}

function createSingleLongLineFixture(limits: PipelineLimits): PipelineCorpusFixture {
  const markdown = [
    "# Single long line [[MDR:SINGLE_LONG_LINE_TITLE]]",
    "",
    `${"A".repeat(limits.oversizedNodeCost + 256)} [[MDR:SINGLE_LONG_LINE_BODY]]`,
    "",
  ].join("\n");

  return createFixture(
    "single-long-line",
    "single-long-line.md",
    "One paragraph line above oversized-node cost.",
    markdown,
  );
}

function createWideTableFixture(): PipelineCorpusFixture {
  const columns = Array.from({ length: 24 }, (_, index) => `C${String(index + 1)}`);
  const separator = columns.map(() => "---");
  const rows = Array.from({ length: 8 }, (_, rowIndex) =>
    columns.map((column, columnIndex) => `${column}-${String(rowIndex + columnIndex)}`),
  );
  const markdown = [
    "# Wide table [[MDR:WIDE_TABLE_TITLE]]",
    "",
    `| ${columns.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
  ].join("\n");

  return createFixture("wide-table", "wide-table.md", "Wide GFM table fixture.", markdown);
}

function createHugeSingleNodeFixture(limits: PipelineLimits): PipelineCorpusFixture {
  const markdown = [
    "# Huge node [[MDR:HUGE_NODE_TITLE]]",
    "",
    `${"Huge paragraph sentence. ".repeat(Math.ceil(limits.oversizedNodeCost / 24) + 40)}[[MDR:HUGE_NODE_BODY]]`,
    "",
  ].join("\n");

  return createFixture("huge-single-node", "huge-node.md", "Oversized paragraph fallback candidate.", markdown);
}

function createMaliciousFixture(): PipelineCorpusFixture {
  const safePng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lpYz9wAAAABJRU5ErkJggg==";
  const markdown = [
    "# Security fixture [[MDR:SECURITY_TITLE]]",
    "",
    "<script>alert('raw-script')</script>",
    "",
    "<style>body{background:red}</style>",
    "",
    "<iframe srcdoc=\"<script>alert(1)</script>\"></iframe>",
    "",
    "<a id=\"location\" name=\"constructor\" style=\"color:red\" onclick=\"alert(1)\" href=\"javascript:alert(1)\">raw link</a>",
    "",
    "[javascript link](javascript:alert(1)) [[MDR:SECURITY_JS_LINK]]",
    "",
    "[encoded protocol](java&#x73;cript:alert(1))",
    "",
    "[safe https](https://example.com/safe?token=redacted)",
    "",
    "![relative](./relative.png)",
    "",
    "![http](http://example.com/plain.png)",
    "",
    "![svg data](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+)",
    "",
    `![safe data](${safePng})`,
    "",
    "![safe https](https://example.com/image.png)",
    "",
    "<object data=\"https://example.com/embed\"></object>",
    "",
    "End marker [[MDR:SECURITY_END]].",
    "",
  ].join("\n");

  return createFixture("malicious", "malicious.md", "Raw HTML, URL and image threat corpus.", markdown);
}

function createByteSizedFixture(
  id: "byte-limit-at" | "byte-limit-below" | "byte-limit-above",
  byteLength: number,
): PipelineCorpusFixture {
  const prefix = `# Byte limit ${id} [[MDR:${id.toUpperCase().replaceAll("-", "_")}]]\n\n`;
  const prefixBytes = textEncoder.encode(prefix).byteLength;
  const markdown = `${prefix}${"x".repeat(Math.max(0, byteLength - prefixBytes))}`;

  return createFixture(
    id,
    `${id}.md`,
    `Fixture with exactly ${String(byteLength)} UTF-8 bytes.`,
    markdown,
  );
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = Math.imul(state, 1_664_525) + 1_013_904_223;
    return (state >>> 0) / 4_294_967_296;
  };
}

export function parsedTopLevelTypes(fixture: PipelineCorpusFixture): readonly string[] {
  return parseMarkdownForPipeline(fixture.markdown).children.map((node) => node.type);
}
