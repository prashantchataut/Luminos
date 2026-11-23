import { Badge, Cover, Icon } from "../ui";
import { Inst } from "../api";
const fmtH = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s ? `${Math.floor(s / 60)}m` : "—");
export default function Instances({ insts, setSel, nav }: { insts: Inst[]; setSel: (id: string) => void; nav: (r: string) => void }) {
  return (
    <div className="page-in h-full overflow-y-auto px-12 py-10 max-w-[1280px]">
      <div className="flex items-end justify-between mb-8"><div><div className="eyebrow">Library</div><h1 className="display text-[56px] mt-1">Your <span className="accent-word">instances</span></h1><p className="text-mute mt-2 max-w-[56ch]">Each one is its own Minecraft: version, loader, mods and worlds, kept apart so one can never break another.</p></div><button className="btn btn-primary"><Icon n="plus" s={16} />New instance</button></div>
      <div className="grid grid-cols-3 gap-5 stagger">
        {insts.map((i) => (
          <div key={i.id} className="lift zoom panel overflow-hidden group">
            <div className="relative h-[168px]"><Cover version={i.mc} /><div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 45%, rgba(10,20,51,.95))" }} />
              <div className="absolute top-3 right-3 flex gap-1.5">{i.mods === 0 ? <Badge>Vanilla</Badge> : <Badge tone="ok"><Icon n="shield" s={11} />Checked</Badge>}</div>
              <div className="absolute bottom-3 left-4"><div className="font-semibold text-[18px]">{i.name}</div><div className="text-[12.5px] text-fg/70 num">Minecraft {i.mc} · {i.loader} · Java {i.java}</div></div></div>
            <div className="flex items-center justify-between p-4"><div className="flex gap-5 text-[12.5px]"><div><div className="text-mute">Mods</div><div className="font-semibold num text-[15px]">{i.mods ?? "—"}</div></div><div><div className="text-mute">Played</div><div className="font-semibold num text-[15px]">{fmtH(i.playtime)}</div></div><div><div className="text-mute">Last</div><div className="font-semibold text-[15px]">{i.last}</div></div></div>
              <button className="btn btn-primary btn-sm" onClick={() => { setSel(i.id); nav("home"); }}><Icon n="play" s={12} />Play</button></div>
          </div>
        ))}
        <button className="lift rounded-[16px] grid place-items-center min-h-[270px] text-mute" style={{ border: "1.5px dashed rgba(160,190,255,.28)" }}><div className="text-center"><div className="mx-auto h-12 w-12 rounded-full grid place-items-center hair mb-3"><Icon n="plus" s={20} /></div><div className="font-medium text-fg">Create an instance</div><div className="text-[12.5px] mt-1">Pick a version, we do the rest</div></div></button>
      </div>
    </div>
  );
}
