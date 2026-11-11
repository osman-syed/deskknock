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
const FACES = ['oval', 'round', 'square'];
const HAIRS = ['short-1', 'short-2', 'long-1', 'curly-1', 'bald'];
const GLASSES = ['none', 'round', 'square'];
const BEARDS = ['none', 'stubble', 'full'];

const isColor = (v: unknown): boolean => typeof v === 'string' && v.length <= MAX_LEN && COLOR.test(v);
const isOneOf = (v: unknown, list: string[]): boolean =>
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
