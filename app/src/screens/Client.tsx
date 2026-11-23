import { useState } from "react";
import { call } from "../api";
import { Badge, Cover, Icon, Row, Slider, Toggle, Tile } from "../ui";
const MODS = [
  { id: "fps", t: "FPS", d: "Frames per second", x: 12, y: 12, w: 70, h: 20, text: "240 FPS" },
  { id: "cps", t: "CPS", d: "Clicks per second", x: 12, y: 40, w: 86, h: 20, text: "7 | 3 CPS" },
  { id: "coords", t: "Coordinates", d: "Position and facing", x: 12, y: 68, w: 130, h: 52, text: "X 128.4  Y 71\nZ -310.9\nnorth" },
  { id: "keys", t: "Keystrokes", d: "WASD, space and clicks", x: 12, y: 290, w: 98, h: 92, text: "" },
  { id: "potions", t: "Potion effects", d: "Timers for active effects", x: 560, y: 12, w: 168, h: 48, text: "Speed II  1:42\nNight Vision  6:10" },
  { id: "armor", t: "Armor HUD", d: "Armour and durability", x: 700, y: 150, w: 36, h: 120, text: "" },
];
const OPT = [["Resourcify", "Browse packs, shaders and data packs in game", "ok", "Installed 1.8.1"], ["Zoomify", "Smooth zoom with scroll to adjust", "ok", "Installed 2.15.0"], ["Controlify", "Controller support with radial menus", "mute", "Not installed"], ["Iris Shaders", "Shader packs on top of Sodium", "warn", "Beta only for 26.3"]] as const;
function SyncCard() {
  const [rep, setRep] = useState<Record<string, { pulled: string[]; pushed: string[]; conflicts: { item: string; winner: string }[] }> | null>(null);
  const [busy, setBusy] = useState(false); const [note, setNote] = useState("");
  const run = async () => { setBusy(true); try { setRep(await call("sync_run")); } finally { setBusy(false); } };
  const move = async (cmd: "sync_export" | "sync_import") => { const n = await call<number>(cmd, { path: "" }); setNote(`${cmd === "sync_export" ? "Exported" : "Imported"} ${n} files (folder “sync-export” in your Luminos data folder).`); };
  return (
    <div className="panel p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2"><div className="eyebrow">Sync across instances</div><Badge tone="ok">Keybinds · HUD · servers</Badge></div>
      <p className="text-[12.5px] text-mute mb-3">Runs before every launch and after every exit. Same keys and layout on every version; when two copies disagree the newest edit wins and the other is kept.</p>
      <div className="flex flex-col gap-1.5 min-h-[88px]">
        {rep ? Object.entries(rep).map(([n, r]) => (
          <div key={n} className="flex items-center justify-between text-[12.5px] rounded-[10px] px-3 h-8" style={{ background: "rgba(120,160,255,.07)" }}>
            <span className="truncate">{n}</span>
            <span className="text-mute whitespace-nowrap">{r.pulled.length ? `received ${r.pulled.length}` : r.pushed.length ? `shared ${r.pushed.length}` : "in sync"}{r.conflicts.length ? ` · ${r.conflicts.length} conflict kept` : ""}</span>
          </div>
        )) : <div className="text-[12.5px] text-mute">Not run in this session yet.</div>}
      </div>
      {note && <div className="text-[12px] text-ok mt-2">{note}</div>}
      <div className="flex gap-2 mt-3">
        <button className="btn-primary h-9 px-4 rounded-full text-[13px]" onClick={run} disabled={busy}>{busy ? "Syncing…" : "Sync now"}</button>
        <button className="btn-ghost h-9 px-3 rounded-full text-[13px]" onClick={() => move("sync_export")}>Export</button>
        <button className="btn-ghost h-9 px-3 rounded-full text-[13px]" onClick={() => move("sync_import")}>Import</button>
      </div>
    </div>
  );
}
export default function Client({ mc }: { mc: string }) {
  const [on, setOn] = useState<Record<string, boolean>>({ fps: true, cps: true, coords: true, keys: true, potions: true, armor: true });
  const [sprint, setSprint] = useState(true); const [zoom, setZoom] = useState(30); const [bg, setBg] = useState(true);
  return (
    <div className="page-in h-full overflow-y-auto px-12 py-10 max-w-[1280px]">
      <div className="flex items-end justify-between mb-6"><div><div className="eyebrow">One product</div><h1 className="display text-[56px] mt-1">Your <span className="accent-word">client</span></h1><p className="text-mute mt-2 max-w-[60ch]">Everything you change here is what the in-game panel shows (Right Ctrl). Same file, same look.</p></div><Badge tone="accent"><Icon n="bolt" s={12} />Luminos Client 0.4.0 · Minecraft {mc}</Badge></div>
      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          <div className="panel p-3"><div className="relative aspect-video rounded-[12px] overflow-hidden">
            <Cover version={mc} />
            <div className="absolute inset-x-0 bottom-0 h-10 flex justify-center items-end pb-1"><div className="flex gap-0.5 p-0.5 bg-black/55 rounded">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-7 w-7 border border-white/25 bg-black/30" />)}</div></div>
            {MODS.map((m) => (
              <div key={m.id} className="absolute text-[11px] leading-[14px] text-[#e8eeff] whitespace-pre px-2 py-[3px] transition-all" style={{ left: `${(m.x / 740) * 100}%`, top: `${(m.y / 416) * 100}%`, opacity: on[m.id] ? 1 : 0, transform: on[m.id] ? "none" : "scale(.94)", background: bg ? "rgba(8,13,32,.62)" : "transparent", borderLeft: bg ? "2px solid #4f8cff" : "none", transitionDuration: "var(--dur-base)", pointerEvents: "none" }}>
                {m.id === "keys" ? <div className="grid grid-cols-3 gap-0.5 w-[74px]">{["", "W", "", "A", "S", "D"].map((k, i) => <div key={i} className="h-5 grid place-items-center text-[10px] border" style={{ visibility: k ? "visible" : "hidden", borderColor: k === "W" ? "#4f8cff" : "rgba(255,255,255,.2)", background: k === "W" ? "rgba(44,79,156,.8)" : "transparent" }}>{k}</div>)}</div> : m.id === "armor" ? <div className="grid gap-1">{["#9fb4d8", "#9fb4d8", "#9fb4d8", "#9fb4d8"].map((c, i) => <div key={i} className="h-5 w-5" style={{ background: c, opacity: 0.8 }} />)}</div> : m.text}
              </div>))}
          </div><div className="flex items-center justify-between px-1 pt-3 text-[12px] text-mute"><span>Live preview of your HUD on Minecraft {mc}</span><span>Drag to place in game · Right-click toggles</span></div></div>
          <div className="mt-6 grid grid-cols-2 gap-3 items-start">
            <div className="panel p-4"><div className="eyebrow mb-2">Quick panel</div><img src="/ingame/panel.jpg" alt="The Luminos quick panel open inside Minecraft" className="rounded-[10px] w-full border border-white/10" /><p className="text-[12.5px] text-mute mt-2">Right Ctrl opens it in game, Right Shift jumps to search. Rebind both under Keybinds.</p></div>
            <SyncCard />
          </div>
          <div className="mt-6"><div className="eyebrow mb-3">Optional mods</div><div className="grid grid-cols-2 gap-3">{OPT.map(([n, d, tone, st]) => <div key={n} className="lift panel p-3.5 flex gap-3 items-center"><Tile name={n} hue={n.length * 30} size={42} /><div className="min-w-0 flex-1"><div className="font-semibold text-[14px]">{n}</div><div className="text-[12px] text-mute truncate">{d}</div></div><Badge tone={tone as any}>{st}</Badge></div>)}</div></div>
        </div>
        <div className="panel p-5 h-fit">
          <div className="eyebrow mb-1">Modules</div>
          {MODS.map((m) => <Row key={m.id} title={m.t} desc={m.d}><Toggle on={on[m.id]} onChange={(v) => setOn({ ...on, [m.id]: v })} label={m.t} /></Row>)}
          <div className="eyebrow mt-5 mb-1">Behaviour</div>
          <Row title="Toggle sprint" desc="Hold nothing: sprint until you stop."><Toggle on={sprint} onChange={setSprint} label="Toggle sprint" /></Row>
          <Row title="HUD backgrounds"><Toggle on={bg} onChange={setBg} label="Backgrounds" /></Row>
          <Row title="Zoom field of view" desc="While the zoom key (C) is held."><Slider value={zoom} min={10} max={70} onChange={setZoom} fmt={(v) => v + "°"} /></Row>
        </div>
      </div>
    </div>
  );
}
