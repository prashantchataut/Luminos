import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { Field, PageHeader, Switch } from "../components/ui";
import { MODULES } from "../data/modules";
import { cfgOf, setCfg, setHudPos, setPref, toggleMod, useClient } from "../state/client";

const W = 640, H = 360;
type El = { id: string; label: string; mod: string; pos: [number, number]; size: [number, number] };
const ELS: El[] = [
  { id: "keystrokes", label: "Keystrokes", mod: "keystrokes", pos: [8, 8], size: [76, 97] },
  { id: "cps", label: "CPS Display", mod: "cps", pos: [8, 110], size: [76, 22] },
  { id: "fps", label: "FPS Display", mod: "fps", pos: [8, 137], size: [76, 22] },
  { id: "waypoints", label: "Waypoints", mod: "waypoints", pos: [264, 10], size: [112, 22] },
  { id: "minimap", label: "Minimap", mod: "minimap", pos: [536, 8], size: [96, 96] },
  { id: "armor", label: "Armor Status", mod: "armor", pos: [229, 300], size: [96, 28] },
];
const NUDGE: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] };
const snap = (v: number) => Math.round(v / 5) * 5;

function Body({ id, bg, shadow, color }: { id: string; bg: boolean; shadow: boolean; color: string }) {
  const ts = { color, textShadow: shadow ? "1px 1px 0 rgba(0,0,0,.6)" : "none" };
  const box = "w-full h-full rounded-[3px] ";
  const fill = { background: bg ? "rgba(0,0,0,.42)" : "transparent" };
  if (id === "keystrokes") {
    const K = ({ c, w = 22, h = 22 }: { c: string; w?: number; h?: number }) => <div className="grid place-items-center text-[10px] font-bold rounded-[3px]" style={{ width: w, height: h, background: "rgba(0,0,0,.42)", color }}>{c}</div>;
    return <div className="w-full h-full flex flex-col items-center gap-[3px]"><K c="W" /><div className="flex gap-[3px]"><K c="A" /><K c="S" /><K c="D" /></div><div className="flex gap-[3px]"><K c="LMB" w={36} h={20} /><K c="RMB" w={36} h={20} /></div><K c="" w={73} h={12} /></div>;
  }
  if (id === "waypoints") return <div className={box + "flex items-center justify-center gap-1.5 text-[10px] font-semibold"} style={{ ...fill, ...ts }}><span style={{ color: "#6882FF" }}>◆</span>Base · 142m</div>;
  if (id === "minimap") return <div className={box + "relative overflow-hidden"} style={{ background: "linear-gradient(135deg,#2d5a35,#3b7a45 45%,#2a4f62)", border: "2px solid rgba(0,0,0,.5)" }}><div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rotate-45" style={{ background: "#fff" }} /></div>;
  if (id === "armor") return <div className={box + "flex items-center justify-center gap-1.5"} style={fill}>{["#9bd", "#cde", "#7ac", "#8bd"].map((c, i) => <div key={i} className="w-4 h-4 rounded-[2px]" style={{ background: c }} />)}</div>;
  return <div className={box + "flex items-center justify-center text-[11px] font-semibold"} style={{ ...fill, ...ts }}>{id === "cps" ? "7 | 5 CPS" : "144 FPS"}</div>;
}

