import { useEffect, useRef, useState } from "react";
import type { Boot } from "../App";
import { Cover, Icon, Modal, SkinThumb } from "../kit";
import { PRESETS, QUICK } from "../data/launcher";
import { set, useSettings } from "../store";
import { call, isTauri, onLaunch, SEED } from "../api";
import { engine, fmtBytes } from "../engine";
import { skinById, skinSrc, useLocker } from "../locker/catalog";

type Phase = "idle" | "prepare" | "start" | "run";
const LABEL: Record<Phase, string> = { idle: "Ready to Launch", prepare: "Verifying Assets (Shard Engine)…", start: "Launching JVM…", run: "Running · view live log" };

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
  const s = useSettings(), locker = useLocker();
  const [sel, setSel] = useState(boot.instances[0]?.id), [host, setHost] = useState(false), [logs, setLogs] = useState<string[]>([]), [showLog, setShowLog] = useState(false), [saved, setSaved] = useState<number | null>(null), [pre, setPre] = useState<"pvp" | "survival">(s.keystrokes === "B" ? "survival" : "pvp");
  const cur = boot.instances.find((i) => i.id === sel) || boot.instances[0];
  useEffect(() => { engine.dedupStatus().then((d) => setSaved(d.total_saved)).catch(() => undefined); }, []);
  const applyPreset = (id: "pvp" | "survival") => { Object.entries(PRESETS[id].set).forEach(([k, v]) => set(k as any, v as any)); setPre(id); };
  const onLog = (l: string) => { if (l === "__open__") setShowLog(true); else setLogs((x) => [...x.slice(-199), l]); };
  const cards = [
    { k: "w", name: SEED.worlds[0].name, sub: SEED.worlds[0].played, badge: SEED.worlds[0].mode, ver: "26.3", icon: "cube" },
    { k: "s", name: QUICK.server.name, sub: `${QUICK.server.online.toLocaleString()} online · ${QUICK.server.ago}`, badge: "Server", ver: "1.21.11", icon: "globe", img: QUICK.server.icon },
    { k: "w2", name: SEED.worlds[1].name, sub: SEED.worlds[1].played, badge: SEED.worlds[1].mode, ver: "26.3", icon: "cube" },
  ];
  return (
    <div className="flex gap-4 px-6" style={{ height: "calc(100vh - 56px - 16px)" }}>
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="relative overflow-hidden shrink-0" style={{ height: "52%", minHeight: 270, borderRadius: 16 }}>
          <div className="absolute inset-0 cover" style={{ backgroundImage: `url(/art/${pre === "pvp" ? "hud-backdrop" : "hero-day"}.jpg)` }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(8,10,16,.88) 0%, rgba(8,10,16,.55) 46%, rgba(8,10,16,0) 80%)" }} />
          <div className="relative h-full p-7 flex flex-col justify-end gap-4" style={{ color: "#fff" }}>
            <div><div className="flex items-center gap-2 mb-2"><span className="badge accent">{pre === "pvp" ? "PvP Competitive" : "Survival Plus"}</span><span className="badge" style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}>{cur.loader} · Java {cur.java}</span></div>
              <h2 className="m-0 font-bold" style={{ fontSize: 30, letterSpacing: "-.02em", lineHeight: 1.1 }}>Luminos Client {cur.mc}</h2>
              <p className="t2 m-0 mt-1.5" style={{ color: "rgba(255,255,255,.78)" }}>{cur.mods} mods · {s.memoryMb / 1024} GB · {s.renderer === "sodium" ? "Sodium" : s.renderer === "vulkanmod" ? "VulkanMod" : "Sodium + Nvidium"}</p></div>
            <div className="flex items-center gap-3 flex-wrap">
              <LaunchBar inst={cur.id} onLog={onLog} />
              <label className="flex items-center gap-2 h-11 px-3.5 rounded-[10px]" style={{ background: "rgba(8,10,16,.72)" }}><span className="sr-only">Version and loader</span><select aria-label="Version and loader" className="bg-transparent t2 font-medium outline-none cursor-pointer" value={cur.id} onChange={(e) => setSel(e.target.value)}>{boot.instances.map((i) => <option key={i.id} value={i.id} style={{ background: "#151922", color: "#fff" }}>{i.loader} {i.mc}</option>)}</select><Icon n="chev" s={12} /></label>
              <div className="seg ml-auto" role="group" aria-label="Preset" style={{ background: "rgba(8,10,16,.72)" }}>{(["pvp", "survival"] as const).map((id) => <button key={id} aria-pressed={pre === id} onClick={() => applyPreset(id)}>{id === "pvp" ? "PvP" : "Survival"}</button>)}</div>
            </div>
          </div>
        </div>
        <section className="flex-1 min-h-0 flex flex-col" aria-label="Resume and Quickplay">
          <div className="flex items-center mb-2"><h3 className="t3 font-semibold m-0">Resume & Quickplay</h3><span className="badge ml-2 num">{cards.length}</span><div className="flex-1" /><button className="t2 flex items-center gap-1" style={{ color: "var(--accent-text)" }} onClick={() => go("servers")}>Explore all<Icon n="fwd" s={13} /></button></div>
          <div className="grid grid-cols-3 gap-3 stagger items-start">
            {cards.map((c) => (
              <div key={c.k} className="panel overflow-hidden flex flex-col min-h-0">
                <div className="relative h-[116px]"><Cover version={c.ver} /><span className="absolute left-2 top-2 badge" style={{ background: "rgba(8,10,16,.8)", color: "#fff" }}>{c.badge}</span>{c.img && <img src={c.img} alt="" className="absolute right-2 top-2 w-8 h-8 rounded-md skin-px" />}</div>
                <div className="flex items-center gap-2 p-3"><div className="min-w-0 flex-1"><div className="t2 font-semibold truncate">{c.name}</div><div className="t1 mute truncate num">{c.sub}</div></div>
                  <button className="ibtn" style={{ background: "var(--accent)", color: "var(--accent-fg)" }} aria-label={`Quickplay ${c.name}`} onClick={() => { setLogs((x) => [...x, `${new Date().toLocaleTimeString("en-GB")}  quickplay ${c.name}`]); if (isTauri) call("quickplay_launch", { target: c.name }).catch(() => undefined); }}><Icon n="play" s={13} /></button></div>
              </div>))}
          </div>
        </section>
      </div>
      <aside className="w-[240px] shrink-0 flex flex-col gap-3" aria-label="Player">
        <div className="panel flex flex-col items-center pt-5 pb-4"><SkinThumb src={skinSrc(skinById(locker.skin))} scale={7} /><div className="t3 font-semibold mt-3">{boot.account.username || "Player"}</div><div className="t1 mute">{skinById(locker.skin).name}</div></div>
        <button className="btn btn-lg w-full justify-start" onClick={() => setHost(true)}><Icon n="globe" s={16} />Host World</button>
        <button className="btn btn-lg w-full justify-start" onClick={() => go("cosmetics")}><Icon n="shirt" s={16} />Switch Skin</button>
        <button className="btn btn-lg w-full justify-start" onClick={() => go("profiles")}><Icon n="profile" s={16} />Switch Preset</button>
        <div className="flex-1" />
        <div className="panel p-3 flex items-center gap-2.5"><Icon n="verify" s={18} /><div className="min-w-0"><div className="t2 font-semibold">Storage saved</div><div className="t1 mute num">{saved === null ? "Measuring…" : `Dedup: ${fmtBytes(saved)} saved`}</div></div></div>
      </aside>
      {host && <HostModal onClose={() => setHost(false)} />}
      {showLog && <Modal onClose={() => setShowLog(false)} title="Live log" w={640}><p className="t1 mute m-0 mb-3">Launcher events for this session. Tokens and home-folder paths are removed before anything is shown.</p><pre className="panel-2 p-3 m-0 t1 num overflow-auto select-text" style={{ maxHeight: 280, fontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace' }}>{logs.length ? logs.join("\n") : "No events yet."}</pre><div className="flex justify-end mt-3"><button className="btn" onClick={() => setShowLog(false)}>Close</button></div></Modal>}
    </div>
  );
}
