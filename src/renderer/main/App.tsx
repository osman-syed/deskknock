import { useEffect, useState } from 'react';
import type { AppState } from '../../core/appState';
import type { Settings as SettingsT } from '../../core/store';
import { PeerRow } from './PeerRow';
import { Settings } from './Settings';

export interface DeskKnockApi {
  onState(cb: (s: AppState) => void): void;
  knock(peerId: string): void;
  cancel(peerId: string): void;
  saveSettings(s: SettingsT): void;
}

declare global {
  interface Window { deskknock: DeskKnockApi }
}

export function App(): JSX.Element {
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { window.deskknock.onState(setState); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const peers = (state?.peers ?? [])
    .filter((p) => p.peerId !== state?.settings.peerId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>DeskKnock</h1>
        {state?.updateAvailable && (
          <span style={styles.update} title={`Version ${state.updateAvailable} is on the network`}>
            Update available
          </span>
        )}
        <button onClick={() => setShowSettings((v) => !v)} disabled={!state}>Settings</button>
      </header>
      {state?.networkError && (
        <div role="alert" style={styles.error}>{state.networkError}</div>
      )}
      {state && showSettings && (
        <Settings settings={state.settings} onSave={(s) => window.deskknock.saveSettings(s)} onClose={() => setShowSettings(false)} />
      )}
      {!state ? (
        <p style={styles.empty}>Starting…</p>
      ) : peers.length === 0 ? (
        <p style={styles.empty}>No teammates yet. They appear here when DeskKnock runs on the same network.</p>
      ) : (
        <ul style={styles.list}>
          {peers.map((p) => (
            <PeerRow
              key={p.peerId}
              peer={p}
              view={state.outgoing[p.peerId] ?? { kind: 'idle', canKnock: p.online }}
              now={now}
              onKnock={(id) => window.deskknock.knock(id)}
              onCancel={(id) => window.deskknock.cancel(id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  app: { fontFamily: 'system-ui, sans-serif', color: '#222' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #ddd' },
  title: { fontSize: 20, margin: 0, flex: 1 },
  update: { background: '#fff4cc', color: '#7a5b00', borderRadius: 12, padding: '2px 10px', fontSize: 13 },
  error: { background: '#fde2e1', color: '#8a1c14', padding: '8px 16px', borderBottom: '1px solid #f3b7b3' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  empty: { padding: 16, color: '#666' },
} as const;
