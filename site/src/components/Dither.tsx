import { useEffect, useRef } from "react";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Animated ordered-dither field in the Luminos blues. Renders at 1/CELL resolution and is scaled up pixelated. */
export default function Dither({ className = "", cell = 6 }: { className?: string; cell?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let last = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      c.width = Math.ceil(c.clientWidth / cell);
      c.height = Math.ceil(c.clientHeight / cell);
    };
    const draw = (t: number) => {
      const w = c.width, h = c.height;
      const img = ctx.createImageData(w, h);
      const s = t / 1000;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const u = x / w, v = y / h;
          let f = 0.55 * Math.exp(-(((u - 0.12 - 0.04 * Math.sin(s * 0.3)) ** 2) * 14 + ((v - 0.1) ** 2) * 26));
          f += 0.42 * Math.exp(-(((u - 0.92) ** 2) * 16 + ((v - 0.95 + 0.03 * Math.cos(s * 0.35)) ** 2) * 18));
          f += 0.07 * (Math.sin(u * 9 + s * 0.5) * Math.sin(v * 7 - s * 0.4) + 1);
          const thr = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
          const on = f > thr * 0.95 + 0.04;
          const i = (y * w + x) * 4;
          if (on) { img.data[i] = 70 + f * 60; img.data[i + 1] = 120 + f * 60; img.data[i + 2] = 255; img.data[i + 3] = 95 + f * 120; }
        }
      }
      ctx.putImageData(img, 0, 0);
    };
    const loop = (t: number) => {
      if (t - last > 70) { draw(t); last = t; }
      raf = requestAnimationFrame(loop);
    };
    resize();
    draw(0);
    if (!reduce) raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [cell]);
  return <canvas ref={ref} className={`px ${className}`} aria-hidden />;
}
