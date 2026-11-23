import { useEffect, useState } from "react";
import { Badge, Cover, Icon, Modal } from "../ui";
import { SEED, onLaunch, call, AuditReport, Inst, isTauri } from "../api";

const fmtH = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);

type Phase = "idle" | "preparing" | "launching" | "running" | "failed";
export function LaunchButton({ inst, onAudit, demo }: { inst: Inst; onAudit: (r: AuditReport) => void; demo?: string }) {
  const [phase, setPhase] = useState<Phase>((demo as Phase) || "idle");
  const [stage, setStage] = useState("Resolving Minecraft…");
  const [frac, setFrac] = useState(demo === "preparing" ? 0.62 : 0);
  const [err, setErr] = useState("");
  useEffect(() => {
    let off = () => {};
    onLaunch((e) => {
      if (e.id !== inst.id) return;
      if (e.phase === "preparing") { setPhase("preparing"); setStage(e.stage); setFrac(e.fraction); }
      else if (e.phase === "launching") { setPhase("launching"); if (e.mods) onAudit(e.mods); }
      else if (e.phase === "running") setPhase("running");
      else if (e.phase === "failed") { setPhase("failed"); setErr(e.error); }
      else if (e.phase === "exited") setPhase("idle");
    }).then((u) => (off = u));
    return () => off();
  }, [inst.id]);
  const go = async () => {
    if (phase !== "idle" && phase !== "failed") return;
    setErr(""); setPhase("preparing");
    if (isTauri) { try { await call("launch_instance", { id: inst.id }); } catch (e: any) { setPhase("failed"); setErr(String(e)); } return; }
    const steps: [string, number][] = [["Resolving Minecraft " + inst.mc + "…", 0.12], ["Downloading game files (212)…", 0.5], ["Checking 31 mods against " + inst.mc + "…", 0.82]];
    for (const [s, f] of steps) { setStage(s); setFrac(f); await new Promise((r) => setTimeout(r, 900)); }
    setPhase("launching"); onAudit(SEED.audit);
    await new Promise((r) => setTimeout(r, 1200)); setPhase("running");
    await new Promise((r) => setTimeout(r, 4000)); setPhase("idle");
  };
  const label = { idle: "Play", preparing: "Getting ready", launching: "Starting Minecraft", running: "Playing", failed: "Try again" }[phase];
  const width = { idle: 188, preparing: 320, launching: 320, running: 232, failed: 188 }[phase];
  const busy = phase === "preparing" || phase === "launching";
  return (
    <div>
      <button onClick={go} className="relative h-14 rounded-full overflow-hidden font-semibold text-[16px] text-left" aria-live="polite"
        style={{ width, background: phase === "running" ? "rgba(127,224,176,.16)" : phase === "failed" ? "rgba(255,141,154,.16)" : "#f4f7ff", color: phase === "running" ? "var(--color-ok)" : phase === "failed" ? "var(--color-bad)" : "#06112e", border: phase === "running" ? "1px solid rgba(127,224,176,.5)" : phase === "failed" ? "1px solid rgba(255,141,154,.5)" : "1px solid transparent", boxShadow: phase === "idle" ? "0 14px 50px -10px rgba(130,175,255,.75)" : "none", transition: "width var(--dur-slow) var(--ease-out-expo), background var(--dur-base), color var(--dur-base), box-shadow var(--dur-base)" }}>
        <span className="absolute inset-y-0 left-0" style={{ width: `${busy ? Math.max(6, frac * 100) : 0}%`, background: "linear-gradient(90deg, rgba(143,180,255,.55), rgba(143,180,255,.9))", transition: "width 400ms var(--ease-soft)" }} />
        <span className="relative h-full flex items-center justify-center gap-2.5 px-6">
          {phase === "idle" && <Icon n="play" s={18} />}
          {busy && <span className="h-4 w-4 rounded-full border-2 border-[#06112e]/30 border-t-[#06112e]" style={{ animation: "spin .8s linear infinite" }} />}
          {phase === "running" && <span className="h-2.5 w-2.5 rounded-full bg-ok" style={{ animation: "pulse-ring 1.6s infinite" }} />}
          {phase === "failed" && <Icon n="rot" s={18} />}
          <span key={label} style={{ animation: "fade var(--dur-base) both" }}>{label}</span>
        </span>
      </button>
      <div className="h-5 mt-2 text-[12.5px] text-mute pl-1" style={{ minHeight: 20 }}>
        {busy ? <span className="rise">{stage}</span> : phase === "failed" ? <span className="text-bad rise">{err.slice(0, 90)}</span> : phase === "running" ? <span className="rise">Minecraft {inst.mc} is running</span> : <span>Last played {inst.last.toLowerCase()}</span>}
      </div>
    </div>
  );
}

