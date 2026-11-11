import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Discovery, parseManualPeer, type BonjourLike } from '../../src/main/discovery';

function fakeBonjour() {
  const browser = new EventEmitter() as EventEmitter & { stop: () => void };
  browser.stop = vi.fn();
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
});
