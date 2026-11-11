import { describe, it, expect } from 'vitest';
import { DEFAULT_CHARACTER, isCharacter } from '../../src/core/character';

describe('isCharacter', () => {
  it('accepts DEFAULT_CHARACTER', () => {
    expect(isCharacter(DEFAULT_CHARACTER)).toBe(true);
  });
  it('rejects bad colour', () => {
    expect(isCharacter({ ...DEFAULT_CHARACTER, skin: 'red' })).toBe(false);
  });
  it('rejects unknown hair id', () => {
    expect(isCharacter({ ...DEFAULT_CHARACTER, hair: 'mohawk' })).toBe(false);
  });
  it('rejects extra-long strings', () => {
    expect(isCharacter({ ...DEFAULT_CHARACTER, hair: 'short-1'.padEnd(40, 'x') })).toBe(false);
    expect(isCharacter({ ...DEFAULT_CHARACTER, skin: '#e8b58f'.padEnd(40, '0') })).toBe(false);
  });
  it('rejects non-objects', () => {
    expect(isCharacter(null)).toBe(false);
    expect(isCharacter('x')).toBe(false);
  });
});
