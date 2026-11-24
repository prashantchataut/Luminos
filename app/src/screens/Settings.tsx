import { useEffect, useMemo, useRef, useState } from "react";
import type { Boot } from "../App";
import { Badge, Icon, LRow, SearchBox, Slider, Switch } from "../kit";
import { set, useSettings, type Settings } from "../store";
import { ClickProbe, parseGpu, recommend, whyLow, type Facts } from "../perf";
import { meta } from "../data/launcher";

type Ctl = { t: "sw"; k: keyof Settings } | { t: "rng"; k: keyof Settings; min: number; max: number; step?: number; fmt?: (v: number) => string } | { t: "seg"; k: keyof Settings; o: [string, string][] };
type Row = { g: string; icon: string; name: string; desc: string; c: Ctl };
const ROWS: Row[] = [
  { g: "General", icon: "play", name: "Close launcher on game start", desc: "Frees memory while you play; reopens when the game exits.", c: { t: "sw", k: "closeOnLaunch" } },
  { g: "General", icon: "download", name: "Check for updates", desc: "Looks for a new launcher or client release on start.", c: { t: "sw", k: "checkUpdates" } },
  { g: "General", icon: "puzzle", name: "Allow beta mods", desc: "Lets the solver pick beta builds when no stable one exists.", c: { t: "sw", k: "allowBeta" } },
  { g: "General", icon: "shirt", name: "Offline skin preview", desc: "Shows your chosen skin to you, in the launcher and in game.", c: { t: "sw", k: "offlineSkins" } },
  { g: "Appearance", icon: "eye", name: "Theme", desc: "Clean, Lunar or Light. Changes colours only.", c: { t: "seg", k: "theme", o: [["clean", "Clean"], ["lunar", "Lunar"], ["light", "Light"]] } },
  { g: "Appearance", icon: "box", name: "Classic client", desc: "Hides pets, wings and emotes for you. Others still see them.", c: { t: "sw", k: "classicClient" } },
  { g: "Appearance", icon: "bolt", name: "Reduce motion", desc: "Removes springs and slides.", c: { t: "sw", k: "reduceMotion" } },
  { g: "Appearance", icon: "layers", name: "Compact rows", desc: "32 px rows instead of 40 px.", c: { t: "sw", k: "compact" } },
  { g: "Performance", icon: "cpu", name: "Profile", desc: "Luminos Performance is the default; Sodium-only is the baseline.", c: { t: "seg", k: "profile", o: [["luminos-performance", "Luminos"], ["sodium-baseline", "Sodium only"], ["vanilla", "Vanilla"]] } },
  { g: "Performance", icon: "layers", name: "Throttle HUD and GUI", desc: "Draws the HUD at a lower fixed rate so the world gets the frames.", c: { t: "sw", k: "hudThrottle" } },
  { g: "Performance", icon: "gauge", name: "HUD frame rate", desc: "Exordium-style cap for HUD elements.", c: { t: "rng", k: "hudFps", min: 10, max: 120, step: 5, fmt: (v) => v + " fps" } },
  { g: "Performance", icon: "mouse", name: "Sample input every frame", desc: "Reads clicks and keys at frame rate instead of 20 TPS.", c: { t: "sw", k: "inputSampling" } },
  { g: "Performance", icon: "bolt", name: "Startup cache", desc: "Caches transformed mixins and mod metadata between launches.", c: { t: "sw", k: "startupCache" } },
  { g: "Java & memory", icon: "cpu", name: "Allocated memory", desc: "Too much starves the OS; 4 GB suits most mod lists.", c: { t: "rng", k: "memoryMb", min: 1024, max: 16384, step: 512, fmt: (v) => (v / 1024).toFixed(1) + " GB" } },
  { g: "Developer", icon: "terminal", name: "Startup profiler", desc: "Shows where the launcher's own start time goes.", c: { t: "sw", k: "devProfiler" } },
];
const GROUPS = ["General", "Appearance", "Performance", "Java & memory", "Accounts", "Developer"];
const GIC: Record<string, string> = { General: "gear", Appearance: "eye", Performance: "gauge", "Java & memory": "cpu", Accounts: "user", Developer: "terminal" };

