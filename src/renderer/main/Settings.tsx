import { useState } from 'react';
import type { Settings as SettingsT } from '../../core/store';

export function Settings(props: { settings: SettingsT; onSave(s: SettingsT): void; onClose(): void; onEditCharacter(): void }): JSX.Element {
  const s = props.settings;
  const [name, setName] = useState(s.name);
  const [muted, setMuted] = useState(s.muted);
  const [port, setPort] = useState(String(s.port));
  const [manual, setManual] = useState(s.manualPeers.join('\n'));
  const portNum = Number(port);
  const portValid = Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;

  const save = (): void => {
    if (!portValid) return;
    props.onSave({
      ...s,
      name: name.trim(),
      muted,
      port: portNum,
      manualPeers: manual.split('\n').map((l) => l.trim()).filter(Boolean),
    });
    props.onClose();
  };

  return (
    <section style={styles.box}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <label style={styles.field}>
        Display name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
      </label>
      <label style={styles.check}>
        <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
        Mute chime
      </label>
      <label style={styles.field}>
        Port
        <input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" style={{ width: 100 }} />
        <small style={styles.hint}>
          {portValid ? 'Port changes take effect after restarting DeskKnock.' : 'Enter a port between 1 and 65535.'}
        </small>
      </label>
      <label style={styles.field}>
        Manual peers (one per line, ip or ip:port)
        <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={4} />
      </label>
      <button onClick={props.onEditCharacter} style={{ marginBottom: 12 }}>Edit my character</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={!portValid}>Save</button>
        <button onClick={props.onClose}>Close</button>
      </div>
    </section>
  );
}

const styles = {
  box: { padding: 16, borderTop: '1px solid #ddd' },
  field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  check: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 },
  hint: { color: '#777' },
} as const;
