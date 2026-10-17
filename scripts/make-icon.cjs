/* Draws the GRIND mark — a dark tile, an orange three-quarter ring and a
   yellow square in the open quarter (the same shapes as the SVG in
   app/index.html) — into build/icon.ico as PNG-compressed entries.
   No image libraries: shapes are sampled 4×4 per pixel and encoded by hand.
   Run: npm run icon */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const BG = [11, 11, 12], OR = [255, 79, 46], YE = [255, 194, 61];

function inRound(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r), cy = Math.min(Math.max(v, y0 + r), y1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}
const ring = (u, v) => { const d = Math.hypot(u - 16, v - 16); return d >= 4.5 && d <= 11 && !(u > 16 && v < 16); };
const square = (u, v) => inRound(u, v, 17.5, 5, 27, 14.5, 1.5);
const tile = (u, v) => inRound(u, v, 0, 0, 32, 32, 8);

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const N = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = 0, r = 0, g = 0, b = 0;
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const u = (x + (sx + 0.5) / N) / size * 32, v = (y + (sy + 0.5) / N) / size * 32;
      if (!tile(u, v)) continue;
      const c = square(u, v) ? YE : ring(u, v) ? OR : BG;
      a++; r += c[0]; g += c[1]; b += c[2];
    }
    const i = (y * size + x) * 4;
    if (a) { px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a); }
    px[i + 3] = Math.round(a / (N * N) * 255);
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = draw(size);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const pngs = SIZES.map(png);
const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(SIZES.length, 4);
let offset = 6 + 16 * SIZES.length;
const dir = SIZES.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
const out = path.join(__dirname, '..', 'build');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([head, ...dir, ...pngs]));
fs.writeFileSync(path.join(out, 'icon.png'), pngs[SIZES.length - 1]);
console.log('build/icon.ico', SIZES.join(' '), '+ build/icon.png');
