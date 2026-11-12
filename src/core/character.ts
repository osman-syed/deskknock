export interface Character {
  face: 'oval' | 'round' | 'square';
  skin: string; // #rrggbb
  hair: 'short-1' | 'short-2' | 'long-1' | 'curly-1' | 'bald';
  hairColor: string; // #rrggbb
  glasses: 'none' | 'round' | 'square';
  beard: 'none' | 'stubble' | 'full';
  shirt: string; // #rrggbb
}

export const DEFAULT_CHARACTER: Character = {
  face: 'oval',
  skin: '#e8b58f',
  hair: 'short-2',
  hairColor: '#2b1d16',
  glasses: 'none',
  beard: 'none',
  shirt: '#3b6fe0',
};

const MAX_LEN = 32;
const COLOR = /^#[0-9a-fA-F]{6}$/;
export const FACES: readonly string[] = ['oval', 'round', 'square'];
export const HAIRS: readonly string[] = ['short-1', 'short-2', 'long-1', 'curly-1', 'bald'];
export const GLASSES: readonly string[] = ['none', 'round', 'square'];
export const BEARDS: readonly string[] = ['none', 'stubble', 'full'];

const isColor = (v: unknown): boolean => typeof v === 'string' && v.length <= MAX_LEN && COLOR.test(v);
const isOneOf = (v: unknown, list: readonly string[]): boolean =>
  typeof v === 'string' && v.length <= MAX_LEN && list.includes(v);

export function isCharacter(x: unknown): x is Character {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    isOneOf(c.face, FACES) &&
    isColor(c.skin) &&
    isOneOf(c.hair, HAIRS) &&
    isColor(c.hairColor) &&
    isOneOf(c.glasses, GLASSES) &&
    isOneOf(c.beard, BEARDS) &&
    isColor(c.shirt)
  );
}

// Curated palettes for randomCharacter().
const SKIN_TONES = ['#f6d7c3', '#eec1a1', '#e8b58f', '#d49b72', '#b97c55', '#8d5a3b', '#6b4228', '#4a2e1c'];
const HAIR_COLORS = ['#1c1410', '#2b1d16', '#4a3020', '#6e4a2e', '#a0703f', '#d9b36c', '#b04a2a', '#9a9a9a', '#5a7dd8'];
const SHIRT_COLORS = ['#3b6fe0', '#2a9d8f', '#e76f51', '#8e5bd6', '#e9c46a', '#d6456b', '#3a8f4a', '#46546b'];
/** Chance that glasses / a beard is something other than "none". */
const ACCESSORY_CHANCE = 0.3;

/** A random, valid character from curated palettes. Pass `rand` for deterministic results. */
export function randomCharacter(rand: () => number = Math.random): Character {
  const pick = <T>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const accessory = <T>(list: readonly T[]): T =>
    rand() < ACCESSORY_CHANCE ? pick(list.filter((x) => x !== 'none')) : list[list.indexOf('none' as T)];
  return {
    face: pick(FACES) as Character['face'],
    skin: pick(SKIN_TONES),
    hair: pick(HAIRS) as Character['hair'],
    hairColor: pick(HAIR_COLORS),
    glasses: accessory(GLASSES) as Character['glasses'],
    beard: accessory(BEARDS) as Character['beard'],
    shirt: pick(SHIRT_COLORS),
  };
}
