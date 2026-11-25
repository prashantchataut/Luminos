import { useEffect, useMemo, useState } from "react";
import type { Boot } from "../App";
import { engine, fmtBytes } from "../engine";
import { Icon } from "../kit";
import { MODS } from "../data/mods";
import { useMods } from "../modstore";
import Instances from "./Instances";
import Library from "./Library";

/** Profiles are plain JSON; the profile id is the SHA-256 of its canonical JSON, so two profiles with the same content have the same id. */
async function sha(text: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

function Profile({ boot }: { boot: Boot }) {
  const inst = boot.instances[0], st = useMods();
  const doc = useMemo(() => ({ schema: 1, name: inst.name, minecraft: inst.mc, loader: inst.loader.toLowerCase(), java: inst.java, mods: MODS.filter((m) => st.on[m.id]).map((m) => ({ id: m.id, source: m.src })) }), [inst, st.on]);
  const json = JSON.stringify(doc, null, 2), [id, setId] = useState("…"), [saved, setSaved] = useState<number | null>(null), [busy, setBusy] = useState(false), [res, setRes] = useState<string>("");
  useEffect(() => { sha(JSON.stringify(doc)).then(setId); }, [doc]);
  useEffect(() => { engine.dedupStatus().then((d) => setSaved(d.total_saved)).catch(() => undefined); }, []);
  const verify = async () => { setBusy(true); setRes(""); const t = performance.now(); try { const r = await engine.dedupRun(); setSaved(r.total_saved); setRes(`Checked in ${Math.round(performance.now() - t)} ms · ${r.report.newly_linked} newly linked, ${r.report.reflinked} reflinked, ${r.report.hardlinked} hardlinked`); } catch (e: any) { setRes(String(e?.message || e)); } finally { setBusy(false); } };
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
      <div className="panel p-4"><div className="flex items-center gap-2 mb-2"><div className="t3 font-semibold flex-1">{inst.name} {inst.mc}</div><span className="badge accent">{inst.loader}</span></div>
        <div className="eyebrow mb-1">Profile (plain JSON)</div><pre className="panel-2 p-3 m-0 t1 num overflow-auto select-text" style={{ maxHeight: 300, fontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace' }}>{json}</pre></div>
      <div className="grid gap-3 content-start">
        <div className="panel p-4"><div className="eyebrow mb-1">Profile id (SHA-256)</div><code className="t1 num break-all select-text">{id}</code><div className="t1 mute mt-2 leading-snug">Same content, same id. Mods live once in a shared library and each profile links to them.</div></div>
        <div className="panel p-4"><div className="flex items-center gap-2"><Icon n="verify" s={16} /><div className="t2 font-semibold flex-1">Shared library</div><span className="badge ok num">{saved === null ? "…" : `${fmtBytes(saved)} saved`}</span></div>
          <button className="btn btn-primary mt-3 w-full" onClick={verify} disabled={busy}>{busy ? "Verifying…" : "Verify and link"}</button>{res && <div role="status" className="t1 mute mt-2 leading-snug">{res}</div>}</div>
      </div>
    </div>
  );
}

export function InstancesPage({ boot, go, q, initial }: { boot: Boot; go: (r: string) => void; q: string; initial: "Profiles" | "Instances" | "Browse" }) {
  const [tab, setTab] = useState(initial);
  return (
    <div className="px-6">
      <div className="seg mb-4" role="tablist" aria-label="Instance views">{(["Profiles", "Instances", "Browse"] as const).map((t) => <button key={t} role="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>{t === "Browse" ? "Modrinth & CurseForge" : t}</button>)}</div>
      {tab === "Profiles" && <Profile boot={boot} />}
      {tab === "Instances" && <Instances boot={boot} go={go} />}
      {tab === "Browse" && <Library boot={boot} />}
      <span className="sr-only">{q}</span>
    </div>
  );
}
