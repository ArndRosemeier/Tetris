/**
 * The NES 16-bit Fibonacci LFSR (`docs/NES-MECHANICS.md` §2), seeded `0x8988` at
 * power-on. Period 32767. This is the ONE source of randomness in the game.
 *
 *   bit = ((s >> 9) ^ (s >> 1)) & 1
 *   s   = ((bit << 15) | (s >> 1)) & 0xFFFF
 */
export function stepLfsr(state: number): number {
  if (!Number.isInteger(state) || state < 0 || state > 0xffff) {
    throw new Error(`stepLfsr: state must be a 16-bit integer, got ${String(state)}`);
  }
  const bit = ((state >> 9) ^ (state >> 1)) & 1;
  return ((bit << 15) | (state >> 1)) & 0xffff;
}
