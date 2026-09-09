import type { BlockAnchor } from "@/domain/content/pipeline-types";

export type RestoreConfidence = "exact" | "approximate" | "none";

export interface SemanticAnchor {
  readonly versionId: string;
  readonly headingPathKey: string;
  readonly blockOrdinalWithinHeading: number;
  readonly blockId: string;
  readonly intraBlockRatio: number;
  readonly overallSourceRatio: number;
}

export interface MappingDocument {
  readonly versionId: string;
  readonly sourceLength: number;
  readonly blocks: readonly BlockAnchor[];
}

export const MAPPING_REASON_CODES = [
  "SAME_VERSION_BLOCK_ID",
  "SAME_VERSION_PATH_ORDINAL",
  "SAME_VERSION_NEAREST_HEADING",
  "CROSS_VERSION_CONTENT_FINGERPRINT",
  "CROSS_VERSION_PATH_ORDINAL",
  "CROSS_VERSION_ANCESTOR_ORDINAL",
  "OVERALL_SOURCE_RATIO",
  "NO_RELIABLE_MATCH",
  "TARGET_EMPTY",
] as const;

export type MappingReasonCode = (typeof MAPPING_REASON_CODES)[number];

export const MAPPING_REASON_CONFIDENCE = {
  SAME_VERSION_BLOCK_ID: "exact",
  SAME_VERSION_PATH_ORDINAL: "exact",
  SAME_VERSION_NEAREST_HEADING: "approximate",
  CROSS_VERSION_CONTENT_FINGERPRINT: "exact",
  CROSS_VERSION_PATH_ORDINAL: "approximate",
  CROSS_VERSION_ANCESTOR_ORDINAL: "approximate",
  OVERALL_SOURCE_RATIO: "approximate",
  NO_RELIABLE_MATCH: "none",
  TARGET_EMPTY: "none",
} as const satisfies Readonly<Record<MappingReasonCode, RestoreConfidence>>;

export const MIN_RATIO_FALLBACK_SIMILARITY = 0.2;

const sha256FingerprintPattern = /^[a-f0-9]{64}$/u;

export interface MappingResult {
  readonly confidence: RestoreConfidence;
  readonly reason: MappingReasonCode;
  readonly structuralSimilarity: number;
  readonly anchor?: SemanticAnchor;
}

export interface RestoreUiTrigger {
  readonly notice: "none" | "approximate" | "not-found";
  readonly announce: boolean;
  readonly actions: readonly ("continue" | "start")[];
}

export const RESTORE_UI_TRIGGER_MATRIX = {
  exact: {
    notice: "none",
    announce: false,
    actions: [],
  },
  approximate: {
    notice: "approximate",
    announce: true,
    actions: ["continue", "start"],
  },
  none: {
    notice: "not-found",
    announce: true,
    actions: ["start"],
  },
} as const satisfies Readonly<Record<RestoreConfidence, RestoreUiTrigger>>;

