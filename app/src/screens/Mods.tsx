import { useEffect, useMemo, useState } from "react";
import { CATS, Cat, MODS, Mod, Setting } from "../data/mods";
import { Icon, Slider, Switch } from "../kit";
import { ModIcon } from "../modicons";
import { setVal, tweaked, toggleFav, toggleMod, useMods, valOf } from "../modstore";

const SWATCH = ["#ffffff", "#2b4bff", "#4ade9a", "#f2c14e", "#ff7a8a", "#a78bfa"];

export function KeyRecorder({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [rec, setRec] = useState(false);
  useEffect(() => {
    if (!rec) return;
    const f = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); setRec(false); if (e.key !== "Escape") onChange(e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key); };
    addEventListener("keydown", f, true); return () => removeEventListener("keydown", f, true);
  }, [rec, onChange]);
  return <button className="btn !h-7 min-w-[84px] num" aria-label={label} onClick={() => setRec(true)}>{rec ? "Press a key…" : value || "Unbound"}</button>;
}

function Control({ m, s }: { m: Mod; s: Setting }) {
  const st = useMods(), v = valOf(st, m.id, s.k, s.def);
  if (s.t === "toggle") return <Switch on={!!v} onChange={(x) => setVal(m.id, s.k, x)} label={s.label} />;
  if (s.t === "slider") return <Slider label={s.label} value={Number(v)} min={s.min} max={s.max} step={s.step} onChange={(x) => setVal(m.id, s.k, x)} fmt={(x) => `${x}${s.unit || ""}`} />;
  if (s.t === "color") return <div className="flex items-center gap-1.5">{SWATCH.map((c) => <button key={c} aria-label={`${s.label} ${c}`} aria-pressed={v === c} onClick={() => setVal(m.id, s.k, c)} className="w-5 h-5 rounded-md" style={{ background: c, outline: v === c ? "2px solid var(--accent-text)" : "1px solid var(--line-strong)", outlineOffset: 1 }} />)}</div>;
  if (s.t === "key") return <KeyRecorder label={s.label} value={String(v)} onChange={(x) => setVal(m.id, s.k, x)} />;
  return <div className="seg" role="group" aria-label={s.label}>{s.options.map((o) => <button key={o} aria-pressed={v === o} onClick={() => setVal(m.id, s.k, o)}>{o}</button>)}</div>;
}

function Drawer({ m, onClose, onToggle }: { m: Mod; onClose: () => void; onToggle: () => void }) {
  const st = useMods(), on = st.on[m.id];
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [onClose]);
  const rows: Setting[] = [...m.settings, { k: "toggleKey", t: "key", label: "Toggle keybind", def: "" }];
  return (
    <aside className="drawer slidein absolute right-0 top-0 bottom-0 w-[340px] z-20 flex flex-col" aria-label={`${m.name} settings`} style={{ boxShadow: "-12px 0 24px rgba(0,0,0,.28)" }}>
      <div className="flex items-center gap-3 p-4">
        <span className="grid place-items-center w-11 h-11 rounded-[10px] panel-2"><ModIcon id={m.id} size={28} /></span>
        <div className="min-w-0 flex-1"><div className="t3 font-semibold truncate">{m.name}</div><div className="t1 mute">{m.src === "luminos" ? "Luminos module" : "From Modrinth"}</div></div>
        <button className="ibtn" aria-label="Close settings" onClick={onClose}><Icon n="x" s={16} /></button>
      </div>
      <div className="px-4 t2 mute leading-snug">{m.blurb}</div>
      <div className="px-4 pt-3"><button className={`btn w-full ${on ? "" : "btn-primary"}`} onClick={onToggle}>{on ? "Turn off" : "Turn on"}</button></div>
      <div className="eyebrow px-4 pt-5 pb-1.5">Settings</div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rows.map((s) => <div key={s.k} className="lrow !min-h-[44px] !px-2"><span className="flex-1 t2">{s.label}</span><Control m={m} s={s} /></div>)}
        {!m.settings.length && <div className="px-2 pt-2 t1 mute leading-snug">This mod has no options of its own. It runs with the values the profile sets.</div>}
      </div>
    </aside>
  );
}

