import { useEffect, useState } from "react";
import { Badge, Icon, Tile, Segmented } from "../ui";
import { call, SEED } from "../api";
const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : (n / 1e3).toFixed(0) + "K");
export default function Mods({ mc, allowBeta }: { mc: string; allowBeta: boolean }) {
  const [q, setQ] = useState(""); const [kind, setKind] = useState("mod"); const [cat, setCat] = useState("All");
  const [hits, setHits] = useState<any[] | null>(null); const [done, setDone] = useState<Record<string, boolean>>({ sodium: true, lithium: true, entityculling: true, "ferrite-core": true });
  const [busy, setBusy] = useState("");
  useEffect(() => { setHits(null); const t = setTimeout(() => call("modrinth_search", { query: q, kind, limit: 24 }).then((r: any) => setHits(r?.hits || [])).catch(() => setHits([])), 220); return () => clearTimeout(t); }, [q, kind]);
  const cats = ["All", "Performance", "Visuals", "HUD", "Utility"];
  const list = (hits || []).map((h: any) => ({ ...(SEED.mods.find((m) => m.slug === h.slug) || {}), ...h, title: h.title || h.slug, author: h.author, desc: h.description || h.desc, cat: h.cat || (h.categories || [])[0] || "Utility" })).filter((m: any) => cat === "All" || m.cat === cat);
  const install = async (m: any) => { setBusy(m.slug); await new Promise((r) => setTimeout(r, 1100)); setDone((d) => ({ ...d, [m.slug]: true })); setBusy(""); };
  return (
    <div className="page-in h-full overflow-y-auto px-12 py-10 max-w-[1280px]">
      <div className="flex items-end justify-between mb-6"><div><div className="eyebrow">Modrinth</div><h1 className="display text-[56px] mt-1">Find <span className="accent-word">more</span></h1></div>
        <Badge tone="ok"><Icon n="shield" s={12} />Showing builds for Minecraft {mc} · {allowBeta ? "betas on" : "stable only"}</Badge></div>
      <div className="flex gap-3 items-center mb-4"><div className="relative flex-1"><Icon n="search" s={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" /><input className="field" style={{ paddingLeft: 44 }} placeholder="Search 90,000+ projects" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></div>
        <Segmented value={kind} onChange={setKind} options={[{ v: "mod", l: "Mods" }, { v: "shader", l: "Shaders" }, { v: "resourcepack", l: "Packs" }, { v: "datapack", l: "Data packs" }]} /></div>
      <div className="flex gap-2 mb-6">{cats.map((c) => <button key={c} className="chip" data-on={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
      {hits === null ? <div className="grid grid-cols-2 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[112px] rounded-[16px]" />)}</div> : list.length === 0 ? (
        <div className="panel p-10 text-center"><div className="display text-[30px]">Nothing for “{q}” on {mc}</div><p className="text-mute mt-2">Try a broader word, or switch the type above. Mods are only listed when they have a Fabric build for this version.</p></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 stagger">
          {list.map((m: any) => (
            <div key={m.slug} className="lift panel p-4 flex gap-4 items-start">
              {m.icon || m.icon_url ? <img src={m.icon || m.icon_url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-[14px] hair bg-ink-2" style={{ imageRendering: "auto" }} loading="lazy" /> : <Tile name={m.title} hue={m.hue ?? 210} size={56} />}
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-[15.5px] truncate">{m.title}</span>{m.builtin && <Badge tone="accent">Recommended</Badge>}</div>
                <div className="text-[12.5px] text-mute">by {m.author}</div><p className="text-[13px] text-fg/80 mt-1.5 leading-snug line-clamp-2">{m.desc}</p>
                <div className="flex items-center gap-2 mt-3"><Badge>{m.cat}</Badge><Badge><Icon n="download" s={11} />{fmt(m.downloads || 0)}</Badge>{m.beta ? <Badge tone="warn">Beta only</Badge> : <Badge tone="ok"><Icon n="check" s={11} />Stable {m.ver}</Badge>}</div></div>
              {done[m.slug] ? <Badge tone="ok"><Icon n="check" s={12} />Installed</Badge> : <button className="btn btn-ghost btn-sm" disabled={busy === m.slug || (m.beta && !allowBeta)} onClick={() => install(m)}>{busy === m.slug ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white" style={{ animation: "spin .8s linear infinite" }} /> : <Icon n="download" s={14} />}{m.beta && !allowBeta ? "Needs beta" : busy === m.slug ? "Checking…" : "Install"}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
