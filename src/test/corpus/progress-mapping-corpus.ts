import type {
  MappingReasonCode,
  RestoreConfidence,
} from "@/domain/reading/progress-mapping";

export interface ProgressMappingPair {
  readonly id:
    | "small-block-insertion"
    | "no-headings-insertion"
    | "changed-block-same-heading"
    | "renamed-heading"
    | "removed-heading"
    | "reordered-repeated-heading"
    | "ratio-fallback"
    | "radical-rewrite";
  readonly description: string;
  readonly sourceMarkdown: string;
  readonly targetMarkdown: string;
  readonly sourceMarker: string;
  readonly expectedTargetMarker: string;
  readonly expectedConfidence: RestoreConfidence;
  readonly expectedReason: MappingReasonCode;
  readonly maxBlockDistance: number;
}

export function createProgressMappingPairs(): readonly ProgressMappingPair[] {
  return [
    {
      id: "small-block-insertion",
      description: "An unchanged block shifts by one ordinal after a nearby insertion.",
      sourceMarkdown: lines(
        "# Field Guide",
        "Introductory context.",
        "## Setup",
        "Prepare the workspace [[MDR:INSERT_ANCHOR]].",
        "Verify the result.",
      ),
      targetMarkdown: lines(
        "# Field Guide",
        "Introductory context.",
        "## Setup",
        "Read the compatibility note first.",
        "Prepare the workspace [[MDR:INSERT_ANCHOR]].",
        "Verify the result.",
      ),
      sourceMarker: "[[MDR:INSERT_ANCHOR]]",
      expectedTargetMarker: "[[MDR:INSERT_ANCHOR]]",
      expectedConfidence: "exact",
      expectedReason: "CROSS_VERSION_CONTENT_FINGERPRINT",
      maxBlockDistance: 0,
    },
    {
      id: "no-headings-insertion",
      description: "Headingless content retains an unchanged block through insertion.",
      sourceMarkdown: lines(
        "Opening paragraph.",
        "Headingless anchor [[MDR:NO_HEADING_ANCHOR]].",
        "Closing paragraph.",
      ),
      targetMarkdown: lines(
        "Opening paragraph.",
        "Inserted headingless context.",
        "Headingless anchor [[MDR:NO_HEADING_ANCHOR]].",
        "Closing paragraph.",
      ),
      sourceMarker: "[[MDR:NO_HEADING_ANCHOR]]",
      expectedTargetMarker: "[[MDR:NO_HEADING_ANCHOR]]",
      expectedConfidence: "exact",
      expectedReason: "CROSS_VERSION_CONTENT_FINGERPRINT",
      maxBlockDistance: 0,
    },
    {
      id: "changed-block-same-heading",
      description: "A changed block keeps its heading path and ordinal.",
      sourceMarkdown: lines(
        "# Field Guide",
        "Introductory context.",
        "## Setup",
        "Prepare version one [[MDR:CHANGED_ANCHOR]].",
        "Verify the result.",
      ),
      targetMarkdown: lines(
        "# Field Guide",
        "Introductory context.",
        "## Setup",
        "Prepare version two carefully [[MDR:CHANGED_ANCHOR]].",
        "Verify the result.",
      ),
      sourceMarker: "[[MDR:CHANGED_ANCHOR]]",
      expectedTargetMarker: "[[MDR:CHANGED_ANCHOR]]",
      expectedConfidence: "approximate",
      expectedReason: "CROSS_VERSION_PATH_ORDINAL",
      maxBlockDistance: 0,
    },
    {
      id: "renamed-heading",
      description: "A renamed child heading maps through its unchanged ancestor position.",
      sourceMarkdown: lines(
        "# Manual",
        "Overview.",
        "## Installation [[MDR:RENAME_ANCHOR]]",
        "Install the package.",
        "## Operation",
        "Run the package.",
      ),
      targetMarkdown: lines(
        "# Manual",
        "Overview.",
        "## Setup [[MDR:RENAME_ANCHOR]]",
        "Install the package.",
        "## Operation",
        "Run the package.",
      ),
      sourceMarker: "[[MDR:RENAME_ANCHOR]]",
      expectedTargetMarker: "[[MDR:RENAME_ANCHOR]]",
      expectedConfidence: "approximate",
      expectedReason: "CROSS_VERSION_ANCESTOR_ORDINAL",
      maxBlockDistance: 0,
    },
    {
      id: "removed-heading",
      description: "A removed heading falls to the nearest position in its surviving ancestor.",
      sourceMarkdown: lines(
        "# Manual",
        "Overview.",
        "## Stable",
        "Stable details.",
        "## Optional [[MDR:REMOVED_SOURCE]]",
        "Optional details [[MDR:REMOVED_TARGET]].",
        "## Finish",
        "Finish details one.",
        "Finish details two.",
      ),
      targetMarkdown: lines(
        "# Manual",
        "Overview.",
        "## Stable",
        "Stable details.",
        "Optional details [[MDR:REMOVED_TARGET]].",
        "## Finish",
        "Finish details one.",
        "Finish details two.",
      ),
      sourceMarker: "[[MDR:REMOVED_SOURCE]]",
      expectedTargetMarker: "[[MDR:REMOVED_TARGET]]",
      expectedConfidence: "approximate",
      expectedReason: "CROSS_VERSION_ANCESTOR_ORDINAL",
      maxBlockDistance: 1,
    },
    {
      id: "reordered-repeated-heading",
      description: "Unique body content survives reordered repeated heading paths.",
      sourceMarkdown: lines(
        "# Repeated topics",
        "## Topic",
        "First topic body.",
        "## Topic",
        "Second topic body [[MDR:REPEATED_ANCHOR]].",
        "## Closing",
        "Closing body.",
      ),
      targetMarkdown: lines(
        "# Repeated topics",
        "## Topic",
        "Second topic body [[MDR:REPEATED_ANCHOR]].",
        "## Topic",
        "First topic body.",
        "## Closing",
        "Closing body.",
      ),
      sourceMarker: "[[MDR:REPEATED_ANCHOR]]",
      expectedTargetMarker: "[[MDR:REPEATED_ANCHOR]]",
      expectedConfidence: "exact",
      expectedReason: "CROSS_VERSION_CONTENT_FINGERPRINT",
      maxBlockDistance: 0,
    },
    {
      id: "ratio-fallback",
      description: "Shared surrounding blocks permit an honest source-ratio fallback.",
      sourceMarkdown: lines(
        "# Alpha guide",
        "Shared opening context.",
        "## Beta workflow",
        "Old central instruction [[MDR:RATIO_SOURCE]].",
        "Shared closing context.",
      ),
      targetMarkdown: lines(
        "# Omega handbook",
        "Shared opening context.",
        "## Delta process",
        "New central instruction [[MDR:RATIO_TARGET]].",
        "Shared closing context.",
      ),
      sourceMarker: "[[MDR:RATIO_SOURCE]]",
      expectedTargetMarker: "[[MDR:RATIO_TARGET]]",
      expectedConfidence: "approximate",
      expectedReason: "OVERALL_SOURCE_RATIO",
      maxBlockDistance: 0,
    },
    {
      id: "radical-rewrite",
      description: "No shared structural signal permits no confident continuation.",
      sourceMarkdown: lines(
        "# Alpha reference",
        "Alpha opening.",
        "## Beta details",
        "Old anchor [[MDR:RADICAL_SOURCE]].",
        "Alpha ending.",
      ),
      targetMarkdown: lines(
        "# Completely new material [[MDR:RADICAL_START]]",
        "Unrelated opening.",
        "## Different subject",
        "Unrelated body.",
        "Unrelated ending.",
      ),
      sourceMarker: "[[MDR:RADICAL_SOURCE]]",
      expectedTargetMarker: "[[MDR:RADICAL_START]]",
      expectedConfidence: "none",
      expectedReason: "NO_RELIABLE_MATCH",
      maxBlockDistance: 0,
    },
  ];
}

function lines(...blocks: readonly string[]): string {
  return `${blocks.join("\n\n")}\n`;
}
