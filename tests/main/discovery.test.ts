import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Discovery, parseManualPeer, type BonjourLike } from '../../src/main/discovery';

function fakeBonjour() {
  const browser = new EventEmitter() as EventEmitter & { stop: () => void; update: () => void };
  browser.stop = vi.fn();
  browser.update = vi.fn();
  const published: unknown[] = [];
  const unpublish = vi.fn();
  const b: BonjourLike = {
    publish: (o) => { published.push(o); return { stop: unpublish }; },
    find: () => browser,
    destroy: vi.fn(),
  };
  return { b, browser, published, unpublish };
}

describe('parseManualPeer', () => {
  it('parses ip with default port', () => expect(parseManualPeer('10.0.0.5')).toEqual({ host: '10.0.0.5', port: 47321 }));
  it('parses ip:port', () => expect(parseManualPeer('10.0.0.5:5000')).toEqual({ host: '10.0.0.5', port: 5000 }));
  it('rejects nonsense', () => expect(parseManualPeer('nonsense:x')).toBeNull());
});

describe('Discovery', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); vi.useRealTimers(); });

  it('publishes and ignores own service', () => {
    const f = fakeBonjour(); const connect = vi.fn();
    new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b }).start();
    expect(f.published[0]).toMatchObject({ type: 'deskknock', protocol: 'tcp', port: 47321, txt: { peerId: 'me' } });
    f.browser.emit('up', { port: 47321, addresses: ['10.0.0.1'], txt: { peerId: 'me' } });
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects to discovered peer using first IPv4', () => {
    const f = fakeBonjour(); const connect = vi.fn();
    new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b }).start();
    f.browser.emit('up', { port: 47321, addresses: ['fe80::1', '10.0.0.9'], txt: { peerId: 'other' } });
    expect(connect).toHaveBeenCalledWith('10.0.0.9', 47321);
  });

  it('same-hostname laptops: ignores loopback addresses and prefers the real source address', () => {
    const f = fakeBonjour(); const connect = vi.fn();
    new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b }).start();
    f.browser.emit('up', { port: 47321, addresses: ['127.0.1.1'], referer: { address: '192.168.1.75' }, txt: { peerId: 'other' } });
    expect(connect).toHaveBeenCalledWith('192.168.1.75', 47321);
    f.browser.emit('up', { port: 47321, addresses: ['127.0.1.1'], txt: { peerId: 'third' } });
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('publishes a unique mDNS host name per peer', () => {
    const f = fakeBonjour();
    new Discovery({ peerId: 'abc', name: 'Me', port: 47321, connect: vi.fn(), bonjour: f.b }).start();
    expect(f.published[0]).toMatchObject({ host: 'deskknock-abc.local' });
  });

  it('falls back to referer address', () => {
    const f = fakeBonjour(); const connect = vi.fn();
    new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b }).start();
    f.browser.emit('up', { port: 1234, addresses: [], referer: { address: '10.0.0.7' }, txt: { peerId: 'other' } });
    expect(connect).toHaveBeenCalledWith('10.0.0.7', 1234);
  });

  it('manual peers connect now and every interval; replaced list drops old; invalid skipped', () => {
    vi.useFakeTimers();
    const f = fakeBonjour(); const connect = vi.fn();
    const d = new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b });
    d.start();
    d.setManualPeers(['10.0.0.5', 'nonsense:x']);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenLastCalledWith('10.0.0.5', 47321);
    expect(warn).toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(connect).toHaveBeenCalledTimes(2);
    d.setManualPeers(['10.0.0.6:5000']);
    expect(connect).toHaveBeenLastCalledWith('10.0.0.6', 5000);
    connect.mockClear();
    vi.advanceTimersByTime(30_000);
    expect(connect.mock.calls).toEqual([['10.0.0.6', 5000]]);
    d.stop();
    connect.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(connect).not.toHaveBeenCalled();
  });

  it('redials a remembered mDNS peer on the timer when not connected, and re-queries', () => {
    vi.useFakeTimers();
    const f = fakeBonjour(); const connect = vi.fn();
    const connected = new Set<string>();
    const d = new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b, isConnected: (id) => connected.has(id) });
    d.start();
    d.setManualPeers([]);
    f.browser.emit('up', { port: 47321, addresses: ['10.0.0.9'], txt: { peerId: 'other' } });
    expect(connect).toHaveBeenCalledTimes(1);
    connect.mockClear();
    vi.advanceTimersByTime(30_000);
    expect(connect.mock.calls).toEqual([['10.0.0.9', 47321]]);
    expect(f.browser.update).toHaveBeenCalled();
    d.stop();
  });

  it('uses the latest address from srv-update for redials', () => {
    vi.useFakeTimers();
    const f = fakeBonjour(); const connect = vi.fn();
    const d = new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b, isConnected: () => false });
    d.start();
    f.browser.emit('up', { port: 47321, addresses: ['10.0.0.9'], txt: { peerId: 'other' } });
    f.browser.emit('srv-update', { port: 5000, addresses: ['10.0.0.10'], txt: { peerId: 'other' } }, {});
    connect.mockClear();
    vi.advanceTimersByTime(30_000);
    expect(connect.mock.calls).toEqual([['10.0.0.10', 5000]]);
    d.stop();
  });

  it('does not redial a remembered mDNS peer that is connected', () => {
    vi.useFakeTimers();
    const f = fakeBonjour(); const connect = vi.fn();
    const d = new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b, isConnected: (id) => id === 'other' });
    d.start();
    f.browser.emit('up', { port: 47321, addresses: ['10.0.0.9'], txt: { peerId: 'other' } });
    connect.mockClear();
    vi.advanceTimersByTime(30_000);
    expect(connect).not.toHaveBeenCalled();
    d.stop();
  });

  it('never dials its own peerId, even on the timer', () => {
    vi.useFakeTimers();
    const f = fakeBonjour(); const connect = vi.fn();
    const d = new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b, isConnected: () => false });
    d.start();
    f.browser.emit('up', { port: 47321, addresses: ['10.0.0.1'], txt: { peerId: 'me' } });
    f.browser.emit('txt-update', { port: 47321, addresses: ['10.0.0.1'], txt: { peerId: 'me' } }, {});
    vi.advanceTimersByTime(60_000);
    expect(connect).not.toHaveBeenCalled();
    d.stop();
  });

  it('manual redial skips a host that belongs to a connected mDNS peer', () => {
    vi.useFakeTimers();
    const f = fakeBonjour(); const connect = vi.fn();
    const d = new Discovery({ peerId: 'me', name: 'Me', port: 47321, connect, bonjour: f.b, isConnected: (id) => id === 'other' });
    d.start();
    f.browser.emit('up', { port: 47321, addresses: ['10.0.0.9'], txt: { peerId: 'other' } });
    d.setManualPeers(['10.0.0.9', '10.0.0.5']);
    connect.mockClear();
    vi.advanceTimersByTime(30_000);
    expect(connect.mock.calls).toEqual([['10.0.0.5', 47321]]);
    d.stop();
  });
});
