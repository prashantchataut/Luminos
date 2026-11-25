import { memo, useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export const Switch = memo(function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className="sw" onClick={() => onChange(!on)} />;
});

export function Slider({ value, min, max, step = 1, onChange, label, w = 200 }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; w?: number }) {
  const p = ((value - min) / (max - min)) * 100;
  return <input type="range" aria-label={label} min={min} max={max} step={step} value={value} style={{ width: w, ["--p" as any]: `${p}%` }} onChange={(e) => onChange(Number(e.target.value))} />;
}

export function Select({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  return <select className="sel" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>;
}

export function Pills({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (v: any) => void }) {
  return <div className="flex items-center gap-2 flex-wrap" role="tablist">{items.map((i) => <button key={i.id} role="tab" aria-selected={value === i.id} className="pill press" onClick={() => onChange(i.id)}>{i.label}</button>)}</div>;
}

export function SearchBox({ value, onChange, placeholder, w = 280 }: { value: string; onChange: (v: string) => void; placeholder: string; w?: number }) {
  return (
    <label className="relative block shrink-0" style={{ width: w }}>
      <Icon n="search" s={15} className="absolute left-3.5 top-[11.5px] mute pointer-events-none" />
      <input className="field" placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Standard row: 68px, icon-free, label left, control right. */
export function Row({ title, desc, children, h = 68 }: { title: string; desc?: string; children: ReactNode; h?: number }) {
  return (
    <div className="px-6 rounded-[12px] flex items-center justify-between gap-6" style={{ minHeight: h, background: "var(--surface)" }}>
      <div className="min-w-0 py-3"><div className="text-[14px] font-medium">{title}</div>{desc && <div className="text-[12px] mt-0.5 mute leading-snug">{desc}</div>}</div>
      <div className="flex items-center gap-3 shrink-0">{children}</div>
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-7">
      <div className="min-w-0"><h1 className="m-0 text-[22px] font-bold leading-tight">{title}</h1>{sub && <p className="m-0 mt-1 text-[13px] mute">{sub}</p>}</div>
      {right}
    </div>
  );
}

/** Scrim + dialog. Esc and a click outside close it. Focus moves into the dialog and the 3D stage pauses while it is open. */
export function Modal({ title, onClose, children, w = 480 }: { title: string; onClose: () => void; children: ReactNode; w?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k); ref.current?.focus();
    document.documentElement.dataset.modal = "1";
    return () => { removeEventListener("keydown", k); delete document.documentElement.dataset.modal; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="pop outline-none rounded-[16px] p-6 max-h-[88vh] overflow-y-auto" style={{ width: w, background: "var(--side)" }}>
        <div className="flex items-center justify-between mb-5"><h2 className="m-0 text-[17px] font-bold">{title}</h2><button className="grid place-items-center w-8 h-8 rounded-lg mute hover:text-[var(--fg)] t" aria-label="Close" onClick={onClose}><Icon n="close" s={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={title} className="drawer absolute right-0 top-0 bottom-0 w-[380px] max-w-full p-6 flex flex-col min-h-0" style={{ background: "var(--side)" }}>
        <div className="flex items-center gap-3 mb-6">
          <span className="grid place-items-center w-10 h-10 rounded-[10px]" style={{ background: "var(--surface-2)", color: "var(--accent-text)" }}><Icon n={icon} s={20} /></span>
          <h2 className="m-0 text-[18px] font-bold flex-1 truncate">{title}</h2>
          <button className="grid place-items-center w-8 h-8 rounded-lg mute hover:text-[var(--fg)] t" aria-label="Close" onClick={onClose}><Icon n="close" s={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto space-y-5 pr-1">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-[13px]">{label}</span>{children}</div>;
}
