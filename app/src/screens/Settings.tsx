import { useEffect, useState, type ReactNode } from "react";
import type { Boot } from "../App";
import { Icon } from "../kit";
import { set, useSettings, type Settings } from "../store";
import { setClassic, useLocker } from "../locker/catalog";
import { engine, fmtBytes } from "../engine";
import { PRESETS } from "../data/launcher";
import AccountSwitcher, { useAccounts } from "./Accounts";
import Themes from "./Themes";

// One uniform row: icon + title + one-line description on the left, exactly one control on the right.
export function SRow({ icon, title, desc, children }: { icon: string; title: string; desc: string; children: ReactNode }) {
  return (
    <div className="srow">
      <span className="srow-ic"><Icon n={icon} s={20} /></span>
      <div className="min-w-0 flex-1"><div className="srow-t">{title}</div><div className="srow-d">{desc}</div></div>
      <div className="srow-c">{children}</div>
    </div>
  );
}
const Sw = ({ k, label }: { k: keyof Settings; label: string }) => { const s = useSettings(); return <button role="switch" aria-checked={!!s[k]} aria-label={label} className="sw2" onClick={() => set(k, !s[k] as never)} />; };
const Dd = ({ value, o, on, label }: { value: string; o: [string, string][]; on: (v: string) => void; label: string }) => <label className="dd"><select aria-label={label} value={value} onChange={(e) => on(e.target.value)}>{o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><Icon n="chev" s={12} /></label>;

const TABS: [string, string][] = [["general", "General & Gameplay"], ["java", "Java & Memory"], ["storage", "Storage & Shard Dedup"], ["accounts", "Accounts"], ["themes", "Themes"]];

export default function Settings({ boot }: { boot: Boot }) {
  const s = useSettings(), L = useLocker(), acc = useAccounts(boot.account?.username);
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get("tab") || "general");
  const [saved, setSaved] = useState<number | null>(null), [verified, setVerified] = useState(false), [mgr, setMgr] = useState(false);
  const check = () => engine.dedupStatus().then((d) => { setSaved(d.total_saved); setVerified(true); setTimeout(() => setVerified(false), 2200); }).catch(() => undefined);
  useEffect(() => { engine.dedupStatus().then((d) => setSaved(d.total_saved)).catch(() => undefined); }, []);
  const active = acc.list.find((a) => a.id === acc.active) || acc.list[0];
  const preset = s.keystrokes === "B" ? "survival" : "pvp";
  return (
    <div className="mx-auto pb-10" style={{ maxWidth: 860 }}>
      <div className="flex gap-1.5 flex-wrap mb-5" role="tablist" aria-label="Preferences sections">
        {TABS.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className="cos-tab" data-on={tab === id} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {tab === "general" && (
        <div className="grid gap-2 stagger">
          <SRow icon="swords" title="Gameplay preset" desc="Keystrokes, crosshair, fog and fire in one choice."><Dd label="Gameplay preset" value={preset} o={[["pvp", "PvP"], ["survival", "Survival"]]} on={(v) => Object.entries(PRESETS[v as "pvp" | "survival"].set).forEach(([k, x]) => set(k as any, x as any))} /></SRow>
          <SRow icon="play" title="Close launcher on game start" desc="Frees memory while you play and reopens when the game exits."><Sw k="closeOnLaunch" label="Close launcher on game start" /></SRow>
          <SRow icon="download" title="Check for updates" desc="Looks for a new launcher or client release on start."><Sw k="checkUpdates" label="Check for updates" /></SRow>
          <SRow icon="puzzle" title="Allow beta mods" desc="Lets the solver pick beta builds when no stable one exists."><Sw k="allowBeta" label="Allow beta mods" /></SRow>
          <SRow icon="mouse" title="Sample input every frame" desc="Reads clicks and keys at frame rate instead of 20 TPS."><Sw k="inputSampling" label="Sample input every frame" /></SRow>
          <SRow icon="bolt" title="Startup cache" desc="Keeps transformed mixins and mod metadata between launches."><Sw k="startupCache" label="Startup cache" /></SRow>
          <SRow icon="shirt" title="Offline skin preview" desc="Shows your chosen skin to you, in the launcher and in game."><Sw k="offlineSkins" label="Offline skin preview" /></SRow>
          <SRow icon="ghost" title="Classic client" desc="Hides pets, wings and emotes. Hats and masks stay."><button role="switch" aria-checked={L.classic} aria-label="Classic client" className="sw2" onClick={() => setClassic(!L.classic)} /></SRow>
          <SRow icon="user" title="Discord presence" desc="Friends see “Playing Luminos”. Off removes it at once."><Sw k="presenceOn" label="Discord presence" /></SRow>
          <SRow icon="eye" title="Reduce motion" desc="Removes slides, pop-ins and idle sway."><Sw k="reduceMotion" label="Reduce motion" /></SRow>
        </div>
      )}
      {tab === "java" && (
        <div className="grid gap-2 stagger">
          <SRow icon="cpu" title="Allocated memory" desc="Too much starves the OS. 4 GB suits most mod lists.">
            <div className="flex items-center gap-3"><span className="mono-badge">{s.memoryMb} MB</span><input type="range" className="rng2" aria-label="Allocated memory" min={2048} max={16384} step={512} value={s.memoryMb} onChange={(e) => set("memoryMb", +e.target.value)} style={{ ["--p" as any]: `${((s.memoryMb - 2048) / (16384 - 2048)) * 100}%` }} /></div>
          </SRow>
          <SRow icon="gauge" title="Renderer" desc="Saved as your choice. Nothing is installed silently."><Dd label="Renderer" value={s.renderer} o={[["sodium", "Sodium"], ["vulkanmod", "VulkanMod"], ["nvidium", "Sodium + Nvidium"]]} on={(v) => set("renderer", v as Settings["renderer"])} /></SRow>
          <SRow icon="layers" title="Performance profile" desc="Luminos Performance is the default; Sodium-only is the baseline."><Dd label="Performance profile" value={s.profile} o={[["luminos-performance", "Luminos Performance"], ["sodium-baseline", "Sodium baseline"], ["vanilla", "Vanilla"]]} on={(v) => set("profile", v as Settings["profile"])} /></SRow>
          <SRow icon="layers" title="Throttle HUD and GUI" desc="Draws the HUD at a lower fixed rate so the world gets the frames."><Sw k="hudThrottle" label="Throttle HUD and GUI" /></SRow>
          <SRow icon="terminal" title="Startup profiler" desc="Shows where the launcher's own start time goes."><Sw k="devProfiler" label="Startup profiler" /></SRow>
        </div>
      )}
      {tab === "storage" && (
        <div className="grid gap-2 stagger">
          <SRow icon="verify" title="Shard dedup" desc="Identical files across instances are stored once."><button className="abtn" onClick={check}>{verified ? "Verified" : "Verify Cache"}<span className="abtn-s">{saved === null ? "…" : `${fmtBytes(saved)} saved`}</span></button></SRow>
          <SRow icon="box" title="Include worlds when comparing" desc="Off by default. Worlds are large, so you choose when."><Sw k="compliance" label="Include worlds when comparing" /></SRow>
        </div>
      )}
      {tab === "accounts" && (
        <div className="grid gap-2 stagger">
          <SRow icon="user" title={active?.name || "No account"} desc={`Active account · ${(active?.kind || "offline").toLowerCase()}`}><button className="abtn" onClick={() => setMgr(true)}>Switch account</button></SRow>
          <SRow icon="globe" title="Ely.by / authlib-injector" desc="Use an Ely.by account or a custom Yggdrasil server."><button className="abtn" onClick={() => setMgr(true)}>Add Ely.by</button></SRow>
          <SRow icon="shield" title="Microsoft account" desc="Device-code sign-in needs the owner's Azure app id."><button className="abtn" onClick={() => setMgr(true)}>Sign in</button></SRow>
        </div>
      )}
      {tab === "themes" && <Themes q="" />}
      {mgr && <AccountSwitcher boot={boot} onClose={() => setMgr(false)} />}
    </div>
  );
}
