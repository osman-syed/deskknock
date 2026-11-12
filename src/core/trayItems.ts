import type { Character } from './character';
import type { OutgoingView } from './knockEngine';
import type { PeerView } from './peers';
import { isCancellable, statusText } from './statusText';
import { displayName } from './displayName';

/** Status dot: green = reachable/positive, yellow = waiting/busy, red = away/paused, white = unreachable. */
export type TrayDot = '🟢' | '🟡' | '🔴' | '⚪';

export interface TrayTeammateItem {
  peerId: string;
  label: string;
  dot: TrayDot;
  enabled: boolean;
  action: 'knock' | 'cancel' | null;
  character: Character;
}

/** Row shown under the header when there are no teammates at all. */
export const TRAY_EMPTY_LABEL = 'No teammates yet';

/** Same precedence as statusText: peer state (offline/incompatible/paused) wins over the outgoing view. */
function trayDot(v: OutgoingView, peer: PeerView): TrayDot {
  if (!peer.online || !peer.compatible) return '⚪';
  if (peer.paused) return '🔴';
  switch (v.kind) {
    case 'idle': return peer.away ? '🔴' : '🟢';
    case 'away':
    case 'paused': return '🔴';
    case 'coming':
    case 'dismissed': return '🟢';
    case 'knocking':
    case 'shown':
    case 'queued':
    case 'not-answered':
    case 'busy': return '🟡';
  }
}

/** Tray menu rows: one per teammate (self excluded), in the given order (PeerRegistry.list: online first, by name). */
export function trayTeammateItems(
  peers: readonly PeerView[],
  outgoing: Readonly<Record<string, OutgoingView>>,
  nowMs: number,
  selfId: string,
): TrayTeammateItem[] {
  return peers
    .filter((p) => p.peerId !== selfId)
    .map((p) => {
      const view = outgoing[p.peerId] ?? { kind: 'idle', canKnock: p.online };
      const dot = trayDot(view, p);
      const { label: status, knockEnabled } = statusText(view, p, nowMs);
      const row = (text: string): string => `${displayName(p.name)}   ${dot}${text ? ` ${text}` : ''}`;
      const base = { peerId: p.peerId, dot, character: p.character };
      if (p.online && isCancellable(view)) {
        return { ...base, label: row(`${status} · Cancel`), enabled: true, action: 'cancel' };
      }
      return { ...base, label: row(status), enabled: knockEnabled, action: knockEnabled ? 'knock' : null };
    });
}

/** Disabled header row: "TEAM · N online" (self excluded), or just "TEAM" when there are no teammates. */
export function trayHeader(peers: readonly PeerView[], selfId: string): string {
  const team = peers.filter((p) => p.peerId !== selfId);
  if (team.length === 0) return 'TEAM';
  return `TEAM · ${team.filter((p) => p.online).length} online`;
}
