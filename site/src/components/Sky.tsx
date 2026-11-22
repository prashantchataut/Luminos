import { useEffect, useRef } from "react";
import { renderSky, type SkyVariant } from "../lib/skyCore";

interface Props {
  variant: SkyVariant;
  moon?: boolean;
  className?: string;
}

/**
 * Canvas wrapper around the ordered-dither sky. Renders at low resolution and is
 * scaled up with `image-rendering: pixelated`, so the grain stays crisp.
 * Pauses when off-screen or when the tab is hidden; draws a single still frame
 * when the user prefers reduced motion.
 */
export default function Sky({ variant, moon = false, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let raf = 0;
    let last = 0;
    let img: ImageData | null = null;
    const t0 = performance.now();

    const size = () => {
      const r = canvas.getBoundingClientRect();
      const cell = r.width < 640 ? 2 : 3;
      const w = Math.max(32, Math.ceil(r.width / cell));
      const h = Math.max(32, Math.ceil(r.height / cell));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        img = ctx.createImageData(w, h);
      }
    };

    const draw = (t: number) => {
      if (!img) size();
      if (!img) return;
      renderSky(img.data, img.width, img.height, t, { variant, moon });
      ctx.putImageData(img, 0, 0);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (now - last < 1000 / 24) return;
      last = now;
      draw(40 + (now - t0) / 1000);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      size();
      draw(40);
      if (!reduce.matches) raf = requestAnimationFrame(loop);
    };

    start();
    const ro = new ResizeObserver(() => {
      size();
      draw(40);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);
    reduce.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      reduce.removeEventListener("change", start);
    };
  }, [variant, moon]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`sky absolute inset-0 h-full w-full ${className}`}
    />
  );
}
