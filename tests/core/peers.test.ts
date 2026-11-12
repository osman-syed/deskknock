import { describe, it, expect } from 'vitest';
import { PeerRegistry } from '../../src/core/peers';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import { PROTOCOL_VERSION } from '../../src/core/protocol';

const hello = (peerId: string, name: string, appVersion = '1.0.0', protocolVersion = PROTOCOL_VERSION) =>
  ({ t: 'hello' as const, peerId, name, appVersion, protocolVersion, character: DEFAULT_CHARACTER, photoHash: null });

describe('PeerRegistry', () => {
  it('incompatible protocolVersion is marked compatible:false', () => {
    const r = new PeerRegistry();
    r.upsertFromHello(hello('a', 'A', '1.0.0', PROTOCOL_VERSION + 1));
    r.upsertFromHello(hello('b', 'B'));
    const l = r.list();
    expect(l.find((p) => p.peerId === 'a')!.compatible).toBe(false);
    expect(l.find((p) => p.peerId === 'b')!.compatible).toBe(true);
  });
  it('peers with same name are separate', () => {
    const r = new PeerRegistry();
    r.upsertFromHello(hello('a', 'Sam'));
    r.upsertFromHello(hello('b', 'Sam'));
    expect(r.list()).toHaveLength(2);
  });
  it('newerAppVersionSeen returns highest semver above mine', () => {
    const r = new PeerRegistry();
    r.upsertFromHello(hello('a', 'A', '1.1.0'));
    r.upsertFromHello(hello('b', 'B', '1.3.0'));
    r.upsertFromHello(hello('c', 'C', '1.10.0-beta'));
    expect(r.newerAppVersionSeen('1.2.0')).toBe('1.10.0-beta');
    expect(r.newerAppVersionSeen('1.10.0')).toBeNull();
    expect(r.newerAppVersionSeen('2.0.0')).toBeNull();
  });
  it('sorts online first then name; emits changed; presence and online', () => {
    const r = new PeerRegistry();
    let n = 0;
    r.on('changed', () => n++);
    r.upsertFromHello(hello('a', 'Zed'));
    r.upsertFromHello(hello('b', 'Amy'));
    r.upsertFromHello(hello('c', 'Bob'));
    r.setOnline('a', true);
    r.setPresence('a', { paused: true, away: false });
    const l = r.list();
    expect(l.map((p) => p.name)).toEqual(['Zed', 'Amy', 'Bob']);
    expect(l[0]).toMatchObject({ online: true, paused: true, away: false });
    expect(n).toBe(5);
    r.setOnline('a', false);
    expect(r.list()[0].paused).toBe(false); // presence reset when offline
  });
  it('seeds from cached profiles as offline', () => {
    const r = new PeerRegistry([{ peerId: 'x', name: 'X', appVersion: '1.0.0', protocolVersion: 1, character: DEFAULT_CHARACTER, photoHash: null }]);
    expect(r.list()[0]).toMatchObject({ peerId: 'x', online: false });
  });
  it('online state applies regardless of setOnline/hello order', () => {
    const r = new PeerRegistry();
    r.setOnline('x', true);
    r.upsertFromHello(hello('x', 'X'));
    expect(r.list()[0].online).toBe(true);
    const r2 = new PeerRegistry();
    r2.upsertFromHello(hello('y', 'Y'));
    r2.setOnline('y', true);
    expect(r2.list()[0].online).toBe(true);
  });
});
