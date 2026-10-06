import { describe, expect, it } from 'vitest';

import { GRAVITY_CLAMP_LEVEL, GRAVITY_TABLE, framesPerCell } from './gravity';

/** docs/NES-MECHANICS.md §4 — the 30-entry NTSC table. */
const TABLE = [
  48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1,
];

describe('gravity', () => {
  /**
   * PIN 6 — "gravity is the table and is clamped to 1 frame/cell at level 29 and above."
   * Watched red by editing the clamp (see docs/TESTING.md).
   */
  it('is the 30-entry NTSC frames-per-cell table, clamped to 1 at level 29 and above', () => {
    expect(GRAVITY_TABLE).toHaveLength(30);
    expect(GRAVITY_TABLE).toEqual(TABLE);
    for (let level = 0; level < 30; level++) expect(framesPerCell(level)).toBe(TABLE[level]);
    for (let level = GRAVITY_CLAMP_LEVEL; level <= 80; level++) expect(framesPerCell(level)).toBe(1);
    // The clamp bites: the table index would still be 1 here, but the point is that
    // level 30+ is a clamp, not a read.
    expect(framesPerCell(28)).toBe(2);
  });

  it('refuses a level that is not a non-negative integer', () => {
    expect(() => framesPerCell(-1)).toThrow(/non-negative/);
    expect(() => framesPerCell(2.5)).toThrow(/non-negative/);
  });
});
