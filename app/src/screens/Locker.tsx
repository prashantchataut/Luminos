import { useEffect, useMemo, useRef, useState } from "react";
import type { Boot } from "../App";
import { Icon, SearchBox } from "../kit";
import { Stage } from "../cos3d";
import { CATS, CatId, ITEMS, Item, loadLocker, Locker as L, PET_SPEC, PET_STATES, PetState, saveLocker, VISIBLE_TO, VISIBLE_TO_CAPE } from "../data/cosmetics";
import { loadSkins, ORIGINALS, srcOf } from "../skinio";
import { useSettings, set } from "../store";

export default function Locker(_p: { boot: Boot }) {
  const s = useSettings();
  const [cat, setCat] = useState<CatId>("pets"); const [q, setQ] = useState(""); const [lk, setLk] = useState<L>(loadLocker); const [state, setState] = useState<PetState>("idle");
  const [view, setView] = useState<"studio" | "scene">("scene"); const [cam, setCam] = useState<"front" | "back" | "spin">("spin"); const [spec, setSpec] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null); const stage = useRef<Stage | null>(null);
  const skin = useMemo(() => { const st = loadSkins(); return [...ORIGINALS, ...st.mine].find((x) => x.id === st.active) || ORIGINALS[0]; }, []);
  const items = ITEMS.filter((i) => i.cat === cat && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  const cur = CATS.find((c) => c.id === cat)!; const eq = lk.equipped[cat];

  useEffect(() => { stage.current = new Stage(canvas.current!, 460, 560); (window as any).__stage = stage.current; const k = stage.current; k.setSkin(srcOf(skin), skin.model === "slim"); k.setScene("scene"); k.setCape(lk.equipped.cloaks); k.setEquipped(lk.equipped, s.classicClient); return () => k.dispose(); }, []);
  useEffect(() => { const k = stage.current!; k.reduce = s.reduceMotion; k.setCape(lk.equipped.cloaks); k.setEquipped(lk.equipped, s.classicClient); }, [lk, s.classicClient, s.reduceMotion]);
  useEffect(() => { stage.current!.setScene(view); }, [view]);
  useEffect(() => { stage.current!.setView(cam); }, [cam, s.reduceMotion]);
  useEffect(() => { stage.current!.setState(state); }, [state]);

  const commit = (n: L) => { setLk(n); saveLocker(n); };
  const toggle = (i: Item) => {
    const on = lk.equipped[i.cat] === i.id; const equipped = { ...lk.equipped }; if (on) delete equipped[i.cat]; else equipped[i.cat] = i.id; commit({ ...lk, equipped });
    if (i.cat === "emotes") stage.current!.playEmote(on ? null : i.id);
    if (i.cat === "pets") setState("idle");
  };
  const fav = (id: string) => commit({ ...lk, favs: lk.favs.includes(id) ? lk.favs.filter((f) => f !== id) : [...lk.favs, id] });
  const favFirst = [...items].sort((a, b) => +lk.favs.includes(b.id) - +lk.favs.includes(a.id));
  const worn = Object.values(lk.equipped).filter(Boolean).length;
  const petId = lk.equipped.pets;

  return (
    <div className="grid gap-3 max-w-[1260px]" style={{ gridTemplateColumns: "190px minmax(0,1fr) 360px", height: "calc(100vh - 44px - 20px)" }}>
      <nav className="panel p-2 flex flex-col gap-1 min-h-0 overflow-y-auto" aria-label="Categories">
        <div className="eyebrow px-2 py-1">Locker</div>
        {CATS.map((c) => { const n = ITEMS.filter((i) => i.cat === c.id).length; const on = lk.equipped[c.id]; return (
          <button key={c.id} className="tile flex items-center gap-2 px-2 h-10 text-left" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            <Icon n={c.icon} s={16} /><span className="t2 font-medium flex-1">{c.label}</span>{on && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-accent)" }} aria-label="Something equipped" />}<span className="t1 mute num">{n}</span>
          </button>); })}
        <div className="flex-1" />
        <div className="t1 mute px-2 pb-1">{worn} equipped. Pets and wings are worn together.</div>
        <label className="flex items-center justify-between gap-2 px-2 py-2 t2" style={{ borderTop: "1px solid var(--color-line)" }}><span>Classic client</span><button role="switch" aria-checked={s.classicClient} aria-label="Classic client" className="sw" onClick={() => set("classicClient", !s.classicClient)} /></label>
      </nav>

      <div className="panel relative overflow-hidden min-h-0 flex flex-col" style={{ background: view === "scene" ? "linear-gradient(180deg,#2c2150 0%,#8a3f64 38%,#f08a5d 62%,#ffcf8a 78%)" : "var(--inset)" }}>
        <div className="flex items-center gap-2 p-2.5 z-10 flex-wrap">
          <div className="seg" style={{ background: "var(--surface)" }}><button aria-pressed={view === "studio"} onClick={() => setView("studio")}>Studio</button><button aria-pressed={view === "scene"} onClick={() => setView("scene")}>Sunset scene</button></div>
          <div className="seg" style={{ background: "var(--surface)" }} aria-label="Camera">{(["front", "back", "spin"] as const).map((c) => <button key={c} aria-pressed={cam === c} onClick={() => setCam(c)} className="capitalize">{c}</button>)}</div>
          <div className="flex-1" />
          <div className="seg" style={{ background: "var(--surface)" }} aria-label="Pose">{PET_STATES.map((p) => <button key={p} aria-pressed={state === p} onClick={() => setState(p)} className="capitalize">{p}</button>)}</div>
        </div>
        <div className="flex-1 min-h-0 grid place-items-center relative">
          {state === "swim" && <div className="absolute inset-0 pointer-events-none" style={{ background: "color-mix(in srgb, #2a8fd0 30%, transparent)" }} />}
          <canvas ref={canvas} width={460} height={560} aria-label="3D preview of your equipped items" />
        </div>
        <div className="p-2.5 z-10 flex items-center gap-2">
          {lk.equipped.emotes && <button className="btn" onClick={() => stage.current!.playEmote(lk.equipped.emotes!)}><Icon n="play" s={14} />Play emote</button>}
          <span className="t1 ml-auto px-2 py-1 rounded" style={{ background: "var(--surface)" }}>Skin: {skin.name}</span>
        </div>
      </div>

      <div className="panel p-2.5 flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between"><div className="t3 font-semibold">{cur.label}</div><span className="t1 mute num">{items.length}</span></div>
        <div className="flex"><SearchBox value={q} onChange={setQ} placeholder={`Search ${cur.label.toLowerCase()}`} /></div>
        <div className={`grid grid-cols-2 gap-1.5 overflow-y-auto content-start pr-1 ${cat === "pets" && spec && petId ? "shrink-0" : "flex-1 min-h-0"}`} style={cat === "pets" && spec && petId ? { maxHeight: 230 } : undefined}>
          {favFirst.map((i) => { const on = lk.equipped[i.cat] === i.id; return (
            <div key={i.id} className="relative group">
              <button onClick={() => toggle(i)} aria-pressed={on} aria-label={`${on ? "Unequip" : "Equip"} ${i.name}`} className="tile w-full text-left p-2 flex flex-col gap-1 min-h-[76px]">
                <span className="t2 font-semibold pr-5">{i.name}</span><span className="t1 mute">{i.note}</span>
                {on && <span className="badge accent self-start mt-auto"><Icon n="check" s={10} />Equipped</span>}
              </button>
              <button className="absolute top-1 right-1 ibtn !w-6 !h-6" aria-label={`${lk.favs.includes(i.id) ? "Remove favourite" : "Favourite"} ${i.name}`} aria-pressed={lk.favs.includes(i.id)} onClick={() => fav(i.id)} style={{ color: lk.favs.includes(i.id) ? "var(--color-warn)" : undefined }}><Icon n="star" s={12} /></button>
            </div>); })}
          {!favFirst.length && <div className="t2 mute col-span-2 p-3">Nothing matches “{q}”.</div>}
        </div>
        {cat === "pets" && petId && PET_SPEC[petId] && (
          <div className="flex flex-col min-h-0 flex-1" style={{ borderTop: "1px solid var(--color-line)" }}>
            <button className="flex items-center justify-between py-2 t2 font-semibold" onClick={() => setSpec(!spec)} aria-expanded={spec}>Behaviour: {ITEMS.find((i) => i.id === petId)!.name}<Icon n="chev" s={14} /></button>
            {spec && <div className="overflow-y-auto flex flex-col gap-1.5 pr-1">{PET_STATES.map((p) => <button key={p} className="text-left p-1.5 rounded-md" style={{ background: state === p ? "var(--accent-soft)" : "transparent" }} onClick={() => setState(p)}><span className="t1 font-semibold capitalize">{p}</span><span className="t1 mute block">{PET_SPEC[petId][p]}</span></button>)}</div>}
          </div>)}
        <div className="t1 mute pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>{cat === "cloaks" ? VISIBLE_TO_CAPE : VISIBLE_TO}{s.classicClient && " Classic client is on: pets, wings and emotes are hidden for you."}</div>
      </div>
    </div>
  );
}
