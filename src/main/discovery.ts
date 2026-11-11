import { Bonjour } from 'bonjour-service';

export const DEFAULT_PORT = 47321;
const RETRY_MS = 30_000;

export interface BonjourService {
  port: number;
  addresses?: string[];
  referer?: { address: string };
  txt?: Record<string, unknown>;
}
export interface BonjourLike {
  publish(o: { name: string; type: string; protocol: 'tcp'; port: number; txt: Record<string, string> }): { stop?: (cb?: () => void) => void };
  find(o: { type: string; protocol: 'tcp' }): {
    on(ev: 'up', cb: (s: BonjourService) => void): unknown;
    stop(): void;
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
  private browser: { stop(): void } | null = null;
  private published: { stop?: (cb?: () => void) => void } | null = null;
  private manual: { host: string; port: number }[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly retryMs: number;

  constructor(private readonly opts: {
    peerId: string; name: string; port: number;
    connect: (host: string, port: number) => void;
    bonjour?: BonjourLike; retryMs?: number;
  }) {
    this.retryMs = opts.retryMs ?? RETRY_MS;
  }

  start(): void {
    if (this.bonjour) return;
    const b = this.opts.bonjour ?? (new Bonjour() as unknown as BonjourLike);
    this.bonjour = b;
    this.published = b.publish({ name: `deskknock-${this.opts.peerId}`, type: 'deskknock', protocol: 'tcp', port: this.opts.port, txt: { peerId: this.opts.peerId } });
    const browser = b.find({ type: 'deskknock', protocol: 'tcp' });
    this.browser = browser;
    browser.on('up', (s) => this.onUp(s));
  }

  setManualPeers(list: string[]): void {
    this.manual = [];
    for (const s of list) {
      const p = parseManualPeer(s);
      if (p) this.manual.push(p);
      else console.warn('ignoring invalid manual peer', s);
    }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (!this.manual.length) return;
    this.dialManual();
    this.timer = setInterval(() => this.dialManual(), this.retryMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try { this.browser?.stop(); } catch { /* ignore */ }
    try { this.published?.stop?.(); } catch { /* ignore */ }
    try { this.bonjour?.destroy(); } catch { /* ignore */ }
    this.browser = null; this.published = null; this.bonjour = null;
  }

  private dialManual(): void {
    for (const p of this.manual) this.opts.connect(p.host, p.port);
  }

  private onUp(s: BonjourService): void {
    if (s.txt?.peerId === this.opts.peerId) return;
    const host = s.addresses?.find(isIPv4) ?? s.referer?.address;
    if (!host) return;
    this.opts.connect(host, s.port);
  }
}
