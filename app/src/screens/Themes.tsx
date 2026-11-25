import { useState } from "react";
import { Icon, Switch } from "../kit";
import { PRESETS } from "../data/launcher";
import { exportTheme, parseTheme, THEMES } from "../theme";
import { saveCustomTheme, set, useSettings } from "../store";

// Miniature of the real layout (sidebar, title, pill, 3-column grid) in each theme's own colours. Layout is identical across themes.
const PAL: Record<string, { bg: string; side: string; card: string; bar: string; fg: string; accent: string }> = {
  default: { bg: "#0b0d12", side: "#0f1218", card: "#151922", bar: "#1c212d", fg: "#e8ecf4", accent: "#2b4bff" },
  neutral: { bg: "#0d0d0f", side: "#111114", card: "#17171b", bar: "#1f1f24", fg: "#f2f2f4", accent: "#3f5cff" },
  minecraft: { bg: "#111315", side: "#15181a", card: "#1b1e21", bar: "#25292d", fg: "#f1f4f2", accent: "#6cc24a" },
  light: { bg: "#f4f6fa", side: "#ebeef4", card: "#ffffff", bar: "#e1e5ed", fg: "#12151c", accent: "#2b4bff" },
};
function Mini({ id }: { id: string }) {
  const p = PAL[id], edge = id === "minecraft" ? "#3b4148" : id === "light" ? "#e1e5ed" : "none";
  return (
    <svg viewBox="0 0 180 106" width="100%" height="100%" role="img" aria-label={`${id} preview`}>
      <rect width="180" height="106" fill={p.bg} /><rect width="46" height="106" fill={p.side} />
      <rect x="8" y="9" width="26" height="5" rx="2" fill={p.accent} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="8" y={24 + i * 12} width="30" height="7" rx="3" fill={i === 0 ? p.accent : p.bar} />)}
      <rect x="56" y="9" width="40" height="6" rx="2" fill={p.fg} /><rect x="146" y="8" width="26" height="8" rx="3" fill={p.bar} />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <g key={`${r}${c}`}><rect x={56 + c * 41} y={26 + r * 25} width="37" height="21" rx="4" fill={p.card} stroke={edge} /><rect x={56 + c * 41} y={26 + r * 25 + 15} width="37" height="6" rx="0" fill={(r + c) % 3 === 2 ? p.bar : p.accent} /></g>))}
    </svg>
  );
}
export default function Themes({ q }: { q: string }) {
  const s = useSettings(), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [hex, setHex] = useState("#2b4bff"), [pre, setPre] = useState<string | null>(null);
  const shown = THEMES.filter((t) => !q || (t.name + t.note).toLowerCase().includes(q.toLowerCase()));
  const exp = () => { const cur = THEMES.find((x) => x.id === s.theme)?.name || "Custom"; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportTheme(cur)], { type: "application/json" })); a.download = `luminos-theme-${cur.toLowerCase().replace(/\s+/g, "-")}.json`; a.click(); setMsg({ ok: true, t: "Saved the theme file." }); };
  const imp = async (f?: File | null) => { if (!f) return; const r = parseTheme(await f.text()); if ("error" in r) { setMsg({ ok: false, t: r.error }); return; } saveCustomTheme(r.theme); set("theme", "custom"); setMsg({ ok: true, t: `Applied “${r.theme.name}”.` }); };
  const accent = (v: string) => { setHex(v); if (/^#[0-9a-f]{6}$/i.test(v)) document.documentElement.style.setProperty("--accent", v); };
  const apply = (id: "pvp" | "survival") => { Object.entries(PRESETS[id].set).forEach(([k, v]) => set(k as any, v as any)); setPre(id); };
  return (
    <div className="mx-auto pt-1 pb-6" style={{ maxWidth: 860 }}>
      <div className="flex gap-4 flex-wrap p-1" role="radiogroup" aria-label="Theme">
        {shown.map((t) => { const on = s.theme === t.id; return (
          <button key={t.id} role="radio" aria-checked={on} onClick={() => set("theme", t.id)} className="text-left" style={{ width: 180 }}>
            <span className="block overflow-hidden rounded-[10px]" style={{ height: 106, outline: on ? "2px solid var(--accent)" : "none", outlineOffset: 2, boxShadow: on ? "0 0 0 6px color-mix(in srgb, var(--accent) 22%, transparent)" : "none" }}><Mini id={t.id} /></span>
            <span className="flex items-center gap-1.5 t2 font-semibold mt-2.5">{t.name}{on && <Icon n="check" s={13} />}</span><span className="t1 mute">{t.note}</span>
          </button>); })}
        {!shown.length && <div className="t2 mute">No theme matches “{q}”.</div>}
      </div>
      <div className="grid gap-2 mt-8">
        <div className="setrow"><Icon n="roller" s={20} /><div className="flex-1"><div className="t3 font-semibold">Accent Color</div><div className="t2 mute">The accent color of the Luminos Interface</div></div>
          <label className="btn btn-primary num cursor-pointer" style={{ background: /^#[0-9a-f]{6}$/i.test(hex) ? hex : undefined }}><Icon n="roller" s={13} />{hex.toUpperCase()}<input type="color" value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#2b4bff"} onChange={(e) => accent(e.target.value)} className="sr-only" aria-label="Accent colour" /></label>
          <button className="btn" onClick={() => { document.documentElement.style.removeProperty("--accent"); setHex("#2b4bff"); }}>Reset</button></div>
        <div className="setrow"><Icon n="sparkles" s={20} /><div className="flex-1"><div className="t3 font-semibold">Animations</div><div className="t2 mute">Smooth, clean transitions in the Luminos Interface</div></div><span className="t1 mute w-5">{s.reduceMotion ? "Off" : "On"}</span><Switch on={!s.reduceMotion} onChange={(v) => set("reduceMotion", !v)} label="Animations" /></div>
        <div className="setrow"><Icon n="swords" s={20} /><div className="flex-1"><div className="t3 font-semibold">Gameplay Profile Preset</div><div className="t2 mute">One-click bundle for keystrokes, crosshair, fog and low fire</div></div>
          <div className="seg" role="group" aria-label="Gameplay profile preset">{(["pvp", "survival"] as const).map((id) => <button key={id} aria-pressed={pre === id || (!pre && ((id === "pvp" && s.keystrokes === "A") || (id === "survival" && s.keystrokes === "B")))} onClick={() => apply(id)}>{id === "pvp" ? "PvP Competitive" : "Survival Plus"}</button>)}</div></div>
        <div className="setrow"><Icon n="download" s={20} /><div className="flex-1"><div className="t3 font-semibold">Theme file</div><div className="t2 mute">Colours only. Text must reach 4.5:1 or the file is refused.</div></div>
          <button className="btn" onClick={exp}><Icon n="download" s={13} />Export</button><label className="btn cursor-pointer"><Icon n="upload" s={13} />Import<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { imp(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
        {msg && <div role="status" className="t2 px-2" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</div>}
      </div>
    </div>
  );
}
