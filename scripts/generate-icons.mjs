// Generates PWA icons as minimal PNGs.
// Uses only Node.js built-ins. Produces valid PNG with solid bg + SVG-like "R" letter.
// Run: node scripts/generate-icons.mjs

import { writeFileSync, mkdirSync } from 'fs';

const SIZES = [192, 512];
const COLORS = { bg: [11, 18, 32], fg: [249, 115, 22] }; // #0b1220 dark bg, #f97316 orange

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = data.length;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(len);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePNG(size) {
  const [r, g, b] = COLORS.bg;
  const raw = Buffer.alloc(size * size * 4 + size); // +1 filter byte per row
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = 255;
    }
  }

  // Draw a simple "R" shape by setting fg pixels
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const rSize = Math.floor(size * 0.3);
  const strokeW = Math.max(2, Math.floor(size * 0.06));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Circle outline
      if (Math.abs(dist - rSize) < strokeW) {
        const px = row + 1 + x * 4;
        raw[px] = COLORS.fg[0];
        raw[px + 1] = COLORS.fg[1];
        raw[px + 2] = COLORS.fg[2];
      }
      // R leg
      if (dx > 0 && Math.abs(dy) < strokeW && dx < rSize) {
        const px = row + 1 + x * 4;
        raw[px] = COLORS.fg[0];
        raw[px + 1] = COLORS.fg[1];
        raw[px + 2] = COLORS.fg[2];
      }
      // R diagonal
      if (dx > 0 && dy > 0 && Math.abs(dx - dy) < strokeW && dx < rSize) {
        const px = row + 1 + x * 4;
        raw[px] = COLORS.fg[0];
        raw[px + 1] = COLORS.fg[1];
        raw[px + 2] = COLORS.fg[2];
      }
    }
  }

  // IDAT: compress raw data (uncompressed deflate for simplicity)
  const deflated = deflateRaw(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', iend),
  ]);
}

// Minimal deflate raw (no zlib header)
function deflateRaw(data) {
  // We use a simple uncompressed approach: store blocks
  // For simplicity, just use a minimal compliant approach
  const blocks = [];
  let offset = 0;
  while (offset < data.length) {
    const isFinal = offset + 65535 >= data.length;
    const chunkSize = Math.min(65535, data.length - offset);
    const block = Buffer.alloc(5 + chunkSize);
    block[0] = isFinal ? 1 : 0; // BFINAL
    block.writeUInt16LE(chunkSize, 1);
    block.writeUInt16LE(~chunkSize & 0xffff, 3);
    data.copy(block, 5, offset, offset + chunkSize);
    blocks.push(block);
    offset += chunkSize;
  }
  return Buffer.concat(blocks);
}

mkdirSync('public/assets/icons', { recursive: true });

for (const size of SIZES) {
  for (const suffix of ['', '-maskable']) {
    const png = makePNG(size);
    const path = `public/assets/icons/icon-${size}${suffix}.png`;
    writeFileSync(path, png);
    console.log(`Generated ${path} (${png.length} bytes)`);
  }
}

console.log('Icon generation complete.');
