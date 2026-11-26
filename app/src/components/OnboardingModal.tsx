import { useMemo, useState } from "react";
import { LuminosMark } from "./LuminosLogo";
import MicrosoftSignIn from "./MicrosoftSignIn";
import { addAccount } from "./AccountModal";
import { applyPreset, PRESETS, type Preset } from "../state/client";
import { set } from "../store";

const STEPS = ["Welcome", "Account", "Performance", "Gameplay"];
/** What this PC reports. The webview caps navigator.deviceMemory at 8, so 8 means "8 GB or more". */
function hardware() {
  const mem = (navigator as any).deviceMemory as number | undefined, cores = navigator.hardwareConcurrency || 4;
  const ram = mem ? (mem >= 8 ? 4096 + 2048 * Math.min(2, Math.floor((mem - 8) / 4) + 1) : Math.max(2048, mem * 512)) : 2048;
  return { mem, cores, ramMb: Math.min(3072, Math.max(1024, ram)) };
}
const BLURB: Record<string, string> = {};

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0), [name, setName] = useState(""), [signed, setSigned] = useState(""), [ram, setRam] = useState(hardware().ramMb), [preset, setPreset] = useState<string>(Object.keys(PRESETS)[0]);
  const hw = useMemo(hardware, []);
  const valid = /^[A-Za-z0-9_]{3,16}$/.test(name.trim());
  const next = () => setI((v) => Math.min(3, v + 1));
  const finish = () => { set("memoryMb", ram); applyPreset(preset as Preset); onClose(); };

  return (
    <div role="dialog" aria-modal="true" aria-label="Luminos setup" className="fixed inset-0 z-[70] grid place-items-center" style={{ background: "#07090E" }}>
      <img src="/art/hero-blue-hour.webp" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: i === 0 ? 0.9 : 0.28, transition: "opacity .5s" }} decoding="async" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(7,9,14,.35), rgba(7,9,14,.92))" }} />
      <div className="relative w-[720px] max-w-[92vw] rounded-[18px] p-10" style={{ background: "rgba(14,17,25,.92)", boxShadow: "0 30px 90px rgba(0,0,0,.6)" }}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3"><LuminosMark size={38} /><span className="wordmark text-[18px]">LUMINOS</span></div>
          <ol className="flex items-center gap-2 m-0 p-0 list-none" aria-label="Setup progress">{STEPS.map((s, k) => <li key={s} aria-current={k === i ? "step" : undefined} className="h-[26px] px-3 rounded-full text-[11.5px] font-medium grid place-items-center" style={{ background: k === i ? "#2B4BFF" : "#171C28", color: k === i ? "#fff" : k < i ? "#93C5FD" : "#64748B" }}>{k + 1}. {s}</li>)}</ol>
        </div>

        {i === 0 && (<div className="space-y-4"><h1 className="m-0 text-[34px] font-bold leading-tight text-white">Welcome to Luminos</h1><p className="m-0 text-[14.5px] leading-relaxed" style={{ color: "#A8B3C7" }}>A light Minecraft launcher with a built-in performance stack and a first-party client. Four quick steps: sign in, tune for this PC, pick how you play. You can rerun this from Preferences.</p></div>)}

        {i === 1 && (<div className="space-y-4"><h2 className="m-0 text-[22px] font-semibold text-white">Connect an account</h2>
          <MicrosoftSignIn onDone={(n) => { setSigned(n); addAccount({ id: "ms-" + n, kind: "MICROSOFT", name: n }); }} />
          <div className="rounded-[12px] p-5 space-y-3" style={{ background: "var(--surface)" }}>
            <div className="text-[13px] font-semibold">Or play offline</div>
            <div className="flex gap-3"><input className="field !pl-3.5 flex-1" placeholder="Player name (3–16 letters, numbers, _)" aria-label="Offline player name" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-quiet" disabled={!valid} style={{ opacity: valid ? 1 : 0.45 }} onClick={() => { addAccount({ id: "off-" + name.trim(), kind: "OFFLINE", name: name.trim() }); setSigned(name.trim()); }}>Use offline</button></div>
            <div className="text-[11.5px] mute">Offline accounts work in single player, LAN and offline-mode servers. Ely.by is in Account settings.</div>
          </div>
          {signed && <div role="status" className="text-[13px]" style={{ color: "var(--ok)" }}>Using {signed}.</div>}
        </div>)}

        {i === 2 && (<div className="space-y-4"><h2 className="m-0 text-[22px] font-semibold text-white">Hardware &amp; Max-FPS tuning</h2>
          <div className="rounded-[12px] p-5 grid grid-cols-3 gap-4" style={{ background: "var(--surface)" }}>
            <div><div className="eyebrow">Memory reported</div><div className="num text-[20px] font-semibold">{hw.mem ? (hw.mem >= 8 ? "8+ GB" : `${hw.mem} GB`) : "unknown"}</div></div>
            <div><div className="eyebrow">CPU threads</div><div className="num text-[20px] font-semibold">{hw.cores}</div></div>
            <div><div className="eyebrow">Game heap</div><div className="num text-[20px] font-semibold">{ram} MB</div></div>
          </div>
          <input type="range" min={1024} max={3072} step={256} value={ram} onChange={(e) => setRam(+e.target.value)} aria-label="Game memory in megabytes" className="w-full" />
          <div className="text-[12.5px] leading-relaxed mute">Sodium, Lithium, FerriteCore, ImmediatelyFast, Entity Culling and ModernFix are installed with the Luminos profile and G1GC pause tuning is applied by default. Nothing to switch on.</div>
        </div>)}

        {i === 3 && (<div className="space-y-4"><h2 className="m-0 text-[22px] font-semibold text-white">How do you play?</h2>
          <div className="grid grid-cols-3 gap-3">{Object.keys(PRESETS).map((p) => <button key={p} onClick={() => setPreset(p)} aria-pressed={preset === p} className="h-[96px] rounded-[12px] p-4 text-left t press" style={{ background: preset === p ? "#16295E" : "var(--surface)", outline: preset === p ? "2px solid #3B82F6" : "none" }}><div className="text-[14px] font-semibold text-white">{p}</div><div className="text-[11.5px] mt-1 mute">{BLURB[p] ?? "Sets which HUD modules are on at first launch."}</div></button>)}</div>
        </div>)}

        <div className="flex items-center justify-between mt-9">
          <button className="btn-quiet" onClick={() => (i === 0 ? onClose() : setI(i - 1))}>{i === 0 ? "Skip setup" : "Back"}</button>
          {i < 3 ? <button className="btn-primary" onClick={next}>{i === 0 ? "Get started" : i === 1 && !signed ? "Skip for now" : "Continue"}</button> : <button className="btn-primary" onClick={finish}>Finish setup</button>}
        </div>
      </div>
    </div>
  );
}