function readGpu(): string {
  try { const c = document.createElement("canvas"); const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null; const e = gl?.getExtension("WEBGL_debug_renderer_info"); return gl && e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : "Unknown GPU"; } catch { return "Unknown GPU"; }
}
function useFrameMs() {
  const [ms, setMs] = useState(0);
  useEffect(() => { let n = 0, t0 = performance.now(), raf = 0; const f = () => { n++; if (n === 60) { setMs((performance.now() - t0) / 60); return; } raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, []);
  return ms;
}
const SIM: [string, string][] = [["", "This machine"], ["NVIDIA GeForce RTX 4070", "GeForce RTX 4070"], ["Intel(R) UHD Graphics 770", "Intel UHD 770"], ["AMD Radeon RX 6600", "Radeon RX 6600"], ["NVIDIA GeForce GTX 1060", "GeForce GTX 1060"]];

function Diagnostic({ boot }: { boot: Boot }) {
  const s = useSettings(); const real = useMemo(readGpu, []); const [sim, setSim] = useState(""); const frame = useFrameMs();
  const inst = boot.instances[0];
  const nav: any = navigator;
  const f: Facts = { gpu: parseGpu(sim || real), ramGb: nav.deviceMemory || 0, cores: nav.hardwareConcurrency || 0, mods: inst?.mods || 0, frameMs: sim ? (sim.includes("RTX") ? 4 : 13) : frame || 16.7, renderer: s.renderer, shaders: false, allocatedMb: s.memoryMb, hudThrottle: s.hudThrottle, inputSampling: s.inputSampling };
  const tip = whyLow(f); const recs = recommend(f);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2"><div className="eyebrow">Why is my FPS low?</div><select aria-label="Test with another GPU" className="field !h-6 !w-auto !pl-2 t1" value={sim} onChange={(e) => setSim(e.target.value)}>{SIM.map(([v, l]) => <option key={l} value={v} style={{ color: "#000" }}>{l}</option>)}</select></div>
        <div className="grid grid-cols-4 gap-2 mb-2.5">{[["Renderer", f.gpu.name.replace(/ANGLE \(|\)|Direct3D11|vs_5_0|ps_5_0/g, "").split(",").slice(-1)[0].trim().slice(0, 24)], ["RAM", f.ramGb ? `≥${f.ramGb} GB` : "n/a"], ["Mods", String(f.mods)], ["Frame", `${f.frameMs.toFixed(1)} ms`]].map(([k, v]) => <div key={k} className="rounded-lg p-1.5" style={{ background: "color-mix(in srgb, var(--inset) 40%, transparent)", border: "1px solid var(--color-line)" }}><div className="t1 mute">{k}</div><div className="t2 font-semibold num truncate" title={v}>{v}</div></div>)}</div>
        <div className="rounded-lg p-2.5" style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)" }}>
          <div className="flex items-center gap-1.5 mb-0.5"><Badge tone={tip.severity === "high" ? "bad" : tip.severity === "med" ? "warn" : "ok"}>{tip.severity === "high" ? "Fix first" : tip.severity === "med" ? "Worth trying" : "Minor"}</Badge><span className="t2 font-semibold">{tip.title}</span></div>
          <div className="t2">{tip.change}</div><div className="t1 mute mt-0.5">{tip.because}</div>
        </div>
        <div className="t1 mute mt-1.5">Reads the WebView’s GPU, frame time, memory and your instance. Real, not an estimate.</div>
      </div>
      <div className="panel p-3">
        <div className="eyebrow mb-2">Renderer · never installed silently</div>
        {recs.map((r) => (
          <button key={r.renderer} disabled={!r.allowed} onClick={() => set("renderer", r.renderer)} aria-pressed={s.renderer === r.renderer} className="lrow w-full text-left !items-start !py-1.5" style={{ opacity: r.allowed ? 1 : .6, borderColor: s.renderer === r.renderer ? "var(--color-accent)" : undefined, minHeight: 0 }}>
            <img src={`/mods/${r.renderer}.webp`} alt="" className="w-6 h-6 rounded-md mt-0.5" />
            <span className="flex-1 min-w-0"><span className="flex items-center gap-1.5"><span className="t2 font-semibold">{meta[r.renderer]?.title || r.renderer}</span>{r.renderer === "sodium" && <Badge>Baseline</Badge>}{!r.allowed && <Badge tone="warn">Not on this GPU</Badge>}{s.renderer === r.renderer && <Badge tone="accent">Selected</Badge>}</span><span className="block t1 mute leading-[14px]">{r.why}</span></span>
          </button>
        ))}
        <div className="t1 mute mt-1">Picking a renderer saves your choice only. Install it from Library.</div>
      </div>
    </div>
  );
}