export function AuditModal({ r, onClose }: { r: AuditReport; onClose: () => void }) {
  return (
    <Modal onClose={onClose} w={600}>
      <div className="flex items-start justify-between"><div><div className="eyebrow">Mod check</div><h3 className="display text-[34px] mt-1">Every mod fits <span className="accent-word">this version</span></h3></div><button className="btn btn-ghost btn-sm" onClick={onClose}><Icon n="x" s={14} /></button></div>
      <p className="text-mute mt-2 text-[13.5px] leading-relaxed">Before each launch Luminos reads every jar's <code className="text-fg">fabric.mod.json</code>, checks it against this Minecraft, Fabric and Java, and keeps a set Fabric will accept. Stable builds only unless you opt in.</p>
      <div className="mt-5 grid gap-2.5">
        <div className="flex items-center gap-3 p-3 rounded-xl hair"><Badge tone="ok"><Icon n="check" s={12} />{r.checked} checked</Badge><span className="text-[13px] text-mute">Fabric will load all of them.</span></div>
        {r.replaced.map((x) => <div key={x} className="flex gap-3 p-3 rounded-xl hair items-start"><Badge tone="accent"><Icon n="rot" s={12} />Swapped</Badge><span className="text-[13px]">{x}</span></div>)}
        {r.dropped.map((x) => <div key={x.name} className="flex gap-3 p-3 rounded-xl hair items-start"><Badge tone="warn"><Icon n="alert" s={12} />Dropped</Badge><span className="text-[13px]"><b className="font-semibold">{x.name}</b> <span className="text-mute">{x.reason}</span></span></div>)}
        {r.notes.map((x) => <div key={x} className="text-[12.5px] text-mute px-1">{x}</div>)}
      </div>
    </Modal>
  );
}

