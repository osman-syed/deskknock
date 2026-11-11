import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { decode, encode, MAX_MESSAGE_BYTES, type Message } from '../core/protocol';

type Hello = Extract<Message, { t: 'hello' }>;

export interface TransportOpts {
  port: number;
  hello: () => Hello;
  photo: () => { png: Buffer; hash: string } | null;
  hasPhoto: (hash: string) => boolean;
  pingMs?: number;
  timeoutMs?: number;
  /** Window (ms) in which two sockets for one peer count as a simultaneous mutual dial. */
  simultaneousMs?: number;
}

interface Conn {
  ws: WebSocket;
  outgoing: boolean;
  peerId: string | null;
  photoHash: string | null;
  requested: Set<string>;
  lastSeen: number;
  registeredAt: number;
}

/**
 * Events: 'hello'(peerId, Hello), 'online'(peerId, boolean), 'message'(peerId, Message),
 * 'photo'(peerId, hash, png).
 */
export class Transport extends EventEmitter {
  private server: WebSocketServer | null = null;
  private readonly conns = new Set<Conn>();
  private readonly byPeer = new Map<string, Conn>();
  private timer: NodeJS.Timeout | null = null;
  private closed = false;
  private readonly pingMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly opts: TransportOpts) {
    super();
    this.pingMs = opts.pingMs ?? 10_000;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  get port(): number {
    const a = this.server?.address();
    return a && typeof a === 'object' ? a.port : this.opts.port;
  }

  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = new WebSocketServer({ port: this.opts.port, maxPayload: MAX_MESSAGE_BYTES });
      this.server = server;
      server.on('connection', (ws) => this.attach(ws, false));
      server.once('error', reject);
      server.once('listening', () => {
        server.off('error', reject);
        server.on('error', (e) => console.warn('transport server error', e));
        resolve();
      });
      this.timer = setInterval(() => this.heartbeat(), this.pingMs);
      this.timer.unref();
    });
  }

  connect(host: string, port: number): void {
    if (this.closed) return;
    const host_ = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    const ws = new WebSocket(`ws://${host_}:${port}`, { maxPayload: MAX_MESSAGE_BYTES });
    this.attach(ws, true);
  }

  isConnected(peerId: string): boolean {
    return this.byPeer.has(peerId);
  }

  send(peerId: string, m: Message): void {
    const c = this.byPeer.get(peerId);
    if (c) this.sendRaw(c, m);
  }

  broadcast(m: Message): void {
    for (const c of this.byPeer.values()) this.sendRaw(c, m);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const c of [...this.conns]) c.ws.terminate();
    const server = this.server;
    this.server = null;
    if (server) await new Promise<void>((r) => server.close(() => r()));
  }

  private sendRaw(c: Conn, m: Message): void {
    if (c.ws.readyState !== WebSocket.OPEN) return;
    try { c.ws.send(encode(m)); } catch (e) { console.warn('send failed', e); }
  }

  private attach(ws: WebSocket, outgoing: boolean): void {
    const c: Conn = { ws, outgoing, peerId: null, photoHash: null, requested: new Set(), lastSeen: Date.now(), registeredAt: 0 };
    this.conns.add(c);
    const sendHello = () => this.sendRaw(c, this.opts.hello());
    if (ws.readyState === WebSocket.OPEN) sendHello();
    else ws.once('open', sendHello);
    ws.on('pong', () => { c.lastSeen = Date.now(); });
    ws.on('message', (data, isBinary) => {
      c.lastSeen = Date.now();
      if (isBinary) { console.warn('dropping binary frame'); return; }
      this.onRaw(c, data.toString());
    });
    ws.on('error', (e) => console.warn('socket error', e.message));
    ws.on('close', () => {
      this.conns.delete(c);
      if (c.peerId && this.byPeer.get(c.peerId) === c) {
        this.byPeer.delete(c.peerId);
        this.emit('online', c.peerId, false);
      }
    });
  }

  private heartbeat(): void {
    const now = Date.now();
    for (const c of this.conns) {
      if (now - c.lastSeen > this.timeoutMs) { c.ws.terminate(); continue; }
      if (c.ws.readyState === WebSocket.OPEN) { try { c.ws.ping(); } catch { /* closing */ } }
    }
  }

  private onRaw(c: Conn, raw: string): void {
    const m = decode(raw);
    if (!m) { console.warn('dropping invalid message'); return; }
    if (m.t === 'hello') { this.onHello(c, m); return; }
    if (!c.peerId) { console.warn('dropping message before hello'); return; }
    switch (m.t) {
      case 'getPhoto': {
        const p = this.opts.photo();
        if (p) this.sendRaw(c, { t: 'photo', hash: p.hash, pngBase64: p.png.toString('base64') });
        return;
      }
      case 'photo': {
        const png = Buffer.from(m.pngBase64, 'base64');
        const actual = createHash('sha256').update(png).digest('hex');
        if (actual !== m.hash || m.hash !== c.photoHash) { console.warn('dropping photo with mismatched hash'); return; }
        this.emit('photo', c.peerId, m.hash, png);
        return;
      }
      default:
        this.emit('message', c.peerId, m);
    }
  }

  private onHello(c: Conn, h: Hello): void {
    if (c.peerId && c.peerId !== h.peerId) { console.warn('dropping hello with changed peerId'); return; }
    let isNew = false;
    if (!c.peerId) {
      if (h.peerId === this.opts.hello().peerId) { c.ws.close(); return; } // dialed ourselves
      const old = this.byPeer.get(h.peerId);
      if (old && old !== c && !this.prefer(c, old, h.peerId)) { c.ws.close(); return; }
      c.peerId = h.peerId;
      c.registeredAt = Date.now();
      this.byPeer.set(h.peerId, c);
      if (old && old !== c) old.ws.close(); // replaced: no offline event
      isNew = !old;
    }
    c.photoHash = h.photoHash;
    this.emit('hello', h.peerId, h); // before 'online' so consumers know the peer first
    if (isNew) this.emit('online', h.peerId, true);
    if (h.photoHash && !this.opts.hasPhoto(h.photoHash) && !c.requested.has(h.photoHash)) {
      c.requested.add(h.photoHash);
      this.sendRaw(c, { t: 'getPhoto' });
    }
  }

  /** Should the new socket replace the existing one for the same peer? */
  private prefer(fresh: Conn, old: Conn, theirId: string): boolean {
    if (fresh.outgoing === old.outgoing) return true; // newest wins
    if (Date.now() - old.registeredAt > (this.opts.simultaneousMs ?? 5_000)) return true; // not simultaneous
    // simultaneous dial: the side with the lower peerId keeps its outgoing socket
    const keepOutgoing = this.opts.hello().peerId < theirId;
    return fresh.outgoing === keepOutgoing;
  }
}
