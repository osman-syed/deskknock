import type { OutgoingView } from './knockEngine';
import type { PeerView } from './peers';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local 24h "hh:mm". */
function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Row label and whether Knock is clickable. Peer state (offline/incompatible/paused) wins over the view. */
export function statusText(v: OutgoingView, peer: PeerView, _nowMs: number): { label: string; knockEnabled: boolean } {
  if (!peer.online) return { label: 'Offline', knockEnabled: false };
  if (!peer.compatible) return { label: 'Needs update', knockEnabled: false };
  if (peer.paused) return { label: 'Paused', knockEnabled: false };
  switch (v.kind) {
    case 'idle': return { label: peer.away ? 'Away' : '', knockEnabled: v.canKnock };
    case 'knocking':
    case 'shown':
    case 'queued': return { label: 'Knocking…', knockEnabled: false };
    case 'away': return { label: 'Away', knockEnabled: false };
    case 'paused': return { label: 'Paused', knockEnabled: false };
    case 'not-answered': return { label: 'Not answered yet', knockEnabled: false };
    case 'coming': return { label: 'Coming', knockEnabled: v.canKnock };
    case 'busy': return { label: `Busy until ${hhmm(v.until)}`, knockEnabled: v.canKnock };
    case 'dismissed': return { label: 'Seen', knockEnabled: v.canKnock };
  }
}

/** True while an unanswered knock is outstanding (row shows Cancel). */
export function isCancellable(v: OutgoingView): boolean {
  return v.kind === 'knocking' || v.kind === 'shown' || v.kind === 'queued' || v.kind === 'away' || v.kind === 'not-answered';
}
