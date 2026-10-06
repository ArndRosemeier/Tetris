import { describe, expect, it } from 'vitest';

import { SPAWN_TABLE, createRandomiser, pick } from './randomiser';

/** docs/NES-MECHANICS.md §11, VECTOR B — 20 back-to-back calls with NO frame steps. */
const VECTOR_B_IDS = [8, 10, 11, 14, 18, 7, 10, 11, 14, 18, 18, 14, 18, 11, 7, 11, 14, 18, 18, 14];
const VECTOR_B_SEEDS = [
  0x8988, 0x8988, 0x8988, 0x8988, 0x8988, 0x44c4, 0x44c4, 0x44c4, 0x44c4, 0x44c4,
  0x2262, 0x1131, 0x1131, 0x0898, 0x044c, 0x044c, 0x044c, 0x044c, 0x0226, 0x0113,
];

describe('the NES spawn picker', () => {
  /**
   * PIN 3 — "the picker is a pure function of (seed, spawnCount, spawnID) producing
   * Vector B when called with no frame steps between calls."
   * Watched red by changing the dummy index or the repeat check (see docs/TESTING.md).
   */
  it('is a pure function of (seed, spawnCount, spawnID) and reproduces Vector B with no frame steps', () => {
    let rng = createRandomiser(0x8988);
    const ids: number[] = [];
    const seeds: number[] = [];
    for (let call = 0; call < 20; call++) {
      const rolled = pick(rng);
      ids.push(rolled.id);
      seeds.push(rolled.state.seed);
      rng = rolled.state;
    }
    expect(ids).toEqual(VECTOR_B_IDS);
    expect(seeds).toEqual(VECTOR_B_SEEDS);
    expect(rng.spawnCount).toBe(20);
  });

  it('does not mutate the state it is given — the caller owns the transition', () => {
    const before = createRandomiser(0x8988);
    const snapshot = { ...before };
    pick(before);
    expect(before).toEqual(snapshot);
  });

  it('only ever deals the 7 table entries, never the dummy index 7', () => {
    expect(SPAWN_TABLE).toEqual([2, 7, 8, 10, 11, 14, 18]);
    let rng = createRandomiser(0x8988);
    for (let call = 0; call < 500; call++) {
      const rolled = pick(rng);
      rng = rolled.state;
      expect(SPAWN_TABLE).toContain(rolled.id);
    }
  });

  it('rejects a repeat of the previous spawn on the FIRST roll only — the re-roll can repeat it', () => {
    // §2 says the repeat check makes it "effectively not the same piece twice in a row".
    // That is an approximation, not an invariant: the re-roll index is
    // (((seed >> 8) & 7) + spawnID) % 7, which is computed from the previous spawn ID
    // and CAN land on the same table entry. Find one and pin it, so nobody later
    // "fixes" the picker into a different sequence.
    let rng = createRandomiser(0x8988);
    let previous = rng.spawnID;
    const repeats: number[] = [];
    for (let call = 0; call < 2000; call++) {
      const rolled = pick(rng);
      rng = rolled.state;
      if (rolled.id === previous) repeats.push(call);
      previous = rolled.id;
    }
    expect(repeats.length).toBeGreaterThan(0);
  });

  it('counts spawns in the $001A byte and wraps at 256', () => {
    let rng = createRandomiser(0x1234);
    for (let call = 0; call < 257; call++) rng = pick(rng).state;
    expect(rng.spawnCount).toBe(1);
  });
});
