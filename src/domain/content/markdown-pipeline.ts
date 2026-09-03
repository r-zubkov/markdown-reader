import type {
  Element,
  ElementContent,
  Nodes as HastNode,
  Properties,
  Root as HastRoot,
  RootContent as HastRootContent,
} from "hast";
import { common, createLowlight } from "lowlight";
import { toString as mdastToString } from "mdast-util-to-string";
import type {
  Definition,
  Heading,
  Image,
  Parents as MdastParent,
  Root as MdastRoot,
  RootContent as MdastRootContent,
} from "mdast";
import rehypeSanitize, { type Options as RehypeSanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import {
  FOOTNOTE_ID_PREFIX,
  HEADING_ID_PREFIX,
  PIPELINE_LIMITS,
  PIPELINE_SUPPORTED_LANGUAGES,
  PIPELINE_VERSION,
} from "./pipeline-limits";
import type {
  AutoDetectPreview,
  BlockAnchor,
  ChunkDiagnosticCode,
  OutlineItem,
  PersistablePipelineChunk,
  PipelineChunkBatch,
  PipelineFailure,
  PipelineLimits,
  PipelineRunResult,
  PipelineStageTimings,
  PipelineWarning,
  PipelineWarningCode,
  SectionLayout,
  SectionRef,
  SplitStrategy,
} from "./pipeline-types";

interface WarningCounter {
  readonly increment: (code: PipelineWarningCode) => void;
  readonly toArray: () => readonly PipelineWarning[];
}

interface HeadingRecord {
  readonly id: string;
  readonly level: 1 | 2 | 3;
  readonly text: string;
  readonly pathKey: string;
  readonly sourceStart: number;
  chunkOrdinal: number;
  readonly childIds: string[];
}

interface TopLevelBlock {
  readonly ordinal: number;
  readonly node: MdastRootContent;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly estimatedCost: number;
  readonly headingIds: readonly string[];
  readonly blockAnchor: BlockAnchor;
  readonly firstHeading?: HeadingRecord;
  readonly oversized: boolean;
}

interface ChunkPlan {
  readonly ordinal: number;
  readonly blocks: readonly TopLevelBlock[];
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly estimatedCost: number;
  readonly headingIds: readonly string[];
  readonly blockAnchors: readonly BlockAnchor[];
  readonly firstHeading?: HeadingRecord;
  readonly oversized: boolean;
}

const markdownParser = unified().use(remarkParse).use(remarkGfm);

const mdastToHastProcessor = unified().use(remarkRehype, {
  allowDangerousHtml: false,
  clobberPrefix: FOOTNOTE_ID_PREFIX,
  footnoteBackLabel(referenceIndex: number, rereferenceIndex: number) {
    const note = referenceIndex + 1;
    const repeated =
      rereferenceIndex > 0 ? `, ссылка ${String(rereferenceIndex + 1)}` : "";
    return `Вернуться к сноске ${String(note)}${repeated}`;
  },
  footnoteLabel: "Сноски",
  footnoteLabelProperties: {
    className: ["sr-only"],
    id: `${FOOTNOTE_ID_PREFIX}label`,
  },
});

const hastSanitizeProcessor = unified().use(rehypeSanitize, createSanitizeSchema());
const hastStringifyProcessor = unified().use(rehypeStringify);
const lowlight = createLowlight(common);
const supportedLanguageSet = new Set<string>(PIPELINE_SUPPORTED_LANGUAGES);

const languageAliases: Readonly<Record<string, string>> = {
  "c#": "csharp",
  "c++": "cpp",
  cc: "cpp",
  cjs: "javascript",
  conf: "ini",
  cs: "csharp",
  cxx: "cpp",
  gql: "graphql",
  h: "c",
  hpp: "cpp",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  kt: "kotlin",
  kts: "kotlin",
  make: "makefile",
  mak: "makefile",
  mjs: "javascript",
  mk: "makefile",
  md: "markdown",
  mdx: "markdown",
  mm: "objectivec",
  objc: "objectivec",
  "obj-c": "objectivec",
  pl: "perl",
  pm: "perl",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sass: "scss",
  sh: "bash",
  shellsession: "shell",
  ts: "typescript",
  tsx: "typescript",
  text: "plaintext",
  toml: "ini",
  txt: "plaintext",
  yml: "yaml",
  zsh: "bash",
};

export function parseMarkdownForPipeline(markdown: string): MdastRoot {
  return markdownParser.parse(markdown);
}

export function countTopLevelMarkdownNodes(markdown: string): number {
  return parseMarkdownForPipeline(markdown).children.length;
}

export async function runMarkdownPipeline(
  bytes: Uint8Array,
  fileName: string,
  limits: PipelineLimits = PIPELINE_LIMITS,
): Promise<PipelineRunResult> {
  const startedAt = performanceNow();
  const decodeStartedAt = performanceNow();
  const decoded = decodeUtf8(bytes, limits);
  const decodeMs = performanceNow() - decodeStartedAt;

  if (!decoded.ok) {
    return decoded;
  }

  const hashStartedAt = performanceNow();
  const contentHash = await sha256Hex(bytes);
  const hashMs = performanceNow() - hashStartedAt;
  const parseStartedAt = performanceNow();
  const mdast = parseMarkdownForPipeline(decoded.value);
  const parseMs = performanceNow() - parseStartedAt;
  const metadataStartedAt = performanceNow();
  const warningCounter = createWarningCounter();
  const headingRecords = annotateHeadingRecords(mdast);
  const rawSafeMdast = neutralizeRawHtml(mdast, warningCounter);
  annotateImageProperties(rawSafeMdast);
  const nonRenderingDefinitions = collectNonRenderingDefinitions(rawSafeMdast);
  const blocks = buildTopLevelBlocks(rawSafeMdast, decoded.value, headingRecords, limits);
  const metadataMs = performanceNow() - metadataStartedAt;
  const partitionStartedAt = performanceNow();
  const chunkPlans = partitionBlocks(blocks, limits);
  const partitionMs = performanceNow() - partitionStartedAt;
  const renderStartedAt = performanceNow();
  const chunks = chunkPlans.map((plan) =>
    renderChunk(plan, nonRenderingDefinitions, warningCounter, limits),
  );
  const renderMs = performanceNow() - renderStartedAt;
  const layoutStartedAt = performanceNow();
  const layouts = buildLayouts(chunkPlans, limits);
  const outline = buildOutline(headingRecords);
  const title = chooseTitle(outline, fileName);

  for (const record of headingRecords) {
    record.chunkOrdinal = findChunkOrdinalForSourceStart(chunkPlans, record.sourceStart);
  }

  const orderedOutline = buildOutline(headingRecords);
  const layoutMs = performanceNow() - layoutStartedAt;
  const batchStartedAt = performanceNow();
  const batches = batchChunks(chunks, limits);
  const batchMs = performanceNow() - batchStartedAt;
  const timings: PipelineStageTimings = {
    decodeMs,
    hashMs,
    parseMs,
    metadataMs,
    partitionMs,
    renderMs,
    layoutMs,
    batchMs,
    totalMs: performanceNow() - startedAt,
  };

  return {
    ok: true,
    value: {
      metadata: {
        contentHash,
        byteLength: bytes.byteLength,
        charLength: decoded.value.length,
        title,
        outline: orderedOutline,
        layouts,
        chunkCount: chunks.length,
        warnings: warningCounter.toArray(),
      },
      chunks,
      batches,
      timings,
    },
  };
}

export async function runMarkdownPipelineFromText(
  markdown: string,
  fileName = "fixture.md",
  limits: PipelineLimits = PIPELINE_LIMITS,
): Promise<PipelineRunResult> {
  return runMarkdownPipeline(new TextEncoder().encode(markdown), fileName, limits);
}

export function batchChunks(
  chunks: readonly PersistablePipelineChunk[],
  limits: PipelineLimits,
): readonly PipelineChunkBatch[] {
  const batches: PipelineChunkBatch[] = [];
  let current: PersistablePipelineChunk[] = [];
  let currentHtmlBytes = 0;

  for (const chunk of chunks) {
    const htmlBytes = utf8ByteLength(chunk.html);
    const exceedsChunkCount = current.length >= limits.batchMaxChunks;
    const exceedsBytes =
      current.length > 0 && currentHtmlBytes + htmlBytes > limits.batchMaxHtmlBytes;

    if (exceedsChunkCount || exceedsBytes) {
      batches.push({
        batchOrdinal: batches.length,
        chunks: current,
        htmlBytes: currentHtmlBytes,
      });
      current = [];
      currentHtmlBytes = 0;
    }

    current.push(chunk);
    currentHtmlBytes += htmlBytes;
  }

  if (current.length > 0) {
    batches.push({
      batchOrdinal: batches.length,
      chunks: current,
      htmlBytes: currentHtmlBytes,
    });
  }

  return batches;
}

export function previewAutoDetect(
  code: string,
  limits: PipelineLimits = PIPELINE_LIMITS,
): AutoDetectPreview {
  const started = performanceNow();

  if (code.length > limits.maxAutoDetectChars || limits.maxAutoDetectChars === 0) {
    return {
      accepted: false,
      relevance: 0,
      elapsedMs: performanceNow() - started,
    };
  }

  const highlighted = lowlight.highlightAuto(code, {
    prefix: "hljs-",
    subset: PIPELINE_SUPPORTED_LANGUAGES,
  });
  const language =
    typeof highlighted.data?.language === "string" ? highlighted.data.language : undefined;
  const relevance =
    typeof highlighted.data?.relevance === "number" ? highlighted.data.relevance : 0;

  if (language === undefined || relevance < limits.autoDetectMinRelevance) {
    const elapsedMs = performanceNow() - started;

    return {
      accepted: false,
      relevance,
      elapsedMs,
      ...(language === undefined ? {} : { language }),
    };
  }

  return {
    accepted: true,
    language,
    relevance,
    elapsedMs: performanceNow() - started,
  };
}

function decodeUtf8(
  bytes: Uint8Array,
  limits: PipelineLimits,
):
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: PipelineFailure } {
  if (bytes.byteLength > limits.maxFileBytes) {
    return {
      ok: false,
      error: {
        code: "FILE_TOO_LARGE",
        limit: limits.maxFileBytes,
        actual: bytes.byteLength,
      },
    };
  }

  try {
    return {
      ok: true,
      value: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return {
      ok: false,
      error: { code: "INVALID_UTF8" },
    };
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function annotateHeadingRecords(root: MdastRoot): HeadingRecord[] {
  const records: HeadingRecord[] = [];
  const slugOccurrences = new Map<string, number>();
  const pathOccurrences = new Map<string, number>();
  const activePath = new Map<1 | 2 | 3, string>();
  const lastRecordAtLevel = new Map<1 | 2 | 3, HeadingRecord>();

  visit(root, "heading", (node) => {
    const text = normalizeDisplayText(mdastToString(node));
    const slugBase = slugify(text);
    const occurrence = incrementMap(slugOccurrences, slugBase);
    const id = `${HEADING_ID_PREFIX}${slugBase}-${String(occurrence)}`;
    const sourceStart = positionStart(node);
    const level = node.depth;

    setHeadingId(node, id);

    if (!isOutlineDepth(level)) {
      return;
    }

    for (const key of [1, 2, 3] as const) {
      if (key >= level) {
        activePath.delete(key);
        lastRecordAtLevel.delete(key);
      }
    }

    const pathPartBase = `${String(level)}:${slugBase}`;
    const pathOccurrence = incrementMap(pathOccurrences, pathPartBase);
    activePath.set(level, `${pathPartBase}[${String(pathOccurrence)}]`);
    const parentLevel = level === 1 ? undefined : findNearestParentLevel(activePath, level);
    const parent = parentLevel === undefined ? undefined : lastRecordAtLevel.get(parentLevel);
    const pathKey = orderedPath(activePath);

    const record: HeadingRecord = {
      id,
      level,
      text,
      pathKey,
      sourceStart,
      chunkOrdinal: 0,
      childIds: [],
    };

    if (parent !== undefined) {
      parent.childIds.push(id);
    }

    lastRecordAtLevel.set(level, record);
    records.push(record);
  });

  return records;
}

function buildOutline(records: readonly HeadingRecord[]): readonly OutlineItem[] {
  return records.map((record) => ({
    id: record.id,
    level: record.level,
    text: record.text,
    pathKey: record.pathKey,
    sourceStart: record.sourceStart,
    chunkOrdinal: record.chunkOrdinal,
    childIds: [...record.childIds],
  }));
}

function buildTopLevelBlocks(
  root: MdastRoot,
  source: string,
  headingRecords: readonly HeadingRecord[],
  limits: PipelineLimits,
): readonly TopLevelBlock[] {
  const headingByStart = new Map<number, HeadingRecord>();

  for (const heading of headingRecords) {
    headingByStart.set(heading.sourceStart, heading);
  }

  const blocks: TopLevelBlock[] = [];
  let activeHeadingPath = "root";
  let blockOrdinalWithinHeading = 0;

  for (const [ordinal, node] of root.children.entries()) {
    const sourceStart = positionStart(node);
    const sourceEnd = positionEnd(node, source.length);
    const firstHeading = headingByStart.get(sourceStart);

    if (firstHeading !== undefined) {
      activeHeadingPath = firstHeading.pathKey;
      blockOrdinalWithinHeading = 0;
    }

    const estimatedCost = estimateNodeCost(node, source);
    const headingIds = collectHeadingIds(node);
    const blockAnchor: BlockAnchor = {
      blockId: createBlockId(node.type, ordinal, sourceStart, sourceEnd),
      headingPathKey: activeHeadingPath,
      blockOrdinalWithinHeading,
      sourceStart,
      sourceEnd,
    };

    blocks.push({
      ordinal,
      node,
      sourceStart,
      sourceEnd,
      estimatedCost,
      headingIds,
      blockAnchor,
      oversized: estimatedCost > limits.oversizedNodeCost,
      ...(firstHeading === undefined ? {} : { firstHeading }),
    });

    blockOrdinalWithinHeading += 1;
  }

  return blocks;
}

function partitionBlocks(
  blocks: readonly TopLevelBlock[],
  limits: PipelineLimits,
): readonly ChunkPlan[] {
  const chunks: ChunkPlan[] = [];
  let current: TopLevelBlock[] = [];
  let currentCost = 0;

  for (const block of blocks) {
    const startsHardSection = block.firstHeading?.level === 1 || block.firstHeading?.level === 2;
    const exceedsTarget =
      current.length > 0 && currentCost + block.estimatedCost > limits.targetChunkCost;

    if (current.length > 0 && (startsHardSection || exceedsTarget)) {
      chunks.push(createChunkPlan(chunks.length, current));
      current = [];
      currentCost = 0;
    }

    current.push(block);
    currentCost += block.estimatedCost;

    if (block.oversized) {
      chunks.push(createChunkPlan(chunks.length, current));
      current = [];
      currentCost = 0;
    }
  }

  if (current.length > 0) {
    chunks.push(createChunkPlan(chunks.length, current));
  }

  return chunks;
}

function createChunkPlan(ordinal: number, blocks: readonly TopLevelBlock[]): ChunkPlan {
  const sourceStart = Math.min(...blocks.map((block) => block.sourceStart));
  const sourceEnd = Math.max(...blocks.map((block) => block.sourceEnd));
  const estimatedCost = blocks.reduce((total, block) => total + block.estimatedCost, 0);
  const headingIds = blocks.flatMap((block) => block.headingIds);
  const blockAnchors = blocks.map((block) => block.blockAnchor);
  const firstHeading = blocks.find((block) => block.firstHeading !== undefined)?.firstHeading;
  const oversized = blocks.some((block) => block.oversized);

  return {
    ordinal,
    blocks,
    sourceStart,
    sourceEnd,
    estimatedCost,
    headingIds,
    blockAnchors,
    oversized,
    ...(firstHeading === undefined ? {} : { firstHeading }),
  };
}

function renderChunk(
  plan: ChunkPlan,
  nonRenderingDefinitions: readonly Definition[],
  warnings: WarningCounter,
  limits: PipelineLimits,
): PersistablePipelineChunk {
  if (plan.oversized) {
    warnings.increment("OVERSIZED_NODE");
  }

  const chunkRoot: MdastRoot = {
    type: "root",
    children: [...nonRenderingDefinitions, ...plan.blocks.map((block) => block.node)],
  };
  const hast = mdastToHastProcessor.runSync(chunkRoot);

  applyUrlPolicy(hast, warnings, limits);
  const highlightDiagnostic = applyHighlightPolicy(hast, warnings, limits);
  const sanitized = hastSanitizeProcessor.runSync(hast);
  const html = hastStringifyProcessor.stringify(sanitized);
  const diagnosticCode = chooseChunkDiagnostic(plan, highlightDiagnostic);

  return {
    ordinal: plan.ordinal,
    html,
    pipelineVersion: PIPELINE_VERSION,
    sourceStart: plan.sourceStart,
    sourceEnd: plan.sourceEnd,
    estimatedCost: plan.estimatedCost,
    headingIds: plan.headingIds,
    blockAnchors: plan.blockAnchors,
    renderState: diagnosticCode === undefined ? "ready" : "safe-fallback",
    ...(diagnosticCode === undefined ? {} : { diagnosticCode }),
  };
}

function chooseChunkDiagnostic(
  plan: ChunkPlan,
  highlightDiagnostic: ChunkDiagnosticCode | undefined,
): ChunkDiagnosticCode | undefined {
  if (plan.oversized) {
    return "OVERSIZED_NODE";
  }

  return highlightDiagnostic;
}

function applyUrlPolicy(
  root: HastRoot,
  warnings: WarningCounter,
  limits: PipelineLimits,
): void {
  walkHast(root, (node) => {
    if (!isElement(node)) {
      return;
    }

    if (node.tagName === "a") {
      applyLinkPolicy(node, warnings);
      return;
    }

    if (node.tagName === "img") {
      applyImagePolicy(node, warnings, limits);
    }
  });
}

function applyLinkPolicy(element: Element, warnings: WarningCounter): void {
  const href = getPropertyString(element.properties, "href");

  if (href === undefined) {
    return;
  }

  const policy = classifyLinkHref(href);

  if (!policy.allowed) {
    const remaining = { ...element.properties };
    delete remaining.href;
    delete remaining.rel;
    delete remaining.target;
    element.properties = {
      ...remaining,
      dataMdrBlockedUrl: "true",
    };
    warnings.increment("UNSAFE_URL_BLOCKED");
    return;
  }

  if (policy.external) {
    element.properties = {
      ...element.properties,
      href: policy.href,
      rel: ["noopener", "noreferrer"],
      target: "_blank",
    };
  } else {
    element.properties = {
      ...element.properties,
      href: policy.href,
    };
  }
}

function applyImagePolicy(
  element: Element,
  warnings: WarningCounter,
  limits: PipelineLimits,
): void {
  const src = getPropertyString(element.properties, "src");

  if (src !== undefined && isAllowedImageSrc(src, limits)) {
    element.properties = {
      ...element.properties,
      decoding: "async",
      loading: "lazy",
      referrerPolicy: "no-referrer",
      src,
    };
    return;
  }

  warnings.increment("UNSUPPORTED_IMAGE");

  element.tagName = "span";
  element.properties = {
    className: ["mdr-image-placeholder"],
    role: "note",
  };
  element.children = [
    {
      type: "text",
      value: "Неподдерживаемое изображение",
    },
  ];
}

function applyHighlightPolicy(
  root: HastRoot,
  warnings: WarningCounter,
  limits: PipelineLimits,
): ChunkDiagnosticCode | undefined {
  let diagnostic: ChunkDiagnosticCode | undefined;

  walkHast(root, (node) => {
    if (!isElement(node) || node.tagName !== "pre") {
      return;
    }

    const code = firstElementChild(node, "code");

    if (code === undefined) {
      return;
    }

    const source = textContent(code);
    const language = normalizeLanguageLabel(getLanguageClass(code.properties));

    if (source.length > limits.maxCodeHighlightChars) {
      code.properties = { className: ["language-plaintext"] };
      warnings.increment("CODE_HIGHLIGHT_SKIPPED");
      diagnostic = diagnostic ?? "HIGHLIGHT_FAILED";
      return;
    }

    if (language === undefined) {
      const detected = previewAutoDetect(source, limits);

      if (detected.accepted && detected.language !== undefined) {
        replaceCodeWithHighlighted(code, detected.language, source, warnings);
      } else {
        code.properties = { className: ["language-plaintext"] };
        warnings.increment("AUTO_DETECT_LOW_CONFIDENCE");
      }

      return;
    }

    replaceCodeWithHighlighted(code, language, source, warnings);
  });

  return diagnostic;
}

function replaceCodeWithHighlighted(
  code: Element,
  language: string,
  source: string,
  warnings: WarningCounter,
): void {
  try {
    const highlighted = lowlight.highlight(language, source, { prefix: "hljs-" });
    code.properties = {
      className: ["hljs", `language-${language}`],
    };
    code.children = filterElementChildren(highlighted.children);
  } catch {
    code.properties = { className: ["language-plaintext"] };
    code.children = [{ type: "text", value: source }];
    warnings.increment("HIGHLIGHT_FAILED");
  }
}

function createSanitizeSchema(): RehypeSanitizeSchema {
  return {
    allowComments: false,
    allowDoctypes: false,
    ancestors: {
      tbody: ["table"],
      td: ["table"],
      th: ["table"],
      thead: ["table"],
      tr: ["table"],
    },
    attributes: {
      a: [
        "ariaDescribedBy",
        "ariaLabel",
        "dataFootnoteBackref",
        "dataFootnoteRef",
        ["className", "data-footnote-backref"],
        ["href", /^#mdr-/, /^https?:\/\//, /^mailto:/],
        ["id", /^mdr-/],
        ["rel", "noopener", "noreferrer"],
        ["target", "_blank"],
      ],
      code: [["className", "hljs", /^language-[a-z0-9-]+$/]],
      h1: [["id", /^mdr-/]],
      h2: [
        ["className", "sr-only"],
        ["id", /^mdr-/],
      ],
      h3: [["id", /^mdr-/]],
      h4: [["id", /^mdr-/]],
      h5: [["id", /^mdr-/]],
      h6: [["id", /^mdr-/]],
      img: [
        "alt",
        ["decoding", "async"],
        ["loading", "lazy"],
        ["referrerPolicy", "no-referrer"],
        ["src", /^https:\/\//, /^data:image\/(?:png|jpeg|gif|webp|avif);base64,/],
      ],
      input: [
        ["checked", true],
        ["disabled", true],
        ["type", "checkbox"],
      ],
      li: [["className", "task-list-item"]],
      ol: [
        "ariaDescribedBy",
        "ariaLabel",
        ["className", "contains-task-list"],
      ],
      section: [
        "dataFootnotes",
        ["className", "footnotes"],
      ],
      span: [
        ["className", "mdr-image-placeholder", /^hljs(?:-[a-z0-9-]+)?$/],
        ["role", "note"],
      ],
      table: ["ariaDescribedBy", "ariaLabel"],
      th: ["align"],
      td: ["align"],
      ul: [
        "ariaDescribedBy",
        "ariaLabel",
        ["className", "contains-task-list"],
      ],
    },
    clobber: [],
    clobberPrefix: "",
    protocols: {
      href: ["http", "https", "mailto"],
      src: ["https", "data"],
    },
    required: {
      input: { disabled: true, type: "checkbox" },
    },
    strip: ["script", "style"],
    tagNames: [
      "a",
      "blockquote",
      "br",
      "code",
      "del",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "img",
      "input",
      "li",
      "ol",
      "p",
      "pre",
      "section",
      "span",
      "strong",
      "sup",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul",
    ],
  };
}

function buildLayouts(
  chunks: readonly ChunkPlan[],
  limits: PipelineLimits,
): Record<SplitStrategy, SectionLayout> {
  return {
    auto: buildAutoLayout(chunks, limits),
    h1: buildHeadingLayout("h1", chunks, 1, limits),
    h2: buildHeadingLayout("h2", chunks, 2, limits),
    whole: buildWholeLayout(chunks, limits),
  };
}

function buildWholeLayout(
  chunks: readonly ChunkPlan[],
  limits: PipelineLimits,
): SectionLayout {
  if (chunks.length === 0) {
    return {
      strategy: "whole",
      sectionIds: [],
      sections: [],
      safeForSelection: true,
    };
  }

  const estimatedCost = chunks.reduce((total, chunk) => total + chunk.estimatedCost, 0);
  const safeForSelection = estimatedCost <= limits.maxChunkCostBeforeFallback;

  return {
    strategy: "whole",
    sectionIds: ["whole-0"],
    sections: [
      {
        id: "whole-0",
        title: "Весь документ",
        startChunkOrdinal: 0,
        endChunkOrdinalInclusive: chunks.length - 1,
        estimatedCost,
      },
    ],
    safeForSelection,
    ...(safeForSelection ? {} : { unavailableReason: "DOM_BUDGET" }),
  };
}

function buildAutoLayout(
  chunks: readonly ChunkPlan[],
  limits: PipelineLimits,
): SectionLayout {
  const h1Layout = buildHeadingLayout("auto", chunks, 1, limits);
  const hasUsefulH1 = h1Layout.sections.some((section) => section.headingId !== undefined);

  if (hasUsefulH1 && h1Layout.sections.every((section) => section.estimatedCost <= limits.maxChunkCostBeforeFallback)) {
    return h1Layout;
  }

  const h2Layout = buildHeadingLayout("auto", chunks, 2, limits);
  const hasUsefulH2 = h2Layout.sections.some((section) => section.headingId !== undefined);

  if (hasUsefulH2) {
    return h2Layout;
  }

  return buildCostLayout("auto", chunks, limits);
}

function buildHeadingLayout(
  strategy: SplitStrategy,
  chunks: readonly ChunkPlan[],
  headingDepth: 1 | 2,
  limits: PipelineLimits,
): SectionLayout {
  if (chunks.length === 0) {
    return {
      strategy,
      sectionIds: [],
      sections: [],
      safeForSelection: true,
    };
  }

  const starts = new Set<number>([0]);

  for (const chunk of chunks) {
    const heading = chunk.firstHeading;

    if (heading !== undefined && heading.level <= headingDepth) {
      starts.add(chunk.ordinal);
    }
  }

  const orderedStarts = [...starts].sort((left, right) => left - right);

  if (orderedStarts.length === 1 && orderedStarts[0] === 0) {
    return buildCostLayout(strategy, chunks, limits);
  }

  const sections = orderedStarts.map((start, index): SectionRef => {
    const nextStart = orderedStarts[index + 1];
    const end = nextStart === undefined ? chunks.length - 1 : nextStart - 1;
    const range = chunks.slice(start, end + 1);
    const heading = chunks[start]?.firstHeading;
    const estimatedCost = range.reduce((total, chunk) => total + chunk.estimatedCost, 0);

    return {
        id: `${strategy}-section-${String(index)}`,
      startChunkOrdinal: start,
      endChunkOrdinalInclusive: end,
      estimatedCost,
      ...(heading === undefined ? {} : { headingId: heading.id, title: heading.text }),
    };
  });

  return createLayout(strategy, sections, limits);
}

function buildCostLayout(
  strategy: SplitStrategy,
  chunks: readonly ChunkPlan[],
  limits: PipelineLimits,
): SectionLayout {
  const sections: SectionRef[] = [];
  let start = 0;
  let cost = 0;

  for (const chunk of chunks) {
    if (chunk.ordinal > start && cost + chunk.estimatedCost > limits.maxChunkCostBeforeFallback) {
      sections.push({
        id: `${strategy}-section-${String(sections.length)}`,
        title: `Раздел ${String(sections.length + 1)}`,
        startChunkOrdinal: start,
        endChunkOrdinalInclusive: chunk.ordinal - 1,
        estimatedCost: cost,
      });
      start = chunk.ordinal;
      cost = 0;
    }

    cost += chunk.estimatedCost;
  }

  if (chunks.length > 0) {
    sections.push({
      id: `${strategy}-section-${String(sections.length)}`,
      title: `Раздел ${String(sections.length + 1)}`,
      startChunkOrdinal: start,
      endChunkOrdinalInclusive: chunks.length - 1,
      estimatedCost: cost,
    });
  }

  return createLayout(strategy, sections, limits);
}

function createLayout(
  strategy: SplitStrategy,
  sections: readonly SectionRef[],
  limits: PipelineLimits,
): SectionLayout {
  const unsafe = sections.some(
    (section) => section.estimatedCost > limits.maxChunkCostBeforeFallback,
  );

  return {
    strategy,
    sectionIds: sections.map((section) => section.id),
    sections,
    safeForSelection: !unsafe,
    ...(unsafe ? { unavailableReason: "OVERSIZED_NODE" } : {}),
  };
}

function neutralizeRawHtml(root: MdastRoot, warnings: WarningCounter): MdastRoot {
  const clone = structuredClone(root);
  neutralizeRawHtmlChildren(clone, warnings);
  return clone;
}

function neutralizeRawHtmlChildren(parent: MdastParent, warnings: WarningCounter): void {
  const children = getMutableChildren(parent);

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];

    if (!isObjectNode(child)) {
      continue;
    }

    if (child.type === "html") {
      warnings.increment("RAW_HTML_ESCAPED");
      children[index] =
        parent.type === "root"
          ? {
              type: "paragraph",
              position: child.position,
              children: [{ type: "text", value: literalValue(child), position: child.position }],
            }
          : { type: "text", value: literalValue(child), position: child.position };
      continue;
    }

    if (hasChildren(child)) {
      neutralizeRawHtmlChildren(child, warnings);
    }
  }
}

function collectNonRenderingDefinitions(root: MdastRoot): readonly Definition[] {
  return root.children.filter((node): node is Definition => node.type === "definition");
}

function walkHast(root: HastNode, visitor: (node: HastNode) => void): void {
  visitor(root);

  if (isElement(root) || root.type === "root") {
    for (const child of root.children) {
      walkHast(child, visitor);
    }
  }
}

function walkMdast(root: MdastRoot | MdastRootContent, visitor: (node: MdastRoot | MdastRootContent) => void): void {
  visitor(root);

  if (hasChildren(root)) {
    for (const child of root.children) {
      walkMdast(child, visitor);
    }
  }
}

function isHeading(node: MdastRoot | MdastRootContent): node is Heading {
  return node.type === "heading";
}

function isImage(node: MdastRoot | MdastRootContent): node is Image {
  return node.type === "image";
}

function isOutlineDepth(depth: Heading["depth"]): depth is 1 | 2 | 3 {
  return depth === 1 || depth === 2 || depth === 3;
}

function setHeadingId(node: Heading, id: string): void {
  node.data = {
    ...node.data,
    hProperties: {
      id,
    },
  };
}

function annotateImageProperties(root: MdastRoot): void {
  walkMdast(root, (node) => {
    if (!isImage(node)) {
      return;
    }

    const hProperties: Record<string, string> = {
      src: node.url,
    };

    if (typeof node.alt === "string") {
      hProperties.alt = node.alt;
    }

    if (typeof node.title === "string") {
      hProperties.title = node.title;
    }

    node.data = {
      ...node.data,
      hProperties,
    };
  });
}

function collectHeadingIds(node: MdastRootContent): readonly string[] {
  const ids: string[] = [];

  walkMdast(node, (child) => {
    if (!isHeading(child)) {
      return;
    }

    const hProperties = child.data?.hProperties;

    if (isRecord(hProperties) && typeof hProperties.id === "string") {
      ids.push(hProperties.id);
    }
  });

  return ids;
}

function firstElementChild(parent: Element, tagName: string): Element | undefined {
  return parent.children.find(
    (child): child is Element => isElement(child) && child.tagName === tagName,
  );
}

function textContent(node: HastNode): string {
  if (node.type === "text") {
    return node.value;
  }

  if (isElement(node) || node.type === "root") {
    return node.children.map((child) => textContent(child)).join("");
  }

  return "";
}

function filterElementChildren(children: readonly HastRootContent[]): ElementContent[] {
  return children.filter(
    (child): child is ElementContent => child.type !== "doctype",
  );
}

function getLanguageClass(properties: Properties): string | undefined {
  const className = properties.className;

  if (!Array.isArray(className)) {
    return undefined;
  }

  const languageClass = className.find((value) => {
    return typeof value === "string" && value.startsWith("language-");
  });

  return typeof languageClass === "string" ? languageClass : undefined;
}

function normalizeLanguageLabel(label: string | undefined): string | undefined {
  if (label === undefined) {
    return undefined;
  }

  const normalized = label
    .replace(/^language-/u, "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9#+.-]{1,32}$/u.test(normalized)) {
    return undefined;
  }

  const canonical = languageAliases[normalized] ?? normalized;
  return supportedLanguageSet.has(canonical) && lowlight.registered(canonical)
    ? canonical
    : undefined;
}

function classifyLinkHref(
  href: string,
):
  | { readonly allowed: true; readonly external: boolean; readonly href: string }
  | { readonly allowed: false } {
  const trimmed = href.trim();

  if (trimmed.length === 0 || containsControlCharacter(trimmed)) {
    return { allowed: false };
  }

  if (trimmed.startsWith("#")) {
    return {
      allowed: true,
      external: false,
      href: trimmed,
    };
  }

  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.toLowerCase();

    if (protocol === "http:" || protocol === "https:") {
      return {
        allowed: true,
        external: true,
        href: url.href,
      };
    }

    if (protocol === "mailto:") {
      return {
        allowed: true,
        external: false,
        href: url.href,
      };
    }
  } catch {
    return { allowed: false };
  }

  return { allowed: false };
}

function isAllowedImageSrc(src: string, limits: PipelineLimits): boolean {
  const trimmed = src.trim();

  if (containsControlCharacter(trimmed)) {
    return false;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol === "https:") {
      return true;
    }

    if (url.protocol === "data:") {
      return isAllowedDataImage(trimmed, limits);
    }
  } catch {
    return isAllowedDataImage(trimmed, limits);
  }

  return false;
}

function isAllowedDataImage(src: string, limits: PipelineLimits): boolean {
  const match = /^data:image\/(png|jpeg|gif|webp|avif);base64,([a-z0-9+/=]+)$/iu.exec(src);

  if (match === null) {
    return false;
  }

  const encoded = match[2];

  if (encoded === undefined) {
    return false;
  }

  return approximateBase64Bytes(encoded) <= limits.safeDataImageBytes;
}

function createWarningCounter(): WarningCounter {
  const counts = new Map<PipelineWarningCode, number>();

  return {
    increment(code) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    },
    toArray() {
      return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, count]) => ({ code, count }));
    },
  };
}

