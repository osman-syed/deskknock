import { describe, it, expect, beforeEach } from 'vitest';
import { KnockEngine, type EngineEffects, type OutgoingView, type IncomingKnock } from '../../src/core/knockEngine';
import type { Message } from '../../src/core/protocol';

const A = 'peer-a';
const B = 'peer-b';
const C = 'peer-c';

let fx: EngineEffects & {
  sent: { peerId: string; m: Message }[];
  shown: { k: IncomingKnock; behind: number }[];
  hidden: string[];
  replies: { from: string; answer: string }[];
  views: { peerId: string; view: OutgoingView }[];
};
let now: number;
let n: number;
let eng: KnockEngine;

const lastView = (p: string) => [...fx.views].reverse().find((v) => v.peerId === p)?.view;
const total = () => fx.sent.length + fx.shown.length + fx.hidden.length + fx.replies.length + fx.views.length;

beforeEach(() => {
  now = 1_000_000;
  n = 0;
  fx = {
    sent: [], shown: [], hidden: [], replies: [], views: [],
    send(peerId, m) { this.sent.push({ peerId, m }); },
    showIncoming(k, behind) { this.shown.push({ k, behind }); },
    hideIncoming(id) { this.hidden.push(id); },
    showReply(from, answer) { this.replies.push({ from, answer }); },
    outgoingChanged(peerId, view) { this.views.push({ peerId, view }); },
  };
  eng = new KnockEngine(fx, () => now, () => `id${++n}`);
});

// caller helper: knock B, return its id
function knockB(): string {
  eng.peerOnline(B, true);
  expect(eng.knock(B)).toBe(true);
  return (fx.sent.find((s) => s.m.t === 'knock')!.m as { id: string }).id;
}

describe('caller side', () => {
  it('knock sends knock and shows Knocking…', () => {
    const id = knockB();
    expect(fx.sent).toEqual([{ peerId: B, m: { t: 'knock', id } }]);
    expect(lastView(B)).toEqual({ kind: 'knocking' });
  });

  it('knock is refused when peer was never brought online', () => {
    expect(eng.knock(B)).toBe(false);
    expect(fx.sent).toHaveLength(0);
  });

  it('second knock while unanswered is refused', () => {
    knockB();
    expect(eng.knock(B)).toBe(false);
    expect(fx.sent).toHaveLength(1);
  });

  it('status updates view', () => {
    const id = knockB();
    for (const state of ['queued', 'away', 'shown'] as const) {
      eng.onMessage(B, { t: 'status', id, state });
      expect(lastView(B)).toEqual({ kind: state });
    }
  });

  it('not answered after 2 min', () => {
    const id = knockB();
    eng.onMessage(B, { t: 'status', id, state: 'shown' });
    now += 119_999; eng.tick();
    expect(lastView(B)).toEqual({ kind: 'shown' });
    now += 1; eng.tick();
    expect(lastView(B)).toEqual({ kind: 'not-answered' });
  });

  it('cancel works from not-answered', () => {
    const id = knockB();
    now += 120_000; eng.tick();
    expect(lastView(B)).toEqual({ kind: 'not-answered' });
    eng.cancel(B);
    expect(fx.sent.at(-1)).toEqual({ peerId: B, m: { t: 'cancel', id } });
    expect(lastView(B)).toEqual({ kind: 'idle', canKnock: true });
  });

  it('knock is refused while not-answered (must cancel first)', () => {
    knockB();
    now += 120_000; eng.tick();
    expect(eng.knock(B)).toBe(false);
    expect(fx.sent).toHaveLength(1);
  });

  it('reply coming shows reply peek and view', () => {
    const id = knockB();
    eng.onMessage(B, { t: 'reply', id, answer: 'coming' });
    expect(fx.replies).toEqual([{ from: B, answer: 'coming' }]);
    expect(lastView(B)).toEqual({ kind: 'coming', canKnock: false });
  });

  it('reply busy5 sets until', () => {
    const id = knockB();
    eng.onMessage(B, { t: 'reply', id, answer: 'busy5' });
    expect(lastView(B)).toEqual({ kind: 'busy', until: now + 300_000, canKnock: false });
    expect(fx.replies).toEqual([{ from: B, answer: 'busy5' }]);
  });

  it('reply dismissed has no peek', () => {
    const id = knockB();
    eng.onMessage(B, { t: 'reply', id, answer: 'dismissed' });
    expect(fx.replies).toHaveLength(0);
    expect(lastView(B)).toEqual({ kind: 'dismissed', canKnock: false });
  });

  it('cooldown 30s after answer', () => {
    const id = knockB();
    eng.onMessage(B, { t: 'reply', id, answer: 'coming' });
    now += 29_999;
    expect(eng.knock(B)).toBe(false);
    now += 1;
    expect(eng.knock(B)).toBe(true);
  });

  it('tick re-emits answered view with canKnock true after cooldown', () => {
    const id = knockB();
    eng.onMessage(B, { t: 'reply', id, answer: 'busy5' });
    const until = now + 300_000;
    now += 29_999; eng.tick();
    expect(lastView(B)).toEqual({ kind: 'busy', until, canKnock: false });
    now += 1; eng.tick();
    expect(lastView(B)).toEqual({ kind: 'busy', until, canKnock: true });
    const c = fx.views.length;
    eng.tick();
    expect(fx.views).toHaveLength(c);
  });

  it('second reply after reminder updates the view', () => {
    const id = knockB();
    eng.onMessage(B, { t: 'reply', id, answer: 'busy5' });
    now += 300_000;
    eng.onMessage(B, { t: 'reply', id, answer: 'coming' });
    expect(lastView(B)).toEqual({ kind: 'coming', canKnock: false });
    expect(fx.replies.at(-1)).toEqual({ from: B, answer: 'coming' });
  });

  it('cannot knock paused peer', () => {
    eng.peerOnline(B, true);
    eng.peerPresence(B, { paused: true, away: false });
    expect(eng.knock(B)).toBe(false);
    expect(lastView(B)).toEqual({ kind: 'paused' });
  });

  it('cancel sends cancel and has no cooldown', () => {
    const id = knockB();
    eng.cancel(B);
    expect(fx.sent.at(-1)).toEqual({ peerId: B, m: { t: 'cancel', id } });
    expect(lastView(B)).toEqual({ kind: 'idle', canKnock: true });
    expect(eng.knock(B)).toBe(true);
  });

  it('callee going offline makes view idle/blocked', () => {
    knockB();
    eng.peerOnline(B, false);
    expect(lastView(B)).toEqual({ kind: 'idle', canKnock: false });
    expect(eng.knock(B)).toBe(false);
  });

  it('reply for unknown id is ignored', () => {
    knockB();
    const c = total();
    eng.onMessage(B, { t: 'reply', id: 'nope', answer: 'coming' });
    expect(total()).toBe(c);
  });
});

