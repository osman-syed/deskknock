import { describe, it, expect } from 'vitest';
import { displayName, MAX_DISPLAY_NAME } from '../../src/core/displayName';

describe('displayName', () => {
  it('leaves normal names unchanged', () => {
    expect(displayName('Sara Ahmed')).toBe('Sara Ahmed');
    expect(displayName('Zoë & Ali')).toBe('Zoë & Ali');
  });
  it('replaces newlines and control chars with a single space', () => {
    expect(displayName('Sara\n\r\tAhmed')).toBe('Sara Ahmed');
    expect(displayName('a\u0000\u0007b\u007fc')).toBe('a b c');
  });
  it('strips bidi controls', () => {
    expect(displayName('evil‮gnp.exe')).toBe('evil gnp.exe');
    expect(displayName('⁦x⁩')).toBe('x');
  });
  it('collapses whitespace and trims', () => {
    expect(displayName('   Sara    Ahmed  ')).toBe('Sara Ahmed');
  });
  it('whitespace-only or empty → Unnamed', () => {
    expect(displayName('')).toBe('Unnamed');
    expect(displayName(' \n\t‮ ')).toBe('Unnamed');
  });
  it('caps long names at 40 chars with …', () => {
    expect(MAX_DISPLAY_NAME).toBe(40);
    const forty = 'x'.repeat(40);
    expect(displayName(forty)).toBe(forty);
    const out = displayName('y'.repeat(41));
    expect(out).toBe('y'.repeat(39) + '…');
    expect([...out].length).toBe(40);
    expect([...displayName('z'.repeat(600_000))].length).toBe(40);
  });
  it('does not split surrogate pairs when capping', () => {
    const out = displayName('😀'.repeat(50));
    expect([...out].length).toBe(40);
    expect(out.endsWith('😀…')).toBe(true);
  });
});