function findChunkOrdinalForSourceStart(
  chunks: readonly ChunkPlan[],
  sourceStart: number,
): number {
  const chunk = chunks.find(
    (candidate) =>
      candidate.sourceStart <= sourceStart && sourceStart <= candidate.sourceEnd,
  );

  return chunk?.ordinal ?? 0;
}

function chooseTitle(outline: readonly OutlineItem[], fileName: string): string {
  const firstH1 = outline.find((item) => item.level === 1);

  if (firstH1 !== undefined && firstH1.text.length > 0) {
    return firstH1.text;
  }

  return normalizeDisplayText(stripMarkdownExtension(fileName)) || "Untitled document";
}

function stripMarkdownExtension(fileName: string): string {
  const basename = fileName.split(/[\\/]/u).at(-1) ?? fileName;
  return basename.replace(/\.md$/iu, "");
}

function estimateNodeCost(node: MdastRootContent, source: string): number {
  const sourceStart = positionStart(node);
  const sourceEnd = positionEnd(node, source.length);
  const sourceCost = Math.max(1, sourceEnd - sourceStart);
  const descendants = countDescendants(node);
  const codeMultiplier = node.type === "code" ? 2 : 1;
  const tableMultiplier = node.type === "table" ? 2 : 1;

  return Math.ceil(sourceCost * codeMultiplier * tableMultiplier + descendants * 8);
}