export function mapSemanticAnchor(
  savedAnchor: SemanticAnchor,
  sourceDocument: MappingDocument,
  targetDocument: MappingDocument,
): MappingResult {
  const targetBlocks = orderedUsableBlocks(targetDocument.blocks);
  const sourceBlocks = orderedUsableBlocks(sourceDocument.blocks);
  const sameVersion = savedAnchor.versionId === targetDocument.versionId;
  const structuralSimilarity = sameVersion
    ? 1
    : calculateStructuralSimilarity(sourceBlocks, targetBlocks);

  if (targetBlocks.length === 0) {
    return resultWithoutAnchor("TARGET_EMPTY", structuralSimilarity);
  }

  if (sameVersion) {
    const blockIdMatch = targetBlocks.find(
      (block) => block.blockId === savedAnchor.blockId,
    );

    if (blockIdMatch !== undefined) {
      return resultForBlock(
        "SAME_VERSION_BLOCK_ID",
        blockIdMatch,
        targetDocument,
        savedAnchor.intraBlockRatio,
        structuralSimilarity,
      );
    }

    const pathOrdinalMatch = findPathOrdinalMatch(savedAnchor, targetBlocks);

    if (pathOrdinalMatch !== undefined) {
      return resultForBlock(
        "SAME_VERSION_PATH_ORDINAL",
        pathOrdinalMatch,
        targetDocument,
        savedAnchor.intraBlockRatio,
        structuralSimilarity,
      );
    }

    const nearestHeadingMatch = findNearestHeadingMatch(
      savedAnchor,
      sourceBlocks,
      targetBlocks,
    );

    if (nearestHeadingMatch !== undefined) {
      return resultForBlock(
        "SAME_VERSION_NEAREST_HEADING",
        nearestHeadingMatch,
        targetDocument,
        savedAnchor.intraBlockRatio,
        structuralSimilarity,
      );
    }

    return ratioResult(savedAnchor, targetDocument, targetBlocks, structuralSimilarity);
  }

  const sourceBlock = findSourceBlock(savedAnchor, sourceDocument, sourceBlocks);
  const fingerprintMatch = findUniqueFingerprintMatch(
    sourceBlock,
    sourceBlocks,
    targetBlocks,
  );

  if (fingerprintMatch !== undefined) {
    return resultForBlock(
      "CROSS_VERSION_CONTENT_FINGERPRINT",
      fingerprintMatch,
      targetDocument,
      savedAnchor.intraBlockRatio,
      structuralSimilarity,
    );
  }

  const pathOrdinalMatch = findPathOrdinalMatch(savedAnchor, targetBlocks);
  const pathIsReliable =
    savedAnchor.headingPathKey !== "root" ||
    structuralSimilarity >= MIN_RATIO_FALLBACK_SIMILARITY;

  if (pathOrdinalMatch !== undefined && pathIsReliable) {
    return resultForBlock(
      "CROSS_VERSION_PATH_ORDINAL",
      pathOrdinalMatch,
      targetDocument,
      savedAnchor.intraBlockRatio,
      structuralSimilarity,
    );
  }

  const ancestorMatch = findNearestAncestorMatch(
    savedAnchor,
    sourceBlock,
    sourceBlocks,
    targetBlocks,
  );

  if (ancestorMatch !== undefined) {
    return resultForBlock(
      "CROSS_VERSION_ANCESTOR_ORDINAL",
      ancestorMatch,
      targetDocument,
      savedAnchor.intraBlockRatio,
      structuralSimilarity,
    );
  }

  if (structuralSimilarity >= MIN_RATIO_FALLBACK_SIMILARITY) {
    return ratioResult(savedAnchor, targetDocument, targetBlocks, structuralSimilarity);
  }

  return resultForBlock(
    "NO_RELIABLE_MATCH",
    firstBlock(targetBlocks),
    targetDocument,
    0,
    structuralSimilarity,
    0,
  );
}

export function calculateStructuralSimilarity(
  sourceBlocks: readonly BlockAnchor[],
  targetBlocks: readonly BlockAnchor[],
): number {
  const sourceSignals = collectStructuralSignals(sourceBlocks);
  const targetSignals = collectStructuralSignals(targetBlocks);

  if (sourceSignals.size === 0 || targetSignals.size === 0) {
    return 0;
  }

  let sharedSignals = 0;

  for (const signal of sourceSignals) {
    if (targetSignals.has(signal)) {
      sharedSignals += 1;
    }
  }

  return clampRatio((2 * sharedSignals) / (sourceSignals.size + targetSignals.size));
}

function findSourceBlock(
  savedAnchor: SemanticAnchor,
  sourceDocument: MappingDocument,
  sourceBlocks: readonly BlockAnchor[],
): BlockAnchor | undefined {
  if (sourceDocument.versionId !== savedAnchor.versionId) {
    return undefined;
  }

  return (
    sourceBlocks.find((block) => block.blockId === savedAnchor.blockId) ??
    findPathOrdinalMatch(savedAnchor, sourceBlocks)
  );
}

function findUniqueFingerprintMatch(
  sourceBlock: BlockAnchor | undefined,
  sourceBlocks: readonly BlockAnchor[],
  targetBlocks: readonly BlockAnchor[],
): BlockAnchor | undefined {
  if (
    sourceBlock === undefined ||
    !sha256FingerprintPattern.test(sourceBlock.contentFingerprint)
  ) {
    return undefined;
  }

  const sourceMatches = sourceBlocks.filter(
    (block) => block.contentFingerprint === sourceBlock.contentFingerprint,
  );
  const targetMatches = targetBlocks.filter(
    (block) =>
      sha256FingerprintPattern.test(block.contentFingerprint) &&
      block.contentFingerprint === sourceBlock.contentFingerprint,
  );

  if (sourceMatches.length !== 1 || targetMatches.length !== 1) {
    return undefined;
  }

  return targetMatches[0];
}

function findPathOrdinalMatch(
  savedAnchor: SemanticAnchor,
  blocks: readonly BlockAnchor[],
): BlockAnchor | undefined {
  return blocks.find(
    (block) =>
      block.headingPathKey === savedAnchor.headingPathKey &&
      block.blockOrdinalWithinHeading === savedAnchor.blockOrdinalWithinHeading,
  );
}

