import { describe, expect, it } from 'vitest';

import { ORIENTATION_COUNT, SPAWN_ORIENTATION, cellsAt, cellsOfOrientation, isValidOrientationId, pieceOfOrientation, rotateOrientation } from './pieces';

/** docs/NES-MECHANICS.md §1 — the clockwise cycle of each orientation id. */
const CW: Readonly<Record<number, number>> = {
  0: 1, 1: 2, 2: 3, 3: 0,
  4: 5, 5: 6, 6: 7, 7: 4,
  8: 9, 9: 8,
  10: 10,
  11: 12, 12: 11,
  13: 14, 14: 15, 15: 16, 16: 13,
  17: 18, 18: 17,
};

describe('the 19 NES orientations', () => {
  it('has 19 orientations of 4 cells each, and rejects id 19', () => {
    expect(ORIENTATION_COUNT).toBe(19);
    for (let id = 0; id < 19; id++) {
      expect(cellsOfOrientation(id)).toHaveLength(4);
      expect(isValidOrientationId(id)).toBe(true);
    }
    expect(isValidOrientationId(19)).toBe(false);
  });

  it('rotates on the documented cycles: I/S/Z toggle, O is fixed, T/J/L cycle', () => {
    for (const [from, to] of Object.entries(CW)) {
      expect(rotateOrientation(Number(from), 1)).toBe(to);
      expect(rotateOrientation(to, -1)).toBe(Number(from));
    }
  });

  it('spawns each piece in its NES orientation — not the SRS spawn', () => {
    expect(SPAWN_ORIENTATION).toEqual({ T: 2, J: 7, Z: 8, O: 10, S: 11, L: 14, I: 18 });
    for (const [piece, spawn] of Object.entries(SPAWN_ORIENTATION)) {
      expect(pieceOfOrientation(spawn)).toBe(piece);
    }
  });

  it('spawns I spanning x-2..x+1, O on columns x-1 and x, and T stem-down', () => {
    expect(cellsAt(18, 5, 0)).toEqual([{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }]);
    expect(cellsAt(10, 5, 0)).toEqual([{ x: 4, y: 0 }, { x: 5, y: 0 }, { x: 4, y: 1 }, { x: 5, y: 1 }]);
    expect(cellsAt(2, 5, 0)).toEqual([{ x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 5, y: 1 }]);
  });

  it('refuses an orientation id that is not in the table', () => {
    expect(() => cellsOfOrientation(19)).toThrow(/0\.\.18/);
    expect(() => pieceOfOrientation(-1)).toThrow(/0\.\.18/);
  });
});
