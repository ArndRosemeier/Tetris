/**
 * Scoring (§5). Deliberately NOT the ROM's packed-BCD arithmetic: this clone models
 * the score as a plain integer (§12.1). No T-spin, combo or back-to-back modifier
 * exists in NES Tetris and none is modelled here.
 */
export const BASE_SCORES: readonly number[] = [0, 40, 100, 300, 1200];

/**
 * The base award for a lock. `levelAfterClear` is the level AFTER the level-up check
 * has run — a clear that levels the player up is scored at the NEW level (§5).
 */
export function lockBaseScore(linesCleared: number, levelAfterClear: number): number {
  const base = BASE_SCORES[linesCleared];
  if (base === undefined) {
    throw new Error(`lockBaseScore: linesCleared must be 0..4, got ${String(linesCleared)}`);
  }
  return base * (levelAfterClear + 1);
}