describe('receiver side', () => {
  it('incoming knock is shown and status shown sent', () => {
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    expect(fx.shown).toEqual([{ k: { id: 'k1', fromPeerId: A, reminder: false }, behind: 0 }]);
    expect(fx.sent).toEqual([{ peerId: A, m: { t: 'status', id: 'k1', state: 'shown' } }]);
  });

  it('incoming while locked is queued as away and shown on unlock', () => {
    eng.setLocked(true);
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    expect(fx.sent).toEqual([{ peerId: A, m: { t: 'status', id: 'k1', state: 'away' } }]);
    expect(fx.shown).toHaveLength(0);
    eng.setLocked(false);
    expect(fx.shown).toHaveLength(1);
    expect(fx.sent.at(-1)).toEqual({ peerId: A, m: { t: 'status', id: 'k1', state: 'shown' } });
  });

  it('incoming while paused is refused', () => {
    eng.setPaused(true);
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    expect(fx.sent).toEqual([{ peerId: A, m: { t: 'status', id: 'k1', state: 'paused' } }]);
    expect(fx.shown).toHaveLength(0);
  });

  it('second caller is queued with +1', () => {
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    eng.onMessage(C, { t: 'knock', id: 'k2' });
    expect(fx.sent.at(-1)).toEqual({ peerId: C, m: { t: 'status', id: 'k2', state: 'queued' } });
    expect(fx.shown).toHaveLength(2);
    expect(fx.shown[1]).toEqual({ k: { id: 'k1', fromPeerId: A, reminder: false }, behind: 1 });
    eng.answer('k1', 'coming');
    expect(fx.shown.at(-1)).toEqual({ k: { id: 'k2', fromPeerId: C, reminder: false }, behind: 0 });
    expect(fx.sent.at(-1)).toEqual({ peerId: C, m: { t: 'status', id: 'k2', state: 'shown' } });
  });

  it('answer coming sends reply and hides', () => {
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    eng.answer('k1', 'coming');
    expect(fx.sent.at(-1)).toEqual({ peerId: A, m: { t: 'reply', id: 'k1', answer: 'coming' } });
    expect(fx.hidden).toEqual(['k1']);
  });

  it('busy5 reminder after 5 min reuses id', () => {
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    eng.answer('k1', 'busy5');
    now += 299_999; eng.tick();
    expect(fx.shown).toHaveLength(1);
    now += 1; eng.tick();
    expect(fx.shown.at(-1)).toEqual({ k: { id: 'k1', fromPeerId: A, reminder: true }, behind: 0 });
    eng.answer('k1', 'coming');
    expect(fx.sent.at(-1)).toEqual({ peerId: A, m: { t: 'reply', id: 'k1', answer: 'coming' } });
  });

  it('caller cancel hides overlay', () => {
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    eng.onMessage(A, { t: 'cancel', id: 'k1' });
    expect(fx.hidden).toEqual(['k1']);
  });

  it('closes incoming knock when caller offline 30s', () => {
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    eng.onMessage(A, { t: 'knock', id: 'k2' });
    eng.peerOnline(A, false);
    now += 29_999; eng.tick();
    expect(fx.hidden).toHaveLength(0);
    now += 1; eng.tick();
    expect(fx.hidden).toEqual(['k1']);
    // queued k2 dropped, not shown afterwards
    expect(fx.shown.every((s) => s.k.id === 'k1')).toBe(true);
  });

  it('coming back online before 30s keeps knock', () => {
    eng.onMessage(A, { t: 'knock', id: 'k1' });
    eng.peerOnline(A, false);
    now += 29_999; eng.tick();
    eng.peerOnline(A, true);
    now += 10_000; eng.tick();
    expect(fx.hidden).toHaveLength(0);
  });

  it('answer for unknown id is ignored', () => {
    const c = total();
    eng.answer('nope', 'coming');
    expect(total()).toBe(c);
  });
});
