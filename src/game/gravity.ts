/**
 * NTSC gravity (§4): frames per cell. 30 entries, levels 0..29. Level >= 29 is
 * hard-clamped to 1 frame/cell (1G) and the table is not read above it.
 */
export const GRAVITY_TABLE: readonly number[] = [
  48, 43, 38, 33, 28, 23, 18, 13, 8, 6, // 0..9
  5, 5, 5, // 10..12
  4, 4, 4, // 13..15
  3, 3, 3, // 16..18
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 19..28
  1, // 29
];

/** Level 29 is the colloquial "kill screen" (1G). It is a clamp, not a table entry. */
export const GRAVITY_CLAMP_LEVEL = 29;

export function framesPerCell(level: number): number {
  if (!Number.isInteger(level) || level < 0) {
    throw new Error(`framesPerCell: level must be a non-negative integer, got ${String(level)}`);
  }
  if (level >= GRAVITY_CLAMP_LEVEL) return 1;
  return GRAVITY_TABLE[level]!;
}
