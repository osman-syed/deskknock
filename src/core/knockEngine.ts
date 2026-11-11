import { randomUUID } from 'node:crypto';
import type { Answer, DeliveryState, Message } from './protocol';

export type OutgoingView =
  | { kind: 'idle'; canKnock: boolean }
  | { kind: 'knocking' }
  | { kind: 'shown' }
  | { kind: 'queued' }
  | { kind: 'away' }
  | { kind: 'paused' }
  | { kind: 'not-answered' }
  | { kind: 'coming'; canKnock: boolean }
  | { kind: 'busy'; until: number; canKnock: boolean }
  | { kind: 'dismissed'; canKnock: boolean };

export interface IncomingKnock { id: string; fromPeerId: string; reminder: boolean }

export interface EngineEffects {
  send(peerId: string, m: Message): void;
  showIncoming(k: IncomingKnock, waitingBehind: number): void;
  hideIncoming(id: string): void;
  showReply(fromPeerId: string, answer: 'coming' | 'busy5'): void;
  outgoingChanged(peerId: string, view: OutgoingView): void;
}

export const KNOCK_TIMEOUT_MS = 120_000;
export const COOLDOWN_MS = 30_000;
export const BUSY_MS = 300_000;
export const CALLER_OFFLINE_MS = 30_000;

type PendingKind = 'knocking' | 'shown' | 'queued' | 'away' | 'paused';
type AnsweredView = Extract<OutgoingView, { kind: 'coming' | 'busy' | 'dismissed' }>;

interface Outgoing {
  id: string;
  sentAt: number;
  view: OutgoingView;
  answeredAt?: number;
  cooldownEmitted?: boolean;
}

interface Reminder { id: string; fromPeerId: string; at: number }

/** Unanswered knock still on the callee's screen (includes not-answered). */
const isUnanswered = (v: OutgoingView): boolean => isPending(v) || v.kind === 'not-answered';

const isPending = (v: OutgoingView): boolean =>
  v.kind === 'knocking' || v.kind === 'shown' || v.kind === 'queued' || v.kind === 'away';

export class KnockEngine {
  // caller side
  private outgoing = new Map<string, Outgoing>();
  private online = new Set<string>();
  private presence = new Map<string, { paused: boolean; away: boolean }>();
  // receiver side
  private queue: IncomingKnock[] = [];
  private current: IncomingKnock | null = null;
  private reminders: Reminder[] = [];
  private offlineSince = new Map<string, number>();
  private locked = false;
  private paused = false;

  constructor(
    private fx: EngineEffects,
    private now: () => number = Date.now,
    private newId: () => string = randomUUID,
  ) {}

  // ---------- caller side ----------

  knock(peerId: string): boolean {
    if (!this.online.has(peerId)) return false;
    if (this.presence.get(peerId)?.paused) return false;
    const o = this.outgoing.get(peerId);
    if (o) {
      if (isUnanswered(o.view)) return false;
      if (o.answeredAt !== undefined && this.now() < o.answeredAt + COOLDOWN_MS) return false;
    }
    const id = this.newId();
    const view: OutgoingView = { kind: 'knocking' };
    this.outgoing.set(peerId, { id, sentAt: this.now(), view });
    this.fx.send(peerId, { t: 'knock', id });
    this.fx.outgoingChanged(peerId, view);
    return true;
  }

  cancel(peerId: string): void {
    const o = this.outgoing.get(peerId);
    if (!o || !isUnanswered(o.view)) return;
    this.fx.send(peerId, { t: 'cancel', id: o.id });
    this.outgoing.delete(peerId);
    this.emitIdle(peerId);
  }

  private idleView(peerId: string): OutgoingView {
    if (!this.online.has(peerId)) return { kind: 'idle', canKnock: false };
    if (this.presence.get(peerId)?.paused) return { kind: 'paused' };
    return { kind: 'idle', canKnock: true };
  }

  private emitIdle(peerId: string): void {
    this.fx.outgoingChanged(peerId, this.idleView(peerId));
  }

  private setView(peerId: string, o: Outgoing, view: OutgoingView): void {
    o.view = view;
    this.fx.outgoingChanged(peerId, view);
  }

  private onStatus(peerId: string, id: string, state: DeliveryState): void {
    const o = this.outgoing.get(peerId);
    if (!o || o.id !== id || !isPending(o.view)) return;
    this.setView(peerId, o, { kind: state as PendingKind });
  }

  private onReply(peerId: string, id: string, answer: Answer): void {
    const o = this.outgoing.get(peerId);
    // Latest knock id is accepted even if already answered (busy reminder follow-up).
    if (!o || o.id !== id) return;
    let view: AnsweredView;
    if (answer === 'coming') view = { kind: 'coming', canKnock: false };
    else if (answer === 'busy5') view = { kind: 'busy', until: this.now() + BUSY_MS, canKnock: false };
    else view = { kind: 'dismissed', canKnock: false };
    o.answeredAt = this.now();
    o.cooldownEmitted = false;
    if (answer !== 'dismissed') this.fx.showReply(peerId, answer);
    this.setView(peerId, o, view);
  }

  // ---------- receiver side ----------

  answer(id: string, a: Answer): void {
    const k = this.queue.find((q) => q.id === id);
    if (!k) return;
    this.removeFromQueue(k);
    this.fx.send(k.fromPeerId, { t: 'reply', id, answer: a });
    if (this.current === k) {
      this.current = null;
      this.fx.hideIncoming(id);
    }
    if (a === 'busy5') {
      this.reminders.push({ id, fromPeerId: k.fromPeerId, at: this.now() + BUSY_MS });
    }
    this.pump();
    this.refreshCurrent();
  }

