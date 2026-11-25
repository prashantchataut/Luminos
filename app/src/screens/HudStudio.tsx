import { useEffect, useMemo, useRef, useState } from "react";
import { call } from "../api";
import { Icon, Slider, Switch } from "../kit";
import { MODS } from "../data/mods";
import { toggleMod, useMods } from "../modstore";

const W = 1280, H = 720, GAP = 5, SNAP = 7, MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';
type Wd = { id: string; name: string; w: number; h: number; x: number; y: number };
// Only the HUD modules the client really has. The default PvP layout stacks Keystrokes, CPS and FPS on one left edge with a 5px gap.
const BASE: Wd[] = [
  { id: "keystrokes", name: "Keystrokes", w: 96, h: 112, x: 12, y: 12 },
  { id: "cps", name: "CPS", w: 96, h: 28, x: 12, y: 12 + 112 + GAP },
  { id: "fps", name: "FPS", w: 96, h: 28, x: 12, y: 12 + 112 + GAP + 28 + GAP },
  { id: "ping", name: "Ping", w: 84, h: 28, x: 1184, y: 12 },
  { id: "potions", name: "Potion Effects", w: 120, h: 58, x: 1148, y: 45 },
  { id: "armor", name: "Armor Status", w: 90, h: 124, x: 1178, y: 300 },
  { id: "coordinates", name: "Coordinates", w: 168, h: 44, x: 12, y: 440 },
  { id: "sprint", name: "Sprint Status", w: 150, h: 26, x: 565, y: 590 },
];
type Cfg = { x: number; y: number; locked: boolean; hidden: boolean; mcScale: boolean; scale: number; bg: boolean; bgOp: number; radius: number; color: string; shadow: boolean; f3: boolean; tab: boolean; guis: boolean; chat: boolean; mode: "Normal" | "Custom"; font?: string };
const dflt = (w: Wd): Cfg => ({ x: w.x, y: w.y, locked: false, hidden: false, mcScale: true, scale: 1, bg: false, bgOp: 45, radius: 4, color: "#ffffff", shadow: true, f3: true, tab: true, guis: true, chat: true, mode: "Normal" });
const KEY = "luminos.hud.v1";
const load = (): Record<string, Cfg> => { try { return { ...Object.fromEntries(BASE.map((w) => [w.id, dflt(w)])), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return Object.fromEntries(BASE.map((w) => [w.id, dflt(w)])); } };
const SW = ["#ffffff", "#2b4bff", "#4ade9a", "#f2c14e", "#ff7a8a", "#a78bfa"];

function Body({ id, c }: { id: string; c: Cfg }) {
  const t = { color: c.color, textShadow: c.shadow ? "1px 1px 0 rgba(0,0,0,.75)" : "none", fontFamily: c.font || MONO, fontSize: 13, fontWeight: 600 } as const;
  const key = (l: string, on = false, w = 26) => <span style={{ ...t, width: w, height: 26, display: "grid", placeItems: "center", background: on ? "rgba(255,255,255,.34)" : "rgba(0,0,0,.34)", borderRadius: 3 }}>{l}</span>;
  if (id === "keystrokes") return <div style={{ display: "grid", gap: 4, justifyContent: "center", paddingTop: 4 }}><div style={{ display: "flex", justifyContent: "center" }}>{key("W", true)}</div><div style={{ display: "flex", gap: 4 }}>{key("A")}{key("S")}{key("D")}</div><div style={{ ...t, height: 8, background: "rgba(0,0,0,.34)", borderRadius: 3, display: "grid", placeItems: "center" }}><i style={{ width: 40, height: 2, background: c.color, display: "block" }} /></div><div style={{ display: "flex", gap: 4 }}>{key("LMB", false, 41)}{key("RMB", false, 41)}</div></div>;
  const line = { fps: "FPS  248", cps: "CPS  8 | 6", ping: "42 ms", coordinates: "XYZ  128 / 64 / -340", sprint: "[Sprinting (Toggled)]" }[id];
  if (line) return <div style={{ ...t, display: "grid", placeItems: "center", height: "100%" }}>{line}</div>;
  if (id === "potions") return <div style={{ ...t, padding: "6px 8px", display: "grid", gap: 4 }}><span>Speed II · 0:42</span><span>Strength · 1:08</span></div>;
  return <div style={{ display: "flex", gap: 6, padding: 8, justifyContent: "center", flexDirection: "column" }}>{["#9aa4b2", "#5ad1e6", "#5ad1e6", "#9aa4b2"].map((col, i) => <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 16, height: 16, background: col, borderRadius: 2, opacity: 0.9 }} /><i style={{ height: 4, flex: 1, background: "rgba(255,255,255,.28)", borderRadius: 2 }}><i style={{ display: "block", height: 4, width: `${88 - i * 14}%`, background: c.color, borderRadius: 2 }} /></i></span>)}</div>;
}

