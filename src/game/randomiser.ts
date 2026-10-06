import { stepLfsr } from './lfsr';
import type { OrientationId } from './types';

/** The ROM's power-on LFSR seed, big-endian at `$0017-$0018`. */
export const DEFAULT_SEED = 0x8988;

/**
 * DIS L3013: index 0..6 -> orientation ids `[T-down, J-down, Z-horiz, O, S-horiz,
 * L-down, I-horiz]`. Index 7 is the dummy value that is always rejected.
 */
export const SPAWN_TABLE: readonly OrientationId[] = [2, 7, 8, 10, 11, 14, 18];

/** The randomiser's live state: `seed` = `$0017-$0018`, `spawnCount` = `$001A`, `spawnID` = `$0019`. */
export interface RandomiserState {
  readonly seed: number;
  readonly spawnCount: number;
  readonly spawnID: OrientationId;
}

export function createRandomiser(seed: number = DEFAULT_SEED): RandomiserState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff) {
    throw new Error(`createRandomiser: seed must be a 16-bit integer, got ${String(seed)}`);
  }
  return { seed, spawnCount: 0, spawnID: 0 };
}

/**
 * The FRAME seam: the LFSR is stepped exactly once per rendered frame (§2, §11
 * Vector D). Nothing else may advance it except {@link pick}'s internal re-roll.
 */
export function advanceFrame(rng: RandomiserState): RandomiserState {
  return { seed: stepLfsr(rng.seed), spawnCount: rng.spawnCount, spawnID: rng.spawnID };
}

/**
 * The PURE picker (§2), run at spawn. It is a pure function of
 * `(seed, spawnCount, spawnID)` and steps NO frames of its own — it only re-rolls
 * the LFSR when the first roll is the dummy `7` or repeats the previous spawn.
 *
 *   spawnCount = (spawnCount + 1) & 0xFF        // NOT reset between games
 *   i = ((seed >> 8) + spawnCount) & 7
 *   if (i === 7 || spawnTable[i] === spawnID) {
 *     seed = step(seed)
 *     i = (((seed >> 8) & 7) + spawnID) % 7
 *   }
 *   spawnID = spawnTable[i]
 */
export function pick(rng: RandomiserState): { id: OrientationId; state: RandomiserState } {
  const spawnCount = (rng.spawnCount + 1) & 0xff;
  let seed = rng.seed;
  let i = ((seed >> 8) + spawnCount) & 7;
  if (i === 7 || SPAWN_TABLE[i] === rng.spawnID) {
    seed = stepLfsr(seed);
    i = (((seed >> 8) & 7) + rng.spawnID) % 7;
  }
  const id = SPAWN_TABLE[i]!;
  return { id, state: { seed, spawnCount, spawnID: id } };
}
