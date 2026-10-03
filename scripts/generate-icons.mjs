// Generates the placeholder PWA icons (a fruit with a leaf) as PNGs, with no
// dependencies: pixels are rasterized here and encoded with zlib.
//
//   node scripts/generate-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [44, 122, 75];
const FRUIT = [245, 247, 241];
const LEAF = [176, 224, 190];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const SS = 4; // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// `scale` < 1 shrinks the artwork into the maskable safe zone.
function artwork(scale) {
  return (u, v) => {
    const x = (u - 0.5) / scale, y = (v - 0.5) / scale;
    // Leaf: an ellipse tilted 45°, up and to the right of the fruit.
    const lx = x - 0.1, ly = y + 0.25;
    const along = (lx - ly) / Math.SQRT2, across = (lx + ly) / Math.SQRT2;
    if ((along / 0.13) ** 2 + (across / 0.055) ** 2 < 1) return LEAF;
    if (Math.hypot(x, y - 0.07) < 0.23) return FRUIT;
    return BG;
  };
}

const out = [
  ["public/icon-192.png", 192, 1],
  ["public/icon-512.png", 512, 1],
  ["public/icon-512-maskable.png", 512, 0.72],
  ["src/app/apple-icon.png", 180, 0.85],
  ["src/app/icon.png", 64, 1.25],
];
for (const [path, size, scale] of out) {
  writeFileSync(path, png(size, artwork(scale)));
  console.log(path);
}
