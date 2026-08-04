// ─── Scoring Utilities ────────────────────────────────────────────────────────
// Shared helpers used by the analysis service, reporting service, and all
// scanners that need to convert a numeric score to a letter grade.
// Single source of truth — do NOT duplicate this logic in individual files.

/**
 * Convert a 0–100 numeric score to a letter grade.
 * Thresholds: A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F < 40.
 */
export function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Extract a score safely from a scanner result.
 * Returns the scanner's score only when the scanner ran and succeeded.
 * Falls back to `defaultScore` when the scanner was absent or failed,
 * preventing a failed scanner's explicit 0 from collapsing overall scores.
 */
export function safeScore(
  scanner: { success: boolean; score: number } | undefined,
  defaultScore = 70,
): number {
  return scanner?.success === true ? scanner.score : defaultScore;
}

/**
 * Same as safeScore but for the performance scanner whose score lives at
 * `scores.performance` rather than a top-level `score` property.
 */
export function safePerformanceScore(
  scanner: { success: boolean; scores: { performance: number } } | undefined,
  defaultScore = 70,
): number {
  return scanner?.success === true ? scanner.scores.performance : defaultScore;
}
