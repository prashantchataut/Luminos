import { useEffect, useRef, useState, ReactNode } from "react";

/* ---------- icons: one hand-drawn 24px set, 1.6 stroke, round caps ---------- */
export const P: Record<string, string> = {
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

/** Cover art: the real in-game capture from CI at /covers/<version>.jpg, otherwise a flat tile with the version number. */
export function Cover({ version, className = "" }: { version: string; className?: string }) {
  const [real, setReal] = useState(true);
  return real ? (
    <img src={`/covers/${version}.jpg`} alt="" onError={() => setReal(false)} className={`object-cover w-full h-full ${className}`} />
  ) : (
    <div className={`w-full h-full grid place-items-center ${className}`} style={{ background: "var(--surface-2)" }}><span className="t2 mute num">{version}</span></div>
  );
}

/* ---------- controls ---------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="relative h-6 w-11 rounded-full shrink-0 transition-colors" style={{ background: on ? "var(--color-accent)" : "color-mix(in srgb, var(--color-fg) 16%, transparent)", transitionDuration: "var(--dur-base)" }}>
      <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: `translateX(${on ? 20 : 0}px)`, transitionDuration: "var(--dur-base)", transitionTimingFunction: "var(--ease-out-expo)" }} />
    </button>
  );
}
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-1 rounded-full hair  gap-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className="h-8 px-4 rounded-full text-[13px] font-medium transition-colors" style={{ background: value === o.v ? "color-mix(in srgb, var(--color-accent) 20%, transparent)" : "transparent", color: value === o.v ? "#fff" : "var(--color-mute)", transitionDuration: "var(--dur-fast)" }}>{o.l}</button>
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
        <div className="absolute left-0 h-1.5 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--color-accent),var(--color-accent))" }} />
        <div className="absolute h-4 w-4 rounded-full bg-white shadow -ml-2" style={{ left: `${pct}%`, boxShadow: "0 0 0 4px color-mix(in srgb, var(--color-accent) 20%, transparent)" }} />
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
  return <div className="grid place-items-center rounded-[12px] font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(145deg, hsl(${hue} 70% 38%), hsl(${hue + 30} 65% 22%))`, border: "1px solid color-mix(in srgb, var(--color-fg) 14%, transparent)", boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--color-fg) 18%, transparent)" }}>{ini}</div>;
}
export function Modal({ onClose, children, w = 560 }: { onClose: () => void; children: ReactNode; w?: number }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{ animation: "fade var(--dur-base) both" }} onClick={onClose}>
      <div className="absolute inset-0  backdrop-blur-sm" />
      <div className="relative panel p-6 rise" style={{ width: w, background: "color-mix(in srgb, var(--surface) 96%, transparent)" }} onClick={(e) => e.stopPropagation()}>{children}</div>
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
