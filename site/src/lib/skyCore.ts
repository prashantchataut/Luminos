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

export interface SkyBuilder {
  /** Does a small slice of work. Returns true when everything is built. */
  step(): boolean;
  /** Paints one frame. Cheap: table lookups plus the dither. */
  frame(data: Uint8ClampedArray, t: number): void;
}

/**
 * Builds the sky in layers once (sky gradient + moon + stars, then clouds), in small
 * slices so the main thread is never blocked for long. Animation afterwards is only a
 * horizontal slide of the precomputed cloud layer plus star twinkle.
 */
export function createSky(W: number, H: number, o: SkyOpts): SkyBuilder {
  const hero = o.variant === "hero";
  const cloudBase = hero ? 0.8 : 0.5;
  const rowStart = Math.max(0, Math.floor((cloudBase - 0.28) * H));
  const extra = Math.floor(W * 0.25);
  const CW = W + extra;
  const CH = H - rowStart;

  const base = new Float32Array(W * H);
  const moonCov = new Uint8Array(W * H);
  const cover = new Uint8Array(CW * CH);
  const cval = new Float32Array(CW * CH);
  const stars: { x: number; y: number; ph: number }[] = [];

  const mr = Math.min(W * 0.2, H * 0.26);
  const mcx = W * 0.5;
  const mcy = H * 1.0;
  const L = [-0.5, -0.45, 0.74];

  let phase = 0;
  let row = 0;

  function baseRow(y: number) {
    const yf = y / H;
    let b: number;
    if (hero) b = 0.012 + 0.46 * sm(0.4, 0.97, yf);
    else b = 0.125 - 0.1 * sm(0, 0.16, yf) + 0.52 * sm(0.14, 0.52, yf);
    for (let x = 0; x < W; x++) {
      let v = b;
      let covered = 0;
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
          covered = 1;
        } else {
          v += Math.exp(-Math.pow((d - mr) / (mr * 0.85), 1.3)) * 0.2;
        }
      }
      base[y * W + x] = v;
      moonCov[y * W + x] = covered;
      if (!covered && v < 0.5 && hash(x * 7 + 1, y * 13 + 5) < 0.0011 * (1 - yf * 0.75)) {
        stars.push({ x, y, ph: hash(x + 99, y + 7) * 6.283 });
      }
    }
  }

  function cloudRow(y: number) {
    const yf = y / H;
    const r = y - rowStart;
    const w = (y / H) * 5;
    for (let xc = 0; xc < CW; xc++) {
      const u = (xc / H) * 5;
      const n1 = fbm(u * 0.9, w * 0.9);
      const n2 = fbm(u * 2.4 + 3, w * 2.4);
      const d = clamp01((yf - cloudBase) * 5 + (n1 - 0.5) * 2.0 + (n2 - 0.5) * 0.9);
      const cov = sm(0.0, 0.22, d);
      const i = r * CW + xc;
      cover[i] = Math.round(cov * 255);
      if (cov > 0) {
        const light = 1 - sm(0, 0.8, d);
        const tex = clamp01((n2 - 0.28) * 2.4);
        const bright = 0.2 + 0.8 * (0.5 * light + 0.5 * tex);
        let cv = hero ? 0.2 + 0.46 * bright : 0.68 + 0.32 * bright;
        if (hero) cv = cv + (0.125 - cv) * sm(0.84, 1, yf);
        cval[i] = cv;
      }
    }
  }

  return {
    step() {
      if (phase === 0) {
        const end = Math.min(H, row + 8);
        for (; row < end; row++) baseRow(row);
        if (row >= H) {
          phase = 1;
          row = rowStart;
        }
        return false;
      }
      if (phase === 1) {
        const end = Math.min(H, row + 3);
        for (; row < end; row++) cloudRow(row);
        if (row >= H) phase = 2;
        return phase === 2;
      }
      return true;
    },
    frame(data, t) {
      const shift = Math.floor(extra * (0.5 + 0.5 * Math.sin(t * 0.1)));
      for (let y = 0; y < H; y++) {
        const cr = y - rowStart;
        const by = y * W;
        const by4 = by * 4;
        for (let x = 0; x < W; x++) {
          let v = base[by + x];
          if (cr >= 0) {
            const ci = cr * CW + x + shift;
            const c = cover[ci];
            if (c > 0) v += (cval[ci] - v) * (c / 255);
          }
          const lv = (v < 0 ? 0 : v > 1 ? 1 : v) * LEVELS;
          const b0 = Math.floor(lv);
          let k = b0 + (lv - b0 > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0);
          if (k > LEVELS) k = LEVELS;
          const col = PALETTE[k];
          const i = by4 + x * 4;
          data[i] = col[0];
          data[i + 1] = col[1];
          data[i + 2] = col[2];
          data[i + 3] = 255;
        }
      }
      // stars, only where no cloud covers them right now
      for (let n = 0; n < stars.length; n++) {
        const st = stars[n];
        const cr = st.y - rowStart;
        if (cr >= 0 && cover[cr * CW + st.x + shift] > 5) continue;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + st.ph);
        const col = PALETTE[5 + Math.floor(tw * 3.99)];
        const i = (st.y * W + st.x) * 4;
        data[i] = col[0];
        data[i + 1] = col[1];
        data[i + 2] = col[2];
      }
    },
  };
}