function findNearestHeadingMatch(
  savedAnchor: SemanticAnchor,
  sourceBlocks: readonly BlockAnchor[],
  targetBlocks: readonly BlockAnchor[],
): BlockAnchor | undefined {
  const samePathBlocks = targetBlocks.filter(
    (block) => block.headingPathKey === savedAnchor.headingPathKey,
  );

  if (samePathBlocks.length > 0) {
    return closestOrdinal(savedAnchor.blockOrdinalWithinHeading, samePathBlocks);
  }

  return findNearestAncestorMatch(
    savedAnchor,
    undefined,
    sourceBlocks,
    targetBlocks,
  );
}

function findNearestAncestorMatch(
  savedAnchor: SemanticAnchor,
  sourceBlock: BlockAnchor | undefined,
  sourceBlocks: readonly BlockAnchor[],
  targetBlocks: readonly BlockAnchor[],
): BlockAnchor | undefined {
  for (const ancestorPath of ancestorPaths(savedAnchor.headingPathKey)) {
    const targetSubtree = targetBlocks.filter((block) =>
      belongsToSubtree(block.headingPathKey, ancestorPath),
    );

    if (targetSubtree.length === 0) {
      continue;
    }

    if (sourceBlock !== undefined) {
      const sourceSubtree = sourceBlocks.filter((block) =>
        belongsToSubtree(block.headingPathKey, ancestorPath),
      );
      const sourceIndex = sourceSubtree.findIndex(
        (block) => block.blockId === sourceBlock.blockId,
      );

      if (sourceIndex >= 0) {
        const sourceDenominator = Math.max(1, sourceSubtree.length - 1);
        const targetIndex = Math.round(
          (sourceIndex / sourceDenominator) * Math.max(0, targetSubtree.length - 1),
        );
        return targetSubtree[targetIndex];
      }
    }

    return blockForRatio(savedAnchor.overallSourceRatio, targetSubtree, targetSubtree.at(-1)?.sourceEnd ?? 0)
      .block;
  }

  return undefined;
}

function ratioResult(
  savedAnchor: SemanticAnchor,
  targetDocument: MappingDocument,
  targetBlocks: readonly BlockAnchor[],
  structuralSimilarity: number,
): MappingResult {
  const ratioMatch = blockForRatio(
    savedAnchor.overallSourceRatio,
    targetBlocks,
    effectiveSourceLength(targetDocument, targetBlocks),
  );

  return resultForBlock(
    "OVERALL_SOURCE_RATIO",
    ratioMatch.block,
    targetDocument,
    ratioMatch.intraBlockRatio,
    structuralSimilarity,
    clampRatio(savedAnchor.overallSourceRatio),
  );
}

function blockForRatio(
  ratio: number,
  blocks: readonly BlockAnchor[],
  sourceLength: number,
): { readonly block: BlockAnchor; readonly intraBlockRatio: number } {
  const safeRatio = clampRatio(ratio);
  const targetPosition = safeRatio * Math.max(0, sourceLength);
  const containingBlock = blocks.find(
    (block) => block.sourceStart <= targetPosition && targetPosition <= block.sourceEnd,
  );
  const block = containingBlock ?? closestBlockToPosition(targetPosition, blocks);
  const blockLength = Math.max(1, block.sourceEnd - block.sourceStart);

  return {
    block,
    intraBlockRatio: clampRatio((targetPosition - block.sourceStart) / blockLength),
  };
}

function closestBlockToPosition(
  targetPosition: number,
  blocks: readonly BlockAnchor[],
): BlockAnchor {
  let closest = firstBlock(blocks);
  let closestDistance = distanceToBlock(targetPosition, closest);

  for (const block of blocks.slice(1)) {
    const distance = distanceToBlock(targetPosition, block);

    if (distance < closestDistance) {
      closest = block;
      closestDistance = distance;
    }
  }

  return closest;
}

function distanceToBlock(position: number, block: BlockAnchor): number {
  if (position < block.sourceStart) {
    return block.sourceStart - position;
  }

  if (position > block.sourceEnd) {
    return position - block.sourceEnd;
  }

  return 0;
}

