// Tiny dependency-free RGBA raster + PNG encoder + 3x5 pixel font, shared by the cape and skin generators.
import zlib from "node:zlib";

export const hex = (h) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
export const shade = (c, f) => [clamp(Math.round(c[0] * f)), clamp(Math.round(c[1] * f)), clamp(Math.round(c[2] * f))];
export const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
export const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** Ordered-dither threshold in 0..1 for pixel (x,y). */
export const bayer = (x, y) => (BAYER4[y & 3][x & 3] + 0.5) / 16;

export class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c, a = 255) { x = Math.round(x); y = Math.round(y); if (!this.in(x, y)) return; const i = (y * this.w + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a; }
  get(x, y) { if (!this.in(x, y)) return [0, 0, 0, 0]; const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  rect(x, y, w, h, c, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  line(x0, y0, x1, y1, c, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); this.rect(x - (t >> 1), y - (t >> 1), t, t, c); }
  }
  disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.4) this.set(cx + x, cy + y, c); }
  ring(cx, cy, r0, r1, c) { for (let y = -r1; y <= r1; y++) for (let x = -r1; x <= r1; x++) { const d = Math.hypot(x, y); if (d >= r0 && d <= r1) this.set(cx + x, cy + y, c); } }
  blit(src, dx, dy) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const p = src.get(x, y); if (p[3]) this.set(dx + x, dy + y, p, p[3]); } }
  map(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const p = this.get(x, y); if (!p[3]) continue; const r = fn(p, x, y); if (r) this.set(x, y, r, p[3]); } }
  png() {
    const stride = this.w * 4 + 1, raw = Buffer.alloc(stride * this.h);
    for (let y = 0; y < this.h; y++) { raw[y * stride] = 0; Buffer.from(this.d.buffer, y * this.w * 4, this.w * 4).copy(raw, y * stride + 1); }
    const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
    const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
    const chunk = (t, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(t), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4); ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  }
}

// 3x5 font. Each glyph: five rows of three chars ('#' set).
const G = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###", F: "###|#..|##.|#..|#..",
  G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.", K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###",
  M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.", P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|##.|.##", R: "##.|#.#|##.|#.#|#.#",
  S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.", U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#",
  Y: "#.#|#.#|.#.|.#.|.#.", Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "##.|..#|.#.|#..|###", 3: "##.|..#|.#.|..#|##.", 4: "#.#|#.#|###|..#|..#", 5: "###|#..|##.|..#|##.",
  6: ".##|#..|###|#.#|###", 7: "###|..#|.#.|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|##.",
  ":": "...|.#.|...|.#.|...", ".": "...|...|...|...|.#.", "-": "...|...|###|...|...", _: "...|...|...|...|###", "/": "..#|..#|.#.|#..|#..", "(": ".#.|#..|#..|#..|.#.",
  ")": ".#.|..#|..#|..#|.#.", "!": ".#.|.#.|.#.|...|.#.", "'": ".#.|.#.|...|...|...", "?": "##.|..#|.#.|...|.#.", "%": "#.#|..#|.#.|#..|#.#", " ": "...|...|...|...|...", "+": "...|.#.|###|.#.|...", "=": "...|###|...|###|...",
};
export const textWidth = (s, scale = 1, gap = 1) => s.length * (3 + gap) * scale - gap * scale;
export function text(img, s, x, y, c, scale = 1, gap = 1) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = (G[ch] || G["?"]).split("|");
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === "#") img.rect(cx + q * scale, y + r * scale, scale, scale, c);
    cx += (3 + gap) * scale;
  }
}
export const textCentered = (img, s, cx, y, c, scale = 1, gap = 1) => text(img, s, Math.round(cx - textWidth(s, scale, gap) / 2), y, c, scale, gap);
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
