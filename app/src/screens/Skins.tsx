import { useEffect, useState } from "react";
import Skin3D from "../Skin3D";
import { Sky, Badge, Icon, Segmented } from "../ui";
import { call } from "../api";
const FALLBACK = [
  { id: "luminos-pilot", name: "Pilot", blurb: "The default: dithered-blue flight jacket with a moon patch.", slim: false },
  { id: "luminos-moonlit", name: "Moonlit", blurb: "Night-shift hoodie, pale and calm.", slim: true },
  { id: "luminos-ember", name: "Ember", blurb: "Warm dusk colours for lava-lit caves.", slim: false },
  { id: "luminos-knight", name: "Knight", blurb: "Plain steel with a blue plume.", slim: false },
].map((s) => ({ ...s, png: `/skins/${s.id}.png` }));
const WORKSHOP = [["Wings", "Dither wings"], ["Hat", "Pixel halo"], ["Back", "Lantern"], ["Glasses", "Night shades"], ["Aura", "Starfall"], ["Emotes", "Moon wave"]];
export default function Skins() {
  const [skins, setSkins] = useState<any[]>(FALLBACK);
  const [capes, setCapes] = useState<any[]>([{ id: "luminos-moon-cape", name: "Moon cape", blurb: "Soft crescent on deep blue.", png: "/skins/luminos-moon-cape.png" }]);
  const [sel, setSel] = useState("luminos-pilot"); const [cape, setCape] = useState(true); const [tab, setTab] = useState("skins"); const [walk, setWalk] = useState(true);
  useEffect(() => { call("builtin_skins").then((r: any) => { if (r?.skins?.length) { setSkins(r.skins); setSel(r.skins[0].id); setCapes(r.capes); } }).catch(() => {}); }, []);
  const cur = skins.find((s) => s.id === sel) || skins[0];
  return (
    <div className="page-in h-full grid grid-cols-[minmax(420px,5fr)_6fr]">
      <div className="relative overflow-hidden border-r border-line">
        <div className="absolute inset-0 opacity-90"><Sky tone={2} /></div>
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 55%, rgba(59,108,240,.25), transparent 70%), linear-gradient(180deg, transparent 60%, rgba(5,10,31,.8))" }} />
        <div className="relative h-full flex flex-col">
          <div className="px-10 pt-9"><div className="eyebrow">Wearing</div><h2 className="display text-[44px]">{cur.name} <span className="accent-word">{cape ? "+ Moon cape" : ""}</span></h2></div>
          <div className="flex-1 grid place-items-center"><Skin3D skin={cur.png} cape={cape ? capes[0]?.png : undefined} slim={cur.slim} height={470} walk={walk} /></div>
          <div className="px-10 pb-7 flex items-center justify-between"><div className="flex gap-2"><button className="chip" data-on={cape} onClick={() => setCape(!cape)}>Cape</button><button className="chip" data-on={walk} onClick={() => setWalk(!walk)}>Walk</button></div><span className="text-[12px] text-mute">Drag to turn</span></div>
        </div>
      </div>
      <div className="h-full overflow-y-auto px-10 py-9">
        <div className="flex items-center justify-between mb-6"><Segmented value={tab} onChange={setTab} options={[{ v: "skins", l: "Skins" }, { v: "capes", l: "Capes" }, { v: "cosmetics", l: "Cosmetics" }]} /><Badge tone="ok"><Icon n="check" s={12} />All free · original work</Badge></div>
        {tab === "skins" && <div className="grid grid-cols-2 gap-4 stagger">
          {skins.map((s) => (
            <button key={s.id} onClick={() => setSel(s.id)} className="lift panel p-4 text-left flex gap-4" style={{ outline: sel === s.id ? "2px solid var(--color-accent)" : "none", outlineOffset: 2 }}>
              <div className="h-16 w-16 rounded-[12px] shrink-0 hair" style={{ backgroundImage: `url(${s.png})`, backgroundSize: "512px 512px", backgroundPosition: "-64px -64px", imageRendering: "pixelated" }} />
              <div className="min-w-0"><div className="font-semibold">{s.name}</div><div className="text-[12.5px] text-mute leading-snug mt-0.5">{s.blurb}</div></div>
            </button>))}
          <div className="col-span-2 panel p-4 flex items-start gap-3"><Icon n="shield" s={18} className="text-accent mt-0.5" /><div className="text-[12.5px] text-mute leading-relaxed"><b className="text-fg font-medium">Licences are checked, never assumed.</b> Luminos' own skins are original work by Luminos contributors, free to use anywhere. A skin you import keeps its creator's licence: you confirm it before it is saved, and the creator's name and source stay attached to it in your library.<div className="mt-3 flex gap-2"><input className="field !h-10" placeholder="Import from a username…" /><button className="btn btn-ghost btn-sm !h-10">Import</button></div></div></div>
        </div>}
        {tab === "capes" && <div className="grid grid-cols-2 gap-4 stagger">{capes.map((c) => <div key={c.id} className="lift panel p-4 flex gap-4"><div className="h-16 w-12 rounded-md hair shrink-0" style={{ backgroundImage: `url(${c.png})`, backgroundSize: "480px 240px", backgroundPosition: "-12px -12px", imageRendering: "pixelated" }} /><div><div className="font-semibold">{c.name}</div><div className="text-[12.5px] text-mute">{c.blurb}</div><div className="mt-2"><Badge tone="ok">Worn</Badge></div></div></div>)}</div>}
        {tab === "cosmetics" && <div className="grid grid-cols-3 gap-4 stagger">{WORKSHOP.map(([k, n], i) => <div key={k} className="panel p-4"><div className="h-24 rounded-[10px] overflow-hidden mb-3"><Sky animate={false} tone={i + 4} /></div><div className="eyebrow">{k}</div><div className="font-semibold mt-0.5">{n}</div><div className="mt-2"><Badge tone="warn">In the workshop</Badge></div></div>)}</div>}
      </div>
    </div>
  );
}
