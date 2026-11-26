#!/usr/bin/env node
// Renders brand/luminos-mark.svg into every desktop and installer icon Luminos ships:
//   app/src-tauri/icons/{icon.png,32x32.png,64x64.png,128x128.png,128x128@2x.png}
//   app/src-tauri/icons/icon.ico            (256,128,64,48,32,16: a real multi-layer Windows icon)
//   app/src-tauri/icons/nsis-sidebar.bmp    (164x314, 24-bit)   app/src-tauri/icons/nsis-header.bmp (150x57, 24-bit)
//   site/public/{luminos.svg,favicon.svg,favicon-32.png,apple-touch-icon.png,luminos-512.png}, site/src/assets/luminos.svg
// Usage: node scripts/gen-icons.mjs   (needs `sharp`, installed in app/ as a dev dependency)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(join(root, "app", "package.json"))("sharp");
const svg = readFileSync(join(root, "brand", "luminos-mark.svg"));
const icons = join(root, "app", "src-tauri", "icons");
mkdirSync(icons, { recursive: true });

const BG = { r: 0x0b, g: 0x0d, b: 0x12 };
const png = (size) => sharp(svg, { density: Math.max(72, (size / 32) * 72 * 4) }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// --- ICO: PNG for 256 (Vista+), 32-bit BMP/DIB for the smaller layers (what shell, taskbar and old tools read best) ---
async function dib(size) {
  const { data } = await sharp(svg, { density: Math.max(72, (size / 32) * 72 * 4) }).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const head = Buffer.alloc(40);
  head.writeUInt32LE(40, 0); head.writeInt32LE(size, 4); head.writeInt32LE(size * 2, 8); head.writeUInt16LE(1, 12); head.writeUInt16LE(32, 14);
  head.writeUInt32LE(size * size * 4, 20);
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = ((size - 1 - y) * size + x) * 4, d = (y * size + x) * 4; // bottom-up, BGRA
    px[d] = data[s + 2]; px[d + 1] = data[s + 1]; px[d + 2] = data[s]; px[d + 3] = data[s + 3];
  }
  const maskRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([head, px, Buffer.alloc(maskRow * size)]);
}
async function ico(sizes) {
  const layers = [];
  for (const s of sizes) layers.push({ s, buf: s >= 256 ? await png(s) : await dib(s) });
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(layers.length, 4);
  let off = 6 + layers.length * 16;
  const dir = layers.map(({ s, buf }) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(off, 12);
    off += buf.length; return e;
  });
  return Buffer.concat([head, ...dir, ...layers.map((l) => l.buf)]);
}

// --- 24-bit BMP (NSIS wants BMP3 without alpha) ---
async function bmp(width, height, composite) {
  const base = sharp({ create: { width, height, channels: 3, background: BG } });
  const { data } = await base.composite(composite).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const stride = Math.ceil((width * 3) / 4) * 4, out = Buffer.alloc(54 + stride * height);
  out.write("BM", 0); out.writeUInt32LE(out.length, 2); out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14); out.writeInt32LE(width, 18); out.writeInt32LE(height, 22); out.writeUInt16LE(1, 26); out.writeUInt16LE(24, 28);
  out.writeUInt32LE(stride * height, 34); out.writeInt32LE(2835, 38); out.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const s = ((height - 1 - y) * width + x) * 3, d = 54 + y * stride + x * 3;
    out[d] = data[s + 2]; out[d + 1] = data[s + 1]; out[d + 2] = data[s];
  }
  return out;
}
const glow = (w, h, cx, cy, r) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2B4BFF" stop-opacity=".42"/><stop offset="1" stop-color="#2B4BFF" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);

const out = (name, buf) => { writeFileSync(join(icons, name), buf); console.log("wrote", name, buf.length, "bytes"); };

out("icon.png", await png(512));
out("128x128@2x.png", await png(256));
out("128x128.png", await png(128));
out("64x64.png", await png(64));
out("32x32.png", await png(32));
out("icon.ico", await ico([256, 128, 64, 48, 32, 16]));
out("nsis-sidebar.bmp", await bmp(164, 314, [
  { input: glow(164, 314, 82, 130, 150), left: 0, top: 0 },
  { input: await png(104), left: 30, top: 78 },
]));
out("nsis-header.bmp", await bmp(150, 57, [
  { input: glow(150, 57, 110, 28, 70), left: 0, top: 0 },
  { input: await png(40), left: 98, top: 8 },
]));

// brand + site copies of the same drawing
copyFileSync(join(root, "brand", "luminos-mark.svg"), join(root, "brand", "luminos.svg"));
writeFileSync(join(root, "brand", "luminos-512.png"), await png(512));
writeFileSync(join(root, "brand", "luminos-256.png"), await png(256));
writeFileSync(join(root, "brand", "luminos-64.png"), await png(64));
writeFileSync(join(root, "brand", "luminos.ico"), await ico([256, 128, 64, 48, 32, 16]));
for (const f of ["luminos.svg", "favicon.svg"]) copyFileSync(join(root, "brand", "luminos-mark.svg"), join(root, "site", "public", f));
copyFileSync(join(root, "brand", "luminos-mark.svg"), join(root, "site", "src", "assets", "luminos.svg"));
writeFileSync(join(root, "site", "public", "favicon-32.png"), await png(32));
writeFileSync(join(root, "site", "public", "apple-touch-icon.png"), await png(180));
writeFileSync(join(root, "site", "public", "luminos-512.png"), await png(512));
console.log("done");
