import { useState } from "react";
import type { Boot } from "../App";
import type { Inst } from "../api";
import { call } from "../api";
import { Badge, Chip, Cover, Icon, fmtTime } from "../kit";

const LOADER_ICON: Record<string, string> = { Fabric: "/mods/fabric-api.png" };

export default function Instances({ boot, go }: { boot: Boot; go: (r: string) => void }) {
  const [list, setList] = useState<Inst[]>(boot.instances);
  const [f, setF] = useState("All");
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const shown = list.filter((i) => f === "All" || i.loader === f || (f === "Modded" && i.loader !== "Vanilla"));
  const toast = (m: string) => { setNote(m); setTimeout(() => setNote(""), 3200); };
  const clone = (i: Inst) => { setList((l) => [...l, { ...i, id: i.id + "-copy" + l.length, name: i.name + " (copy)", playtime: 0, last: "Never" }]); toast(`Cloned ${i.name} ${i.mc}. Worlds and mods were copied.`); };
  const exportIt = async (i: Inst) => { try { await call("export_instance", { id: i.id }); toast(`Exported ${i.name} as .mrpack`); } catch { toast("Export runs in the desktop engine; this build has no export command yet."); } };
  return (
    <div className="max-w-[1180px]">
      <div className="flex items-center gap-2 mb-3">
        {["All", "Fabric", "Vanilla"].map((x) => <Chip key={x} on={f === x} onClick={() => setF(x)}>{x}<span className="num mute">{x === "All" ? list.length : list.filter((i) => i.loader === x).length}</span></Chip>)}
        <div className="flex-1" />
        {note && <span className="t1 mute rise" role="status">{note}</span>}
        <button className="btn btn-primary" onClick={() => go("onboarding/4")}><Icon n="plus" s={14} />New instance</button>
      </div>
      <div className="grid gap-3 stagger" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        {shown.map((i) => (
          <article key={i.id} className="glass lift overflow-hidden group">
            <div className="relative h-[104px]">
              <Cover version={i.mc} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(2,4,13,.78))" }} />
              <div className="absolute left-2.5 bottom-2 flex items-center gap-1.5"><Badge tone="accent">{i.mc}</Badge><Badge>{i.loader}</Badge>{i.mods ? <Badge>{i.mods} mods</Badge> : null}</div>
              {playing === i.id && <div className="absolute right-2.5 top-2"><Badge tone="ok">Running</Badge></div>}
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-2">
                {LOADER_ICON[i.loader] ? <img src={LOADER_ICON[i.loader]} alt="" className="w-6 h-6 rounded-md" /> : <span className="w-6 h-6 rounded-md grid place-items-center" style={{ background: "rgba(160,190,255,.12)" }}><Icon n="cube" s={14} /></span>}
                <div className="min-w-0 flex-1"><div className="t2 font-semibold truncate">{i.name}</div><div className="t1 mute truncate"><Icon n="clock" s={10} className="inline -mt-0.5 mr-1" />{fmtTime(i.playtime)} · {i.last} · Java {i.java}</div></div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <button className="btn btn-primary !h-7 flex-1" onClick={() => setPlaying(playing === i.id ? null : i.id)}><Icon n={playing === i.id ? "stop" : "play"} s={12} />{playing === i.id ? "Stop" : "Play"}</button>
                <button className="ibtn" title="Edit" aria-label={`Edit ${i.name}`} onClick={() => go("library")}><Icon n="edit" s={14} /></button>
                <button className="ibtn" title="Clone" aria-label={`Clone ${i.name}`} onClick={() => clone(i)}><Icon n="copy" s={14} /></button>
                <button className="ibtn" title="Export" aria-label={`Export ${i.name}`} onClick={() => exportIt(i)}><Icon n="upload" s={14} /></button>
              </div>
            </div>
          </article>
        ))}
        <button onClick={() => go("onboarding/4")} className="lift rounded-[14px] grid place-items-center t2 mute" style={{ minHeight: 190, border: "1px dashed rgba(190,210,255,.3)" }} aria-label="Create a new instance"><span className="text-center"><Icon n="plus" s={20} className="mx-auto mb-1" />New instance<span className="block t1">Luminos Performance profile</span></span></button>
      </div>
    </div>
  );
}
