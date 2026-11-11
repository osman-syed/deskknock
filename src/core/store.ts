import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CHARACTER, isCharacter, type Character } from './character';
import type { PeerProfile } from './peers';

export interface Settings {
  peerId: string;
  name: string;
  muted: boolean;
  paused: boolean;
  port: number;
  manualPeers: string[]; // "ip[:port]"
}

export const DEFAULT_PORT = 47321;
const SAFE_NAME = /^[A-Za-z0-9_-]{1,64}$/; // guards against path traversal

export class Store {
  constructor(private readonly dir: string) {
    mkdirSync(join(dir, 'peer-photos'), { recursive: true });
  }

  private path(...p: string[]): string { return join(this.dir, ...p); }

  private writeAtomic(file: string, data: string | Buffer): void {
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, data);
    renameSync(tmp, file);
  }

  private readJson(file: string): unknown {
    try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
  }

  loadSettings(): Settings {
    const raw = this.readJson(this.path('settings.json'));
    const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const s: Settings = {
      peerId: typeof o.peerId === 'string' && o.peerId ? o.peerId : randomUUID(),
      name: typeof o.name === 'string' ? o.name : '',
      muted: o.muted === true,
      paused: o.paused === true,
      port: typeof o.port === 'number' && Number.isInteger(o.port) && o.port >= 0 && o.port <= 65535 ? o.port : DEFAULT_PORT,
      manualPeers: Array.isArray(o.manualPeers) ? o.manualPeers.filter((x): x is string => typeof x === 'string') : [],
    };
    if (typeof o.peerId !== 'string' || !o.peerId) this.saveSettings(s);
    return s;
  }

  saveSettings(s: Settings): void {
    this.writeAtomic(this.path('settings.json'), JSON.stringify(s, null, 2));
  }

  hasCharacter(): boolean { return existsSync(this.path('character.json')); }

  loadCharacter(): Character {
    const raw = this.readJson(this.path('character.json'));
    return isCharacter(raw) ? raw : { ...DEFAULT_CHARACTER };
  }

  saveCharacter(c: Character): void {
    this.writeAtomic(this.path('character.json'), JSON.stringify(c));
  }

  loadPhoto(): { png: Buffer; hash: string } | null {
    try {
      const png = readFileSync(this.path('photo.png'));
      return { png, hash: sha256(png) };
    } catch { return null; }
  }

  savePhoto(png: Buffer): void {
    this.writeAtomic(this.path('photo.png'), png);
  }

  clearPhoto(): void { rmSync(this.path('photo.png'), { force: true }); }

  cachePeer(p: PeerProfile): void {
    const all = this.loadCachedPeers().filter((x) => x.peerId !== p.peerId);
    all.push(p);
    this.writeAtomic(this.path('peers.json'), JSON.stringify(all));
  }

  loadCachedPeers(): PeerProfile[] {
    const raw = this.readJson(this.path('peers.json'));
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is PeerProfile =>
      typeof p === 'object' && p !== null && typeof p.peerId === 'string' && typeof p.name === 'string' &&
      typeof p.appVersion === 'string' && typeof p.protocolVersion === 'number' && isCharacter(p.character) &&
      (p.photoHash === null || typeof p.photoHash === 'string'));
  }

  cachePeerPhoto(hash: string, png: Buffer): void {
    if (!SAFE_NAME.test(hash)) return;
    this.writeAtomic(this.path('peer-photos', `${hash}.png`), png);
  }

  loadPeerPhoto(hash: string): Buffer | null {
    if (!SAFE_NAME.test(hash)) return null;
    try { return readFileSync(this.path('peer-photos', `${hash}.png`)); } catch { return null; }
  }
}

export function sha256(b: Buffer): string {
  return createHash('sha256').update(b).digest('hex');
}
