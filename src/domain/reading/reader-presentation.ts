import type { ReaderStateSnapshot } from "@/application/ports/document-repository";
import type { SectionLayout, SectionRef, SplitStrategy } from "@/domain/content/pipeline-types";
import { selectInitialReadingMode, type ReadingMode } from "./reading-mode";

export interface ReaderPresentation {
  readonly mode: ReadingMode;
  readonly modeOrigin: "auto" | "user";
  readonly splitStrategy: SplitStrategy;
}

export function resolveReaderPresentation(
  layouts: Record<SplitStrategy, SectionLayout>,
  saved: ReaderStateSnapshot | undefined,
): ReaderPresentation {
  const splitStrategy = saved?.splitStrategy ?? "auto";
  if (saved?.modeOrigin === "user") {
    return { mode: saved.readingMode, modeOrigin: "user", splitStrategy };
  }
  return {
    mode: selectInitialReadingMode(layouts.whole.sections[0]?.estimatedCost ?? 0),
    modeOrigin: "auto",
    splitStrategy,
  };
}

export function findSectionIndex(sections: readonly SectionRef[], chunkOrdinal: number): number {
  const index = sections.findIndex((section) => section.startChunkOrdinal <= chunkOrdinal && chunkOrdinal <= section.endChunkOrdinalInclusive);
  return index < 0 ? 0 : index;
}
