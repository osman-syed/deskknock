import { useEffect } from 'react';
import type { Answer } from '../../core/protocol';
import type { Character } from '../../core/character';
import type { Edge } from '../../core/edge';
import { CharacterSvg } from '../shared/CharacterSvg';
import { displayName } from '../../core/displayName';
import chimeUrl from '../../../resources/chime.wav?url';

export interface OverlayPayload {
  mode: 'knock' | 'reply';
  id: string;
  name: string;
  character: Character;
  /** data: URL of the caller's photo, if any */
  photo: string | null;
  reminder: boolean;
  waitingBehind: number;
  muted: boolean;
  edge: Edge;
  answer?: 'coming' | 'busy5';
}

const CSS = `
html, body { margin:0; background:transparent; overflow:hidden; font-family: Inter, system-ui, sans-serif; user-select:none; }
.dk-peek { position:absolute; width:100px; height:100px; }
.dk-peek svg { width:100%; height:100%; display:block; }
.dk-mirror { position:absolute; inset:0; }
.dk-mirror.left { transform: scaleX(-1); }
.dk-peek.bottom { bottom:-4px; animation: dk-rise 1.1s cubic-bezier(.34,1.56,.64,1) both; }
.dk-peek.bottom.r { right:28px; } .dk-peek.bottom.l { left:28px; }
.dk-peek.side { right:-6px; bottom:70px; animation: dk-slide 1.1s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes dk-rise { 0% { transform: translateY(105%); } 70% { transform: translateY(-4%); } 100% { transform: translateY(0); } }
@keyframes dk-slide { 0% { transform: translateX(105%); } 70% { transform: translateX(-4%); } 100% { transform: translateX(0); } }
.dk-bubble { position:absolute; background:#fff; color:#1a1c26; border-radius:16px; padding:14px 16px 12px; width:230px; box-sizing:border-box;
  box-shadow:0 6px 18px rgba(0,0,0,.3); animation: dk-pop .35s ease-out 1s both; }
.dk-bubble::after { content:""; position:absolute; width:18px; height:18px; background:#fff; transform:rotate(45deg); border-radius:3px; }
.dk-bubble.to-left { right:122px; } .dk-bubble.to-left::after { right:-6px; bottom:22px; }
.dk-bubble.to-right { left:122px; } .dk-bubble.to-right::after { left:-6px; bottom:22px; }
.dk-bubble.bottom { bottom:78px; } .dk-bubble.side { bottom:110px; }
@keyframes dk-pop { 0% { opacity:0; transform: scale(.6) translateY(10px); } 100% { opacity:1; transform: none; } }
.dk-hi { font-size:12px; color:#7a7f8f; margin-bottom:2px; }
.dk-who { font-size:15px; font-weight:600; display:flex; align-items:center; gap:6px; }
.dk-who b { color:#e0663a; }
.dk-photo { width:32px; height:32px; border-radius:50%; object-fit:cover; flex:none; }
.dk-more { font-size:11px; color:#7a7f8f; margin-top:6px; }
.dk-acts { display:flex; gap:8px; margin-top:12px; }
.dk-acts button { flex:1; font: 600 12px Inter, system-ui, sans-serif; padding:7px 0; border-radius:999px; border:0; cursor:pointer; }
.dk-yes { background:#1f9d55; color:#fff; } .dk-no { background:#eef0f4; color:#3a3d4a; }
.dk-x { position:absolute; top:6px; right:8px; border:0; background:transparent; color:#9a9eac; font-size:16px; line-height:1; cursor:pointer; }
`;

export function Overlay(props: { payload: OverlayPayload; onAnswer: (id: string, a: Answer) => void }): JSX.Element {
  const { payload: p, onAnswer } = props;
  const side = p.edge === 'left' || p.edge === 'right';
  const faceRight = p.edge === 'bottom-left' || p.edge === 'left'; // character on the left, bubble to its right
  const knock = p.mode === 'knock';
  const mountKey = `${p.mode}:${p.id}`;

  // Chime once per shown knock (keyed on id), never for replies or muted.
  useEffect(() => {
    if (!knock || p.muted) return;
    try { void new Audio(chimeUrl).play().catch(() => {}); } catch { /* no audio available */ }
  }, [mountKey, knock]); // eslint-disable-line react-hooks/exhaustive-deps

  const placement = side ? 'side' : `bottom ${faceRight ? 'l' : 'r'}`;
  const name = displayName(p.name);
  const copy = knock
    ? p.reminder
      ? <div className="dk-who">You said 5 min — {name} is waiting</div>
      : <>
          <div className="dk-hi">Hi! Look here 👋</div>
          <div className="dk-who">
            {p.photo && <img className="dk-photo" src={p.photo} alt="" />}
            <span><b>{name}</b> is calling you</span>
          </div>
        </>
    : <div className="dk-who">{p.answer === 'coming' ? 'Coming!' : 'Busy, ~5 min'}</div>;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <style>{CSS}</style>
      <div className={`dk-mirror${p.edge === 'left' ? ' left' : ''}`}>
        <div key={mountKey} data-peek={mountKey} className={`dk-peek ${placement}`}>
          <CharacterSvg character={p.character} pose={side ? 'lean' : 'rise'} animate />
        </div>
      </div>
      <div key={`b:${mountKey}`} className={`dk-bubble ${faceRight ? 'to-right' : 'to-left'} ${side ? 'side' : 'bottom'}`}>
        {knock && <button className="dk-x" aria-label="Dismiss" onClick={() => onAnswer(p.id, 'dismissed')}>×</button>}
        {copy}
        {knock && p.waitingBehind > 0 && <div className="dk-more">+{p.waitingBehind} more waiting</div>}
        {knock && (
          <div className="dk-acts">
            <button className="dk-yes" onClick={() => onAnswer(p.id, 'coming')}>Coming</button>
            <button className="dk-no" onClick={() => onAnswer(p.id, 'busy5')}>Busy · 5 min</button>
          </div>
        )}
      </div>
    </div>
  );
}
