import type { OutgoingView } from './knockEngine';
import type { PeerView } from './peers';
import { isCancellable, statusText } from './statusText';
import { displayName } from './displayName';

export interface TrayTeammateItem {
  peerId: string;
  label: string;
  enabled: boolean;
  action: 'knock' | 'cancel' | null;
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
      const name = displayName(p.name);
      const { label, knockEnabled } = statusText(view, p, nowMs);
      if (p.online && isCancellable(view)) {
        return { peerId: p.peerId, label: `${name} — ${label} · Cancel`, enabled: true, action: 'cancel' };
      }
      return {
        peerId: p.peerId,
        label: `${name} — ${label || 'Online'}`,
        enabled: knockEnabled,
        action: knockEnabled ? 'knock' : null,
      };
    });
}
