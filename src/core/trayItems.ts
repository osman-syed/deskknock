import type { OutgoingView } from './knockEngine';
import type { PeerView } from './peers';
import { isCancellable, statusText } from './statusText';

export interface TrayTeammateItem {
  peerId: string;
  label: string;
  enabled: boolean;
  action: 'knock' | 'cancel' | null;
  /** Label depends on time (e.g. "Busy until"), so the menu should be refreshed periodically. */
  timed: boolean;
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
      const name = p.name || 'Unnamed';
      const { label, knockEnabled } = statusText(view, p, nowMs);
      const timed = view.kind === 'busy';
      if (p.online && isCancellable(view)) {
        return { peerId: p.peerId, label: `${name} — ${label} (click to cancel)`, enabled: true, action: 'cancel', timed };
      }
      return {
        peerId: p.peerId,
        label: `${name} — ${label || 'Online'}`,
        enabled: knockEnabled,
        action: knockEnabled ? 'knock' : null,
        timed,
      };
    });
}
