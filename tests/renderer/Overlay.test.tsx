// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import { Overlay, type OverlayPayload } from '../../src/renderer/overlay/Overlay';

afterEach(cleanup);

const base: OverlayPayload = {
  mode: 'knock', id: 'k1', name: 'Sara', character: DEFAULT_CHARACTER, photo: null,
  reminder: false, waitingBehind: 0, muted: true, edge: 'bottom-right',
};

describe('Overlay', () => {
  it('shows caller name and both buttons', () => {
    render(<Overlay payload={base} onAnswer={() => {}} />);
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('Hi! Look here 👋')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Coming' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Busy · 5 min' })).toBeTruthy();
  });
  it('reminder copy', () => {
    render(<Overlay payload={{ ...base, reminder: true }} onAnswer={() => {}} />);
    expect(screen.getByText('You said 5 min — Sara is waiting')).toBeTruthy();
  });
  it('+2 more waiting when waitingBehind 2', () => {
    render(<Overlay payload={{ ...base, waitingBehind: 2 }} onAnswer={() => {}} />);
    expect(screen.getByText('+2 more waiting')).toBeTruthy();
  });
  it('no queue line when nobody waits', () => {
    render(<Overlay payload={base} onAnswer={() => {}} />);
    expect(screen.queryByText(/more waiting/)).toBeNull();
  });
  it('clicking Busy · 5 min calls answer(id,busy5)', () => {
    const fn = vi.fn();
    render(<Overlay payload={base} onAnswer={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Busy · 5 min' }));
    expect(fn).toHaveBeenCalledWith('k1', 'busy5');
  });
  it('clicking Coming calls answer(id,coming)', () => {
    const fn = vi.fn();
    render(<Overlay payload={base} onAnswer={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Coming' }));
    expect(fn).toHaveBeenCalledWith('k1', 'coming');
  });
  it('× calls answer(id,dismissed)', () => {
    const fn = vi.fn();
    render(<Overlay payload={base} onAnswer={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(fn).toHaveBeenCalledWith('k1', 'dismissed');
  });
  it('reply mode has no buttons and shows Coming!', () => {
    render(<Overlay payload={{ ...base, mode: 'reply', answer: 'coming' }} onAnswer={() => {}} />);
    expect(screen.getByText('Coming!')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('reply busy copy', () => {
    render(<Overlay payload={{ ...base, mode: 'reply', answer: 'busy5' }} onAnswer={() => {}} />);
    expect(screen.getByText('Busy, ~5 min')).toBeTruthy();
  });
  it('same id with new waitingBehind updates the count without remounting the character', () => {
    const { container, rerender } = render(<Overlay payload={base} onAnswer={() => {}} />);
    const peek = container.querySelector('[data-peek]')!;
    const key = peek.getAttribute('data-peek');
    rerender(<Overlay payload={{ ...base, waitingBehind: 3 }} onAnswer={() => {}} />);
    expect(screen.getByText('+3 more waiting')).toBeTruthy();
    expect(container.querySelector('[data-peek]')).toBe(peek);
    expect(peek.getAttribute('data-peek')).toBe(key);
  });
  it('a different id remounts the character', () => {
    const { container, rerender } = render(<Overlay payload={base} onAnswer={() => {}} />);
    const peek = container.querySelector('[data-peek]')!;
    rerender(<Overlay payload={{ ...base, id: 'k2' }} onAnswer={() => {}} />);
    expect(container.querySelector('[data-peek]')).not.toBe(peek);
  });
});
