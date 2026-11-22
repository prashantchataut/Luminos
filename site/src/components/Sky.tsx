import { useEffect, useRef } from "react";
import { createSky, type SkyBuilder, type SkyVariant } from "../lib/skyCore";

interface Props {
  variant: SkyVariant;
  moon?: boolean;
  className?: string;
}

/**
 * Canvas wrapper around the ordered-dither sky.
 *  - Renders at low resolution, scaled up with `image-rendering: pixelated`.
 *  - Builds its layers in ~8 ms slices (never a long task), and only once the
 *    section is within 600 px of the viewport.
 *  - Animates at 10 fps, only while on screen and the tab is visible.
 *  - Draws one still frame when the user prefers reduced motion.
 */
export default function Sky({ variant, moon = false, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let raf = 0;
    let timer = 0;
    let last = 0;
    let builder: SkyBuilder | null = null;
    let img: ImageData | null = null;
    let ready = false;
    let building = false;
    let gen = 0;
    const t0 = performance.now();

    const buildNow = () => {
      const r = canvas.getBoundingClientRect();
      const cell = r.width < 640 ? 3 : 4;
      const w = Math.max(32, Math.ceil(r.width / cell));
      const h = Math.max(32, Math.ceil(r.height / cell));
      canvas.width = w;
      canvas.height = h;
      img = ctx.createImageData(w, h);
      builder = createSky(w, h, { variant, moon });
      ready = false;
      building = true;
      const my = ++gen;
      const pump = () => {
        if (my !== gen || !builder) return;
        const s = performance.now();
        while (performance.now() - s < 8) {
          if (builder.step()) {
            building = false;
            ready = true;
            paint(40);
            canvas.style.opacity = "1";
            if (!reduce.matches) raf = requestAnimationFrame(loop);
            return;
          }
        }
        timer = window.setTimeout(pump, 0);
      };
      pump();
    };

    const paint = (t: number) => {
      if (!ready || !builder || !img) return;
      builder.frame(img.data, t);
      ctx.putImageData(img, 0, 0);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < 100) return;
      last = now;
      paint(40 + (now - t0) / 1000);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !builder) buildNow();
      },
      { rootMargin: "600px 0px 600px 0px" },
    );
    io.observe(canvas);

    let rt = 0;
    const ro = new ResizeObserver(() => {
      if (!builder) return;
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        cancelAnimationFrame(raf);
        window.clearTimeout(timer);
        canvas.style.opacity = "0";
        buildNow();
      }, 250);
    });
    ro.observe(canvas);

    const onMotion = () => {
      cancelAnimationFrame(raf);
      if (ready && !reduce.matches) raf = requestAnimationFrame(loop);
    };
    reduce.addEventListener("change", onMotion);

    return () => {
      gen++;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(rt);
      io.disconnect();
      ro.disconnect();
      reduce.removeEventListener("change", onMotion);
      void building;
    };
  }, [variant, moon]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ opacity: 0, transition: "opacity 1.2s cubic-bezier(0.22,1,0.36,1)" }}
      className={`sky absolute inset-0 h-full w-full bg-ink-1 ${className}`}
    />
  );
}
