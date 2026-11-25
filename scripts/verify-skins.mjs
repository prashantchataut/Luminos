// Fails when a built-in skin is flat, mis-sized or has an empty 2nd layer.   node scripts/verify-skins.mjs
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function walk(d, out = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".git", "target", "dist", "build"].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith(".png") && /[\\/]skins[\\/]/.test(p)) out.push(p); } return out; }
function decode(buf) {
  let p = 8, w = 0, h = 0, ct = 0, idat = [];
  while (p < buf.length) { const n = buf.readUInt32BE(p), t = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n); if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8) throw new Error("only 8-bit"); } if (t === "IDAT") idat.push(d); p += 12 + n; }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error("colour type " + ct + " unsupported");
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } cur[i] = v & 255; }
    prev = cur; }
  const rgba = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { rgba[i * 4] = px[i * bpp]; rgba[i * 4 + 1] = px[i * bpp + 1]; rgba[i * 4 + 2] = px[i * bpp + 2]; rgba[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255; }
  return { w, h, rgba };
}
const files = walk(ROOT).sort(); let bad = 0;
const count = (img, x0, y0, x1, y1) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (img.rgba[(y * img.w + x) * 4 + 3] > 0) n++; return n; };
console.log("skin".padEnd(26), "colours  top-share  hat  jacket  sleeves  legs2  verdict");
for (const f of files) {
  const rel = path.relative(ROOT, f), why = [];
  let img; try { img = decode(fs.readFileSync(f)); } catch (e) { console.log(rel.padEnd(26), "unreadable:", e.message); bad++; continue; }
  if (img.w !== 64 || img.h !== 64) { console.log(rel.padEnd(26), `${img.w}x${img.h}  FAIL not 64x64`); bad++; continue; }
  const m = new Map(); let opaque = 0; for (let i = 0; i < 4096; i++) if (img.rgba[i * 4 + 3]) { opaque++; const k = img.rgba.readUInt32BE(i * 4); m.set(k, (m.get(k) || 0) + 1); }
  const top = Math.max(...m.values()) / opaque, hat = count(img, 32, 0, 63, 15), jacket = count(img, 16, 32, 39, 47), sleeves = count(img, 40, 32, 55, 47) + count(img, 48, 48, 63, 63), legs = count(img, 0, 32, 15, 47) + count(img, 0, 48, 15, 63);
  if (m.size < 40) why.push(`only ${m.size} colours (<40)`); if (top > .3) why.push(`one colour fills ${(top * 100) | 0}%`);
  if (hat < 24) why.push("hat layer empty"); if (jacket < 24) why.push("jacket layer empty"); if (sleeves < 24) why.push("sleeve layer empty"); if (legs < 24) why.push("leg layer empty");
  if (why.length) bad++;
  console.log(path.basename(rel).padEnd(26), String(m.size).padStart(7), `${(top * 100).toFixed(0)}%`.padStart(9), String(hat).padStart(6), String(jacket).padStart(6), String(sleeves).padStart(8), String(legs).padStart(6), "  ", why.length ? "FAIL " + why.join("; ") : "ok");
}
if (files.length < 12) { console.log(`FAIL: expected at least 12 skins, found ${files.length}`); bad++; }
console.log(`\n${files.length} skin files checked, ${bad} failing`); process.exit(bad ? 1 : 0);
