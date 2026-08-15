import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(SCRIPT_DIR, "..", "public", "icons");

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makePng(width, height, getPixel) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc((1 + rowBytes) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowBytes);
    raw[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const compressed = deflateSync(raw);

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, "ascii");
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = createChunk("IHDR", ihdr);
  const idatChunk = createChunk("IDAT", compressed);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// 5x7 font representation of "T" and "P"
const GLYPH_T = [
  "11111",
  "00100",
  "00100",
  "00100",
  "00100",
  "00100",
  "00100"
];

const GLYPH_P = [
  "11110",
  "10001",
  "10001",
  "11110",
  "10000",
  "10000",
  "10000"
];

function drawIcon(x, y, width, height, isMaskable = false) {
  const brandR = 0xb0, brandG = 0x98, brandB = 0x28;
  const cornerRadius = isMaskable ? 0 : width * 0.18;

  // Check rounded corner distance
  if (!isMaskable) {
    let dx = 0, dy = 0;
    if (x < cornerRadius) dx = cornerRadius - x;
    else if (x > width - cornerRadius) dx = x - (width - cornerRadius);

    if (y < cornerRadius) dy = cornerRadius - y;
    else if (y > height - cornerRadius) dy = y - (height - cornerRadius);

    if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
      return [0, 0, 0, 0]; // transparent
    }
  }

  // Draw TP text centered
  const scale = width / 18;
  const textWidth = (5 + 1 + 5) * scale;
  const textHeight = 7 * scale;
  const startX = (width - textWidth) / 2;
  const startY = (height - textHeight) / 2;

  const relX = x - startX;
  const relY = y - startY;

  if (relX >= 0 && relX < textWidth && relY >= 0 && relY < textHeight) {
    const gridY = Math.floor(relY / scale);
    if (gridY >= 0 && gridY < 7) {
      // Glyph T (0..5*scale)
      if (relX < 5 * scale) {
        const gridX = Math.floor(relX / scale);
        if (GLYPH_T[gridY][gridX] === "1") {
          return [255, 255, 255, 255];
        }
      }
      // Spacing (5..6*scale)
      // Glyph P (6..11*scale)
      else if (relX >= 6 * scale && relX < 11 * scale) {
        const gridX = Math.floor((relX - 6 * scale) / scale);
        if (GLYPH_P[gridY][gridX] === "1") {
          return [255, 255, 255, 255];
        }
      }
    }
  }

  return [brandR, brandG, brandB, 255];
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });

  const icons = [
    { name: "icon-192.png", size: 192, maskable: false },
    { name: "icon-512.png", size: 512, maskable: false },
    { name: "icon-maskable-512.png", size: 512, maskable: true },
    { name: "apple-touch-icon-180.png", size: 180, maskable: false }
  ];

  for (const icon of icons) {
    const png = makePng(icon.size, icon.size, (x, y, w, h) => drawIcon(x, y, w, h, icon.maskable));
    await writeFile(path.join(ICONS_DIR, icon.name), png);
    console.log(`Generated public/icons/${icon.name}`);
  }
}

await main();
