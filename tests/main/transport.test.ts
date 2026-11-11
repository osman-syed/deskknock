import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import WebSocket from 'ws';
import { Transport } from '../../src/main/transport';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import { PROTOCOL_VERSION, type Message } from '../../src/core/protocol';

type Hello = Extract<Message, { t: 'hello' }>;
const mkHello = (peerId: string, photoHash: string | null = null): Hello =>
  ({ t: 'hello', peerId, name: peerId, appVersion: '1.0.0', protocolVersion: PROTOCOL_VERSION, character: DEFAULT_CHARACTER, photoHash });

const open: Transport[] = [];
const sockets: WebSocket[] = [];
async function mk(peerId: string, extra: Partial<ConstructorParameters<typeof Transport>[0]> = {}, photoHash: string | null = null) {
  const t = new Transport({
    port: 0, hello: () => mkHello(peerId, photoHash),
    photo: () => null, hasPhoto: () => true, ...extra,
  });
  open.push(t);
  await t.listen();
  return t;
}
const once = <T extends unknown[] = [string, boolean]>(t: Transport, ev: string, pred: (...a: T) => boolean = () => true) =>
  new Promise<T>((res) => {
    const f = (...a: unknown[]) => { if (pred(...(a as T))) { t.off(ev, f); res(a as T); } };
    t.on(ev, f);
  });
const waitFor = async (cond: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond()) { if (Date.now() > end) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 10)); }
};

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await Promise.all(open.splice(0).map((t) => t.close()));
  warn.mockRestore();
});

describe('Transport', () => {
  it('hello exchange emits online on both', async () => {
    const a = await mk('a'), b = await mk('b');
    const pa = once<[string, boolean]>(a, 'online', (id, on) => id === 'b' && on);
    const pb = once<[string, boolean]>(b, 'online', (id, on) => id === 'a' && on);
    const ha = once<[string, Hello]>(a, 'hello');
    a.connect('127.0.0.1', b.port);
    await Promise.all([pa, pb]);
    expect((await ha)[1].peerId).toBe('b');
  });

  it('send delivers message', async () => {
    const a = await mk('a'), b = await mk('b');
    const online = Promise.all([
      once(b, 'online', (id, on) => id === 'a' && on),
      once(a, 'online', (id, on) => id === 'b' && on),
    ]);
    a.connect('127.0.0.1', b.port);
    await online;
    const got = once<[string, Message]>(b, 'message');
    a.send('b', { t: 'knock', id: 'k1' });
    expect(await got).toEqual(['a', { t: 'knock', id: 'k1' }]);
    a.send('nobody', { t: 'knock', id: 'x' }); // no-op
  });

  it('same peerId from new address replaces old connection', async () => {
    const b = await mk('b');
    const events: boolean[] = [];
    b.on('online', (id, on) => { if (id === 'a') events.push(on); });
    const a1 = await mk('a');
    const a2 = await mk('a');
    a1.connect('127.0.0.1', b.port);
    await waitFor(() => events.length === 1);
    a2.connect('127.0.0.1', b.port);
    await new Promise((r) => setTimeout(r, 200));
    expect(events).toEqual([true]);
    // a1's connection was closed by b; a2 is live
    await waitFor(() => !a1.isConnected('b'));
    const got = once<[string, Message]>(b, 'message');
    a2.send('b', { t: 'knock', id: 'k2' });
    expect((await got)[1]).toEqual({ t: 'knock', id: 'k2' });
  });

  it('invalid json is dropped and connection survives', async () => {
    const b = await mk('b');
    const ws = new WebSocket(`ws://127.0.0.1:${b.port}`);
    sockets.push(ws);
    await new Promise((r) => ws.on('open', r));
    ws.send(JSON.stringify(mkHello('x')));
    await once(b, 'online', (id, on) => id === 'x' && on);
    ws.send('{not json');
    ws.send(JSON.stringify({ t: 'bogus' }));
    const got = once<[string, Message]>(b, 'message');
    ws.send(JSON.stringify({ t: 'knock', id: 'ok' }));
    expect((await got)[1]).toEqual({ t: 'knock', id: 'ok' });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect(warn).toHaveBeenCalled();
  });

  it('close emits online false on the other side', async () => {
    const a = await mk('a'), b = await mk('b');
    const on = once(b, 'online', (id, o) => id === 'a' && o);
    a.connect('127.0.0.1', b.port);
    await on;
    const off = once(b, 'online', (id, o) => id === 'a' && !o);
    await a.close();
    await off;
  });

  it('photo fetched once and hash-verified', async () => {
    const png = Buffer.from('fake-png-bytes');
    const hash = createHash('sha256').update(png).digest('hex');
    const cache = new Set<string>();
    let served = 0;
    const a = await mk('a', { photo: () => { served++; return { png, hash }; } }, hash);
    const b = await mk('b', { hasPhoto: (h) => cache.has(h) });
    const photo = once<[string, string, Buffer]>(b, 'photo');
    b.on('photo', (_id, h) => cache.add(h));
    b.connect('127.0.0.1', a.port);
    const [pid, h, buf] = await photo;
    expect([pid, h, buf.equals(png)]).toEqual(['a', hash, true]);
    // re-send hello: no second fetch
    const hellos: number[] = [];
    b.on('hello', () => hellos.push(1));
    a.broadcast(mkHello('a', hash));
    await waitFor(() => hellos.length >= 1);
    await new Promise((r) => setTimeout(r, 100));
    expect(served).toBe(1);
  });

  it('mismatched photo hash is dropped', async () => {
    const png = Buffer.from('real');
    const claimed = createHash('sha256').update('other').digest('hex');
    const a = await mk('a', { photo: () => ({ png, hash: claimed }) }, claimed);
    const b = await mk('b', { hasPhoto: () => false });
    const onPhoto = vi.fn();
    b.on('photo', onPhoto);
    b.connect('127.0.0.1', a.port);
    await waitFor(() => warn.mock.calls.length > 0);
    expect(onPhoto).not.toHaveBeenCalled();
  });

  it('ping timeout closes a silent peer', async () => {
    const a = await mk('a', { pingMs: 50, timeoutMs: 150 });
    // raw ws client that never answers pings (auto-pong disabled by pausing socket)
    const ws = new WebSocket(`ws://127.0.0.1:${a.port}`, { autoPong: false } as any);
    sockets.push(ws);
    await new Promise((r) => ws.on('open', r));
    ws.send(JSON.stringify(mkHello('x')));
    await once(a, 'online', (id, on) => id === 'x' && on);
    await once(a, 'online', (id, on) => id === 'x' && !on);
  });
});
