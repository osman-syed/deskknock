import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { DEFAULT_CHARACTER } from '../../src/core/character';
import { characterKey, HeadIconCache, renderHeadPngs } from '../../src/main/headIcon';

describe('renderHeadPngs', () => {
  it('renders 32x32 and 64x64 PNGs with the skin colour at the centre', async () => {
    const { x1, x2 } = await renderHeadPngs({ ...DEFAULT_CHARACTER, skin: '#ff0000', glasses: 'none' });
    const m1 = await sharp(x1).metadata();
    const m2 = await sharp(x2).metadata();
    expect([m1.format, m1.width, m1.height]).toEqual(['png', 32, 32]);
    expect([m2.format, m2.width, m2.height]).toEqual(['png', 64, 64]);
    // Pixel at the cheek area (between eyes and mouth) should be close to the skin colour.
    const { data, info } = await sharp(x2).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    const [r, g, b] = at(32, 52); // chin area, below the mouth
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });
  it('rejects when sharp cannot be loaded', async () => {
    vi.resetModules();
    vi.doMock('sharp', () => { throw new Error('libvips.so: cannot open shared object file'); });
    try {
      const fresh = await import('../../src/main/headIcon');
      await expect(fresh.renderHeadPngs(DEFAULT_CHARACTER)).rejects.toThrow(/image library unavailable/i);
    } finally {
      vi.doUnmock('sharp');
      vi.resetModules();
    }
  });
});

describe('characterKey', () => {
  it('is stable regardless of property order and differs per character', () => {
    const reordered = Object.fromEntries(Object.entries(DEFAULT_CHARACTER).reverse()) as typeof DEFAULT_CHARACTER;
    expect(characterKey(reordered)).toBe(characterKey(DEFAULT_CHARACTER));
    expect(characterKey({ ...DEFAULT_CHARACTER, skin: '#000000' })).not.toBe(characterKey(DEFAULT_CHARACTER));
  });
});

describe('HeadIconCache', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  it('returns null until ready, renders once per character, then notifies and serves from cache', async () => {
    const render = vi.fn(async () => ({ x1: Buffer.from('a'), x2: Buffer.from('b') }));
    const onReady = vi.fn();
    const cache = new HeadIconCache((p) => `img:${p.x1}${p.x2}`, onReady, render);
    expect(cache.get(DEFAULT_CHARACTER)).toBeNull();
    expect(cache.get(DEFAULT_CHARACTER)).toBeNull(); // still pending: no second render
    await flush();
    expect(render).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(cache.get(DEFAULT_CHARACTER)).toBe('img:ab');
  });
  it('a failed render leaves the row without an icon and is not retried', async () => {
    const render = vi.fn(async () => { throw new Error('boom'); });
    const onReady = vi.fn();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cache = new HeadIconCache(() => 'x', onReady, render);
    expect(cache.get(DEFAULT_CHARACTER)).toBeNull();
    await flush();
    expect(cache.get(DEFAULT_CHARACTER)).toBeNull();
    expect(render).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
