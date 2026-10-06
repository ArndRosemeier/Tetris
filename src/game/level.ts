/** Every level-up AFTER the first advances at +10 lines (§6). */
export const LINES_PER_LEVEL = 10;

/**
 * A-Type's FIRST level-up line count, by starting level (§6). The real game has a
 * BCD-vs-binary bug here; this is the equivalent closed form the wiki documents:
 * `min(startLevel*10 + 10, max(100, startLevel*10 - 50))`.
 */
export function firstLevelUpLines(startLevel: number): number {
  if (!Number.isInteger(startLevel) || startLevel < 0) {
    throw new Error(`firstLevelUpLines: startLevel must be a non-negative integer, got ${String(startLevel)}`);
  }
  return Math.min(startLevel * 10 + 10, Math.max(100, startLevel * 10 - 50));
}
