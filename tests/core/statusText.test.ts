import { describe, it, expect } from 'vitest';
import { statusText } from '../../src/core/statusText';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import type { PeerView } from '../../src/core/peers';

const peer: PeerView = {
  peerId: 'b', name: 'Sara', appVersion: '0.1.0', protocolVersion: 1, character: DEFAULT_CHARACTER,
  photoHash: null, online: true, compatible: true, paused: false, away: false,
};
const NOW = new Date(2026, 10, 12, 14, 0, 0).getTime();

describe('statusText', () => {
  it('offline → disabled', () => {
    expect(statusText({ kind: 'idle', canKnock: true }, { ...peer, online: false }, NOW).knockEnabled).toBe(false);
  });
  it('incompatible → Needs update, disabled', () => {
    expect(statusText({ kind: 'idle', canKnock: true }, { ...peer, compatible: false }, NOW))
      .toEqual({ label: 'Needs update', knockEnabled: false });
  });
  it('paused peer → Paused, disabled', () => {
    expect(statusText({ kind: 'idle', canKnock: true }, { ...peer, paused: true }, NOW))
      .toEqual({ label: 'Paused', knockEnabled: false });
  });
  it('paused view → Paused, disabled', () => {
    expect(statusText({ kind: 'paused' }, peer, NOW)).toEqual({ label: 'Paused', knockEnabled: false });
  });
  it('knocking → Knocking…', () => {
    expect(statusText({ kind: 'knocking' }, peer, NOW)).toEqual({ label: 'Knocking…', knockEnabled: false });
    expect(statusText({ kind: 'shown' }, peer, NOW).label).toBe('Knocking…');
    expect(statusText({ kind: 'queued' }, peer, NOW).label).toBe('Knocking…');
  });
  it('not-answered → Not answered yet', () => {
    expect(statusText({ kind: 'not-answered' }, peer, NOW)).toEqual({ label: 'Not answered yet', knockEnabled: false });
  });
  it('busy until 14:05 local → Busy until 14:05', () => {
    const until = new Date(2026, 10, 12, 14, 5, 0).getTime();
    expect(statusText({ kind: 'busy', until, canKnock: false }, peer, NOW))
      .toEqual({ label: 'Busy until 14:05', knockEnabled: false });
  });
  it('busy zero-pads hours', () => {
    const until = new Date(2026, 10, 12, 9, 7, 0).getTime();
    expect(statusText({ kind: 'busy', until, canKnock: true }, peer, NOW))
      .toEqual({ label: 'Busy until 09:07', knockEnabled: true });
  });
  it('away → Away', () => {
    expect(statusText({ kind: 'away' }, peer, NOW)).toEqual({ label: 'Away', knockEnabled: false });
  });
  it('coming → Coming, follows canKnock', () => {
    expect(statusText({ kind: 'coming', canKnock: false }, peer, NOW)).toEqual({ label: 'Coming', knockEnabled: false });
    expect(statusText({ kind: 'coming', canKnock: true }, peer, NOW)).toEqual({ label: 'Coming', knockEnabled: true });
  });
  it('dismissed → Seen', () => {
    expect(statusText({ kind: 'dismissed', canKnock: true }, peer, NOW)).toEqual({ label: 'Seen', knockEnabled: true });
  });
  it('idle during cooldown → disabled', () => {
    expect(statusText({ kind: 'idle', canKnock: false }, peer, NOW).knockEnabled).toBe(false);
  });
  it('idle and online → enabled', () => {
    expect(statusText({ kind: 'idle', canKnock: true }, peer, NOW).knockEnabled).toBe(true);
  });
  it('peer state wins over the view', () => {
    expect(statusText({ kind: 'coming', canKnock: true }, { ...peer, compatible: false }, NOW).label).toBe('Needs update');
    expect(statusText({ kind: 'knocking' }, { ...peer, online: false }, NOW).knockEnabled).toBe(false);
  });
});
