// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import type { PeerView } from '../../src/core/peers';
import type { AppState } from '../../src/core/appState';
import { App } from '../../src/renderer/main/App';

const mk = (peerId: string, name: string, online: boolean): PeerView => ({
  peerId, name, appVersion: '0.1.0', protocolVersion: 1, character: DEFAULT_CHARACTER,
  photoHash: null, online, compatible: true, paused: false, away: false,
});

const state = (over: Partial<AppState> = {}): AppState => ({
  peers: [mk('a', 'Alice', false), mk('b', 'Bob', true), mk('c', 'Cara', true)],
  outgoing: {},
  updateAvailable: null,
  networkError: null,
  settings: { peerId: 'me', name: 'Me', muted: false, paused: false, port: 47321, manualPeers: [] },
  ...over,
});

let emit: (s: AppState) => void;
let api: { onState: ReturnType<typeof vi.fn>; knock: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; saveSettings: ReturnType<typeof vi.fn> };

beforeEach(() => {
  api = {
    onState: vi.fn((cb: (s: AppState) => void) => { emit = cb; }),
    knock: vi.fn(), cancel: vi.fn(), saveSettings: vi.fn(),
  };
  (window as unknown as { deskknock: typeof api }).deskknock = api;
});
afterEach(cleanup);

describe('App', () => {
  it('renders a row per peer, online first', () => {
    render(<App />);
    act(() => emit(state()));
    const rows = screen.getAllByTestId('peer-row');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.getAttribute('data-peer'))).toEqual(['b', 'c', 'a']);
  });
  it('shows sanitised peer names', () => {
    render(<App />);
    act(() => emit({ ...state(), peers: [mk('z', 'Evil\n\u202Ename', true)] }));
    const row = screen.getByTestId('peer-row');
    expect(row.textContent).toContain('Evil name');
    expect(row.textContent).not.toContain('\u202E');
  });
  it('clicking Knock calls knock(peerId)', () => {
    render(<App />);
    act(() => emit(state()));
    const row = screen.getAllByTestId('peer-row').find((r) => r.getAttribute('data-peer') === 'b')!;
    fireEvent.click(row.querySelector('button')!);
    expect(api.knock).toHaveBeenCalledWith('b');
  });
  it('shows Cancel while knocking and calls cancel(peerId)', () => {
    render(<App />);
    act(() => emit(state({ outgoing: { b: { kind: 'knocking' } } })));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.cancel).toHaveBeenCalledWith('b');
    expect(screen.getByText('Knocking…')).toBeTruthy();
  });
  it('shows Update available when set', () => {
    render(<App />);
    act(() => emit(state()));
    expect(screen.queryByText(/Update available/)).toBeNull();
    act(() => emit(state({ updateAvailable: '0.2.0' })));
    expect(screen.getByText(/Update available/)).toBeTruthy();
  });
  it('shows the network error banner when set', () => {
    render(<App />);
    act(() => emit(state()));
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => emit(state({ networkError: "Can't use port 47321 — change it in Settings and restart" })));
    expect(screen.getByRole('alert').textContent).toContain("Can't use port 47321");
  });
});
