// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import { CharacterSvg } from '../../src/renderer/shared/CharacterSvg';

describe('CharacterSvg', () => {
  it('renders skin colour', () => {
    const { container } = render(
      <CharacterSvg character={{ ...DEFAULT_CHARACTER, skin: '#123456' }} pose="rise" animate={false} />
    );
    expect(container.querySelector('[data-part="head"]')?.getAttribute('fill')).toBe('#123456');
  });
  it('omits glasses when none', () => {
    const { container } = render(
      <CharacterSvg character={{ ...DEFAULT_CHARACTER, glasses: 'none' }} pose="rise" animate={false} />
    );
    expect(container.querySelector('[data-part="glasses"]')).toBeNull();
  });
  it('lean pose rotates', () => {
    const { container } = render(<CharacterSvg character={DEFAULT_CHARACTER} pose="lean" animate={false} />);
    expect(container.querySelector('svg > g')?.getAttribute('transform')).toContain('rotate(-90');
  });
  it('rise pose does not rotate', () => {
    const { container } = render(<CharacterSvg character={DEFAULT_CHARACTER} pose="rise" animate={false} />);
    expect(container.querySelector('svg > g')?.getAttribute('transform') ?? '').not.toContain('rotate');
  });
});
