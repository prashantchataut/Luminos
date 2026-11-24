import { useEffect, useState } from "react";
import { Badge, Chip, Icon, SearchBox, fmtNum } from "../kit";
import { servers as cache } from "../data/launcher";
import { call, isTauri } from "../api";

type Srv = (typeof cache.servers)[number] & { ping?: number; fav?: boolean };

export default function Servers() {
  const [list, setList] = useState<Srv[]>(() => cache.servers.map((s, i) => ({ ...s, fav: i < 2 })));
  const [q, setQ] = useState(""); const [tag, setTag] = useState("All"); const [favOnly, setFavOnly] = useState(false);
  const [busy, setBusy] = useState(false); const [stamp, setStamp] = useState(`snapshot ${cache.fetchedAt.slice(0, 10)}`);
  const [joined, setJoined] = useState<string | null>(null);
  const [add, setAdd] = useState(""); const [err, setErr] = useState("");
  const tags = ["All", ...Array.from(new Set(list.flatMap((s) => s.tags)))];
  useEffect(() => { if (isTauri) call("servers_list").then((r: any) => { if (Array.isArray(r)) setList((l) => l.map((s) => ({ ...s, ping: r.find((x: any) => x.address === s.address)?.ping }))); }).catch(() => {}); }, []);
  const lookup = async (host: string) => {
    const d = await (await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`)).json();
    if (!d.online) throw new Error("offline");
    return { online: d.players.online, max: d.players.max, icon: d.icon || "", motd: (d.motd?.clean || []).slice(0, 2).map((x: string) => x.trim()), version: d.version || d.protocol?.name || "" };
  };
  const refresh = async () => {
    setBusy(true); setErr("");
    try { for (const s of list) { const u = await lookup(s.address).catch(() => null); if (u) setList((l) => l.map((x) => (x.address === s.address ? { ...x, ...u, icon: u.icon || x.icon } : x))); await new Promise((r) => setTimeout(r, 900)); } setStamp(`live ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`); }
    finally { setBusy(false); }
  };
  const addServer = async () => {
    const host = add.trim().toLowerCase(); if (!/^[a-z0-9.-]+(:\d+)?$/.test(host)) { setErr("Enter a host like play.example.net"); return; }
    setBusy(true); setErr("");
    try { const u = await lookup(host); setList((l) => [{ name: host.split(".").slice(-2, -1)[0] || host, address: host, tags: ["Custom"], ...u } as Srv, ...l]); setAdd(""); } catch { setErr(`${host} did not answer a status ping.`); }
    setBusy(false);
  };
  const shown = list.filter((s) => (tag === "All" || s.tags.includes(tag)) && (!favOnly || s.fav) && (!q || (s.name + s.address + s.motd.join(" ")).toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="max-w-[1180px]">
      <div className="flex items-center gap-2 mb-2.5"><SearchBox value={q} onChange={setQ} placeholder="Search servers" />
        <button className="btn" onClick={refresh} disabled={busy}><Icon n="rot" s={13} />{busy ? "Pinging…" : "Refresh"}</button>
        <div className="flex gap-1.5"><input className="field !pl-2.5 !w-[190px]" placeholder="Add server address" value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Add server address" onKeyDown={(e) => e.key === "Enter" && addServer()} /><button className="btn btn-primary" onClick={addServer} disabled={busy || !add}><Icon n="plus" s={13} />Add</button></div>
      </div>
      <div className="flex items-center gap-1.5 mb-3">{tags.map((t) => <Chip key={t} on={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}<Chip on={favOnly} onClick={() => setFavOnly(!favOnly)} icon="star">Favourites</Chip><div className="flex-1" /><span className="t1 mute">Status from api.mcsrvstat.us · {stamp}{err && <span style={{ color: "var(--color-bad)" }}> · {err}</span>}</span></div>
      <div className="flex flex-col gap-2 stagger">
        {shown.map((s) => (
          <article key={s.address} className="panel lift flex items-center gap-3 p-2.5" style={{ borderRadius: 12 }}>
            {s.icon ? <img src={s.icon} alt="" className="w-11 h-11 rounded-lg skin-px shrink-0" /> : <span className="w-11 h-11 rounded-lg grid place-items-center shrink-0" style={{ background: "rgba(160,190,255,.12)" }}><Icon n="globe" s={18} /></span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="t3 font-semibold truncate">{s.name}</span>{s.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
              <div className="t1 mute truncate">{s.motd[0] || s.address}</div>
              <div className="t1 mute truncate num">{s.address} · {s.version.length > 34 ? s.version.slice(0, 34) + "…" : s.version}</div>
            </div>
            <div className="w-[170px]"><div className="flex justify-between t1 num mb-1"><span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />{s.online.toLocaleString()} online</span><span className="mute">/ {fmtNum(s.max)}</span></div><div className="h-1 rounded bg-white/10 overflow-hidden"><div className="h-full rounded bg-[var(--color-accent)]" style={{ width: `${Math.max(3, Math.min(100, (s.online / s.max) * 100))}%` }} /></div>{s.ping !== undefined && <div className="t1 mute num mt-1">{s.ping} ms</div>}</div>
            <button className="ibtn" aria-label={`${s.fav ? "Unfavourite" : "Favourite"} ${s.name}`} aria-pressed={!!s.fav} onClick={() => setList((l) => l.map((x) => (x.address === s.address ? { ...x, fav: !x.fav } : x)))} style={{ color: s.fav ? "var(--color-warn)" : undefined }}><Icon n="star" s={15} /></button>
            <button className="btn btn-primary !w-[96px]" onClick={() => setJoined(s.address)}>{joined === s.address ? <><Icon n="check" s={12} />Queued</> : <><Icon n="play" s={12} />Quick join</>}</button>
          </article>
        ))}
      </div>
    </div>
  );
}
