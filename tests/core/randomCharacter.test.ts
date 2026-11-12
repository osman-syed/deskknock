import { describe, it, expect } from 'vitest';
import { isCharacter, randomCharacter } from '../../src/core/character';

/** Small deterministic PRNG (mulberry32) so tests can use many seeds. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('randomCharacter', () => {
  it('is always a valid character over many seeds', () => {
    for (let s = 0; s < 500; s++) expect(isCharacter(randomCharacter(seeded(s)))).toBe(true);
  });
  it('is valid at the extremes of rand', () => {
    expect(isCharacter(randomCharacter(() => 0))).toBe(true);
    expect(isCharacter(randomCharacter(() => 0.999999))).toBe(true);
  });
  it('is deterministic for a given rand', () => {
    expect(randomCharacter(seeded(42))).toEqual(randomCharacter(seeded(42)));
  });
  it('different rand can give different characters', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 20; s++) seen.add(JSON.stringify(randomCharacter(seeded(s))));
    expect(seen.size).toBeGreaterThan(1);
  });
  it('picks glasses and beard less often than none', () => {
    let glasses = 0, beard = 0;
    const N = 2000;
    for (let s = 0; s < N; s++) {
      const c = randomCharacter(seeded(s));
      if (c.glasses !== 'none') glasses++;
      if (c.beard !== 'none') beard++;
    }
    expect(glasses / N).toBeLessThan(0.5);
    expect(beard / N).toBeLessThan(0.5);
    expect(glasses).toBeGreaterThan(0);
    expect(beard).toBeGreaterThan(0);
  });
  it('defaults to Math.random', () => {
    expect(isCharacter(randomCharacter())).toBe(true);
  });
});
