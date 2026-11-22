// Ordered-dither night sky. Pure function, no DOM, so it can run in the browser
// (canvas) and in Node (screenshot check). One scalar "value" per pixel is mapped
// onto a fixed 9-step blue palette using an 8x8 Bayer matrix, which is what gives
// the sky, moon and clouds their halftone grain.

export type SkyVariant = "hero" | "closing";
export interface SkyOpts {
  variant: SkyVariant;
  moon: boolean;
}

const HEX = [
  "#01020a",
  "#050a1f", // == page background, so section edges disappear
  "#08124a",
  "#0c2370",
  "#1a45bd",
  "#3f74e6",
  "#8fb6f5",
  "#d3e4fc",
  "#ffffff",
];
export const PALETTE: [number, number, number][] = HEX.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);
const LEVELS = PALETTE.length - 1;

const BAYER = (() => {
  const m = new Float32Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let v = 0;
      let xx = x;
      let yy = y;
      for (let b = 0; b < 3; b++) {
        v = (v << 2) | (((xx ^ yy) & 1) << 1) | (yy & 1);
        xx >>= 1;
        yy >>= 1;
      }
      m[y * 8 + x] = (v + 0.5) / 64;
    }
  }
  return m;
})();

function hash(ix: number, iy: number): number {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const w = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}
function fbm(x: number, y: number): number {
  return (
    vnoise(x, y) * 0.5 +
    vnoise(x * 2.03 + 11.1, y * 2.03 + 5.7) * 0.25 +
    vnoise(x * 4.1 + 3.3, y * 4.1 + 17.9) * 0.125 +
    vnoise(x * 8.3 + 9.9, y * 8.3 + 1.3) * 0.0625
  );
}
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function renderSky(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  t: number,
  o: SkyOpts,
): void {
  const hero = o.variant === "hero";
  const cloudBase = hero ? 0.8 : 0.5;
  const rowStart = Math.max(0, cloudBase - 0.28);

  // moon geometry (hero only)
  const mr = Math.min(W * 0.2, H * 0.26);
  const mcx = W * 0.5;
  const mcy = H * 1.0;
  const L = [-0.5, -0.45, 0.74];

  const drift = t * 0.018;

  for (let y = 0; y < H; y++) {
    const yf = y / H;
    let base: number;
    if (hero) base = 0.012 + 0.46 * sm(0.4, 0.97, yf);
    else base = 0.125 - 0.1 * sm(0, 0.16, yf) + 0.52 * sm(0.14, 0.52, yf);

    for (let x = 0; x < W; x++) {
      let v = base;
      let covered = false;

      // ---- moon
      if (o.moon && hero) {
        const dx = x - mcx;
        const dy = y - mcy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < mr) {
          const nx = dx / mr;
          const ny = dy / mr;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const lit = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
          const tex = fbm(x * 0.05 + 40, y * 0.05 + 8);
          v = 0.2 + 0.7 * lit * (0.8 + 0.4 * tex);
          covered = true;
        } else {
          const g = Math.exp(-Math.pow((d - mr) / (mr * 0.85), 1.3)) * 0.2;
          v += g;
        }
      }

      // ---- clouds
      let cover = 0;
      if (yf > rowStart) {
        const u = (x / H) * 5;
        const w = (y / H) * 5;
        const n1 = fbm(u * 0.9 + drift, w * 0.9);
        const n2 = fbm(u * 2.4 + drift * 1.6 + 3, w * 2.4);
        const cs = yf - cloudBase;
        const d = clamp01(cs * 5 + (n1 - 0.5) * 2.0 + (n2 - 0.5) * 0.9);
        cover = sm(0.0, 0.22, d);
        if (cover > 0) {
          const light = 1 - sm(0, 0.8, d);
          const tex = clamp01((n2 - 0.28) * 2.4);
          const bright = 0.2 + 0.8 * (0.5 * light + 0.5 * tex);
          let cv = hero ? 0.2 + 0.46 * bright : 0.68 + 0.32 * bright;
          if (hero) cv = cv + (0.125 - cv) * sm(0.84, 1, yf);
          v = v + (cv - v) * cover;
        }
      }

      // ---- stars (only on open sky)
      let r: number;
      let g: number;
      let b: number;
      const idx = (y * W + x) * 4;
      if (!covered && cover < 0.02 && v < 0.5) {
        const sh = hash(x * 7 + 1, y * 13 + 5);
        if (sh < 0.0011 * (1 - yf * 0.75)) {
          const ph = hash(x + 99, y + 7) * 6.283;
          const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + ph);
          const c = PALETTE[5 + Math.floor(tw * 3.99)];
          data[idx] = c[0];
          data[idx + 1] = c[1];
          data[idx + 2] = c[2];
          data[idx + 3] = 255;
          continue;
        }
      }

      // ---- ordered dither into palette
      const lv = clamp01(v) * LEVELS;
      const base0 = Math.floor(lv);
      const frac = lv - base0;
      let k = base0 + (frac > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0);
      if (k > LEVELS) k = LEVELS;
      const c = PALETTE[k];
      r = c[0];
      g = c[1];
      b = c[2];
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
}
