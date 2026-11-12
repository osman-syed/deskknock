import { describe, it, expect } from 'vitest';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import { characterHeadSvg, HEAD_VIEWBOX } from '../../src/renderer/shared/headSvg';

describe('characterHeadSvg', () => {
  const svg = characterHeadSvg({ ...DEFAULT_CHARACTER, skin: '#123456', hairColor: '#abcdef', glasses: 'round' });
  it('is a standalone SVG document', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
  it('is cropped to the head with an explicit pixel size', () => {
    expect(svg).toContain(`viewBox="${HEAD_VIEWBOX}"`);
    expect(svg).toMatch(/ width="\d+"/);
    expect(svg).toMatch(/ height="\d+"/);
  });
  it('uses the character colours and parts', () => {
    expect(svg).toContain('#123456');
    expect(svg).toContain('#abcdef');
    expect(svg).toContain('data-part="glasses"');
  });
  it('omits the shirt, hands and animation', () => {
    expect(svg).not.toContain('data-part="shirt"');
    expect(svg).not.toContain('<style');
    expect(svg).not.toContain('<rect');
  });
});
