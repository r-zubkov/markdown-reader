import type {
  ReaderBlockAnchorSnapshot,
  SemanticAnchorSnapshot,
} from "@/application/ports/document-repository";

export const READER_LOCATION_LINE_PX = 72;
export const FINAL_BLOCK_COMPLETION_RATIO = 0.9;

export interface ObservedLocation {
  readonly anchor: SemanticAnchorSnapshot;
  readonly chunkOrdinal: number;
  readonly progressRatio: number;
  readonly lastSectionId?: string;
}

export type ReaderAnchorResolver = (
  chunkOrdinal: number,
  blockIndex: number,
) => { readonly block: ReaderBlockAnchorSnapshot; readonly isFinalBlock: boolean } | undefined;

/** Adds observation-only metadata after safe HTML has crossed the render boundary. */
export function markMeaningfulBlocks(
  content: HTMLElement,
  anchors: readonly ReaderBlockAnchorSnapshot[],
): void {
  const nodes = [...content.childNodes].filter(
    (node) => node instanceof HTMLElement || node.textContent?.trim().length !== 0,
  );

  for (const [index, anchor] of anchors.entries()) {
    const node = nodes[index];
    if (node === undefined) break;
    const element = node instanceof HTMLElement ? node : wrapTextNode(node);
    element.dataset.readerBlockIndex = String(index);
    element.dataset.readerBlockId = anchor.anchor.blockId;
  }
}

export function observeTopMeaningfulLocation(input: {
  readonly root: HTMLElement;
  readonly resolveAnchor: ReaderAnchorResolver;
  readonly line?: number;
  readonly pageEndReached?: boolean;
  readonly lastSectionId?: string;
}): ObservedLocation | undefined {
  const line = input.line ?? READER_LOCATION_LINE_PX;
  const candidate = [...input.root.querySelectorAll<HTMLElement>("[data-reader-block-index]")]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.bottom > line)
    .sort((left, right) => left.rect.top - right.rect.top)[0];
  if (candidate === undefined) return undefined;

  const chunkElement = candidate.element.closest<HTMLElement>("[data-reader-ordinal]");
  const chunkOrdinal = Number(chunkElement?.dataset.readerOrdinal);
  const blockIndex = Number(candidate.element.dataset.readerBlockIndex);
  if (!Number.isInteger(chunkOrdinal) || !Number.isInteger(blockIndex)) return undefined;
  const resolved = input.resolveAnchor(chunkOrdinal, blockIndex);
  if (resolved === undefined) return undefined;

  const height = Math.max(1, candidate.rect.height);
  const intraBlockRatio = clampRatio((line - candidate.rect.top) / height);
  const measuredProgress = clampRatio(
    resolved.block.sourceStartRatio +
      intraBlockRatio * (resolved.block.sourceEndRatio - resolved.block.sourceStartRatio),
  );
  const progressRatio = resolved.isFinalBlock &&
    (intraBlockRatio >= FINAL_BLOCK_COMPLETION_RATIO || input.pageEndReached === true)
    ? 1
    : measuredProgress;
  const anchor: SemanticAnchorSnapshot = {
    ...resolved.block.anchor,
    intraBlockRatio,
    overallSourceRatio: progressRatio,
  };
  return {
    anchor,
    chunkOrdinal,
    progressRatio,
    ...(input.lastSectionId === undefined ? {} : { lastSectionId: input.lastSectionId }),
  };
}

export function isPageEndReached(): boolean {
  return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
}

function wrapTextNode(node: ChildNode): HTMLElement {
  const wrapper = document.createElement("span");
  node.before(wrapper);
  wrapper.append(node);
  return wrapper;
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
