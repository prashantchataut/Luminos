import { useEffect, useRef } from "react";

// Same maths as launcher/crates/luminos-app/src/brand.rs: a lit sphere quantised with a 4x4 Bayer matrix.
const TONES = ["#0e1b52", "#2348e0", "#5c8cff", "#e2eeff"];
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function cell(n: number, x: number, y: number, lx: number, ly: number): number | null {
  const h = n / 2;
  const dx = (x + 0.5 - h) / h;
  const dy = (y + 0.5 - h) / h;
  const r2 = dx * dx + dy * dy;
  if (r2 > 1) return null;
  const nz = Math.sqrt(1 - r2);
  const lz = 0.62;
  const norm = Math.hypot(lx, ly, lz);
  const lam = (dx * lx + dy * ly + nz * lz) / norm;
  const b = Math.min(1, Math.max(0, lam * 0.92 + 0.2 + (1 - nz) * 0.06));
  const v = b * 3;
  const lo = Math.floor(v);
  const t = (BAYER[y & 3][x & 3] + 0.5) / 16;
  return Math.min(3, lo + (v - lo > t ? 1 : 0));
}

export default function Orb({ n = 44, className = "" }: { n?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    const draw = (ms: number) => {
      const s = Math.min(cv.clientWidth, 760) * (window.devicePixelRatio || 1);
      if (cv.width !== Math.round(s)) cv.width = cv.height = Math.round(s);
      const u = cv.width / n;
      const a = reduce ? -2.36 : -2.36 + (ms / 1000) * 0.55;
      const lx = Math.cos(a);
      const ly = Math.sin(a);
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const t = cell(n, x, y, lx, ly);
          if (t === null) continue;
          ctx.fillStyle = TONES[t];
          ctx.fillRect(Math.floor(x * u), Math.floor(y * u), Math.ceil(u), Math.ceil(u));
        }
    };
    const loop = (ms: number) => {
      if (ms - last > 50) {
        draw(ms);
        last = ms;
      }
      raf = requestAnimationFrame(loop);
    };
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
