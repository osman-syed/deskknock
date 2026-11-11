import { describe, it, expect } from 'vitest';
import { encode, decode, MAX_MESSAGE_BYTES, PROTOCOL_VERSION, type Message } from '../../src/core/protocol';
import { DEFAULT_CHARACTER } from '../../src/core/character';

const samples: Message[] = [
  { t: 'hello', peerId: 'p1', name: 'Ann', appVersion: '0.1.0', protocolVersion: PROTOCOL_VERSION, character: DEFAULT_CHARACTER, photoHash: null },
  { t: 'hello', peerId: 'p1', name: 'Ann', appVersion: '0.1.0', protocolVersion: PROTOCOL_VERSION, character: DEFAULT_CHARACTER, photoHash: 'abc' },
  { t: 'presence', paused: false, away: true },
  { t: 'knock', id: 'k1' },
  { t: 'status', id: 'k1', state: 'queued' },
  { t: 'reply', id: 'k1', answer: 'busy5' },
  { t: 'cancel', id: 'k1' },
  { t: 'getPhoto' },
  { t: 'photo', hash: 'abc', pngBase64: 'AAAA' },
];

describe('protocol', () => {
  it('round-trips every message type', () => {
    for (const m of samples) expect(decode(encode(m))).toEqual(m);
  });
  it('decode rejects non-JSON', () => {
    expect(decode('{oops')).toBeNull();
  });
  it('decode rejects unknown type', () => {
    expect(decode('{"t":"explode"}')).toBeNull();
  });
  it('decode rejects missing fields', () => {
    expect(decode('{"t":"reply","id":"x"}')).toBeNull();
    expect(decode('{"t":"reply","id":"x","answer":"maybe"}')).toBeNull();
  });
  it('decode rejects oversized', () => {
    expect(decode('x'.repeat(MAX_MESSAGE_BYTES + 1))).toBeNull();
  });
  it('decode rejects bad character in hello', () => {
    const bad = { ...samples[0], character: {} };
    expect(decode(JSON.stringify(bad))).toBeNull();
  });
  it('decode rejects non-object JSON', () => {
    for (const s of ['null', '42', '"x"', '[]']) expect(decode(s)).toBeNull();
  });
});