export default function Mods({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const st = useMods();
  const [cat, setCat] = useState<Cat | "all">("all"), [view, setView] = useState<"grid" | "compact">("grid");
  const [open, setOpen] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ name: string; to: boolean; off: string[]; on: string[] } | null>(null);
  const list = useMemo(() => MODS.filter((m) => (cat === "all" || (cat === "favorites" ? st.fav.includes(m.id) : m.cats.includes(cat))) && (!q || (m.name + m.blurb).toLowerCase().includes(q.toLowerCase()))), [cat, q, st.fav]);
  const toggle = (m: Mod) => { const to = !st.on[m.id], d = toggleMod(m.id, to); setDiff(d.off.length || d.on.length ? { name: m.name, to, off: d.off.map((x) => x.name), on: d.on.map((x) => x.name) } : null); };
  const enabled = MODS.filter((m) => st.on[m.id]).length;
  const cur = MODS.find((m) => m.id === open) || null;
  return (
    <div className="relative min-h-full">
      <div className="flex items-center gap-2 px-6 pb-3">
        <div className="flex gap-2 overflow-x-auto flex-1 min-w-0 py-0.5" role="tablist" aria-label="Mod categories">
          {CATS.map((c) => <button key={c.id} role="tab" aria-selected={cat === c.id} data-on={cat === c.id} className="pill" onClick={() => setCat(c.id)}>{c.icon && <Icon n={c.icon} s={14} />}{c.label}</button>)}
        </div>
        <div className="seg shrink-0" role="group" aria-label="View"><button aria-pressed={view === "grid"} onClick={() => setView("grid")}>Grid</button><button aria-pressed={view === "compact"} onClick={() => setView("compact")}>Compact</button></div>
      </div>
      {diff && <div role="status" className="mx-6 mb-3 panel flex items-center gap-3 px-4 py-2.5 rise" style={{ background: "var(--accent-soft)" }}>
        <Icon n="info" s={16} /><div className="flex-1 t2 leading-snug"><b>What changed.</b> {diff.to ? `Turning on ${diff.name} also turned on ${diff.on.join(", ")}, because it needs ${diff.on.length > 1 ? "them" : "it"}.` : `Turning off ${diff.name} also turned off ${diff.off.join(", ")}, because ${diff.off.length > 1 ? "they need" : "it needs"} ${diff.name}.`}</div>
        <button className="btn" onClick={() => { const m = MODS.find((x) => x.name === diff.name)!; toggleMod(m.id, !diff.to); setDiff(null); }}>Undo</button>
        <button className="ibtn" aria-label="Dismiss" onClick={() => setDiff(null)}><Icon n="x" s={14} /></button>
      </div>}
      {view === "grid" ? (
        <div className="grid grid-cols-4 gap-3 px-6 pb-6 stagger" role="list">
          {list.map((m) => (
            <div key={m.id} role="listitem" className="mod" data-on={!!st.on[m.id]} onContextMenu={(e) => { e.preventDefault(); setOpen(m.id); }}>
              <button className="mod-icon" aria-label={`${m.name} settings`} onClick={() => setOpen(m.id)}><ModIcon id={m.id} /></button>
              {tweaked(st, m.id) && <span className="mod-dot" title="Custom settings" />}
              <button className="mod-bar" aria-pressed={!!st.on[m.id]} aria-label={`${m.name}: ${st.on[m.id] ? "on" : "off"}`} onClick={() => toggle(m)}>{m.name}</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 pb-6 flex flex-col gap-0.5">
          {list.map((m) => (
            <div key={m.id} className="lrow !min-h-[32px] !h-8" onContextMenu={(e) => { e.preventDefault(); setOpen(m.id); }}>
              <span className="w-5 grid place-items-center"><ModIcon id={m.id} size={20} /></span>
              <button className="t2 font-medium w-[200px] text-left truncate" onClick={() => setOpen(m.id)}>{m.name}</button>
              <span className="t1 mute flex-1 truncate">{m.blurb}</span>
              <button className="chip" onClick={() => toggleFav(m.id)} aria-label={`Favourite ${m.name}`} data-on={st.fav.includes(m.id)}><Icon n="star" s={11} /></button>
              <span className="badge">{m.src === "luminos" ? "Luminos" : "Modrinth"}</span>
              <Switch on={!!st.on[m.id]} onChange={() => toggle(m)} label={m.name} />
            </div>
          ))}
        </div>
      )}
      {!list.length && <div className="px-6 t2 mute">{cat === "favorites" ? "Nothing starred yet. Open a mod and star it from the compact view." : `No mod matches “${q}”.`} <button className="underline" onClick={() => { setQ(""); setCat("all"); }}>Clear filters</button></div>}
      <div className="px-6 pb-6 t1 mute num">{enabled} of {MODS.length} on · saved to disk on every change</div>
      {cur && <Drawer m={cur} onClose={() => setOpen(null)} onToggle={() => toggle(cur)} />}
    </div>
  );
}