export default function HudStudio() {
  const mods = useMods();
  const [cfg, setCfg] = useState<Record<string, Cfg>>(load), [sel, setSel] = useState("keystrokes"), [tab, setTab] = useState<"Settings" | "Designer">("Settings");
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({}), [k, setK] = useState(0.7), [note, setNote] = useState("");
  const wrap = useRef<HTMLDivElement>(null), drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  useEffect(() => { const el = wrap.current!, f = () => setK(Math.min((el.clientWidth - 32) / W, (el.clientHeight - 32 - 64) / H)); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, []);
  const save = (n: Record<string, Cfg>) => { setCfg(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ } call("set_setting", { key: "hudLayout", value: JSON.stringify(n) }).catch(() => undefined); };
  const patch = (id: string, p: Partial<Cfg>) => save({ ...cfg, [id]: { ...cfg[id], ...p } });
  const live = useMemo(() => BASE.filter((w) => mods.on[w.id] && !cfg[w.id].hidden), [mods.on, cfg]);
  const dims = (w: Wd) => ({ w: Math.round(w.w * cfg[w.id].scale), h: Math.round(w.h * cfg[w.id].scale) });

  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const w = BASE.find((b) => b.id === d.id)!, r = wrap.current!.firstElementChild!.getBoundingClientRect(), { w: ww, h: hh } = dims(w);
    let x = (e.clientX - r.left) / k - d.dx, y = (e.clientY - r.top) / k - d.dy; const g: { x?: number; y?: number } = {};
    const xs: number[] = [GAP, W - GAP - ww], ys: number[] = [GAP, H - GAP - hh];
    for (const o of live) if (o.id !== d.id) { const od = dims(o), oc = cfg[o.id]; xs.push(oc.x, oc.x + od.w - ww, oc.x + od.w + GAP, oc.x - ww - GAP); ys.push(oc.y, oc.y + od.h + GAP, oc.y - hh - GAP, oc.y + od.h - hh); }
    const nx = xs.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a), xs[0]), ny = ys.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a), ys[0]);
    if (Math.abs(nx - x) <= SNAP) { x = nx; g.x = nx; } if (Math.abs(ny - y) <= SNAP) { y = ny; g.y = ny; }
    x = Math.max(0, Math.min(W - ww, Math.round(x))); y = Math.max(0, Math.min(H - hh, Math.round(y)));
    setCfg((c) => ({ ...c, [d.id]: { ...c[d.id], x, y } })); setGuides(g);
  };
  const up = () => { if (drag.current) { drag.current = null; setGuides({}); save(cfg); } };
  const importFont = async (f?: File | null) => {
    if (!f) return; try { const fam = `lum-${sel}-${Date.now()}`, ff = new FontFace(fam, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff); patch(sel, { font: `"${fam}", ${MONO}` }); setNote(`Loaded ${f.name}`); } catch { setNote("That file is not a usable .ttf or .otf font."); }
  };
  const restack = () => { const n = { ...cfg }; for (const w of BASE.slice(0, 3)) n[w.id] = { ...n[w.id], x: w.x, y: w.y }; save(n); };
  const sw0 = null; void sw0;
  const sw = BASE.find((b) => b.id === sel)!, c = cfg[sel], on = !!mods.on[sel];

  return (
    <div className="flex h-full min-h-0" style={{ background: "var(--bg)" }}>
      <div ref={wrap} className="flex-1 min-w-0 flex flex-col items-center justify-center gap-3 p-4" onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
        <div className="relative overflow-hidden" style={{ width: W * k, height: H * k, borderRadius: 14 }} onPointerDown={() => setSel("")}>
          <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: "top left", position: "absolute", inset: 0, backgroundImage: "url(/art/hud-backdrop.jpg)", backgroundSize: "cover", fontFamily: MONO }}>
            {/* in-game furniture: chat, bars, hotbar (drawn, so the preview matches the game's layout at GUI scale 2) */}
            <div style={{ position: "absolute", left: 0, bottom: 0, width: 400, padding: "8px 10px", background: "rgba(0,0,0,.42)", color: "#fff", fontSize: 12, lineHeight: "17px", textShadow: "1px 1px 0 #000" }}><b style={{ color: "#f2c14e" }}>Chatting</b><br />This is a preview of your chat window.<br />&lt;Steve&gt; Awesome!<br />&lt;Alex&gt; Let’s go!</div>
            <div style={{ position: "absolute", left: 458, bottom: 62, display: "flex", gap: 2 }}>{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ width: 16, height: 16, background: "#e5383b", clipPath: "polygon(0 30%,25% 0,50% 25%,75% 0,100% 30%,50% 100%)" }} />)}</div>
            <div style={{ position: "absolute", right: 458, bottom: 62, display: "flex", gap: 2 }}>{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ width: 16, height: 16, background: "#c8803a", borderRadius: "50%" }} />)}</div>
            <div style={{ position: "absolute", left: 458, right: 458, bottom: 52, height: 5, background: "rgba(0,0,0,.6)" }}><i style={{ display: "block", width: "62%", height: 5, background: "#7ee06b" }} /></div>
            <div style={{ position: "absolute", left: 458, bottom: 4, display: "flex", gap: 2, padding: 2, background: "rgba(20,20,24,.75)" }}>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ width: 40, height: 40, background: "rgba(0,0,0,.4)", outline: i === 3 ? "3px solid #fff" : "2px solid rgba(140,140,150,.55)", outlineOffset: -1 }} />)}</div>
            {guides.x !== undefined && <i style={{ position: "absolute", left: guides.x, top: 0, bottom: 0, borderLeft: "1px dashed var(--accent-text)" }} />}
            {guides.y !== undefined && <i style={{ position: "absolute", top: guides.y, left: 0, right: 0, borderTop: "1px dashed var(--accent-text)" }} />}
            {live.map((w) => { const q = cfg[w.id], d = dims(w), s = sel === w.id; return (
              <div key={w.id} role="button" tabIndex={0} aria-label={`${w.name} widget, ${d.w} by ${d.h}`} onPointerDown={(e) => { e.stopPropagation(); setSel(w.id); if (q.locked) return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); drag.current = { id: w.id, dx: (e.clientX - r.left) / k, dy: (e.clientY - r.top) / k }; }}
                style={{ position: "absolute", left: q.x, top: q.y, width: d.w, height: d.h, cursor: q.locked ? "default" : "move", touchAction: "none", background: q.bg ? `rgba(0,0,0,${q.bgOp / 100})` : "transparent", borderRadius: q.radius, outline: s ? "2px solid var(--accent)" : "none" }}>
                <div style={{ width: w.w, height: w.h, transform: `scale(${q.scale})`, transformOrigin: "top left" }}><Body id={w.id} c={q} /></div>
                {s && <>
                  {[[-4, -4], [d.w - 3, -4], [-4, d.h - 3], [d.w - 3, d.h - 3]].map(([hx, hy], i) => <i key={i} style={{ position: "absolute", left: hx, top: hy, width: 7, height: 7, background: "#fff", border: "1.5px solid var(--accent)", borderRadius: 1 }} />)}
                  <span style={{ position: "absolute", left: "50%", top: -22, transform: "translateX(-50%)", background: "var(--accent)", color: "var(--accent-fg)", font: `600 11px ${MONO}`, padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>{d.w} x {d.h}</span>
                  <span style={{ position: "absolute", left: "50%", top: d.h + 8, transform: "translateX(-50%)", display: "flex", gap: 2, padding: 3, background: "var(--side)", borderRadius: 8 }} onPointerDown={(e) => e.stopPropagation()}>
                    {[["sliders", "Settings", () => setTab("Settings")], [q.hidden ? "eyeoff" : "eye", "Visibility", () => patch(w.id, { hidden: !q.hidden })], [q.locked ? "lock" : "unlock", "Lock position", () => patch(w.id, { locked: !q.locked })], ["trash", "Reset position", () => patch(w.id, { x: w.x, y: w.y })]].map(([ic, l, fn]) => <button key={l as string} className="ibtn !w-7 !h-7" aria-label={l as string} title={l as string} onClick={fn as () => void} style={{ transform: `scale(${1 / k * 0.7})` }}><Icon n={ic as string} s={14} /></button>)}
                  </span></>}
              </div>); })}
          </div>
        </div>
      <div className="flex items-center gap-2 flex-wrap justify-center" style={{ maxWidth: W * k }} role="group" aria-label="Widgets on the canvas" onPointerDown={(e) => e.stopPropagation()}>
        {BASE.map((w) => <button key={w.id} className="pill !h-8" data-on={!!mods.on[w.id]} aria-pressed={!!mods.on[w.id]} onClick={() => { toggleMod(w.id, !mods.on[w.id]); setSel(w.id); }}>{w.name}</button>)}
        <span className="t1 mute num ml-2">Drag to move · {GAP}px snap gap</span>
      </div>
      </div>

      <aside className="drawer w-[320px] shrink-0 flex flex-col min-h-0" aria-label="HUD Design Studio inspector" style={{ background: "var(--side)" }}>
        <div className="px-5 pt-5"><div className="t4 font-semibold">HUD Design Studio</div><div className="t2 mute mt-0.5">{sw.name} / Luminos HUD</div>
          <div className="flex gap-2 mt-4"><button className="btn" data-on={tab === "Settings"} style={tab === "Settings" ? { background: "var(--accent)", color: "var(--accent-fg)" } : undefined} onClick={() => setTab("Settings")}><Icon n="sliders" s={14} />Settings</button><button className="btn" style={tab === "Designer" ? { background: "var(--accent)", color: "var(--accent-fg)" } : undefined} onClick={() => setTab("Designer")}><Icon n="edit" s={14} />Designer</button></div></div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {!sel ? <div className="t2 mute pt-6 leading-snug">Click a widget on the canvas to edit it. Drag to move; it snaps with a {GAP}px gap to the others.</div> : tab === "Settings" ? <>
            {!on && <div className="mt-4 panel-2 p-3 t2 leading-snug">{sw.name} is off. <button className="underline" onClick={() => toggleMod(sel, true)}>Turn it on</button> to see it on the canvas.</div>}
            <Sec t="Position"><button className="btn btn-primary w-fit" onClick={() => patch(sel, { x: sw.x, y: sw.y })}>Reset to default position</button><Tg l="Lock position" v={c.locked} f={(v) => patch(sel, { locked: v })} /><div className="t1 mute num">x {c.x}  y {c.y}</div></Sec>
            <Sec t="GUI scale"><Tg l="Use Minecraft GUI Scale" v={c.mcScale} f={(v) => patch(sel, { mcScale: v, scale: v ? 1 : c.scale })} />
              <div className="flex items-center gap-2"><span className="t2 flex-1">Custom Scale</span><button className="btn !h-7 !px-2" aria-label="Smaller" disabled={c.mcScale} onClick={() => patch(sel, { scale: Math.max(0.5, +(c.scale - 0.1).toFixed(1)) })}>−</button><span className="num t2 w-8 text-center">{c.scale.toFixed(1)}</span><button className="btn !h-7 !px-2" aria-label="Larger" disabled={c.mcScale} onClick={() => patch(sel, { scale: Math.min(2.5, +(c.scale + 0.1).toFixed(1)) })}>+</button></div></Sec>
            <Sec t="Background"><Tg l="Show Background" v={c.bg} f={(v) => patch(sel, { bg: v })} />{c.bg && <><R l="Opacity"><Slider label="Opacity" value={c.bgOp} min={0} max={100} onChange={(v) => patch(sel, { bgOp: v })} fmt={(v) => v + "%"} /></R><R l="Corner radius"><Slider label="Radius" value={c.radius} min={0} max={16} onChange={(v) => patch(sel, { radius: v })} fmt={(v) => v + "px"} /></R></>}</Sec>
            <Sec t="Appearance"><div className="t2">Text Color</div><div className="flex gap-1.5">{SW.map((s) => <button key={s} aria-label={`Text colour ${s}`} aria-pressed={c.color === s} onClick={() => patch(sel, { color: s })} className="w-7 h-7 rounded-md" style={{ background: s, outline: c.color === s ? "2px solid var(--accent-text)" : "1px solid var(--line-strong)", outlineOffset: 2 }} />)}</div>
              <Tg l="Text Shadow" v={c.shadow} f={(v) => patch(sel, { shadow: v })} />
              <label className="btn w-fit cursor-pointer"><Icon n="upload" s={13} />Import font (.ttf / .otf)<input type="file" accept=".ttf,.otf,font/ttf,font/otf" className="hidden" onChange={(e) => { importFont(e.target.files?.[0]); e.target.value = ""; }} /></label>{c.font && <button className="t1 underline w-fit" onClick={() => patch(sel, { font: undefined })}>Back to the default font</button>}{note && <div role="status" className="t1 mute">{note}</div>}</Sec>
            <Sec t="Visibility"><Tg l="Show in F3 Screen" v={c.f3} f={(v) => patch(sel, { f3: v })} /><Tg l="Show in Tab List" v={c.tab} f={(v) => patch(sel, { tab: v })} /><Tg l="Show in GUIs" v={c.guis} f={(v) => patch(sel, { guis: v })} /><Tg l="Show in Chat" v={c.chat} f={(v) => patch(sel, { chat: v })} /></Sec>
            <Sec t="General"><div className="panel p-3"><div className="flex items-center gap-3"><div className="flex-1"><div className="t2 font-medium">Mode</div><div className="t1 mute leading-snug mt-0.5">{sel === "keystrokes" ? "Normal draws the movement layout. Custom draws one key of your choice." : "Normal follows the game's layout. Custom lets you place it freely."}</div></div><div className="seg">{(["Normal", "Custom"] as const).map((m) => <button key={m} aria-pressed={c.mode === m} onClick={() => patch(sel, { mode: m })}>{m}</button>)}</div></div></div></Sec>
          </> : <>
            <Sec t="Widgets">{BASE.map((w) => <div key={w.id} className="lrow !px-0"><button className="flex-1 text-left t2" onClick={() => setSel(w.id)} style={{ fontWeight: sel === w.id ? 650 : 500 }}>{w.name}</button><Switch on={!!mods.on[w.id]} onChange={(v) => toggleMod(w.id, v)} label={`Show ${w.name}`} /></div>)}</Sec>
            <Sec t="Layout"><button className="btn w-fit" onClick={restack}><Icon n="layers" s={13} />Re-stack Keystrokes, CPS, FPS</button><div className="t1 mute leading-snug">Puts them back on one left edge with a {GAP}px gap.</div>
              <button className="btn w-fit" onClick={() => { localStorage.removeItem(KEY); setCfg(load()); setNote("Layout reset."); }}><Icon n="refresh" s={13} />Reset whole layout</button></Sec>
            <div className="t1 mute leading-snug pt-2">The client has {BASE.length} HUD modules today. A larger EvergreenHUD-style set is not built yet.</div>
          </>}
        </div>
      </aside>
    </div>
  );
}
const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => <section className="pt-5 grid gap-3"><div className="eyebrow">{t}</div>{children}</section>;
const Tg = ({ l, v, f }: { l: string; v: boolean; f: (v: boolean) => void }) => <div className="flex items-center gap-3"><span className="t1 mute w-5 num">{v ? "On" : "Off"}</span><Switch on={v} onChange={f} label={l} /><span className="t2">{l}</span></div>;
const R = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="flex items-center gap-2"><span className="t2 flex-1">{l}</span>{children}</div>;
export const HUD_MODS = MODS.filter((m) => m.cats.includes("hud"));
