// Generates resources/chime.wav: two soft sine tones (660 Hz then 880 Hz), ~0.6 s, 16-bit mono PCM.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const AMP = 0.25;
const tones = [{ f: 660, dur: 0.28 }, { f: 880, dur: 0.32 }];
const FADE = 0.03;

const samples = [];
for (const { f, dur } of tones) {
  const n = Math.round(dur * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const fadeIn = Math.min(1, t / FADE);
    const fadeOut = Math.min(1, (dur - t) / (dur * 0.6)); // gentle decay
    samples.push(Math.sin(2 * Math.PI * f * t) * AMP * fadeIn * fadeOut);
  }
}

const data = Buffer.alloc(samples.length * 2);
samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2));
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
h.write('data', 36); h.writeUInt32LE(data.length, 40);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'chime.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([h, data]));
console.log(`wrote ${out} (${(samples.length / RATE).toFixed(2)} s)`);
