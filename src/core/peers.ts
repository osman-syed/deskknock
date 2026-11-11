import { EventEmitter } from 'node:events';
import { PROTOCOL_VERSION, type Message } from './protocol';
import type { Character } from './character';

export interface PeerProfile {
  peerId: string;
  name: string;
  appVersion: string;
  protocolVersion: number;
  character: Character;
  photoHash: string | null;
}

export interface PeerView extends PeerProfile {
  online: boolean;
  compatible: boolean;
  paused: boolean;
  away: boolean;
}

interface Entry { profile: PeerProfile; online: boolean; paused: boolean; away: boolean }

/** Parses "x.y.z[-pre]" into numeric parts; null if not semver-like. */
function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export class PeerRegistry extends EventEmitter {
  private readonly peers = new Map<string, Entry>();

  constructor(cached: PeerProfile[] = []) {
    super();
    for (const p of cached) this.peers.set(p.peerId, { profile: p, online: false, paused: false, away: false });
  }

  upsertFromHello(hello: Extract<Message, { t: 'hello' }>): void {
    const { t: _t, ...profile } = hello;
    const e = this.peers.get(hello.peerId);
    if (e) e.profile = profile;
    else this.peers.set(hello.peerId, { profile, online: false, paused: false, away: false });
    this.emit('changed');
  }

  setOnline(peerId: string, online: boolean): void {
    const e = this.peers.get(peerId);
    if (!e) return;
    e.online = online;
    if (!online) { e.paused = false; e.away = false; }
    this.emit('changed');
  }

  setPresence(peerId: string, p: { paused: boolean; away: boolean }): void {
    const e = this.peers.get(peerId);
    if (!e) return;
    e.paused = p.paused;
    e.away = p.away;
    this.emit('changed');
  }

  list(): PeerView[] {
    return [...this.peers.values()]
      .map((e) => ({
        ...e.profile,
        online: e.online,
        compatible: e.profile.protocolVersion === PROTOCOL_VERSION,
        paused: e.paused,
        away: e.away,
      }))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }

  newerAppVersionSeen(mine: string): string | null {
    const m = parseVersion(mine);
    if (!m) return null;
    let best: { raw: string; v: number[] } | null = null;
    for (const { profile } of this.peers.values()) {
      const v = parseVersion(profile.appVersion);
      if (v && cmp(v, m) > 0 && (!best || cmp(v, best.v) > 0)) best = { raw: profile.appVersion, v };
    }
    return best ? best.raw : null;
  }
}
