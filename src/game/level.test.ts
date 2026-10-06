import { describe, expect, it } from 'vitest';

import { LINES_PER_LEVEL, firstLevelUpLines } from './level';
import { BASE_SCORES, lockBaseScore } from './scoring';

/** docs/NES-MECHANICS.md §6 — the first-level-up line count by starting level. */
const FIRST_LEVEL_UP = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100, 100, 100, 100, 100, 110, 120, 130, 140];

describe('level progression', () => {
  it('advances at the documented first-level-up line count for every starting level 0..19', () => {
    for (let start = 0; start < FIRST_LEVEL_UP.length; start++) {
      expect(firstLevelUpLines(start)).toBe(FIRST_LEVEL_UP[start]);
    }
  });

  it('then advances every 10 lines', () => {
    expect(LINES_PER_LEVEL).toBe(10);
    expect(firstLevelUpLines(15) + LINES_PER_LEVEL).toBe(110);
  });
});

describe('scoring', () => {
  it('is base[lines] * (level + 1) and uses the level it is handed', () => {
    expect(BASE_SCORES).toEqual([0, 40, 100, 300, 1200]);
    expect(lockBaseScore(0, 0)).toBe(0);
    expect(lockBaseScore(1, 0)).toBe(40);
    expect(lockBaseScore(2, 0)).toBe(100);
    expect(lockBaseScore(3, 0)).toBe(300);
    expect(lockBaseScore(4, 0)).toBe(1200);
    expect(lockBaseScore(4, 1)).toBe(2400);
    expect(lockBaseScore(1, 9)).toBe(400);
  });

  it('refuses a line count outside 0..4 rather than inventing a score', () => {
    expect(() => lockBaseScore(5, 0)).toThrow(/0\.\.4/);
  });
});
