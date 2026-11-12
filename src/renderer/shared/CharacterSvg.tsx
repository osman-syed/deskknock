import type { Character } from '../../core/character';
import {
  BEARD, BROW_PATHS, EAR_RX, EAR_RY, FACES, FINGER_LINES, GLASSES, HAIR, HAND_RECTS, NECK_PATH, SMILE_PATH,
} from './parts';

export type Pose = 'rise' | 'lean';

// Eye-glance timing from the mockup (3s, 1.2s delay). Blink timing is our own.
const CSS = `
.dk-pupil { animation: dk-look 3s ease-in-out 1.2s infinite; }
.dk-eye { transform-box: fill-box; transform-origin: center; animation: dk-blink 4.5s ease-in-out 2s infinite; }
@keyframes dk-look { 0%,100% { transform: translate(0,0); } 40%,60% { transform: translate(-3px,-2px); } }
@keyframes dk-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
`;

/** Square crop around head, ears and hair (used by the 'head' variant, e.g. tray icons). */
export const HEAD_VIEWBOX = '28 36 144 144';
const HEAD_SIZE = 144;

export function CharacterSvg(props: {
  character: Character;
  pose: Pose;
  animate: boolean;
  /** 'head' = head/hair/face only (no shirt or hands), cropped to HEAD_VIEWBOX at a fixed pixel size. */
  variant?: 'full' | 'head';
}): JSX.Element {
  const { character: c, pose, animate, variant = 'full' } = props;
  const full = variant === 'full';
  const head = FACES[c.face];
  const hair = HAIR[c.hair];
  const glasses = c.glasses === 'none' ? null : GLASSES[c.glasses];
  const beard = c.beard === 'none' ? null : BEARD[c.beard];
  // lean = rise drawing rotated -90deg about the centre; hands stay on the (now right) edge.
  const transform = pose === 'lean' ? 'rotate(-90 100 100)' : undefined;

  return (
    <svg
      viewBox={full ? '0 0 200 200' : HEAD_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      width={full ? '100%' : HEAD_SIZE}
      height={full ? '100%' : HEAD_SIZE}
    >
      {animate && <style>{CSS}</style>}
      <g transform={transform} data-pose={pose}>
        {hair.back && <path data-part="hair-back" d={hair.back} fill={c.hairColor} />}
        {full && <path data-part="shirt" d={NECK_PATH} fill={c.shirt} />}
        <ellipse data-part="head" cx={head.cx} cy={head.cy} rx={head.rx} ry={head.ry} fill={c.skin} />
        <ellipse cx={head.cx - head.rx + 8} cy="116" rx={EAR_RX} ry={EAR_RY} fill={c.skin} />
        <ellipse cx={head.cx + head.rx - 8} cy="116" rx={EAR_RX} ry={EAR_RY} fill={c.skin} />
        {hair.front && <path data-part="hair-front" d={hair.front} fill={c.hairColor} />}
        {BROW_PATHS.map((d) => (
          <path key={d} d={d} stroke={c.hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
        ))}
        {[80, 120].map((x) => (
          <ellipse key={x} className={animate ? 'dk-eye' : undefined} cx={x} cy="112" rx="11" ry="12" fill="#fff" />
        ))}
        <g className={animate ? 'dk-pupil' : undefined}>
          <circle cx="77" cy="110" r="6" fill="#2a1a12" />
          <circle cx="75" cy="108" r="2" fill="#fff" />
          <circle cx="117" cy="110" r="6" fill="#2a1a12" />
          <circle cx="115" cy="108" r="2" fill="#fff" />
        </g>
        <ellipse cx="68" cy="134" rx="9" ry="5" fill="#f08a7a" opacity=".45" />
        <ellipse cx="132" cy="134" rx="9" ry="5" fill="#f08a7a" opacity=".45" />
        {beard && <path data-part="beard" d={beard.d} fill={c.hairColor} opacity={beard.opacity} />}
        <path d={SMILE_PATH} stroke="#8a3b2a" strokeWidth="4" fill="#fff" strokeLinecap="round" strokeLinejoin="round" />
        {glasses && (
          <g data-part="glasses" fill="none" stroke="#222" strokeWidth="3">
            {glasses.frame.map((spec) => {
              const [x, y, w, h] = spec.split(' ').map(Number);
              return glasses.kind === 'ellipse' ? (
                <ellipse key={spec} cx={x} cy={y} rx={w} ry={h} />
              ) : (
                <rect key={spec} x={x} y={y} width={w} height={h} rx="6" />
              );
            })}
            <line x1="95" y1="112" x2="105" y2="112" />
          </g>
        )}
        {full && (
          <>
            <g fill={c.skin} stroke="#c98f6b" strokeWidth="1.5">
              {HAND_RECTS.map((r) => (
                <rect key={r.x} x={r.x} y={r.y} width="44" height="30" rx="12" />
              ))}
            </g>
            <g stroke="#c98f6b" strokeWidth="1.5">
              {FINGER_LINES.map(([x1, y1, x2, y2]) => (
                <line key={x1} x1={x1} y1={y1} x2={x2} y2={y2} />
              ))}
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
