import { useEffect, useRef, useState } from "react";
import type { Boot } from "../App";
import { Badge, Cover, Icon, SkinThumb, fmtTime } from "../kit";
import { QUICK, news, PRESETS } from "../data/launcher";
import { set, useSettings } from "../store";
import { call, isTauri, onLaunch, SEED } from "../api";
import { Switch } from "../kit";

type Phase = "idle" | "prepare" | "start" | "run";
const LABEL: Record<Phase, string> = { idle: "Launch", prepare: "Preparing", start: "Starting", run: "Running" };
const STEP: Record<Phase, string> = { idle: "Ready", prepare: "Checking 31 mods against 26.3", start: "Opening the game window", run: "In game" };

export function LaunchButton({ inst, big = true }: { inst: string; big?: boolean }) {
  const demo = new URLSearchParams(location.search).get("demo");
  const [phase, setPhase] = useState<Phase>((demo as Phase) || "idle");
  const [p, setP] = useState(demo === "prepare" ? 0.46 : 0);
  const [sec, setSec] = useState(demo === "run" ? 42 : 0);
  const timer = useRef<number>(0);
  useEffect(() => { let un = () => {}; onLaunch((e) => { if (e?.state) setPhase(e.state); if (typeof e?.progress === "number") setP(e.progress); }).then((f) => (un = f)); return () => un(); }, []);
  useEffect(() => { if (phase !== "run") return; const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, [phase]);
  const start = async () => {
    if (phase === "run") { setPhase("idle"); setP(0); setSec(0); return; }
    if (phase !== "idle") return;
    setPhase("prepare"); setP(0);
    if (isTauri) { call("launch_instance", { id: inst }).catch(() => setPhase("idle")); return; }
    let v = 0; timer.current = window.setInterval(() => { v += 0.05; setP(Math.min(1, v)); if (v >= 0.6) setPhase("start"); if (v >= 1) { clearInterval(timer.current); setPhase("run"); } }, 120);
  };
  useEffect(() => () => clearInterval(timer.current), []);
  const run = phase === "run";
  return (
    <button onClick={start} aria-live="polite" className="relative overflow-hidden lift" style={{ height: big ? 44 : 32, minWidth: big ? 220 : 120, borderRadius: 12, padding: "0 18px", background: run ? "color-mix(in srgb, var(--color-ok) 16%, transparent)" : "var(--color-accent)", color: run ? "var(--color-ok)" : "var(--accent-ink)", border: run ? "1px solid color-mix(in srgb, var(--color-ok) 50%, transparent)" : "1px solid transparent", transition: "background 300ms, color 300ms, min-width 420ms var(--ease-spring)" }}>
      {(phase === "prepare" || phase === "start") && <span className="absolute inset-y-0 left-0" style={{ width: `${p * 100}%`, background: "color-mix(in srgb, var(--color-fg) 35%, transparent)", transition: "width 160ms linear" }} />}
      <span className="relative flex items-center justify-center gap-2 font-semibold t3">
        {phase === "idle" && <Icon n="play" s={16} />}
        {(phase === "prepare" || phase === "start") && <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--accent-ink)]/30 border-t-[var(--accent-ink)]" style={{ animation: "spin .8s linear infinite" }} />}
        {run && <Icon n="stop" s={14} />}
        {LABEL[phase]}{run && <span className="num t2 font-medium">{String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}</span>}
      </span>
      <span className="sr-only">{STEP[phase]}</span>
    </button>
  );
}