function ClickTest() {
  const s = useSettings(); const probe = useRef(new ClickProbe()); const [v, setV] = useState({ raw: 0, cps: 0, lat: 0, peak: 0 });
  useEffect(() => { let raf = 0, last = 0, peak = 0; const f = (t: number) => { const tick = t - last >= 50; if (tick) last = t; probe.current.frame(s.inputSampling, tick); peak = Math.max(peak, probe.current.rawCps); setV({ raw: probe.current.rawCps, cps: probe.current.cps, lat: probe.current.avgLatencyMs, peak }); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [s.inputSampling]);
  return (
    <div className="panel p-3 flex gap-3 items-stretch">
      <button onMouseDown={() => probe.current.down()} aria-label="Click test pad" className="lift rounded-xl grid place-items-center t2 font-semibold" style={{ width: 200, border: "1px dashed color-mix(in srgb, var(--color-accent) 50%, transparent)", background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}><span><Icon n="mouse" s={20} className="mx-auto mb-1" />Click here fast</span></button>
      <div className="flex-1">
        <div className="eyebrow mb-1.5">Click test · input sampling {s.inputSampling ? "on" : "off"}</div>
        <div className="grid grid-cols-4 gap-2">{[["Raw input", v.raw + "/s"], ["Processed CPS", v.cps + "/s"], ["Added delay", v.lat.toFixed(1) + " ms"], ["Peak raw", v.peak + "/s"]].map(([k, x]) => <div key={k} className="rounded-lg p-1.5" style={{ background: "color-mix(in srgb, var(--inset) 40%, transparent)", border: "1px solid var(--color-line)" }}><div className="t1 mute">{k}</div><div className="t3 font-semibold num">{x}</div></div>)}</div>
        <div className="t1 mute mt-1.5">Off: clicks wait for the next 20 TPS tick (up to 50 ms). On: they are read on the very next frame. Toggle above and compare the delay.</div>
      </div>
    </div>
  );
}

function Profiler() {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const paint = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]));
  const boot = (window as any).__bootMs as number | undefined;
  const rows: [string, number | undefined][] = [["HTML parsed (domInteractive)", nav?.domInteractive], ["DOM content loaded", nav?.domContentLoadedEventEnd], ["First paint", paint["first-paint"]], ["First contentful paint", paint["first-contentful-paint"]], ["Engine bootstrap answered", boot ? boot + (nav?.domContentLoadedEventEnd || 0) : undefined], ["Window load", nav?.loadEventEnd]];
  const max = Math.max(...rows.map((r) => r[1] || 0), 1);
  return (
    <div className="panel p-3"><div className="flex items-center justify-between mb-2"><div className="eyebrow">Launcher startup · measured in this window</div><Badge tone="accent">Dev</Badge></div>
      {rows.filter((r) => r[1] !== undefined).map(([k, v]) => <div key={k} className="flex items-center gap-2 min-h-[24px]"><span className="t1 w-[190px] mute">{k}</span><span className="flex-1 h-1.5 rounded bg-white/10 overflow-hidden"><span className="block h-full rounded bg-[var(--color-accent)]" style={{ width: `${(v! / max) * 100}%` }} /></span><span className="t1 num w-[64px] text-right">{v!.toFixed(0)} ms</span></div>)}
      <div className="t1 mute mt-2">Game stages (JVM start, mod discovery, mixin apply, resource reload, first frame) are written by the engine to the launch log; none has been recorded on this machine yet.</div>
    </div>
  );
}

