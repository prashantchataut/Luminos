"use client";
import { useEffect, useRef } from "react";

// 8x8 ordered (Bayer) dither – the same technique the launcher uses for its backdrop.
const bayer = (x: number, y: number) => {
  let idx = 0;
  let xx = x & 7;
  let yy = y & 7;
  for (let i = 0; i < 3; i++) {
    idx = (idx << 2) | ((((xx ^ yy) & 1) << 1) | (yy & 1));
    xx >>= 1;
    yy >>= 1;
  }
  return (idx + 0.5) / 64;
};

const RAMP: [number, number, number][] = [
  [4, 6, 18],
  [6, 12, 40],
  [8, 20, 66],
  [20, 52, 150],
  [46, 100, 230],
  [79, 140, 255],
];

export default function DitherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    let w = 0;
    let h = 0;
    let img: ImageData;

    const resize = () => {
      w = Math.ceil(window.innerWidth / 6);
      h = Math.ceil(window.innerHeight / 6);
      canvas.width = w;
      canvas.height = h;
      img = ctx.createImageData(w, h);
    };

    const draw = (t: number) => {
      const aspect = w / h;
      const data = img.data;
      for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
          const u = x / w;
          const ux = u * aspect;
          const d1 = Math.hypot(ux - (0.1 * aspect + 0.06 * Math.sin(t * 0.23)), v - (0.05 + 0.04 * Math.cos(t * 0.31)));
          const g1 = Math.pow(Math.max(0, 1 - d1 / 0.85), 1.6) * 0.95;
          const d2 = Math.hypot(ux - (0.95 * aspect + 0.05 * Math.cos(t * 0.27)), v - (1.0 + 0.05 * Math.sin(t * 0.19)));
          const g2 = Math.pow(Math.max(0, 1 - d2 / 0.75), 1.5) * 0.8;
          const wave = 0.045 * Math.sin(u * 9 + v * 6 + t * 0.6) + 0.03 * Math.sin(u * 4 - v * 7 - t * 0.45);
          const val = Math.min(1, Math.max(0, (g1 + g2 + wave) * 0.95 + 0.06));
          const scaled = val * (RAMP.length - 1);
          const lo = Math.floor(scaled);
          const idx = Math.min(RAMP.length - 1, lo + (scaled - lo > bayer(x, y) ? 1 : 0));
          const c = RAMP[idx];
          const o = (y * w + x) * 4;
          data[o] = c[0];
          data[o + 1] = c[1];
          data[o + 2] = c[2];
          data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    const loop = (now: number) => {
      if (now - last > 110) {
        draw(now / 1000);
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    draw(4);
    if (!reduce) raf = requestAnimationFrame(loop);
    const onResize = () => {
      resize();
      draw(performance.now() / 1000);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full [image-rendering:pixelated]" />;
}
