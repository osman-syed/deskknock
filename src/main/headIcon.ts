import { createHash } from 'node:crypto';
import type { Character } from '../core/character';
import { characterHeadSvg } from '../renderer/shared/headSvg';
import { loadSharp } from './photo';

export interface HeadPngs {
  x1: Buffer; // 32x32
  x2: Buffer; // 64x64 (@2x)
}

const FIELDS: readonly (keyof Character)[] = ['face', 'skin', 'hair', 'hairColor', 'glasses', 'beard', 'shirt'];

/** Stable hash of a character (fixed field order), used as the icon cache key. */
export function characterKey(c: Character): string {
  return createHash('sha1').update(JSON.stringify(FIELDS.map((f) => c[f]))).digest('hex').slice(0, 16);
}

/** Rasterise the character's head (sharp renders SVG via librsvg). Rejects if sharp is unavailable. */
export async function renderHeadPngs(c: Character): Promise<HeadPngs> {
  const sharp = await loadSharp();
  const svg = Buffer.from(characterHeadSvg(c));
  const at = (px: number): Promise<Buffer> => sharp(svg).resize(px, px).png().toBuffer();
  const [x1, x2] = await Promise.all([at(32), at(64)]);
  return { x1, x2 };
}

const MAX_ENTRIES = 256;
type Entry<T> = { state: 'pending' } | { state: 'ready'; image: T } | { state: 'failed' };

/**
 * In-memory face icons keyed by characterKey. get() never blocks: it returns null and starts an async
 * render the first time, then calls onReady so the caller can rebuild. Failures are remembered (no retry).
 */
export class HeadIconCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly toImage: (pngs: HeadPngs) => T,
    private readonly onReady: () => void,
    private readonly render: (c: Character) => Promise<HeadPngs> = renderHeadPngs,
  ) {}

  /** Cache key for the icon get() would return now ('' when there is none yet), for menu change detection. */
  keyFor(c: Character): string {
    const k = characterKey(c);
    return this.entries.get(k)?.state === 'ready' ? k : '';
  }

  get(c: Character): T | null {
    const k = characterKey(c);
    const e = this.entries.get(k);
    if (e) return e.state === 'ready' ? e.image : null;
    this.evict();
    this.entries.set(k, { state: 'pending' });
    this.render(c)
      .then(
        (pngs) => {
          this.entries.set(k, { state: 'ready', image: this.toImage(pngs) });
          return true;
        },
        (err: unknown) => {
          this.entries.set(k, { state: 'failed' });
          console.error('DeskKnock: tray face icon failed', err);
          return false;
        },
      )
      .then((ok) => { if (ok) this.onReady(); })
      .catch((err: unknown) => {
        this.entries.set(k, { state: 'failed' }); // toImage threw
        console.error('DeskKnock: tray face icon failed', err);
      });
    return null;
  }

  private evict(): void {
    for (const [k, e] of this.entries) {
      if (this.entries.size < MAX_ENTRIES) return;
      if (e.state !== 'pending') this.entries.delete(k);
    }
  }
}
