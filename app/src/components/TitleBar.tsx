import { useEffect, useState } from "react";
import { LuminosMark } from "./LuminosLogo";
import { isTauri } from "../lib/tauri-bridge";

/**
 * The window's own title bar (decorations are off in tauri.conf.json so the launcher can carry its own chrome).
 * `data-tauri-drag-region` makes the bar draggable, double-click toggles maximize, and the three controls call the real window API.
 * The launcher is never always-on-top: Alt+Tab, the taskbar and other windows behave normally.
 */
async function win() { return (await import("@tauri-apps/api/window")).getCurrentWindow(); }
const run = (f: (w: Awaited<ReturnType<typeof win>>) => Promise<unknown>) => { if (isTauri()) void win().then(f).catch((e) => console.warn("[luminos] window control failed", e)); };

const Btn = ({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} data-testid={`win-${label.toLowerCase()}`}
    className={`w-[46px] h-full grid place-items-center t ${danger ? "hover:!bg-[#E5484D] hover:!text-white" : "hover:bg-[#1B202C] hover:text-white"}`} style={{ color: "#94A3B8" }}>
    {children}
  </button>
);

export default function TitleBar({ version }: { version: string }) {
  const [max, setMax] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined, live = true;
    void win().then(async (w) => {
      const sync = async () => { const m = await w.isMaximized(); if (live) setMax(m); };
      await sync();
      off = await w.onResized(() => void sync());
    }).catch(() => {});
    return () => { live = false; off?.(); };
  }, []);
  return (
    <header data-tauri-drag-region onDoubleClick={() => run((w) => w.toggleMaximize())} className="h-9 shrink-0 flex items-center justify-between select-none" style={{ background: "#0A0C11", borderBottom: "1px solid #141821" }}>
      <div data-tauri-drag-region className="flex items-center gap-2.5 pl-3 h-full flex-1 min-w-0">
        <span className="pointer-events-none"><LuminosMark size={16} /></span>
        <span data-tauri-drag-region className="text-[12px] font-semibold tracking-wide pointer-events-none" style={{ color: "#CBD5E1" }}>Luminos</span>
        <span data-tauri-drag-region className="text-[11px] pointer-events-none mono" style={{ color: "#64748B" }}>v{version}</span>
      </div>
      <div className="flex h-full" onDoubleClick={(e) => e.stopPropagation()}>
        <Btn label="Minimize" onClick={() => run((w) => w.minimize())}><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden><path d="M1 5.5h9" stroke="currentColor" strokeWidth="1.2" /></svg></Btn>
        <Btn label={max ? "Restore" : "Maximize"} onClick={() => run((w) => w.toggleMaximize())}>
          {max
            ? <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.1"><rect x="1.5" y="3" width="6.5" height="6.5" rx=".6" /><path d="M3.5 3V1.5h6V8H8" /></svg>
            : <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.1"><rect x="1.5" y="1.5" width="8" height="8" rx=".8" /></svg>}
        </Btn>
        <Btn label="Close" danger onClick={() => run((w) => w.close())}><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.2" /></svg></Btn>
      </div>
    </header>
  );
}
