import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { ENGINE_PRESETS, MC_VERSIONS, WINDOW_MODES, type EnginePreset, type WindowMode } from "../data/launcher";
import { setLaunchChoice, useClient } from "../state/client";

/** One popover list: used for the Minecraft version and the engine preset. Opens upward on Home (above the launch bar) or downward in Preferences. */
function Pop<T extends string>({ label, value, shown, options, onPick, up = true, testid }: { label: string; value: T; shown?: string; options: { id: T; sub: string }[]; onPick: (v: T) => void; up?: boolean; testid: string }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("mousedown", f); addEventListener("keydown", k);
    return () => { removeEventListener("mousedown", f); removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button data-testid={testid} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}
        className="h-[46px] px-4 rounded-[10px] text-[13px] font-medium flex items-center gap-2.5 t press" style={{ background: "rgba(22,27,38,.92)", color: "#E2E8F0", border: "1px solid rgba(255,255,255,.07)" }}>
        <span className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: "#64748B" }}>{label}</span>{shown ?? value}<Icon n="chev" s={14} />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className={`pop absolute ${up ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"} left-0 w-max min-w-[260px] rounded-[12px] p-1.5 z-30 m-0 list-none`} style={{ background: "var(--side)", boxShadow: "0 12px 40px rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.06)" }}>
          {options.map((o) => (
            <li key={o.id}>
              <button role="option" aria-selected={o.id === value} onClick={() => { onPick(o.id); setOpen(false); }} className="w-full h-[42px] px-3 rounded-[8px] text-left flex items-center justify-between gap-6 t hover:bg-[var(--surface)]">
                <span className="leading-tight"><span className="block text-[13px] font-medium">{o.id}</span><span className="block text-[11px]" style={{ color: "var(--mute)" }}>{o.sub}</span></span>
                {o.id === value && <Icon n="check" s={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VersionSelect({ up = true }: { up?: boolean }) {
  const v = useClient().prefs.gameVersion;
  return <Pop testid="version-select" label="Minecraft" value={v} up={up} options={MC_VERSIONS.map((m) => ({ id: m.id as string, sub: m.tag }))} onPick={(id) => setLaunchChoice({ gameVersion: id })} />;
}
export function PresetSelect({ up = true }: { up?: boolean }) {
  const v = useClient().prefs.enginePreset;
  return <Pop<EnginePreset> testid="preset-select" label="Engine" value={v} up={up} options={ENGINE_PRESETS.map((p) => ({ id: p.id, sub: p.blurb }))} onPick={(id) => setLaunchChoice({ enginePreset: id })} />;
}
/** Segmented control: three window modes, one click each. */
export function WindowModeToggle() {
  const m = useClient().prefs.windowMode;
  return (
    <div role="radiogroup" aria-label="Window mode" data-testid="window-mode" className="h-[46px] p-1 rounded-[10px] flex items-center gap-1" style={{ background: "rgba(22,27,38,.92)", border: "1px solid rgba(255,255,255,.07)" }}>
      {WINDOW_MODES.map((w: WindowMode) => (
        <button key={w} role="radio" aria-checked={m === w} onClick={() => setLaunchChoice({ windowMode: w })} className="h-full px-3 rounded-[7px] text-[12px] font-medium t whitespace-nowrap" style={m === w ? { background: "#2B4BFF", color: "#fff" } : { color: "#94A3B8" }}>{w}</button>
      ))}
    </div>
  );
}
