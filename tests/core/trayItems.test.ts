import { describe, it, expect } from 'vitest';
import { trayTeammateItems } from '../../src/core/trayItems';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import type { PeerView } from '../../src/core/peers';
import type { OutgoingView } from '../../src/core/knockEngine';

const mk = (peerId: string, name: string, over: Partial<PeerView> = {}): PeerView => ({
  peerId, name, appVersion: '0.1.0', protocolVersion: 1, character: DEFAULT_CHARACTER,
  photoHash: null, online: true, compatible: true, paused: false, away: false, ...over,
});
const NOW = new Date(2026, 10, 12, 14, 0, 0).getTime();

describe('trayTeammateItems', () => {
  it('empty list → no items', () => {
    expect(trayTeammateItems([], {}, NOW, 'me')).toEqual([]);
  });
  it('excludes self and keeps the given (online-first, by name) order', () => {
    const peers = [mk('a', 'Ali'), mk('me', 'Osman'), mk('z', 'Zed'), mk('b', 'Bea', { online: false })];
    expect(trayTeammateItems(peers, {}, NOW, 'me').map((i) => i.peerId)).toEqual(['a', 'z', 'b']);
  });
  it('idle online peer → "Name — Online", knock enabled', () => {
    expect(trayTeammateItems([mk('a', 'Ali')], {}, NOW, 'me')).toEqual([
      { peerId: 'a', label: 'Ali — Online', enabled: true, action: 'knock' },
    ]);
  });
  it('offline peer → disabled', () => {
    const [i] = trayTeammateItems([mk('a', 'Ali', { online: false })], {}, NOW, 'me');
    expect(i).toMatchObject({ label: 'Ali — Offline', enabled: false, action: null });
  });
  it('incompatible peer → Needs update, disabled', () => {
    const [i] = trayTeammateItems([mk('a', 'Ali', { compatible: false })], {}, NOW, 'me');
    expect(i).toMatchObject({ label: 'Ali — Needs update', enabled: false, action: null });
  });
  it('paused peer → Paused, disabled', () => {
    const [i] = trayTeammateItems([mk('a', 'Ali', { paused: true })], {}, NOW, 'me');
    expect(i).toMatchObject({ label: 'Ali — Paused', enabled: false, action: null });
  });
  it('away idle peer is still knockable', () => {
    const [i] = trayTeammateItems([mk('a', 'Ali', { away: true })], {}, NOW, 'me');
    expect(i).toMatchObject({ label: 'Ali — Away', enabled: true, action: 'knock' });
  });
  it('knocking → cancel action', () => {
    const out: Record<string, OutgoingView> = { a: { kind: 'knocking' } };
    const [i] = trayTeammateItems([mk('a', 'Ali')], out, NOW, 'me');
    expect(i).toMatchObject({ label: 'Ali — Knocking… · Cancel', enabled: true, action: 'cancel' });
  });
  it('not-answered → cancel action', () => {
    const [i] = trayTeammateItems([mk('a', 'Ali')], { a: { kind: 'not-answered' } }, NOW, 'me');
    expect(i).toMatchObject({ label: 'Ali — Not answered yet · Cancel', action: 'cancel', enabled: true });
  });
  it('busy → "Busy until hh:mm", knock only once allowed', () => {
    const until = new Date(2026, 10, 12, 14, 5, 0).getTime();
    const [cool] = trayTeammateItems([mk('a', 'Ali')], { a: { kind: 'busy', until, canKnock: false } }, NOW, 'me');
    expect(cool).toEqual({ peerId: 'a', label: 'Ali — Busy until 14:05', enabled: false, action: null });
    const [ok] = trayTeammateItems([mk('a', 'Ali')], { a: { kind: 'busy', until, canKnock: true } }, NOW, 'me');
    expect(ok).toMatchObject({ enabled: true, action: 'knock' });
  });
  it('coming → Coming', () => {
    const [i] = trayTeammateItems([mk('a', 'Ali')], { a: { kind: 'coming', canKnock: false } }, NOW, 'me');
    expect(i).toMatchObject({ label: 'Ali — Coming', enabled: false, action: null });
  });
  it('sanitises untrusted names', () => {
    const [i] = trayTeammateItems([mk('a', 'Bad\nName\u202E' + 'x'.repeat(100))], {}, NOW, 'me');
    expect(i.label).toBe('Bad Name ' + 'x'.repeat(30) + '… — Online');
  });
  it('unnamed peer → "Unnamed"', () => {
    const [i] = trayTeammateItems([mk('a', '')], {}, NOW, 'me');
    expect(i.label).toBe('Unnamed — Online');
  });
});
