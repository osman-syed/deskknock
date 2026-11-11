import sharp from 'sharp';

export const MAX_PHOTO_INPUT_BYTES = 10 * 1024 * 1024;

/** Decode any image sharp understands and re-encode as PNG with the longest side <= 128. */
export async function resizePhoto(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 64_000_000 })
    .rotate()
    .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}
