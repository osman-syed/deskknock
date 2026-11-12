import type { OutgoingView } from '../../core/knockEngine';
import type { PeerView } from '../../core/peers';
import { isCancellable, statusText } from '../../core/statusText';
import { displayName } from '../../core/displayName';
import { CharacterSvg } from '../shared/CharacterSvg';

export function PeerRow(props: {
  peer: PeerView; view: OutgoingView; now: number;
  onKnock(peerId: string): void; onCancel(peerId: string): void;
}): JSX.Element {
  const { peer, view, now } = props;
  const { label, knockEnabled } = statusText(view, peer, now);
  const cancellable = peer.online && isCancellable(view);
  return (
    <li data-testid="peer-row" data-peer={peer.peerId} style={styles.row}>
      {/* Head only: crop the bottom of the 200x200 drawing (hands start around y=170). */}
      <div style={styles.head} aria-hidden>
        <CharacterSvg character={peer.character} pose="rise" animate={false} />
      </div>
      <span
        style={{ ...styles.dot, background: peer.online ? '#2fb344' : '#b8b8b8' }}
        title={peer.online ? 'Online' : 'Offline'}
      />
      <span style={styles.name}>{displayName(peer.name)}</span>
      <span style={styles.status}>{label}</span>
      {cancellable ? (
        <button style={styles.btn} onClick={() => props.onCancel(peer.peerId)}>Cancel</button>
      ) : (
        <button style={styles.btn} disabled={!knockEnabled} onClick={() => props.onKnock(peer.peerId)}>Knock</button>
      )}
    </li>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid #eee' },
  head: { width: 48, height: 40, overflow: 'hidden', flex: 'none' },
  dot: { width: 10, height: 10, borderRadius: '50%', flex: 'none' },
  name: { fontWeight: 600, minWidth: 120 },
  status: { flex: 1, color: '#666', fontSize: 14 },
  btn: { minWidth: 80, padding: '6px 12px' },
} as const;