export default function Home({ insts, sel, setSel, nav, demo }: { insts: Inst[]; sel: string; setSel: (id: string) => void; nav: (r: string) => void; demo?: string }) {
  const cur = insts.find((i) => i.id === sel) || insts[0];
  const [audit, setAudit] = useState<AuditReport | null>(demo === "audit" ? SEED.audit : null);
  const [last, setLast] = useState<AuditReport | null>(SEED.audit);
  const days = SEED.playtime.daily; const maxD = Math.max(...days.map((d) => d[1]));
  return (
    <div className="page-in h-full overflow-y-auto">
      <section className="relative h-[344px] overflow-hidden">
        <div className="absolute inset-0 zoom" key={cur.mc} style={{ animation: "fade var(--dur-slow) both" }}><Cover version={cur.mc} /></div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,10,31,.25) 0%, rgba(5,10,31,.1) 35%, rgba(5,10,31,.92) 92%, #050a1f 100%), linear-gradient(90deg, rgba(5,10,31,.72) 0%, transparent 62%)" }} />
        <div className="relative h-full flex flex-col justify-end px-12 pb-10 max-w-[1280px]">
          <div className="flex items-center gap-2 mb-4 rise"><Badge tone="accent"><Icon n="bolt" s={12} />Luminos Client</Badge><Badge>{cur.loader}</Badge><Badge>Java {cur.java}</Badge>{cur.mods ? <button onClick={() => setAudit(last)} className="contents"><Badge tone="ok"><Icon n="shield" s={12} />{cur.mods} mods checked</Badge></button> : null}</div>
          <h1 className="display text-[84px] rise" style={{ animationDelay: "60ms" }}>Minecraft <span className="accent-word">{cur.mc}</span></h1>
          <div className="mt-6 flex items-end gap-4 rise" style={{ animationDelay: "120ms" }}>
            <LaunchButton inst={cur} onAudit={(r) => { setLast(r); setAudit(r); }} demo={demo} />
            <button className="btn btn-ghost mb-7" onClick={() => nav("client")}><Icon n="sliders" s={16} />Client</button>
            <button className="btn btn-ghost mb-7" onClick={() => nav("instances")}><Icon n="layers" s={16} />All instances</button>
          </div>
        </div>
      </section>

      <div className="px-12 pb-12 pt-3 max-w-[1280px]">
        <div className="flex items-center justify-between mb-3"><span className="eyebrow">Your versions</span><span className="text-[12.5px] text-mute">{insts.length} instances</span></div>
        <div className="grid grid-cols-5 gap-4 stagger">
          {insts.map((i) => (
            <button key={i.id} onClick={() => setSel(i.id)} className="lift zoom relative h-[132px] rounded-[16px] overflow-hidden text-left" style={{ outline: i.id === cur.id ? "2px solid var(--color-accent)" : "1px solid var(--color-line)", outlineOffset: i.id === cur.id ? 2 : -1 }} aria-pressed={i.id === cur.id}>
              <div className="absolute inset-0" style={{ opacity: i.id === cur.id ? 1 : 0.62, transition: "opacity var(--dur-base)" }}><Cover version={i.mc} /></div>
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 35%, rgba(5,10,31,.88))" }} />
              <div className="absolute left-3.5 bottom-3 right-3"><div className="font-semibold text-[15px] truncate">{i.name}</div><div className="text-[12px] text-fg/70 num">{i.mc} · {i.loader}</div></div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1.35fr_1fr] gap-5 mt-9">
          <div>
            <div className="flex items-center justify-between mb-3"><span className="eyebrow">Recent worlds</span><span className="text-[12.5px] text-mute">Jump back in</span></div>
            <div className="grid gap-3 stagger">
              {SEED.worlds.map((w) => (
                <div key={w.name} className="lift panel p-3 pr-5 flex items-center gap-4 cursor-pointer">
                  <div className="h-[64px] w-[104px] rounded-[10px] overflow-hidden shrink-0"><Cover version={w.inst === "26.3" ? (w.seed > 5 ? "26.2" : "26.3") : "1.21.11"} /></div>
                  <div className="min-w-0 flex-1"><div className="font-semibold text-[15px] truncate">{w.name}</div><div className="text-[12.5px] text-mute mt-0.5">{w.mode} · Minecraft {w.inst}</div></div>
                  <div className="text-[12.5px] text-mute num">{w.played}</div>
                  <span className="btn btn-ghost btn-sm"><Icon n="play" s={12} />Play</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3"><span className="eyebrow">Playtime</span><span className="text-[12.5px] text-mute">Last 14 days</span></div>
            <div className="panel p-5">
              <div className="flex items-end justify-between">
                <div><div className="display text-[54px] num">{fmtH(SEED.playtime.week)}</div><div className="text-[12.5px] text-mute -mt-1">this week · {fmtH(SEED.playtime.total)} all time</div></div>
                <Badge tone="warn"><Icon n="spark" s={12} />{SEED.playtime.streak}-day streak</Badge>
              </div>
              <div className="flex items-end gap-1.5 h-[88px] mt-5">
                {days.map((d, k) => <div key={k} className="flex-1 rounded-[5px]" title={fmtH(d[1])} style={{ height: Math.max(4, (d[1] / maxD) * 100) + "%", background: d[1] ? "linear-gradient(180deg,#8fb4ff,#3b6cf0)" : "rgba(160,190,255,.1)", opacity: 0.55 + (k / 13) * 0.45, animation: `rise var(--dur-slow) var(--ease-out-expo) ${k * 30}ms both` }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {audit && <AuditModal r={audit} onClose={() => setAudit(null)} />}
    </div>
  );
}
