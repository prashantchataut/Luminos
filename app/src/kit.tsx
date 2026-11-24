import { ReactNode, useEffect, useRef } from "react";
import { Icon, P } from "./ui";
export { Icon, Sky, Cover } from "./ui";

// Extra glyphs for the 0.9 screens (same 24px / 1.6 stroke family as ui.tsx).
Object.assign(P, {
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z",
  copy: "M9 9h10v11H9zM5 15V4h10", edit: "M4 20l1-4L16 5l3 3L8 19zM14 7l3 3", trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  box: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8", cpu: "M7 7h10v10H7zM4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3",
  gauge: "M4 17a8 8 0 1 1 16 0M12 17l4-6", news: "M5 5h12v14H7a2 2 0 0 1-2-2zM17 9h2v8a2 2 0 0 1-2 2M8 9h6M8 12h6M8 15h4",
  swords: "M5 4l9 9M4 5v4l3 3M19 4l-9 9M20 5v4l-3 3M9 14l-4 4M15 14l4 4", leaf: "M5 19c0-8 4-13 14-14 0 9-4 14-12 14zM5 19l7-7",
  wand: "M5 19L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM18 12l.7 1.3 1.3.7-1.3.7L18 16l-.7-1.3L16 14l1.3-.7z", wings: "M3 6c6 0 8 5 9 8-1 3-3 5-6 5 0-4-1-8-3-13zM21 6c-6 0-8 5-9 8 1 3 3 5 6 5 0-4 1-8 3-13z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1", chev: "M9 6l6 6-6 6", grip: "M9 6v.01M9 12v.01M9 18v.01M15 6v.01M15 12v.01M15 18v.01",
  pin: "M12 21v-7M8 4h8l-1 6 3 4H6l3-4z", mic: "M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v3", sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", warn: "M12 4l9 16H3zM12 10v4.5M12 17.5v.01", terminal: "M4 5h16v14H4zM8 10l3 2-3 2M13 15h4",
  vulkan: "M4 18L12 5l8 13zM8 18l4-7 4 7", mouse: "M7 4h10v16H7zM12 4v6", cloud: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 7z", target: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
});

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className="sw" onClick={() => onChange(!on)} />;
}
export function Slider({ value, min, max, step = 1, onChange, fmt, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string; label: string }) {
  return <div className="flex items-center gap-2"><input type="range" className="rng" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} /><span className="t1 mute num w-[44px] text-right">{fmt ? fmt(value) : value}</span></div>;
}
export function Chip({ on, onClick, children, icon }: { on?: boolean; onClick?: () => void; children: ReactNode; icon?: string }) {
  return <button className="chip" data-on={!!on} onClick={onClick}>{icon && <Icon n={icon} s={12} />}{children}</button>;
}
export function Badge({ tone = "mute", children }: { tone?: "ok" | "warn" | "bad" | "mute" | "accent"; children: ReactNode }) { return <span className={`badge ${tone}`}>{children}</span>; }

/** icon + name + one-line description + control. 32px. */
export function LRow({ icon, name, desc, children, onClick }: { icon: string; name: string; desc: string; children?: ReactNode; onClick?: () => void }) {
  return (
    <div className="lrow" onClick={onClick} data-row={name}>
      <span className="grid place-items-center w-6 h-6 rounded-md shrink-0" style={{ background: "rgba(160,190,255,.1)" }}><Icon n={icon} s={14} /></span>
      <span className="min-w-0 flex-1 leading-[15px]"><span className="block t2 font-medium truncate">{name}</span><span className="block t1 mute truncate leading-[13px]">{desc}</span></span>
      {children}
    </div>
  );
}
export function Section({ title, count, right, children }: { title: string; count?: number; right?: ReactNode; children: ReactNode }) {
  return <section className="mb-4"><div className="flex items-center justify-between mb-1.5 px-1"><div className="eyebrow">{title}{count !== undefined && <span className="ml-2 opacity-70 num">{count}</span>}</div>{right}</div>{children}</section>;
}
export function SearchBox({ value, onChange, placeholder, autoFocus, inputRef }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  return <div className="relative flex-1 min-w-0 self-start w-full"><Icon n="search" s={14} className="absolute left-2.5 top-[8px] mute" /><input ref={inputRef} autoFocus={autoFocus} className="field" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} /></div>;
}
export function Modal({ onClose, children, w = 520, title }: { onClose: () => void; children: ReactNode; w?: number; title: string }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center" style={{ background: "rgba(2,4,13,.55)" }} onMouseDown={onClose}><div role="dialog" aria-label={title} className="glass rise p-4" style={{ width: w, maxWidth: "92vw" }} onMouseDown={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-3"><div className="t3 font-semibold">{title}</div><button className="ibtn" aria-label="Close" onClick={onClose}><Icon n="x" s={14} /></button></div>{children}</div></div>;
}
export const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.max(1, Math.floor(s / 60))}m`);
export const fmtNum = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : String(n));

/** Front-view of a 64x64 skin (head + overlay, body, arms, legs) drawn pixel-exact on a canvas. */
export function SkinThumb({ src, scale = 3, bust = false, className = "" }: { src: string; scale?: number; bust?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = src;
    img.onload = () => {
      const c = ref.current; if (!c) return; const g = c.getContext("2d")!; g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
      const d = (sx: number, sy: number, w: number, h: number, dx: number, dy: number) => g.drawImage(img, sx, sy, w, h, dx, dy, w, h);
      d(8, 8, 8, 8, 4, 0); d(40, 8, 8, 8, 4, 0);
      if (bust) return;
      d(20, 20, 8, 12, 4, 8); d(20, 36, 8, 12, 4, 8); d(44, 20, 4, 12, 0, 8); d(44, 36, 4, 12, 0, 8);
      d(36, 52, 4, 12, 12, 8); d(52, 52, 4, 12, 12, 8); d(4, 20, 4, 12, 4, 20); d(4, 36, 4, 12, 4, 20); d(20, 52, 4, 12, 8, 20); d(4, 52, 4, 12, 8, 20);
    };
  }, [src, bust]);
  return <canvas ref={ref} width={16} height={bust ? 8 : 32} className={`skin-px ${className}`} style={{ width: 16 * scale, height: (bust ? 8 : 32) * scale }} />;
}
