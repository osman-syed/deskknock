import type SharpType from 'sharp';

export const MAX_PHOTO_INPUT_BYTES = 10 * 1024 * 1024;

let sharpPromise: Promise<typeof SharpType> | null = null;

/** Loaded on first use so a broken native module only fails photo saves / tray faces, not app startup. */
export function loadSharp(): Promise<typeof SharpType> {
  sharpPromise ??= import('sharp').then(
    (m) => ((m as { default?: typeof SharpType }).default ?? (m as unknown as typeof SharpType)),
    (e: unknown) => {
      sharpPromise = null;
      console.error('DeskKnock: failed to load sharp', e);
      throw new Error(`Image library unavailable: ${e instanceof Error ? e.message : String(e)}`);
    },
  );
  return sharpPromise;
}

/** Decode any image sharp understands and re-encode as PNG with the longest side <= 128. */
export async function resizePhoto(input: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp(input, { limitInputPixels: 64_000_000 })
    .rotate()
    .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}
