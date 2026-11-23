import { useEffect, useRef, useState, ReactNode } from "react";

/* ---------- icons: one hand-drawn 24px set, 1.6 stroke, round caps ---------- */
const P: Record<string, string> = {
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  puzzle: "M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z",
  shirt: "M8 3l-5 3 2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .5a7 7 0 0 0-1.5-1.5L17 5l-3-1-1 2a7 7 0 0 0-2 0L10 4 7 5l.5 2A7 7 0 0 0 6 8.5L4 8l-1 3 2 1a7 7 0 0 0 0 2l-2 1 1 3 2-.5a7 7 0 0 0 1.5 1.5L7 21l3 1 1-2a7 7 0 0 0 2 0l1 2 3-1-.5-2a7 7 0 0 0 1.5-1.5l2 .5 1-3-2-1a7 7 0 0 0 0-2z",
  play: "M7 4.5v15l12-7.5z",
  stop: "M6 6h12v12H6z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  download: "M12 4v11m0 0l-4-4m4 4l4-4M5 20h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4.5l3 1.5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  alert: "M12 4l9 16H3zM12 10v4.5M12 17.5v.01",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  heart: "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  upload: "M12 16V5m0 0L8 9m4-4l4 4M5 20h14",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 20c1-4 4-6 8-6s7 2 8 6",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  ext: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  min: "M5 12h14", max: "M6 6h12v12H6z", rot: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
  wifi: "M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0M12 19.5v.01",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
};
export function Icon({ n, s = 18, className = "" }: { n: string; s?: number; className?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={P[n] || P.cube} />
    </svg>
  );
}

/* ---------- dithering ---------- */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rnd = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** Animated Bayer-dithered night sky: the website's identity, at 12 fps, paused when hidden or when reduced motion is on. */
export function Sky({ className = "", animate = true, tone = 0 }: { className?: string; animate?: boolean; tone?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const px = 3;
    const pal = ["#02040d", "#050a1f", "#0a1433", "#12204d", "#1d3a8a", "#3b6cf0", "#8fb4ff"].map(hex);
    let w = 0, h = 0, raf = 0, last = 0, t0 = performance.now();
    const stars: [number, number, number][] = [];
    const resize = () => {
      w = Math.ceil(c.clientWidth / px); h = Math.ceil(c.clientHeight / px);
      c.width = w; c.height = h;
      const r = rnd(7 + tone); stars.length = 0;
      for (let i = 0; i < w * h * 0.0035; i++) stars.push([Math.floor(r() * w), Math.floor(r() * h * 0.75), r()]);
    };
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = y / h;
          const glowX = 0.68 + Math.sin(t * 0.05 + tone) * 0.04;
          const gx = (x / w - glowX) * 1.4, gy = (v - 0.92) * 1.1;
          const glow = Math.max(0, 1 - Math.sqrt(gx * gx + gy * gy)) ** 2.2;
          const wave = Math.sin(x * 0.045 + t * 0.35 + tone) * 0.03 + Math.sin(x * 0.013 - t * 0.2) * 0.04;
          let l = 1.2 + v * 2.3 + glow * 3.1 + wave * 2;
          const th = BAYER[(y & 3) * 4 + (x & 3)] / 16;
          const idx = Math.max(0, Math.min(pal.length - 1, Math.floor(l + th - 0.5)));
          const col = pal[idx], o = (y * w + x) * 4;
          img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
        }
      }
      for (const [sx, sy, p] of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + p * 1.4) + p * 20);
        const col = tw > 0.35 ? pal[6] : pal[5], o = (sy * w + sx) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2];
      }
      ctx.putImageData(img, 0, 0);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 83 || document.hidden) return;
      last = now; draw(now);
    };
    resize(); draw(performance.now());
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce");
    if (animate && !reduce) raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { resize(); draw(performance.now()); });
    ro.observe(c);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [animate, tone]);
  return <canvas ref={ref} className={className} style={{ imageRendering: "pixelated", width: "100%", height: "100%", display: "block" }} />;
}

