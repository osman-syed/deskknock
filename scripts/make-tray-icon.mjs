// Generates resources/tray.png (22x22) and resources/tray@2x.png (44x44): a door with a knob.
// White door with a dark outline so it reads on both dark and light panels. Node built-ins only.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const encodePng = (size, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
};

// Shapes in a 22-unit design space.
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const door = (x, y) => inRect(x, y, 5, 2.5, 17, 20);
const doorInner = (x, y) => inRect(x, y, 6.5, 4, 15.5, 18.5);
const knob = (x, y) => (x - 13.5) ** 2 + (y - 11.5) ** 2 <= 1.3 ** 2;

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 4, scale = 22 / size;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const x = (px + (sx + 0.5) / ss) * scale, y = (py + (sy + 0.5) / ss) * scale;
      let c = null;
      if (knob(x, y)) c = [40, 40, 40];
      else if (doorInner(x, y)) c = [255, 255, 255];
      else if (door(x, y)) c = [40, 40, 40];
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
    }
    const n = ss * ss, i = (py * size + px) * 4;
    if (a) { buf[i] = r / a; buf[i + 1] = g / a; buf[i + 2] = b / a; buf[i + 3] = Math.round((a / n) * 255); }
  }
  return buf;
}

writeFileSync(join(out, 'tray.png'), encodePng(22, render(22)));
writeFileSync(join(out, 'tray@2x.png'), encodePng(44, render(44)));
console.log('wrote tray.png and tray@2x.png');
