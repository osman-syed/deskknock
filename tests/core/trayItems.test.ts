import { describe, it, expect } from 'vitest';
import { trayHeader, trayTeammateItems, TRAY_EMPTY_LABEL } from '../../src/core/trayItems';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import type { PeerView } from '../../src/core/peers';
import type { OutgoingView } from '../../src/core/knockEngine';

const mk = (peerId: string, name: string, over: Partial<PeerView> = {}): PeerView => ({
  peerId, name, appVersion: '0.1.0', protocolVersion: 1, character: DEFAULT_CHARACTER,
  photoHash: null, online: true, compatible: true, paused: false, away: false, ...over,
});
const NOW = new Date(2026, 10, 12, 14, 0, 0).getTime();
const one = (p: PeerView, v?: OutgoingView) => trayTeammateItems([p], v ? { [p.peerId]: v } : {}, NOW, 'me')[0];

describe('trayTeammateItems', () => {
  it('empty list → no items', () => {
    expect(trayTeammateItems([], {}, NOW, 'me')).toEqual([]);
  });
  it('excludes self and keeps the given (online-first, by name) order', () => {
    const peers = [mk('a', 'Ali'), mk('me', 'Osman'), mk('z', 'Zed'), mk('b', 'Bea', { online: false })];
    expect(trayTeammateItems(peers, {}, NOW, 'me').map((i) => i.peerId)).toEqual(['a', 'z', 'b']);
  });
  it('idle online peer → green dot alone, knock enabled, carries the character', () => {
    expect(one(mk('a', 'Ali'))).toEqual({
      peerId: 'a', label: 'Ali   🟢', dot: '🟢', enabled: true, action: 'knock', character: DEFAULT_CHARACTER,
    });
  });
  it('dismissed → 🟢 Seen', () => {
    expect(one(mk('a', 'Ali'), { kind: 'dismissed', canKnock: true })).toMatchObject({
      label: 'Ali   🟢 Seen', dot: '🟢', enabled: true, action: 'knock',
    });
  });
  it('coming → 🟢 Coming', () => {
    expect(one(mk('a', 'Ali'), { kind: 'coming', canKnock: false })).toMatchObject({
      label: 'Ali   🟢 Coming', dot: '🟢', enabled: false, action: null,
    });
  });
  for (const kind of ['knocking', 'shown', 'queued'] as const) {
    it(`${kind} → 🟡 Knocking… · Cancel`, () => {
      expect(one(mk('a', 'Ali'), { kind })).toMatchObject({
        label: 'Ali   🟡 Knocking… · Cancel', dot: '🟡', enabled: true, action: 'cancel',
      });
    });
  }
  it('not-answered → 🟡 Not answered yet · Cancel', () => {
    expect(one(mk('a', 'Ali'), { kind: 'not-answered' })).toMatchObject({
      label: 'Ali   🟡 Not answered yet · Cancel', dot: '🟡', enabled: true, action: 'cancel',
    });
  });
  it('busy → 🟡 Busy until hh:mm, knock only once allowed', () => {
    const until = new Date(2026, 10, 12, 14, 5, 0).getTime();
    expect(one(mk('a', 'Ali'), { kind: 'busy', until, canKnock: false })).toMatchObject({
      label: 'Ali   🟡 Busy until 14:05', dot: '🟡', enabled: false, action: null,
    });
    expect(one(mk('a', 'Ali'), { kind: 'busy', until, canKnock: true })).toMatchObject({ enabled: true, action: 'knock' });
  });
  it('away peer (idle) → 🔴 Away, still knockable', () => {
    expect(one(mk('a', 'Ali', { away: true }))).toMatchObject({
      label: 'Ali   🔴 Away', dot: '🔴', enabled: true, action: 'knock',
    });
  });
  it('away view (outstanding knock) → 🔴 Away · Cancel', () => {
    expect(one(mk('a', 'Ali'), { kind: 'away' })).toMatchObject({
      label: 'Ali   🔴 Away · Cancel', dot: '🔴', enabled: true, action: 'cancel',
    });
  });
  it('paused peer → 🔴 Paused, disabled', () => {
    expect(one(mk('a', 'Ali', { paused: true }))).toMatchObject({
      label: 'Ali   🔴 Paused', dot: '🔴', enabled: false, action: null,
    });
  });
  it('paused view → 🔴 Paused, disabled', () => {
    expect(one(mk('a', 'Ali'), { kind: 'paused' })).toMatchObject({
      label: 'Ali   🔴 Paused', dot: '🔴', enabled: false, action: null,
    });
  });
  it('incompatible peer → ⚪ Needs update, disabled', () => {
    expect(one(mk('a', 'Ali', { compatible: false }))).toMatchObject({
      label: 'Ali   ⚪ Needs update', dot: '⚪', enabled: false, action: null,
    });
  });
  it('offline peer → ⚪ Offline, disabled (even with a stale outgoing view)', () => {
    expect(one(mk('a', 'Ali', { online: false }), { kind: 'knocking' })).toMatchObject({
      label: 'Ali   ⚪ Offline', dot: '⚪', enabled: false, action: null,
    });
  });
  it('sanitises untrusted names', () => {
    expect(one(mk('a', 'Bad\nName‮' + 'x'.repeat(100))).label).toBe('Bad Name ' + 'x'.repeat(30) + '…   🟢');
  });
  it('unnamed peer → "Unnamed"', () => {
    expect(one(mk('a', '')).label).toBe('Unnamed   🟢');
  });
});

describe('trayHeader', () => {
  it('no teammates → "TEAM" and the empty row', () => {
    expect(trayHeader([], 'me')).toBe('TEAM');
    expect(trayHeader([mk('me', 'Osman')], 'me')).toBe('TEAM');
    expect(TRAY_EMPTY_LABEL).toBe('No teammates yet');
  });
  it('counts online teammates, self excluded', () => {
    const peers = [mk('a', 'Ali'), mk('me', 'Osman'), mk('z', 'Zed', { paused: true }), mk('b', 'Bea', { online: false })];
    expect(trayHeader(peers, 'me')).toBe('TEAM · 2 online');
  });
  it('all teammates offline → "TEAM · 0 online"', () => {
    expect(trayHeader([mk('b', 'Bea', { online: false })], 'me')).toBe('TEAM · 0 online');
  });
});
