import { useMemo, useRef, useState } from "react";
import type { Boot } from "../App";
import { Badge, Chip, Icon, SearchBox, fmtNum } from "../kit";
import { PICKS, authorOf, meta, type Pick } from "../data/launcher";

type St = "idle" | "installing" | "installed";
const CATS = ["All", "Renderer", "Logic", "Memory", "HUD", "Utility"] as const;
const EXTRA: Pick[] = ["appleskin", "zoomify", "modmenu", "controlify", "resourcify", "dynamic-fps", "betterf3", "mouse-tweaks", "sodium-extra"].filter((s) => meta[s]).map((slug) => ({ slug, cat: "Utility" as const, tested: "ref" as const, reason: meta[slug].desc, requires: slug === "sodium-extra" ? ["sodium"] : undefined }));

export default function Library({ boot }: { boot: Boot }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [state, setState] = useState<Record<string, St>>(() => Object.fromEntries(PICKS.filter((p) => p.installed).map((p) => [p.slug, "installed" as St])));
  const [upd, setUpd] = useState<Record<string, string | undefined>>(() => Object.fromEntries(PICKS.filter((p) => p.update).map((p) => [p.slug, p.update])));
  const [prog, setProg] = useState<Record<string, number>>({});
  const ref = useRef<HTMLInputElement>(null);
  const all = useMemo(() => [...PICKS, ...EXTRA], []);
  const shown = all.filter((p) => (cat === "All" || p.cat === cat) && (!q || (meta[p.slug]?.title + p.reason + authorOf[p.slug]).toLowerCase().includes(q.toLowerCase())));
  const installed = (s: string) => state[s] === "installed";
  const act = (p: Pick) => {
    if (state[p.slug] === "installing") return;
    if (installed(p.slug) && !upd[p.slug]) { setState((s) => ({ ...s, [p.slug]: "idle" })); return; }
    setState((s) => ({ ...s, [p.slug]: "installing" })); let v = 0;
    const t = setInterval(() => { v += 0.12; setProg((x) => ({ ...x, [p.slug]: Math.min(1, v) })); if (v >= 1) { clearInterval(t); setState((s) => ({ ...s, [p.slug]: "installed" })); setUpd((u) => ({ ...u, [p.slug]: undefined })); } }, 110);
  };
  const warnings = (p: Pick) => {
    const w: { tone: "warn" | "bad"; t: string }[] = [];
    (p.requires || []).filter((r) => !installed(r)).forEach((r) => w.push({ tone: "warn", t: `Needs ${meta[r]?.title || r}` }));
    (p.conflicts || []).filter((c) => installed(c)).forEach((c) => w.push({ tone: "bad", t: `Conflicts with ${meta[c]?.title || c}` }));
    return w;
  };
  return (
    <div className="max-w-[1180px]">
      <div className="flex items-center gap-2 mb-2.5">
        <SearchBox inputRef={ref} value={q} onChange={setQ} placeholder="Search mods, shaders, packs. Luminos Picks come first." autoFocus />
        <span className="badge">Minecraft {boot.instances[0]?.mc} · Fabric</span>
      </div>
      <div className="flex items-center gap-1.5 mb-3">{CATS.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}<div className="flex-1" /><span className="t1 mute">CI = in the default preset our smoke test launches · Ref = recommended from upstream docs, not run by us</span></div>
      <div className="eyebrow mb-1.5 px-1">{q ? `Results · ${shown.length}` : cat === "All" ? "Luminos Picks, then popular Modrinth mods" : cat}</div>
      <div className="grid grid-cols-2 gap-2.5 stagger">
        {shown.map((p) => {
          const m = meta[p.slug]; const w = warnings(p); const st = state[p.slug] || "idle"; const blocked = w.some((x) => x.tone === "bad");
          return (
            <article key={p.slug} className="panel lift flex items-center gap-3 p-2.5" style={{ borderRadius: 12 }}>
              <img src={m.icon} alt="" className="w-10 h-10 rounded-lg shrink-0" style={{ background: "var(--bg)" }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><span className="t2 font-semibold truncate">{m.title.replace(/ \(.*\)/, "").replace("Concurrent Chunk Management Engine", "C2ME")}</span>{PICKS.includes(p) && <Badge tone={p.tested === "ci" ? "ok" : "mute"}>{p.tested === "ci" ? "CI" : "Ref"}</Badge>}{w.map((x) => <Badge key={x.t} tone={x.tone}><Icon n="warn" s={10} />{x.t}</Badge>)}</div>
                <div className="t1 mute truncate">{p.reason}</div>
                <div className="t1 mute num mt-0.5 flex gap-2"><span>{authorOf[p.slug] || "Modrinth"}</span><span><Icon n="download" s={10} className="inline -mt-0.5" /> {fmtNum(m.downloads)}</span></div>
              </div>
              <button className={`btn ${st === "idle" || upd[p.slug] ? "btn-primary" : ""} !w-[92px] relative overflow-hidden`} disabled={blocked && st === "idle"} onClick={() => act(p)} aria-label={`${st === "installed" ? (upd[p.slug] ? "Update" : "Remove") : "Install"} ${m.title}`}>
                {st === "installing" && <span className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${(prog[p.slug] || 0) * 100}%` }} />}
                <span className="relative flex items-center gap-1">{st === "installing" ? "Installing" : st === "installed" ? (upd[p.slug] ? <><Icon n="rot" s={12} />Update</> : <><Icon n="check" s={12} />Installed</>) : <><Icon n="download" s={12} />Install</>}</span>
              </button>
            </article>
          );
        })}
      </div>
      {!shown.length && <div className="panel p-6 text-center t2 mute">No match for “{q}” in this list. Clear the search or pick another category.</div>}
    </div>
  );
}