export default function SettingsPage({ boot }: { boot: Boot }) {
  const s = useSettings(); const [q, setQ] = useState(""); const [g, setG] = useState(new URLSearchParams(location.search).get("g") || "General");
  const ql = q.trim().toLowerCase();
  const match = (r: Row) => !ql || (r.name + r.desc + r.g).toLowerCase().includes(ql);
  const groups = ql ? GROUPS.filter((x) => ROWS.some((r) => r.g === x && match(r)) || (ql.length > 2 && x === "Performance" && ("fps diagnostic renderer click test vulkan").includes(ql))) : [g];
  const control = (r: Row) => { const c = r.c; const v = s[c.k] as any;
    if (c.t === "sw") return <Switch label={r.name} on={!!v} onChange={(x) => set(c.k as any, x as any)} />;
    if (c.t === "rng") return <Slider label={r.name} value={v} min={c.min} max={c.max} step={c.step} fmt={c.fmt} onChange={(x) => set(c.k as any, x as any)} />;
    return <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>{c.o.map(([k, l]) => <button key={k} aria-pressed={v === k} onClick={() => set(c.k as any, k as any)} className="px-2.5 h-7 t1 font-semibold" style={{ background: v === k ? "color-mix(in srgb, var(--color-accent) 22%, transparent)" : "transparent", color: v === k ? "#fff" : "var(--color-mute)" }}>{l}</button>)}</div>; };
  return (
    <div className="max-w-[1180px] grid gap-4" style={{ gridTemplateColumns: "190px minmax(0,1fr)" }}>
      <div className="flex flex-col gap-1">
        <SearchBox value={q} onChange={setQ} placeholder="Search settings" />
        <div className="mt-1.5 flex flex-col gap-0.5">{GROUPS.filter((x) => x !== "Developer" || s.devProfiler || true).map((x) => <button key={x} onClick={() => { setG(x); setQ(""); }} aria-current={!ql && g === x} className="lrow !min-h-[32px] text-left" style={!ql && g === x ? { background: "color-mix(in srgb, var(--color-accent) 16%, transparent)", borderColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)" } : undefined}><Icon n={GIC[x]} s={14} /><span className="t2 font-medium">{x}</span></button>)}</div>
      </div>
      <div className="flex flex-col gap-3 min-w-0">
        {groups.map((gr) => (
          <div key={gr}>
            <div className="eyebrow mb-1.5 px-1">{gr}</div>
            <div className="panel p-1.5">
              {ROWS.filter((r) => r.g === gr && match(r)).map((r) => <LRow key={r.name} icon={r.icon} name={r.name} desc={r.desc}>{control(r)}</LRow>)}
              {gr === "Accounts" && <>
                <LRow icon="user" name={`${boot.account.username || "Player"} · ${boot.account.kind || "Offline"}`} desc="The profile used to launch. Sign in with Microsoft for online servers."><a className="btn" href="#/onboarding/2">Manage</a></LRow>
                <LRow icon="lock" name="Microsoft device-code sign-in" desc="Approve at microsoft.com/link; no password is typed into Luminos."><a className="btn btn-primary" href="#/onboarding/2">Sign in</a></LRow></>}
            </div>
            {gr === "Performance" && !ql && <div className="flex flex-col gap-3 mt-3"><Diagnostic boot={boot} /><ClickTest /></div>}
            {gr === "Developer" && s.devProfiler && <div className="mt-3"><Profiler /></div>}
          </div>
        ))}
        {ql && !groups.length && <div className="panel p-6 t2 mute text-center">No setting matches “{q}”.</div>}
      </div>
    </div>
  );
}
