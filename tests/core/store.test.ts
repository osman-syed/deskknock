import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Store } from '../../src/core/store';
import { DEFAULT_CHARACTER } from '../../src/core/character';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'dk-store-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('Store', () => {
  it('first run creates peerId and port 47321', () => {
    const s = new Store(dir).loadSettings();
    expect(s.peerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.port).toBe(47321);
    expect(s.manualPeers).toEqual([]);
  });
  it('peerId stable across loads', () => {
    expect(new Store(dir).loadSettings().peerId).toBe(new Store(dir).loadSettings().peerId);
  });
  it('invalid character.json falls back to default', () => {
    writeFileSync(join(dir, 'character.json'), '{"face":"nope"}');
    expect(new Store(dir).loadCharacter()).toEqual(DEFAULT_CHARACTER);
    writeFileSync(join(dir, 'character.json'), 'not json');
    expect(new Store(dir).loadCharacter()).toEqual(DEFAULT_CHARACTER);
  });
  it('photo hash is sha256 of png', () => {
    const st = new Store(dir);
    const png = Buffer.from([1, 2, 3, 4]);
    st.savePhoto(png);
    const p = st.loadPhoto()!;
    expect(p.hash).toBe(createHash('sha256').update(png).digest('hex'));
    expect(p.png.equals(png)).toBe(true);
  });
  it('round-trips settings, peers and peer photos', () => {
    const st = new Store(dir);
    const s = { ...st.loadSettings(), name: 'Ann', muted: true };
    st.saveSettings(s);
    expect(new Store(dir).loadSettings()).toEqual(s);
    const peer = { peerId: 'p1', name: 'Bob', appVersion: '1.0.0', protocolVersion: 1, character: DEFAULT_CHARACTER, photoHash: null };
    st.cachePeer(peer);
    expect(st.loadCachedPeers()).toEqual([peer]);
    st.cachePeerPhoto('abc', Buffer.from('x'));
    expect(st.loadPeerPhoto('abc')!.toString()).toBe('x');
    expect(st.loadPeerPhoto('../evil')).toBeNull();
    expect(st.loadPeerPhoto('zzz')).toBeNull();
  });
});

describe('Store character/photo additions', () => {
  it('hasCharacter false until saved', () => {
    const s = new Store(dir);
    expect(s.hasCharacter()).toBe(false);
    s.saveCharacter(DEFAULT_CHARACTER);
    expect(s.hasCharacter()).toBe(true);
  });
  it('clearPhoto removes the photo and is idempotent', () => {
    const s = new Store(dir);
    s.savePhoto(Buffer.from([1, 2, 3]));
    expect(s.loadPhoto()).not.toBeNull();
    s.clearPhoto();
    expect(s.loadPhoto()).toBeNull();
    expect(() => s.clearPhoto()).not.toThrow();
  });
});
