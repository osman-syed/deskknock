// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import { Builder } from '../../src/renderer/builder/Builder';

afterEach(cleanup);

const api = () => ({
  load: vi.fn().mockResolvedValue({ character: DEFAULT_CHARACTER, photo: null }),
  save: vi.fn().mockResolvedValue(undefined),
});

async function setup() {
  const a = api();
  (window as unknown as { builder: unknown }).builder = a;
  const r = render(<Builder />);
  await act(async () => {});
  return { a, ...r };
}

describe('Builder', () => {
  it('changing skin updates preview fill', async () => {
    const { container } = await setup();
    fireEvent.change(screen.getByLabelText('Skin'), { target: { value: '#112233' } });
    expect(container.querySelector('[data-part="head"]')!.getAttribute('fill')).toBe('#112233');
  });
  it('Save calls builder.save with current character', async () => {
    const { a } = await setup();
    fireEvent.change(screen.getByLabelText('Shirt'), { target: { value: '#aabbcc' } });
    fireEvent.change(screen.getByLabelText('Hair'), { target: { value: 'bald' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    expect(a.save).toHaveBeenCalledTimes(1);
    const [c, photo] = a.save.mock.calls[0];
    expect(c).toEqual({ ...DEFAULT_CHARACTER, shirt: '#aabbcc', hair: 'bald' });
    expect(photo).toBeNull();
  });
});
