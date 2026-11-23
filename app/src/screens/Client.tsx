import { useState } from "react";
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
export default function Client({ mc }: { mc: string }) {
  const [on, setOn] = useState<Record<string, boolean>>({ fps: true, cps: true, coords: true, keys: true, potions: true, armor: true });
  const [sprint, setSprint] = useState(true); const [zoom, setZoom] = useState(30); const [bg, setBg] = useState(true);
  return (
    <div className="page-in h-full overflow-y-auto px-12 py-10 max-w-[1280px]">
      <div className="flex items-end justify-between mb-6"><div><div className="eyebrow">One product</div><h1 className="display text-[56px] mt-1">Your <span className="accent-word">client</span></h1><p className="text-mute mt-2 max-w-[60ch]">Everything you change here is what the in-game menu shows (Right Shift). Same file, same look.</p></div><Badge tone="accent"><Icon n="bolt" s={12} />Luminos Client 0.3.0 · Minecraft {mc}</Badge></div>
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
