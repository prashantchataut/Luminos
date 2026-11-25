import { useEffect, useRef, useState } from "react";
import type { Boot } from "../App";
import { Icon, Modal, SkinThumb } from "../kit";
import { PRESETS, QUICK } from "../data/launcher";
import { set, useSettings } from "../store";
import { call, isTauri, onLaunch, SEED } from "../api";
import { engine, fmtBytes } from "../engine";
import { skinById, skinSrc, useLocker } from "../locker/catalog";

type Phase = "idle" | "prepare" | "start" | "run";
const LABEL: Record<Phase, string> = { idle: "Launch Game", prepare: "Verifying (Shard)…", start: "Starting…", run: "Running" };

export function LaunchBar({ inst, label, onLog }: { inst: string; label?: string; onLog: (l: string) => void }) {
  const demo = new URLSearchParams(location.search).get("demo");
  const [phase, setPhase] = useState<Phase>((demo as Phase) || "idle"), [p, setP] = useState(demo === "prepare" ? 0.46 : 0), timer = useRef(0);
  const log = (t: string) => onLog(`${new Date().toLocaleTimeString("en-GB")}  ${t}`);
  useEffect(() => { let un = () => {}; onLaunch((e) => { if (e?.state) { setPhase(e.state); log(`state → ${e.state}`); } if (typeof e?.progress === "number") setP(e.progress); }).then((f) => (un = f)); return () => un(); }, []);
  useEffect(() => () => clearInterval(timer.current), []);
  const click = () => {
    if (phase === "run") { onLog("__open__"); return; }
    if (phase !== "idle") return;
    setPhase("prepare"); setP(0); log(`verify assets for ${inst}`);
    if (isTauri) { call("launch_instance", { id: inst }).catch((e) => { setPhase("idle"); log(`launch failed: ${String(e)}`); }); return; }
    let v = 0; timer.current = window.setInterval(() => { v += 0.05; setP(Math.min(1, v)); if (v >= 0.6) setPhase("start"); if (v >= 1) { clearInterval(timer.current); setPhase("run"); log("browser preview: no JVM is started outside the app"); } }, 120);
  };
  return (
    <button className="launch" data-phase={phase} onClick={click} aria-live="polite">
      {(phase === "prepare" || phase === "start") && <span className="fill" style={{ width: `${p * 100}%` }} />}
      <span className="relative flex items-center justify-center gap-2">
        {phase === "idle" && <Icon n="play" s={16} />}
        {(phase === "prepare" || phase === "start") && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white" style={{ animation: "spin .8s linear infinite" }} />}
        {phase === "run" && <Icon n="terminal" s={15} />}
        {label && phase === "idle" ? label : LABEL[phase]}
      </span>
    </button>
  );
}

const HOST_ROWS: [string, string, string[]][] = [["Host to", "Visibility", ["Friends", "Invite link", "LAN only"]], ["Game Mode", "Mode", ["Survival", "Creative", "Adventure"]], ["Difficulty", "Difficulty", ["Peaceful", "Easy", "Normal", "Hard"]]];
function HostModal({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState<Record<string, string>>({ "Host to": "Invite link", "Game Mode": "Creative", Difficulty: "Normal" }), [cheats, setCheats] = useState(false), [relay, setRelay] = useState(true), [pack, setPack] = useState(false), [done, setDone] = useState(false);
  const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="flex items-center gap-4 min-h-[44px]"><div className="t2 w-[120px] shrink-0">{l}</div><div className="flex-1 flex justify-end">{children}</div></div>;
  const Chk = ({ l, on, f }: { l: string; on: boolean; f: (b: boolean) => void }) => <button role="checkbox" aria-checked={on} onClick={() => f(!on)} className="flex items-center justify-between gap-6 h-9 px-3 rounded-lg min-w-[220px] panel-2 t2"><span>{l}</span><span className="w-4 h-4 rounded grid place-items-center" style={{ background: on ? "var(--accent)" : "var(--line-strong)", color: "var(--accent-fg)" }}>{on && <Icon n="check" s={11} />}</span></button>;
  return (
    <Modal onClose={onClose} title="Configure world settings" w={500}>
      <p className="t1 mute mt-0 mb-3">Choose how this world is hosted for your friends.</p>
      {HOST_ROWS.map(([l, k, o]) => <Row key={l} l={l}><label className="flex items-center gap-2 h-9 px-3 rounded-lg min-w-[220px] panel-2"><span className="t1 mute">{k}</span><select aria-label={l} className="flex-1 bg-transparent t2 text-right outline-none" value={v[l]} onChange={(e) => setV({ ...v, [l]: e.target.value })}>{o.map((x) => <option key={x} style={{ background: "var(--surface)" }}>{x}</option>)}</select></label></Row>)}
      <Row l="Cheats"><Chk l="Allow Cheats" on={cheats} f={setCheats} /></Row><Row l="Private Relay"><Chk l="Private Relay" on={relay} f={setRelay} /></Row><Row l="Resource Pack"><Chk l="Share" on={pack} f={setPack} /></Row>
      <div className="t1 mute leading-snug mt-1">{relay ? "The relay carries encrypted traffic only. It does not see your account token." : "Players connect to you directly, so they can see your IP address."}</div>
      {done && <div role="status" className="t1 mt-2" style={{ color: "var(--warn)" }}>The hosting service is not deployed yet (docs/P2P.md). Your choices are saved; nothing was opened.</div>}
      <div className="flex gap-3 mt-4"><button className="btn flex-1" onClick={onClose}>Back</button><button className="btn btn-primary flex-1" onClick={() => { localStorage.setItem("luminos.host.v1", JSON.stringify({ ...v, cheats, relay, pack })); setDone(true); }}>Next</button></div>
    </Modal>
  );
}

export default function Home({ boot, go }: { boot: Boot; go: (r: string) => void }) {
  const s = useSettings();
  const [sel, setSel] = useState(boot.instances[0]?.id), [host, setHost] = useState(false), [logs, setLogs] = useState<string[]>([]), [showLog, setShowLog] = useState(false), [pre, setPre] = useState<"pvp" | "survival">(s.keystrokes === "B" ? "survival" : "pvp");
  const cur = boot.instances.find((i) => i.id === sel) || boot.instances[0];
  const applyPreset = (id: "pvp" | "survival") => { Object.entries(PRESETS[id].set).forEach(([k, v]) => set(k as any, v as any)); setPre(id); };
  const onLog = (l: string) => { if (l === "__open__") setShowLog(true); else setLogs((x) => [...x.slice(-199), l]); };
  const cards = [
    { k: "s", name: QUICK.server.name, sub: "Ready for launch", pill: `${QUICK.server.online.toLocaleString()} online`, ver: "1.21.11", img: QUICK.server.icon, art: { backgroundImage: "url(/art/hud-backdrop.jpg)", backgroundSize: "cover", backgroundPosition: "50% 60%" } },
    { k: "w", name: SEED.worlds[0].name, sub: "Ready for launch", pill: SEED.worlds[0].mode, ver: "26.3", art: { backgroundImage: "url(/art/hero-day.jpg)", backgroundSize: "240%", backgroundPosition: "18% 78%" } },
    { k: "w2", name: SEED.worlds[1].name, sub: "Ready for launch", pill: SEED.worlds[1].mode, ver: "26.3", art: { backgroundImage: "url(/art/hero-day.jpg)", backgroundSize: "240%", backgroundPosition: "92% 30%" } },
  ];
  return (
    <div className="px-8 pt-1 pb-8 mx-auto" style={{ maxWidth: 1080 }}>
      <section className="relative overflow-hidden" style={{ height: 300, borderRadius: 16 }} aria-label="Luminos Client">
        <div className="absolute inset-0 cover" style={{ backgroundImage: "url(/art/hero-day.jpg)", transform: "scale(1.02)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(11,13,18,0.92) 0%, rgba(11,13,18,0.4) 60%, transparent 100%), linear-gradient(0deg, rgba(11,13,18,.72) 0%, transparent 55%)" }} />
        <div className="absolute left-0 bottom-0 flex flex-col" style={{ padding: 32 }}>
          <div className="hero-eyebrow">{cur.loader} {cur.mc} <span aria-hidden>•</span> Shard engine ready</div>
          <h2 className="m-0 mt-2 font-bold text-white" style={{ fontSize: 32, letterSpacing: "-.02em", lineHeight: 1.1 }}>Luminos Client</h2>
          <p className="m-0 mt-1.5" style={{ fontSize: 13, color: "#9BA3B4" }}>High-frame-rate Fabric client with a built-in HUD studio and live Modrinth mods.</p>
          <div className="flex items-center gap-3" style={{ marginTop: 20 }}>
            <LaunchBar inst={cur.id} onLog={onLog} />
            <label className="hero-pill"><span className="sr-only">Version and preset</span>
              <select aria-label="Version and preset" value={cur.id + "|" + pre} onChange={(e) => { const [i, p] = e.target.value.split("|"); setSel(i); applyPreset(p as "pvp" | "survival"); }}>
                {boot.instances.flatMap((i) => (["pvp", "survival"] as const).map((p) => <option key={i.id + p} value={i.id + "|" + p} style={{ background: "#151922" }}>{i.mc} • {p === "pvp" ? "PvP" : "Survival"} Preset</option>))}
              </select><Icon n="chev" s={12} />
            </label>
            <button className="hero-pill" onClick={() => setHost(true)}><Icon n="globe" s={15} />Host World</button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }} aria-label="Quickplay">
        <div className="flex items-center mb-3.5"><h3 className="m-0 font-bold text-white" style={{ fontSize: 16 }}>Quickplay</h3><div className="flex-1" /><button className="flex items-center gap-1 font-medium" style={{ fontSize: 13, color: "#2B4BFF" }} onClick={() => go("servers")}>Explore Servers<Icon n="fwd" s={13} /></button></div>
        <div className="grid grid-cols-3 gap-4 stagger">
          {cards.map((c) => (
            <div key={c.k} className="qcard">
              <div className="relative" style={{ height: 130 }}>
                <div className="absolute inset-0" style={c.art} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(21,25,34,.55), transparent 55%)" }} />
                {c.img && <img src={c.img} alt="" className="absolute left-3 top-3 w-9 h-9 rounded-lg skin-px" />}
                <span className="absolute right-3 top-3 qpill">{c.pill}</span>
              </div>
              <div className="flex items-center gap-3 px-4" style={{ height: 48 }}>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold text-white" style={{ fontSize: 13 }}>{c.name}</div><div className="truncate" style={{ fontSize: 11, color: "#6E7787" }}>{c.sub}</div></div>
                <button className="qplay" aria-label={`Quickplay ${c.name}`} onClick={() => { setLogs((x) => [...x, `${new Date().toLocaleTimeString("en-GB")}  quickplay ${c.name}`]); if (isTauri) call("quickplay_launch", { target: c.name }).catch(() => undefined); }}><Icon n="play" s={12} /></button>
              </div>
            </div>))}
        </div>
      </section>
      {host && <HostModal onClose={() => setHost(false)} />}
      {showLog && <Modal onClose={() => setShowLog(false)} title="Live log" w={640}><p className="t1 mute m-0 mb-3">Launcher events for this session. Tokens and home-folder paths are removed before anything is shown.</p><pre className="panel-2 p-3 m-0 t1 num overflow-auto select-text" style={{ maxHeight: 280, fontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace' }}>{logs.length ? logs.join("\n") : "No events yet."}</pre><div className="flex justify-end mt-3"><button className="btn" onClick={() => setShowLog(false)}>Close</button></div></Modal>}
    </div>
  );
}