const SCENES: Record<string, { sky: string[]; ridge: string[]; sun: string; seed: number }> = {
  "26.3": { sky: ["#050a1f", "#12204d", "#3b6cf0"], ridge: ["#1d3a8a", "#12204d", "#0a1433"], sun: "#cfe0ff", seed: 3 },
  "26.2": { sky: ["#0a1433", "#2a2f7a", "#7b6cf0"], ridge: ["#2a2f7a", "#1a1c52", "#0c0e30"], sun: "#e4dcff", seed: 5 },
  "26.1.2": { sky: ["#06142a", "#0f3a5c", "#4fb3d9"], ridge: ["#14506f", "#0d3350", "#071e30"], sun: "#dff6ff", seed: 8 },
  "1.21.11": { sky: ["#1a1030", "#6a2f6e", "#ff9e7a"], ridge: ["#4a2a60", "#2c1a45", "#150c2a"], sun: "#ffe6cf", seed: 11 },
  "1.21.4": { sky: ["#0a1a22", "#1f5a4a", "#9be0a0"], ridge: ["#1b5a45", "#10392d", "#08201a"], sun: "#eaffe6", seed: 14 },
};
/** Cover art. Uses the real in-game capture from CI when /covers/<version>.jpg exists, otherwise a dithered scene. */
export function Cover({ version, className = "" }: { version: string; className?: string }) {
  const [real, setReal] = useState(true);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (real) return;
    const c = ref.current!, ctx = c.getContext("2d")!;
    const S = SCENES[version] || SCENES["26.3"];
    const w = 240, h = 135; c.width = w; c.height = h;
    const img = ctx.createImageData(w, h), r = rnd(S.seed);
    const sky = S.sky.map(hex), ridge = S.ridge.map(hex), sun = hex(S.sun);
    const layers = [0.58, 0.68, 0.8].map((base, li) => { const ph = r() * 10, f = 0.03 + li * 0.02, a = 8 + li * 3; return (x: number) => Math.floor(h * base + Math.sin(x * f + ph) * a + Math.sin(x * f * 2.3 + ph) * a * 0.4); });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const th = BAYER[(y & 3) * 4 + (x & 3)] / 16, v = y / h;
      let col: number[];
      const hit = layers.findIndex((fn) => y >= fn(x));
      if (hit >= 0) { const k = layers.map((fn) => y >= fn(x)).lastIndexOf(true); const m = Math.min(2, k + (th > 0.55 ? 0 : 0)); col = ridge[m]; if ((y - layers[k](x)) < 2 && k === 0) col = sky[2]; }
      else {
        const l = v * 2.2 + (1 - Math.hypot((x / w - 0.7) * 1.6, (v - 0.55) * 1.2)) * 0.9;
        col = sky[Math.max(0, Math.min(2, Math.floor(l + th - 0.5)))];
        const d = Math.hypot(x - w * 0.7, (y - h * 0.38) * 1.0);
        if (d < 9) col = sun; else if (d < 12 && th > 0.5) col = sun;
        else if (v < 0.4 && ((x * 7 + y * 13 + S.seed) % 71 === 0)) col = sun;
      }
      const o = (y * w + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [real, version]);
  return real ? (
    <img src={`/covers/${version}.jpg`} alt="" onError={() => setReal(false)} className={`object-cover w-full h-full ${className}`} />
  ) : (
    <canvas ref={ref} className={`w-full h-full ${className}`} style={{ imageRendering: "pixelated", objectFit: "cover" }} />
  );
}

/* ---------- controls ---------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="relative h-6 w-11 rounded-full shrink-0 transition-colors" style={{ background: on ? "var(--color-accent-deep)" : "rgba(160,190,255,.16)", transitionDuration: "var(--dur-base)" }}>
      <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: `translateX(${on ? 20 : 0}px)`, transitionDuration: "var(--dur-base)", transitionTimingFunction: "var(--ease-out-expo)" }} />
    </button>
  );
}
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-1 rounded-full hair bg-ink-0/40 gap-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className="h-8 px-4 rounded-full text-[13px] font-medium transition-colors" style={{ background: value === o.v ? "rgba(143,180,255,.2)" : "transparent", color: value === o.v ? "#fff" : "var(--color-mute)", transitionDuration: "var(--dur-fast)" }}>{o.l}</button>
      ))}
    </div>
  );
}
export function Slider({ value, min, max, step = 1, onChange, fmt }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3 w-64">
      <div className="relative flex-1 h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />
        <div className="absolute left-0 h-1.5 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#3b6cf0,#8fb4ff)" }} />
        <div className="absolute h-4 w-4 rounded-full bg-white shadow -ml-2" style={{ left: `${pct}%`, boxShadow: "0 0 0 4px rgba(143,180,255,.2)" }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="absolute inset-0 w-full opacity-0 cursor-pointer" aria-label="value" />
      </div>
      <span className="num text-[13px] text-mute w-16 text-right">{fmt ? fmt(value) : value}</span>
    </div>
  );
}
export function Row({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 border-b border-line last:border-0">
      <div className="min-w-0"><div className="font-medium text-[14px]">{title}</div>{desc && <div className="text-mute text-[12.5px] mt-0.5 leading-snug max-w-[46ch]">{desc}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
export function Badge({ tone = "mute", children }: { tone?: "ok" | "warn" | "bad" | "mute" | "accent"; children: ReactNode }) {
  const c = { ok: "var(--color-ok)", warn: "var(--color-warn)", bad: "var(--color-bad)", mute: "var(--color-mute)", accent: "var(--color-accent)" }[tone];
  return <span className="inline-flex items-center gap-1.5 h-6 px-2.5 whitespace-nowrap shrink-0 rounded-full text-[11.5px] font-medium" style={{ color: c, background: `color-mix(in srgb, ${c} 16%, #060b22 84%)`, border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`, backdropFilter: "blur(6px)" }}>{children}</span>;
}
export function Tile({ name, hue = 220, size = 44 }: { name: string; hue?: number; size?: number }) {
  const ini = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  return <div className="grid place-items-center rounded-[12px] font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(145deg, hsl(${hue} 70% 38%), hsl(${hue + 30} 65% 22%))`, border: "1px solid rgba(255,255,255,.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)" }}>{ini}</div>;
}
export function Modal({ onClose, children, w = 560 }: { onClose: () => void; children: ReactNode; w?: number }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{ animation: "fade var(--dur-base) both" }} onClick={onClose}>
      <div className="absolute inset-0 bg-ink-0/70 backdrop-blur-sm" />
      <div className="relative panel p-6 rise" style={{ width: w, background: "rgba(10,20,51,.96)" }} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

/** Card hover parallax: writes -1..1 pointer offsets as CSS variables; the cover layer drifts opposite the cursor. */
export function tilt(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--tx", String(((e.clientX - r.left) / r.width - 0.5) * 2));
  e.currentTarget.style.setProperty("--ty", String(((e.clientY - r.top) / r.height - 0.5) * 2));
}
export function untilt(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.setProperty("--tx", "0"); e.currentTarget.style.setProperty("--ty", "0"); }