function Inspector({ el }: { el: El }) {
  const c = useClient();
  const m = MODULES.find((x) => x.id === el.mod)!;
  const has = (k: string) => m.settings.find((s) => s.k === k);
  const bg = has("bg"), sh = has("shadow"), co = has("color");
  const get = (k: string, d: unknown) => { const s = has(k); return s ? cfgOf(c, m.id, s) : d; };
  const R = ({ children }: { children: ReactNode }) => <div className="px-4 min-h-[48px] rounded-[10px] flex items-center" style={{ background: "var(--surface)" }}>{children}</div>;
  return (
    <aside className="w-[310px] shrink-0 min-h-0 overflow-y-auto rounded-[16px] p-5 space-y-3" style={{ background: "var(--side)" }} aria-label="HUD inspector">
      <div><h2 className="m-0 text-[15px] font-semibold">HUD Design Studio</h2><p className="m-0 mt-0.5 text-[12px] mute">Editing {el.label}. Drag it on the canvas.</p></div>
      <button className="btn-quiet w-full" onClick={() => { setHudPos(el.id, el.pos); }}><Icon n="reset" s={14} />Reset to default position</button>
      <R><div className="w-full"><Field label="Lock position"><Switch on={c.prefs.hudLock} onChange={(v) => setPref("hudLock", v)} label="Lock position" /></Field></div></R>
      <R><div className="w-full"><Field label="Use Minecraft GUI Scale"><Switch on={c.prefs.hudGui} onChange={(v) => setPref("hudGui", v)} label="Use Minecraft GUI Scale" /></Field></div></R>
      <R><div className="w-full"><Field label="Visibility"><Switch on={!!c.on[m.id]} onChange={(v) => toggleMod(m.id, v)} label={`Show ${el.label}`} /></Field></div></R>
      {bg && <R><div className="w-full"><Field label="Show Background"><Switch on={get("bg", true) as boolean} onChange={(v) => setCfg(m.id, "bg", v)} label="Show background" /></Field></div></R>}
      {sh && <R><div className="w-full"><Field label="Text Shadow"><Switch on={get("shadow", true) as boolean} onChange={(v) => setCfg(m.id, "shadow", v)} label="Text shadow" /></Field></div></R>}
      {co && <R><div className="w-full"><Field label="Text Color"><input type="color" aria-label="Text color" value={get("color", "#FFFFFF") as string} onChange={(e) => setCfg(m.id, "color", e.target.value.toUpperCase())} /></Field></div></R>}
    </aside>
  );
}

