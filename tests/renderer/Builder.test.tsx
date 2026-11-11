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
    expect(photo).toBeUndefined();
  });
  it('Save is disabled until load resolves', async () => {
    let resolve!: (v: unknown) => void;
    const a = { load: vi.fn(() => new Promise((r) => { resolve = r; })), save: vi.fn() };
    (window as unknown as { builder: unknown }).builder = a;
    render(<Builder />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolve({ character: DEFAULT_CHARACTER, photo: null }); });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('load failure shows an error and keeps Save disabled', async () => {
    const a = { load: vi.fn().mockRejectedValue(new Error('boom')), save: vi.fn() };
    (window as unknown as { builder: unknown }).builder = a;
    render(<Builder />);
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toMatch(/could not load/i);
    const btn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(a.save).not.toHaveBeenCalled();
  });
  it('untouched existing photo is saved without a photo change', async () => {
    const a = { load: vi.fn().mockResolvedValue({ character: DEFAULT_CHARACTER, photo: new Uint8Array([1, 2, 3]) }), save: vi.fn().mockResolvedValue(undefined) };
    (window as unknown as { builder: unknown }).builder = a;
    render(<Builder />);
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    expect(a.save).toHaveBeenCalledTimes(1);
    expect(a.save.mock.calls[0][1]).toBeUndefined();
  });
  it('explicitly removed photo is saved as null', async () => {
    const a = { load: vi.fn().mockResolvedValue({ character: DEFAULT_CHARACTER, photo: new Uint8Array([1, 2, 3]) }), save: vi.fn().mockResolvedValue(undefined) };
    (window as unknown as { builder: unknown }).builder = a;
    render(<Builder />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    expect(a.save.mock.calls[0][1]).toBeNull();
  });
});