function countDescendants(node: MdastRootContent): number {
  let count = 0;

  walkMdast(node, () => {
    count += 1;
  });

  return count;
}

function positionStart(node: { readonly position?: unknown }): number {
  const position = node.position;
  const start = isRecord(position) ? position.start : undefined;
  const offset = isRecord(start) ? start.offset : undefined;

  return typeof offset === "number" && Number.isSafeInteger(offset) && offset >= 0
    ? offset
    : 0;
}

function positionEnd(
  node: { readonly position?: unknown },
  fallback: number,
): number {
  const position = node.position;
  const end = isRecord(position) ? position.end : undefined;
  const offset = isRecord(end) ? end.offset : undefined;

  return typeof offset === "number" && Number.isSafeInteger(offset) && offset >= 0
    ? offset
    : fallback;
}

function createBlockId(
  type: string,
  ordinal: number,
  sourceStart: number,
  sourceEnd: number,
): string {
  return `mdr-b-${String(ordinal)}-${hashString(
    `${type}:${String(sourceStart)}:${String(sourceEnd)}`,
  )}`;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    hash ^= codePoint;
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function slugify(value: string): string {
  const normalized = value.normalize("NFKC").toLowerCase();
  const parts = normalized.match(/[\p{Letter}\p{Number}]+/gu) ?? [];
  return parts.join("-") || "heading";
}

function normalizeDisplayText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function orderedPath(activePath: ReadonlyMap<1 | 2 | 3, string>): string {
  return ([1, 2, 3] as const)
    .map((level) => activePath.get(level))
    .filter((part): part is string => part !== undefined)
    .join("/");
}

function findNearestParentLevel(
  activePath: ReadonlyMap<1 | 2 | 3, string>,
  level: 2 | 3,
): 1 | 2 | undefined {
  if (level === 3 && activePath.has(2)) {
    return 2;
  }

  if (activePath.has(1)) {
    return 1;
  }

  return undefined;
}

function incrementMap(map: Map<string, number>, key: string): number {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (
      codePoint !== undefined &&
      ((codePoint >= 0 && codePoint <= 31) || codePoint === 127)
    ) {
      return true;
    }
  }

  return false;
}

function approximateBase64Bytes(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function getPropertyString(properties: Properties, name: string): string | undefined {
  const value = properties[name];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function performanceNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function isElement(node: HastNode | HastRootContent): node is Element {
  return node.type === "element";
}

function isObjectNode(
  value: unknown,
): value is { readonly type: string; readonly position?: unknown; readonly value?: unknown } {
  return typeof value === "object" && value !== null && "type" in value;
}

function hasChildren(value: unknown): value is MdastParent {
  return (
    typeof value === "object" &&
    value !== null &&
    "children" in value &&
    Array.isArray((value as { readonly children?: unknown }).children)
  );
}

function getMutableChildren(parent: MdastParent): unknown[] {
  return parent.children as unknown[];
}

function literalValue(node: { readonly value?: unknown }): string {
  return typeof node.value === "string" ? node.value : "";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