function resultForBlock(
  reason: MappingReasonCode,
  block: BlockAnchor,
  targetDocument: MappingDocument,
  intraBlockRatio: number,
  structuralSimilarity: number,
  overallSourceRatio?: number,
): MappingResult {
  const safeIntraBlockRatio = clampRatio(intraBlockRatio);
  const sourceLength = effectiveSourceLength(targetDocument, [block]);
  const targetPosition =
    block.sourceStart + safeIntraBlockRatio * Math.max(0, block.sourceEnd - block.sourceStart);

  return {
    confidence: MAPPING_REASON_CONFIDENCE[reason],
    reason,
    structuralSimilarity: clampRatio(structuralSimilarity),
    anchor: {
      versionId: targetDocument.versionId,
      headingPathKey: block.headingPathKey,
      blockOrdinalWithinHeading: block.blockOrdinalWithinHeading,
      blockId: block.blockId,
      intraBlockRatio: safeIntraBlockRatio,
      overallSourceRatio:
        overallSourceRatio === undefined
          ? clampRatio(targetPosition / Math.max(1, sourceLength))
          : clampRatio(overallSourceRatio),
    },
  };
}

function resultWithoutAnchor(
  reason: "TARGET_EMPTY",
  structuralSimilarity: number,
): MappingResult {
  return {
    confidence: MAPPING_REASON_CONFIDENCE[reason],
    reason,
    structuralSimilarity: clampRatio(structuralSimilarity),
  };
}

function collectStructuralSignals(blocks: readonly BlockAnchor[]): ReadonlySet<string> {
  const signals = new Set<string>();

  for (const block of blocks) {
    if (sha256FingerprintPattern.test(block.contentFingerprint)) {
      signals.add(`content:${block.contentFingerprint}`);
    }

    if (block.headingPathKey !== "root" && block.headingPathKey.length > 0) {
      signals.add(`path:${block.headingPathKey}`);
    }
  }

  return signals;
}

function ancestorPaths(path: string): readonly string[] {
  const parts = path.split("/").filter((part) => part.length > 0);
  const ancestors: string[] = [];

  for (let length = parts.length - 1; length > 0; length -= 1) {
    const ancestor = parts.slice(0, length).join("/");

    if (ancestor !== "root") {
      ancestors.push(ancestor);
    }
  }

  return ancestors;
}

function belongsToSubtree(path: string, ancestorPath: string): boolean {
  return path === ancestorPath || path.startsWith(`${ancestorPath}/`);
}

function closestOrdinal(
  ordinal: number,
  blocks: readonly BlockAnchor[],
): BlockAnchor {
  let closest = firstBlock(blocks);
  let closestDistance = Math.abs(closest.blockOrdinalWithinHeading - ordinal);

  for (const block of blocks.slice(1)) {
    const distance = Math.abs(block.blockOrdinalWithinHeading - ordinal);

    if (distance < closestDistance) {
      closest = block;
      closestDistance = distance;
    }
  }

  return closest;
}

function effectiveSourceLength(
  document: MappingDocument,
  blocks: readonly BlockAnchor[],
): number {
  const lastSourceEnd = blocks.reduce(
    (maximum, block) => Math.max(maximum, block.sourceEnd),
    0,
  );

  return Number.isSafeInteger(document.sourceLength) && document.sourceLength >= 0
    ? Math.max(document.sourceLength, lastSourceEnd)
    : lastSourceEnd;
}

function firstBlock(blocks: readonly BlockAnchor[]): BlockAnchor {
  const first = blocks[0];

  if (first === undefined) {
    throw new Error("Progress mapping requires at least one usable target block.");
  }

  return first;
}

function orderedUsableBlocks(blocks: readonly BlockAnchor[]): readonly BlockAnchor[] {
  return blocks.filter(isUsableBlock).slice().sort(compareBlocks);
}

function isUsableBlock(block: BlockAnchor): boolean {
  return (
    block.blockId.length > 0 &&
    block.headingPathKey.length > 0 &&
    Number.isSafeInteger(block.blockOrdinalWithinHeading) &&
    block.blockOrdinalWithinHeading >= 0 &&
    Number.isSafeInteger(block.sourceStart) &&
    block.sourceStart >= 0 &&
    Number.isSafeInteger(block.sourceEnd) &&
    block.sourceEnd >= block.sourceStart
  );
}

function compareBlocks(left: BlockAnchor, right: BlockAnchor): number {
  return (
    left.sourceStart - right.sourceStart ||
    left.sourceEnd - right.sourceEnd ||
    compareStrings(left.headingPathKey, right.headingPathKey) ||
    left.blockOrdinalWithinHeading - right.blockOrdinalWithinHeading ||
    compareStrings(left.blockId, right.blockId)
  );
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
