import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { resizePhoto } from '../../src/main/photo';

describe('resizePhoto', () => {
  it('1024x512 → 128x64 PNG', async () => {
    const input = await sharp({ create: { width: 1024, height: 512, channels: 3, background: '#f00' } }).jpeg().toBuffer();
    const out = await resizePhoto(input);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(128);
    expect(meta.height).toBe(64);
  });
  it('rejects non-image', async () => {
    await expect(resizePhoto(Buffer.from('not an image at all'))).rejects.toThrow();
  });
  it('rejects with a clear error when sharp cannot be loaded', async () => {
    vi.resetModules();
    vi.doMock('sharp', () => { throw new Error('libvips.so: cannot open shared object file'); });
    try {
      const { resizePhoto: fresh } = await import('../../src/main/photo');
      await expect(fresh(Buffer.from('x'))).rejects.toThrow(/image library unavailable/i);
    } finally {
      vi.doUnmock('sharp');
      vi.resetModules();
    }
  });
});
