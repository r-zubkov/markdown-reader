/**
 * A document exceeding this already-measured safe logical-section budget starts
 * in sections mode until the user explicitly chooses another presentation.
 *
 * This is cost, not byte length: the pipeline's cost includes the rendered
 * structure that determines how much work a reader section represents.
 */
export const AUTO_SECTIONS_COST_THRESHOLD = 24_000;

export type ReadingMode = "continuous" | "sections";

export function selectInitialReadingMode(totalEstimatedCost: number): ReadingMode {
  if (!Number.isFinite(totalEstimatedCost) || totalEstimatedCost < 0) return "sections";
  return totalEstimatedCost > AUTO_SECTIONS_COST_THRESHOLD ? "sections" : "continuous";
}
