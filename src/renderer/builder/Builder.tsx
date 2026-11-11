import { useEffect, useState } from 'react';
import { BEARDS, DEFAULT_CHARACTER, FACES, GLASSES, HAIRS, type Character } from '../../core/character';
import { CharacterSvg } from '../shared/CharacterSvg';

export interface BuilderApi {
  load(): Promise<{ character: Character; photo: Uint8Array | null }>;
  save(c: Character, photo: Uint8Array | null): Promise<unknown>;
}

declare global {
  interface Window { builder: BuilderApi }
}

const MAX_PHOTO_FILE = 10 * 1024 * 1024;

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export function Builder(): JSX.Element {
  const [c, setC] = useState<Character>(DEFAULT_CHARACTER);
  const [photo, setPhoto] = useState<{ bytes: Uint8Array; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void window.builder.load().then((r) => {
      setC(r.character);
      setPhoto(r.photo ? { bytes: r.photo, mime: 'image/png' } : null);
    });
  }, []);

  const set = <K extends keyof Character>(k: K, v: Character[K]): void => setC((p) => ({ ...p, [k]: v }));

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    if (file.size > MAX_PHOTO_FILE) { setError('Photo is too large (max 10 MB).'); return; }
    setError(null);
    setPhoto({ bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type || 'image/png' });
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await window.builder.save(c, photo ? photo.bytes : null);
    } catch {
      setError('Could not save. Is the photo a valid image?');
      setSaving(false);
    }
  };

  const select = (label: string, key: 'face' | 'hair' | 'glasses' | 'beard', list: readonly string[]): JSX.Element => (
    <label style={styles.field}>
      {label}
      <select value={c[key]} onChange={(e) => set(key, e.target.value as never)}>
        {list.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>
  );
  const color = (label: string, key: 'skin' | 'hairColor' | 'shirt'): JSX.Element => (
    <label style={styles.field}>
      {label}
      <input type="color" value={c[key]} onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  return (
    <div style={styles.root}>
      <div style={styles.preview}><CharacterSvg character={c} pose="rise" animate /></div>
      <div style={styles.controls}>
        <h2 style={{ marginTop: 0 }}>Build your character</h2>
        {select('Face', 'face', FACES)}
        {color('Skin', 'skin')}
        {select('Hair', 'hair', HAIRS)}
        {color('Hair colour', 'hairColor')}
        {select('Glasses', 'glasses', GLASSES)}
        {select('Beard', 'beard', BEARDS)}
        {color('Shirt', 'shirt')}
        <div style={styles.field}>
          Photo (optional)
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {photo && <img alt="Photo preview" src={toDataUrl(photo.bytes, photo.mime)} width={48} height={48} style={{ objectFit: 'cover' }} />}
            <input type="file" accept="image/*" aria-label="Choose photo" onChange={(e) => void pick(e.target.files?.[0])} />
            {photo && <button onClick={() => setPhoto(null)}>Remove photo</button>}
          </div>
        </div>
        {error && <div role="alert" style={{ color: '#b00020' }}>{error}</div>}
        <button onClick={() => void save()} disabled={saving}>Save</button>
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', gap: 24, padding: 16, fontFamily: 'sans-serif' },
  preview: { width: 280, height: 280, flex: 'none' },
  controls: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  field: { display: 'flex', flexDirection: 'column', gap: 2 },
} as const;
