import { Badge, Icon, Tile } from "../ui";
import { SEED } from "../api";
export default function Servers({ account }: { account: any }) {
  const offline = account?.kind === "Offline";
  return (
    <div className="page-in h-full overflow-y-auto px-12 py-10 max-w-[1100px]">
      <div className="mb-7"><div className="eyebrow">Multiplayer</div><h1 className="display text-[56px] mt-1">Where to <span className="accent-word">play</span></h1><p className="text-mute mt-2 max-w-[60ch]">Pinged just now. We say plainly which servers an offline name can join, so you never find out at the join screen.</p></div>
      <div className="grid gap-3 stagger">
        {[...SEED.servers].sort((a, b) => Number(!!b.fav) - Number(!!a.fav)).map((s) => {
          const can = !offline || s.offline_ok;
          return (
            <div key={s.address} className="lift panel p-4 flex items-center gap-4">
              <Tile name={s.name} hue={(s.name.length * 37) % 360} size={52} />
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-[15.5px]">{s.name}</span>{s.fav && <Icon n="heart" s={14} className="text-bad" />}</div><div className="text-[12.5px] text-mute">{s.address} · {s.ver}</div><div className="flex gap-1.5 mt-2">{s.tags.map((t) => <Badge key={t}>{t}</Badge>)}{s.offline_ok ? <Badge tone="ok"><Icon n="check" s={11} />Offline names welcome</Badge> : <Badge tone="warn"><Icon n="lock" s={11} />Premium accounts only</Badge>}</div></div>
              <div className="text-right w-28"><div className="num font-semibold">{s.online}<span className="text-mute font-normal"> / {s.max}</span></div><div className="h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(s.online / s.max) * 100}%`, background: "linear-gradient(90deg,#3b6cf0,#8fb4ff)" }} /></div></div>
              <div className="w-20 flex items-center gap-1.5 text-[12.5px] num text-mute"><Icon n="wifi" s={14} className={s.ping < 50 ? "text-ok" : "text-warn"} />{s.ping} ms</div>
              <button className={`btn btn-sm ${can ? "btn-primary" : "btn-ghost"}`} disabled={!can} title={can ? "" : "This server checks Mojang accounts. An offline name cannot join."}>{can ? "Join" : "Can't join"}</button>
            </div>);
        })}
      </div>
    </div>
  );
}
