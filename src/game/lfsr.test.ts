import { describe, expect, it } from 'vitest';

import { stepLfsr } from './lfsr';

/** docs/NES-MECHANICS.md §11, VECTOR A — regenerated independently from the recurrence. */
const VECTOR_A: readonly number[] = [
  0x44c4, 0x2262, 0x1131, 0x0898, 0x044c, 0x0226, 0x0113, 0x8089, 0x4044, 0x2022, 0x9011, 0x4808, 0x2404, 0x1202, 0x0901, 0x0480,
];


describe('the NES 16-bit LFSR', () => {
  /**
   * PIN 2 — "the LFSR seeded 0x8988 produces Vector A as its first 16 stepped values."
   * Watched red by changing a tap (see docs/TESTING.md).
   */
  it('steps 0x8988 into Vector A: the spec’s first 16 values', () => {
    let s = 0x8988;
    const out: number[] = [];
    for (let i = 0; i < 16; i++) {
      s = stepLfsr(s);
      out.push(s);
    }
    expect(out).toEqual([...VECTOR_A]);
  });

  it('is the Fibonacci recurrence bit = ((s>>9) ^ (s>>1)) & 1, shifted in at bit 15', () => {
    expect(stepLfsr(0x8988)).toBe(0x44c4);
    expect(stepLfsr(0x0002)).toBe(0x8001); // bit 1 set -> tap fires -> bit 15 set
    expect(stepLfsr(0x0001)).toBe(0x0000); // no tap set -> the register is empty
  });

  it('refuses a state that is not a 16-bit integer instead of silently wrapping', () => {
    expect(() => stepLfsr(0x10000)).toThrow(/16-bit/);
    expect(() => stepLfsr(-1)).toThrow(/16-bit/);
    expect(() => stepLfsr(1.5)).toThrow(/16-bit/);
  });
});