export default function HudStudio() {
  const c = useClient();
  const [sel, setSel] = useState("keystrokes"), [k, setK] = useState(1), [drag, setDrag] = useState<{ id: string; pos: [number, number] } | null>(null);
  const wrap = useRef<HTMLDivElement>(null), start = useRef<{ x: number; y: number; p: [number, number] } | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const f = () => setK(Math.max(0.5, el.clientWidth / W));
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { document.body.style.cursor = drag ? "grabbing" : ""; return () => { document.body.style.cursor = ""; }; }, [!!drag]);
  const posOf = (e: El): [number, number] => (drag?.id === e.id ? drag.pos : c.prefs.hudPos[e.id] ?? e.pos);
  const el = ELS.find((e) => e.id === sel)!;
  useEffect(() => {
    if (!sel || c.prefs.hudLock) return;
    const f = (ev: KeyboardEvent) => {
      const d = NUDGE[ev.key];
      const e = ELS.find((x) => x.id === sel); if (!d || !e) return;
      ev.preventDefault(); const [x, y] = c.prefs.hudPos[sel] ?? e.pos;
      setHudPos(sel, [Math.max(0, Math.min(W - e.size[0], x + d[0])), Math.max(0, Math.min(H - e.size[1], y + d[1]))]);
    };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  }, [sel, c.prefs.hudLock, c.prefs.hudPos]);
  const cur = el ? posOf(el) : null;
  return (
    <Page fill wide>
      <PageHeader title="Edit HUD" sub="Drag elements, then fine-tune them on the right. Changes save as you go." />
      <div className="flex gap-7 flex-1 min-h-0">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4">
        <div ref={wrap} className="w-full min-w-0 flex items-start justify-center">
          <div className="relative overflow-hidden rounded-[14px] shrink-0" style={{ width: W * k, height: H * k, background: "#10131a" }}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${k})` }} onPointerDown={(e) => e.target === e.currentTarget && setSel("")}>
              <img src="/art/hud-backdrop.jpg" alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
              <div className="absolute inset-x-[229px] bottom-[6px] h-[22px] rounded-[2px] pointer-events-none" style={{ background: "rgba(0,0,0,.55)", outline: "2px solid rgba(255,255,255,.25)" }} />
              {ELS.map((e) => {
                const [x, y] = posOf(e), on = !!c.on[e.mod], active = sel === e.id;
                const bg = (cfgOf(c, e.mod, MODULES.find((m) => m.id === e.mod)!.settings.find((s) => s.k === "bg") ?? ({ k: "bg", def: true } as never)) as boolean) ?? true;
                const st = MODULES.find((m) => m.id === e.mod)!.settings;
                const get = (kk: string, d: unknown) => { const s = st.find((q) => q.k === kk); return s ? cfgOf(c, e.mod, s) : d; };
                return (
                  <div key={e.id} role="button" tabIndex={0} aria-label={`${e.label}${on ? "" : " (hidden)"}`} aria-pressed={active}
                    onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") setSel(e.id); }}
                    onPointerDown={(ev) => { ev.stopPropagation(); setSel(e.id); if (c.prefs.hudLock) return; (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); start.current = { x: ev.clientX, y: ev.clientY, p: [x, y] }; }}
                    onPointerMove={(ev) => { const s0 = start.current; if (!s0) return; setDrag({ id: e.id, pos: [Math.max(0, Math.min(W - e.size[0], snap(s0.p[0] + (ev.clientX - s0.x) / k))), Math.max(0, Math.min(H - e.size[1], snap(s0.p[1] + (ev.clientY - s0.y) / k)))] }); }}
                    onPointerUp={() => { if (drag?.id === e.id) setHudPos(e.id, drag.pos); start.current = null; setDrag(null); }}
                    className="absolute touch-none" style={{ left: x, top: y, width: e.size[0], height: e.size[1], opacity: on ? 1 : 0.28, cursor: c.prefs.hudLock ? "default" : "grab", outline: active ? "2px solid #2B4BFF" : "none", outlineOffset: 1 }}>
                    <Body id={e.id} bg={bg} shadow={get("shadow", true) as boolean} color={get("color", "#FFFFFF") as string} />
                    {active && <span className={`absolute top-0 h-[18px] px-1.5 rounded text-[10px] font-semibold grid place-items-center whitespace-nowrap ${x > W / 2 ? "right-full mr-1.5" : "left-full ml-1.5"}`} style={{ background: "#2B4BFF", color: "#fff" }}>{e.size[0]} x {e.size[1]}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="h-11 shrink-0 rounded-[10px] px-4 flex items-center justify-between text-[12px]" style={{ background: "var(--surface)" }} role="status">
          <span className="mute">{el ? <>Selected <b className="font-semibold" style={{ color: "var(--fg)" }}>{el.label}</b></> : "Select an element to edit it"}</span>
          <span className="mono mute num">{cur ? `x ${cur[0]}  y ${cur[1]}  ·  ${el.size[0]} × ${el.size[1]}` : ""}  ·  arrow keys nudge 5 px</span>
        </div>
        <div className="grid grid-cols-4 gap-3" role="group" aria-label="HUD elements">
          {ELS.map((e) => (
            <button key={e.id} onClick={() => setSel(e.id)} aria-pressed={sel === e.id} className="h-11 px-3.5 rounded-[10px] flex items-center gap-2.5 text-[12.5px] font-medium text-left t press" style={{ background: sel === e.id ? "#2B4BFF" : "#141821", color: sel === e.id ? "#fff" : "#8A94A6" }}>
              <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: c.on[e.mod] ? "#34D399" : "#4B5563" }} />
              <span className="truncate">{e.label}</span>
            </button>
          ))}
        </div>
        </div>
        <Inspector el={el ?? ELS[0]} />
      </div>
    </Page>
  );
}