  setLocked(locked: boolean): void {
    if (this.locked === locked) return;
    this.locked = locked;
    if (locked) this.suspendShown('away');
    else this.pump();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!paused) return;
    // Pausing refuses everything pending: hide overlay, tell queued callers, drop reminders.
    const dropped = this.queue;
    if (this.current) this.fx.hideIncoming(this.current.id);
    this.queue = [];
    this.current = null;
    this.reminders = [];
    for (const k of dropped) {
      if (!k.reminder) this.fx.send(k.fromPeerId, { t: 'status', id: k.id, state: 'paused' });
    }
  }

  /** Hide the shown overlay but keep it queued (e.g. screen locked). */
  private suspendShown(state: DeliveryState): void {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    this.fx.hideIncoming(cur.id);
    if (!cur.reminder) this.fx.send(cur.fromPeerId, { t: 'status', id: cur.id, state });
  }

  private removeFromQueue(k: IncomingKnock): void {
    const i = this.queue.indexOf(k);
    if (i >= 0) this.queue.splice(i, 1);
  }

  private pump(): void {
    if (this.locked || this.paused || this.current || this.queue.length === 0) return;
    const k = this.queue[0];
    this.current = k;
    this.fx.showIncoming(k, this.queue.length - 1);
    if (!k.reminder) this.fx.send(k.fromPeerId, { t: 'status', id: k.id, state: 'shown' });
  }

  /** Re-issue the shown overlay so its "+N more waiting" count is current. */
  private refreshCurrent(): void {
    if (this.current) this.fx.showIncoming(this.current, this.queue.length - 1);
  }

  private onKnock(fromPeerId: string, id: string, reminder = false): void {
    if (this.queue.some((q) => q.id === id)) return;
    if (this.paused) {
      if (!reminder) this.fx.send(fromPeerId, { t: 'status', id, state: 'paused' });
      return;
    }
    const k: IncomingKnock = { id, fromPeerId, reminder };
    this.queue.push(k);
    if (this.locked) {
      if (!reminder) this.fx.send(fromPeerId, { t: 'status', id, state: 'away' });
      return;
    }
    if (!this.current) {
      this.pump();
      return;
    }
    if (!reminder) this.fx.send(fromPeerId, { t: 'status', id, state: 'queued' });
    this.refreshCurrent();
  }

  private onCancel(fromPeerId: string, id: string): void {
    const k = this.queue.find((q) => q.id === id && q.fromPeerId === fromPeerId);
    if (!k) return;
    this.removeFromQueue(k);
    if (this.current === k) {
      this.current = null;
      this.fx.hideIncoming(id);
    }
    this.pump();
    this.refreshCurrent();
  }

  private dropCaller(peerId: string): void {
    const wasCurrent = this.current?.fromPeerId === peerId;
    if (wasCurrent) {
      this.fx.hideIncoming(this.current!.id);
      this.current = null;
    }
    this.queue = this.queue.filter((q) => q.fromPeerId !== peerId);
    this.reminders = this.reminders.filter((r) => r.fromPeerId !== peerId);
    this.pump();
    this.refreshCurrent();
  }

  // ---------- network ----------

  onMessage(fromPeerId: string, m: Message): void {
    switch (m.t) {
      case 'knock': return this.onKnock(fromPeerId, m.id);
      case 'cancel': return this.onCancel(fromPeerId, m.id);
      case 'status': return this.onStatus(fromPeerId, m.id, m.state);
      case 'reply': return this.onReply(fromPeerId, m.id, m.answer);
      case 'presence': return this.peerPresence(fromPeerId, { paused: m.paused, away: m.away });
      default: return;
    }
  }

  peerOnline(peerId: string, online: boolean): void {
    if (online) {
      this.online.add(peerId);
      this.offlineSince.delete(peerId);
      if (!this.outgoing.has(peerId)) this.emitIdle(peerId);
      return;
    }
    this.online.delete(peerId);
    this.presence.delete(peerId);
    this.outgoing.delete(peerId);
    this.emitIdle(peerId);
    if (!this.offlineSince.has(peerId)) this.offlineSince.set(peerId, this.now());
  }

  peerPresence(peerId: string, p: { paused: boolean; away: boolean }): void {
    this.presence.set(peerId, p);
    const o = this.outgoing.get(peerId);
    if (o && (isPending(o.view) || o.answeredAt !== undefined)) return;
    this.emitIdle(peerId);
  }

  tick(): void {
    const t = this.now();
    for (const [peerId, o] of this.outgoing) {
      if (isPending(o.view) && t - o.sentAt >= KNOCK_TIMEOUT_MS) {
        this.setView(peerId, o, { kind: 'not-answered' });
      } else if (o.answeredAt !== undefined && !o.cooldownEmitted && t >= o.answeredAt + COOLDOWN_MS) {
        o.cooldownEmitted = true;
        this.setView(peerId, o, { ...(o.view as AnsweredView), canKnock: true });
      }
    }

    const due = this.reminders.filter((r) => r.at <= t);
    if (due.length) {
      this.reminders = this.reminders.filter((r) => r.at > t);
      for (const r of due) this.onKnock(r.fromPeerId, r.id, true);
    }

    for (const [peerId, since] of [...this.offlineSince]) {
      if (t - since >= CALLER_OFFLINE_MS) {
        this.offlineSince.delete(peerId);
        this.dropCaller(peerId);
      }
    }
  }
}
