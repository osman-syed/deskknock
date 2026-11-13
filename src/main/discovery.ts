import { Bonjour } from 'bonjour-service';
import { DEFAULT_PORT } from '../core/store';

export { DEFAULT_PORT };
const RETRY_MS = 30_000;

export interface BonjourService {
  port: number;
  addresses?: string[];
  referer?: { address: string };
  txt?: Record<string, unknown>;
}
export interface BonjourLike {
  publish(o: { name: string; type: string; protocol: 'tcp'; port: number; host?: string; txt: Record<string, string> }): { stop?: (cb?: () => void) => void };
  find(o: { type: string; protocol: 'tcp' }): {
    on(ev: 'up' | 'srv-update' | 'txt-update', cb: (s: BonjourService) => void): unknown;
    stop(): void;
    update?(): void;
  };
  destroy(): void;
}

export function parseManualPeer(s: string): { host: string; port: number } | null {
  const m = /^\s*([^\s:]+)(?::(\d{1,5}))?\s*$/.exec(s);
  if (!m) return null;
  const host = m[1];
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && host.split('.').every((o) => Number(o) <= 255);
  const isName = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host) && /[A-Za-z]/.test(host);
  if (!isIp && !isName) return null;
  const port = m[2] ? Number(m[2]) : DEFAULT_PORT;
  if (port < 1 || port > 65535) return null;
  return { host, port };
}

const isIPv4 = (a: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a);

export class Discovery {
  private bonjour: BonjourLike | null = null;
  private browser: { stop(): void; update?(): void } | null = null;
  private published: { stop?: (cb?: () => void) => void } | null = null;
  private manual: { host: string; port: number }[] = [];
  /** Last known address of each mDNS-discovered peer; bonjour only emits 'up' once per service name. */
  private readonly known = new Map<string, { host: string; port: number }>();
  private timer: NodeJS.Timeout | null = null;
  private readonly retryMs: number;

  constructor(private readonly opts: {
    peerId: string; name: string; port: number;
    connect: (host: string, port: number) => void;
    /** Whether a peer currently has a live connection; disconnected known peers are redialed. */
    isConnected?: (peerId: string) => boolean;
    bonjour?: BonjourLike; retryMs?: number;
  }) {
    this.retryMs = opts.retryMs ?? RETRY_MS;
  }

  start(): void {
    if (this.bonjour) return;
    // Default errorCallback throws inside an mDNS socket callback (uncaught in main); log instead.
    const b = this.opts.bonjour ?? (new Bonjour({}, (e: unknown) => console.warn('mdns', e)) as unknown as BonjourLike);
    this.bonjour = b;
    // Unique mDNS host name: identical machine hostnames must not collide.
    this.published = b.publish({ name: `deskknock-${this.opts.peerId}`, type: 'deskknock', protocol: 'tcp', port: this.opts.port, host: `deskknock-${this.opts.peerId}.local`, txt: { peerId: this.opts.peerId } });
    const browser = b.find({ type: 'deskknock', protocol: 'tcp' });
    this.browser = browser;
    browser.on('up', (s) => this.onUp(s));
    browser.on('srv-update', (s) => this.remember(s));
    browser.on('txt-update', (s) => this.remember(s));
    this.timer = setInterval(() => this.retry(), this.retryMs);
    this.timer.unref?.();
  }

  setManualPeers(list: string[]): void {
    this.manual = [];
    for (const s of list) {
      const p = parseManualPeer(s);
      if (p) this.manual.push(p);
      else console.warn('ignoring invalid manual peer', s);
    }
    this.dialManual();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try { this.browser?.stop(); } catch { /* ignore */ }
    try { this.published?.stop?.(); } catch { /* ignore */ }
    try { this.bonjour?.destroy(); } catch { /* ignore */ }
    this.browser = null; this.published = null; this.bonjour = null;
    this.known.clear();
  }

  private connected(peerId: string): boolean {
    return this.opts.isConnected?.(peerId) ?? false;
  }

  private retry(): void {
    try { this.browser?.update?.(); } catch (e) { console.warn('mdns query failed', e); }
    for (const [peerId, a] of this.known) if (!this.connected(peerId)) this.opts.connect(a.host, a.port);
    this.dialManual();
  }

  private dialManual(): void {
    for (const p of this.manual) {
      // Skip addresses we already know belong to a connected peer.
      let taken = false;
      for (const [peerId, a] of this.known) {
        if (a.host === p.host && a.port === p.port && this.connected(peerId)) { taken = true; break; }
      }
      if (!taken) this.opts.connect(p.host, p.port);
    }
  }

  /** Records the service's address under its peerId; returns it, or null for our own/unusable services. */
  private remember(s: BonjourService): { host: string; port: number } | null {
    const peerId = s.txt?.peerId;
    if (peerId === this.opts.peerId) return null;
    // Office laptops can share a hostname (same OS image), so resolved addresses may point at
    // ourselves (127.0.1.1). Prefer the packet's real source, and never use loopback.
    const usable = (ip: string | undefined): ip is string => !!ip && isIPv4(ip) && !ip.startsWith('127.');
    const host = usable(s.referer?.address) ? s.referer.address : s.addresses?.find(usable);
    if (!host) return null;
    const a = { host, port: s.port };
    if (typeof peerId === 'string' && peerId) this.known.set(peerId, a);
    return a;
  }

  private onUp(s: BonjourService): void {
    const a = this.remember(s);
    if (a) this.opts.connect(a.host, a.port);
  }
}