export default function Home({ boot, go }: { boot: Boot; go: (r: string) => void }) {
  const s = useSettings();
  const last = boot.instances[0];
  const recent = boot.instances.slice(0, 4);
  const [pre, setPre] = useState<string | null>(null);
  const applyPreset = (id: "pvp" | "survival") => { Object.entries(PRESETS[id].set).forEach(([k, v]) => set(k as any, v as any)); setPre(id); };
  return (
    <div className="flex flex-col gap-3 max-w-[1180px]">
      {/* hero */}
      <div className="panel overflow-hidden relative" style={{ height: 212 }}>
        <div className="absolute inset-0"><Cover version={last.mc} /></div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--inset) 90%, transparent) 0%, color-mix(in srgb, var(--inset) 62%, transparent) 48%, color-mix(in srgb, var(--inset) 10%, transparent) 100%)" }} />
        <div className="relative h-full p-5 flex flex-col justify-between">
          <div>
            <div className="eyebrow mb-1.5">Continue playing</div>
            <div className="flex items-center gap-2"><h1 className="t4 font-semibold m-0">{last.name} {last.mc}</h1><Badge tone="accent">{last.loader}</Badge><Badge>Java {last.java}</Badge></div>
            <div className="t2 mute mt-1">Luminos Performance · {s.renderer === "sodium" ? "Sodium" : s.renderer === "vulkanmod" ? "VulkanMod" : "Sodium + Nvidium"} · {last.mods} mods · {s.memoryMb / 1024} GB · played {fmtTime(last.playtime)}</div>
          </div>
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3"><LaunchButton inst={last.id} />
              <button className="btn" onClick={() => go("instances")}><Icon n="layers" s={14} />All instances</button>
              <button className="btn" onClick={() => go("settings")}><Icon n="gauge" s={14} />Performance</button></div>
            <div className="flex items-center gap-1.5 mr-1">
              <span className="t1 mute mr-1">One-click preset</span>
              {(["pvp", "survival"] as const).map((id) => <button key={id} className="chip" data-on={pre === id || (!pre && ((id === "pvp" && s.keystrokes === "A") || (id === "survival" && s.keystrokes === "B")))} onClick={() => applyPreset(id)} title={PRESETS[id].line}><Icon n={PRESETS[id].icon} s={12} />{PRESETS[id].name}</button>)}
            </div>
          </div>
        </div>
        <div className="absolute right-8 top-3 flex flex-col items-center"><SkinThumb src="/skins/luminos-default.png" scale={4} className="drop-shadow-[0_10px_16px_color-mix(in srgb, var(--inset) 50%, transparent)]" /></div>
      </div>

      {/* quick play */}
      <div className="grid grid-cols-3 gap-3 stagger">
        <button className="panel lift flex items-center gap-3 p-2.5 text-left" onClick={() => go("servers")}>
          <img src={QUICK.server.icon} alt="" className="w-10 h-10 rounded-lg skin-px" />
          <span className="min-w-0 flex-1"><span className="eyebrow block">Last server</span><span className="t2 font-medium block truncate">{QUICK.server.name}</span><span className="t1 mute block truncate num">{QUICK.server.online.toLocaleString()} online · {QUICK.server.ago}</span></span>
          <span className="ibtn"><Icon n="play" s={14} /></span>
        </button>
        <button className="panel lift flex items-center gap-3 p-2.5 text-left" onClick={() => go("instances")}>
          <span className="w-10 h-10 rounded-lg overflow-hidden shrink-0"><Cover version="26.3" /></span>
          <span className="min-w-0 flex-1"><span className="eyebrow block">Last world</span><span className="t2 font-medium block truncate">{QUICK.world.name}</span><span className="t1 mute block truncate">{QUICK.world.mode} · {QUICK.world.ago}</span></span>
          <span className="ibtn"><Icon n="play" s={14} /></span>
        </button>
        <button className="panel lift flex items-center gap-3 p-2.5 text-left" onClick={() => go("library")}>
          <span className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: "color-mix(in srgb, var(--color-accent) 16%, transparent)" }}><Icon n="bolt" s={18} className="text-[var(--color-accent)]" /></span>
          <span className="min-w-0 flex-1"><span className="eyebrow block">Last modpack</span><span className="t2 font-medium block truncate">{QUICK.pack.name}</span><span className="t1 mute block truncate">{QUICK.pack.detail}</span></span>
          <span className="ibtn"><Icon n="chev" s={14} /></span>
        </button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)" }}>
        <div>
          <div className="eyebrow mb-1.5 px-1">Recent instances</div>
          <div className="grid grid-cols-2 gap-3 stagger">
            {recent.map((i) => (
              <button key={i.id} className="panel lift flex items-stretch overflow-hidden text-left" onClick={() => go("instances")} style={{ height: 76 }}>
                <span className="w-[112px] shrink-0 relative"><Cover version={i.mc} /></span>
                <span className="min-w-0 flex-1 p-2.5 flex flex-col justify-between">
                  <span className="flex items-center gap-1.5"><span className="t2 font-semibold truncate">{i.name}</span></span>
                  <span className="flex items-center gap-1.5"><Badge>{i.mc}</Badge><Badge tone={i.loader === "Vanilla" ? "mute" : "accent"}>{i.loader}</Badge></span>
                  <span className="t1 mute flex items-center gap-1"><Icon n="clock" s={11} />{fmtTime(i.playtime)} · {i.last}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-1.5 px-1 flex justify-between"><span>News · Mojang patch notes</span></div>
          <div className="panel p-1.5">
            {news.slice(0, 5).map((n) => (
              <div key={n.version} className="lrow" title={n.text}>
                <Badge tone={n.type === "release" ? "ok" : "warn"}>{n.type === "release" ? "Release" : "Snapshot"}</Badge>
                <span className="t2 truncate flex-1">{n.title.replace("Minecraft ", "")}</span><span className="t1 mute num">{n.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)" }}>
        <div>
          <div className="eyebrow mb-1.5 px-1 flex justify-between"><span>Playtime · last 14 days</span><span className="num normal-case tracking-normal">{fmtTime(SEED.playtime.week)} this week · {SEED.playtime.streak}-day streak</span></div>
          <div className="panel p-3 flex items-end gap-1.5" style={{ height: 96 }}>
            {SEED.playtime.daily.map(([d, v], i) => <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${d}: ${fmtTime(v || 60)}`}><div className="w-full rounded-[3px]" style={{ height: `${Math.max(4, (v / 9800) * 100)}%`, background: i === 13 ? "var(--color-accent)" : "color-mix(in srgb, var(--color-accent) 38%, transparent)", minHeight: 3 }} /><span className="t1 mute">{d[0]}</span></div>)}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-1.5 px-1">Luminos Performance</div>
          <div className="panel p-1.5">
            <div className="lrow"><Icon n="cpu" s={14} /><span className="t2 flex-1">Renderer</span><Badge tone="accent">{s.renderer === "sodium" ? "Sodium" : s.renderer === "vulkanmod" ? "VulkanMod" : "Nvidium"}</Badge></div>
            <div className="lrow"><Icon n="layers" s={14} /><span className="t2 flex-1">HUD at {s.hudFps} fps</span><Switch label="Throttle HUD" on={s.hudThrottle} onChange={(v) => set("hudThrottle", v)} /></div>
            <div className="lrow"><Icon n="mouse" s={14} /><span className="t2 flex-1">Per-frame input</span><Switch label="Sample input every frame" on={s.inputSampling} onChange={(v) => set("inputSampling", v)} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
