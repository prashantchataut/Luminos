import { useEffect, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { PageHeader, Pills, Row, Select, Slider, Switch } from "../components/ui";
import { setPref, useClient, type Prefs } from "../state/client";
import { set, useSettings } from "../store";
import { engine } from "../engine";
import { safeInvoke } from "../lib/tauri-bridge";

type Tab = "general" | "engine" | "java" | "storage";
const TABS: { id: Tab; label: string }[] = [{ id: "general", label: "General & Gameplay" }, { id: "engine", label: "Performance Engine" }, { id: "java", label: "Java & Memory" }, { id: "storage", label: "Storage & Dedup" }];
const RES = ["1280 × 800 (Default)", "1600 × 900", "1920 × 1080", "Borderless Fullscreen"];
const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

function EngineCard() {
  const c = useClient();
  return (
    <div className="p-5 rounded-[12px] flex items-center justify-between gap-6" style={{ background: "var(--surface)" }}>
      <div className="flex items-center gap-4 min-w-0">
        <span className="grid place-items-center w-10 h-10 rounded-[10px] shrink-0" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}><Icon n="bolt" s={20} /></span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold">Built-in Fabric Performance Stack <span className="font-medium" style={{ color: "var(--ok)" }}>(Active)</span></div>
          <div className="text-[12px] mt-0.5 mute leading-snug">Sodium, Lithium, FerriteCore, EntityCulling and ImmediatelyFast are pre-bundled and managed automatically.</div>
        </div>
      </div>
      <div className="flex items-center gap-1 p-1 rounded-full shrink-0" style={{ background: "var(--side)" }} role="group" aria-label="Engine profile">
        {(["Max FPS", "Balanced"] as const).map((p) => <button key={p} aria-pressed={c.prefs.engine === p} onClick={() => setPref("engine", p)} className="h-[30px] px-4 rounded-full text-[12.5px] font-medium t" style={{ background: c.prefs.engine === p ? "var(--accent)" : "transparent", color: c.prefs.engine === p ? "var(--accent-fg)" : "var(--mute)" }}>{p}</button>)}
      </div>
    </div>
  );
}

function Storage() {
  const [saved, setSaved] = useState<number | null>(null), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  useEffect(() => { let live = true; engine.dedupStatus().then((d) => live && setSaved(d?.total_saved ?? null)).catch(() => undefined); return () => { live = false; }; }, []);
  const run = async () => { setBusy(true); try { const d = await engine.dedupRun(); setSaved(d?.total_saved ?? saved); setNote("Verified. Identical files are stored once."); } catch { setNote("Could not run right now."); } setBusy(false); };
  const clear = async () => { await safeInvoke("clear_cache", {}, null); setNote("Cache cleared."); };
  return (
    <>
      <Row title="Luminos Content-Addressed Storage" desc="Identical game files across instances are stored once and linked.">
        <span className="h-[30px] px-3 rounded-full text-[12px] font-semibold grid place-items-center num" style={{ background: "var(--surface-2)", color: "var(--ok)" }}>{saved == null ? "…" : `${gb(saved)} Saved`}</span>
        <button className="btn-quiet !h-[34px]" onClick={run} disabled={busy}>{busy ? "Working…" : "Verify & Optimize"}</button>
      </Row>
      <Row title="Cache" desc="Icons and checked mod metadata. Safe to clear."><button className="btn-quiet !h-[34px]" onClick={clear}>Clear cache</button></Row>
      {note && <div className="text-[12px] mute px-1" role="status">{note}</div>}
    </>
  );
}

export default function Preferences() {
  const c = useClient(), s = useSettings();
  const [tab, setTab] = useState<Tab>("general");
  return (
    <Page>
      <PageHeader title="Preferences" sub="Saved the moment you change them." />
      <div className="mb-7"><Pills value={tab} onChange={setTab} items={TABS} /></div>
      <div className="max-w-[920px] space-y-3">
        {(tab === "general" || tab === "engine") && <div className="mb-4"><EngineCard /></div>}
        {tab === "general" && (
          <>
            <Row title="Window Resolution Preset" desc="Size of the game window on launch."><Select label="Window resolution" value={c.prefs.resolution} options={RES} onChange={(v) => setPref("resolution", v)} /></Row>
            <Row title="Launcher Visibility on Launch" desc="What the launcher does while you play."><Select label="Launcher visibility" value={c.prefs.launcherVis} options={["Keep Open", "Hide while Playing", "Minimize to Tray"]} onChange={(v) => setPref("launcherVis", v as Prefs["launcherVis"])} /></Row>
            <Row title="Discord Rich Presence" desc="Display current version and server activity."><Switch on={s.presenceOn} onChange={(v) => set("presenceOn", v)} label="Discord Rich Presence" /></Row>
            <Row title="Interface Animations" desc="Turn off to remove all launcher motion."><Switch on={!s.reduceMotion} onChange={(v) => set("reduceMotion", !v)} label="Interface animations" /></Row>
            <Row title="Check for Updates" desc="Look for a new Luminos release at startup."><Switch on={s.checkUpdates} onChange={(v) => set("checkUpdates", v)} label="Check for updates" /></Row>
          </>
        )}
        {tab === "engine" && (
          <>
            <Row title="Render-Loop Click Sampling" desc="Samples mouse input at frame rate instead of 20 TPS."><Switch on={s.inputSampling} onChange={(v) => set("inputSampling", v)} label="Render-loop click sampling" /></Row>
            <Row title="Background FPS Limiter" desc="Throttles game and launcher rendering when unfocused to prevent lag."><Switch on={s.hudThrottle} onChange={(v) => set("hudThrottle", v)} label="Background FPS limiter" /></Row>
          </>
        )}
        {tab === "java" && (
          <>
            <Row title="Allocated Memory (RAM)" desc="2 GB to 16 GB. 4 GB suits most setups.">
              <Slider label="Allocated memory" value={s.memoryMb} min={2048} max={16384} step={512} onChange={(v) => set("memoryMb", v)} w={220} />
              <span className="mono text-[12px] h-[30px] px-3 rounded-full grid place-items-center num" style={{ background: "var(--surface-2)" }}>{s.memoryMb} MB</span>
            </Row>
            <Row title="Java Runtime" desc="Downloaded and matched to your Minecraft version automatically."><span className="text-[12.5px] mute">Automatic</span></Row>
          </>
        )}
        {tab === "storage" && <Storage />}
        <p className="pt-3 text-[12px] mute leading-relaxed">Settings live in luminos-client-settings.json next to your account file. Memory and engine options apply the next time the game starts.</p>
      </div>
    </Page>
  );
}
