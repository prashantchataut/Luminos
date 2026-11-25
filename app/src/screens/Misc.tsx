import { useState } from "react";
import { Icon } from "../kit";
import { PRESETS } from "../data/launcher";
import { set, useSettings } from "../store";
import ClientPage from "./Client";
import LivePanel from "./LivePanel";
import { KeyRecorder } from "./Mods";

export function Profiles({ go }: { go: (r: string) => void }) {
  const s = useSettings(), [tab, setTab] = useState<"Presets" | "Client" | "Live mods">("Presets"), [pre, setPre] = useState<string | null>(null);
  const apply = (id: "pvp" | "survival") => { Object.entries(PRESETS[id].set).forEach(([k, v]) => set(k as any, v as any)); setPre(id); };
  return (
    <div className="px-6">
      <div className="seg mb-4" role="tablist">{(["Presets", "Client", "Live mods"] as const).map((t) => <button key={t} role="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Presets" && <div className="grid grid-cols-2 gap-3 max-w-[820px]">
        {(["pvp", "survival"] as const).map((id) => { const on = pre === id || (!pre && ((id === "pvp" && s.keystrokes === "A") || (id === "survival" && s.keystrokes === "B"))); return (
          <div key={id} className="panel p-5 flex flex-col gap-3"><div className="flex items-center gap-2"><Icon n={PRESETS[id].icon} s={20} /><div className="t3 font-semibold flex-1">{id === "pvp" ? "PvP Competitive" : "Survival Plus"}</div>{on && <span className="badge accent">Active</span>}</div>
            <div className="t2 mute leading-snug flex-1">{PRESETS[id].line}</div><div className="flex gap-2"><button className="btn btn-primary" onClick={() => apply(id)}>{on ? "Applied" : "Apply preset"}</button><button className="btn" onClick={() => go("hud")}>Open in HUD studio</button></div></div>); })}
      </div>}
      {tab === "Client" && <ClientPage />}
      {tab === "Live mods" && <LivePanel />}
    </div>
  );
}

const ACTIONS: [string, string, string][] = [["panel", "Open the quick panel", "Control"], ["search", "Search panel", "Shift"], ["hud", "Edit HUD layout", "H"], ["sprint", "Toggle sprint", "Ctrl"], ["zoom", "Zoom", "C"], ["shot", "Screenshot with HUD hidden", "F2"]];
const KEY = "luminos.keys.v1";
export function Keybinds() {
  const [m, setM] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } });
  const put = (id: string, v: string) => { const n = { ...m, [id]: v }; setM(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ } };
  const clash = (id: string) => Object.entries({ ...Object.fromEntries(ACTIONS.map((a) => [a[0], a[2]])), ...m }).some(([k, v]) => k !== id && v === (m[id] ?? ACTIONS.find((a) => a[0] === id)![2]));
  return (
    <div className="px-6 pb-6 max-w-[760px] grid gap-2">
      {ACTIONS.map(([id, label, def]) => <div key={id} className="setrow"><Icon n="keyboard" s={18} /><div className="flex-1 t3 font-medium">{label}</div>{clash(id) && <span className="badge warn">Shared with another action</span>}<KeyRecorder label={`${label} key`} value={m[id] ?? def} onChange={(v) => put(id, v)} />{m[id] && <button className="btn" onClick={() => { const n = { ...m }; delete n[id]; setM(n); localStorage.setItem(KEY, JSON.stringify(n)); }}>Reset</button>}</div>)}
      <div className="t1 mute px-1 pt-1">Per-mod toggle keys are set in each mod’s settings drawer.</div>
    </div>
  );
}

const LOG = [
  { v: "1.0.0-rc2", t: "This release", items: ["New single-sidebar layout, solid surfaces, four themes (OneClient Cobalt is the default).", "Mods: 4-column cards with a solid status bar, compact view, settings drawer, dependency “What changed” banner.", "HUD Design Studio: drag with a 5px snap gap, inspector drawer, custom .ttf/.otf fonts.", "Accounts: offline, Ely.by through authlib-injector, Microsoft device-code (not live until an Azure app exists).", "Profiles are plain JSON with a SHA-256 id; the shared library shows the space saved."] },
  { v: "1.0.0-rc1", t: "Earlier", items: ["Windows installer, portable zip, Android launcher preview, two Fabric client jars with SHA-256.", "Live apply for Luminos modules and resource packs; third-party mods queue by design."] },
];
export function Changelog() {
  return <div className="px-6 pb-6 max-w-[760px] grid gap-3">{LOG.map((r) => <section key={r.v} className="panel p-5"><div className="flex items-center gap-2 mb-2"><div className="t3 font-semibold num">{r.v}</div><span className="badge">{r.t}</span></div><ul className="m-0 pl-4 grid gap-1.5 t2 mute leading-snug">{r.items.map((i) => <li key={i}>{i}</li>)}</ul></section>)}</div>;
}
