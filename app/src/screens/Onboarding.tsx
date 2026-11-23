import { useEffect, useState } from "react";
import { Sky, Icon, Badge, Toggle } from "../ui";
import { call, isTauri } from "../api";
export default function Onboarding({ step, setStep, done }: { step: number; setStep: (n: number) => void; done: (name: string) => void }) {
  const q = new URLSearchParams(location.search);
  const [name, setName] = useState(q.get("name") || ""); const [chk, setChk] = useState<any>(null); const [load, setLoad] = useState(false);
  const [imp, setImp] = useState<Record<string, boolean>>({ prism: true, modrinth: true, official: false }); const [pre, setPre] = useState(true); const [prog, setProg] = useState(0);
  useEffect(() => { if (!name) { setChk(null); return; } setLoad(true); const t = setTimeout(() => call("name_check", { name }).then((r: any) => { setChk(r); setLoad(false); }), 350); return () => clearTimeout(t); }, [name]);
  useEffect(() => { if (step !== 4) return; let p = 0; const t = setInterval(() => { p += 0.04; setProg(Math.min(1, p)); if (p >= 1) { clearInterval(t); setTimeout(() => done(name || "Player"), 500); } }, 140); return () => clearInterval(t); }, [step]);
  const tone = !chk ? "mute" : chk.status === "invalid" ? "bad" : chk.status === "premium" ? "warn" : chk.status === "free" ? "ok" : "mute";
  const msg = !name ? "Pick the name other players will see." : load ? "Checking…" : !chk ? "" : chk.status === "invalid" ? chk.reason : chk.status === "premium" ? "This name belongs to a premium account. You can still use it offline, but online servers will ask for that account." : chk.status === "free" ? "Free: no premium account uses this name." : "Couldn't reach Mojang. Format is fine; we'll check again later.";
  const steps = ["Welcome", "Your name", "Bring your stuff", "Get ready"];
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0"><Sky tone={step} /></div>
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 50% 40%, transparent, rgba(2,4,13,.55))" }} />
      <div className="relative h-full flex flex-col items-center justify-center px-8">
        <div className="absolute top-8 left-10 flex items-center gap-3"><img src="/luminos.png" className="h-8 w-8 rounded-lg" alt="" /><span className="font-semibold tracking-tight">Luminos</span></div>
        <div className="absolute top-9 flex gap-2">{steps.map((s, i) => <div key={s} className="h-1.5 rounded-full transition-all" style={{ width: i + 1 === step ? 44 : 14, background: i + 1 <= step ? "var(--color-accent)" : "rgba(160,190,255,.25)", transitionDuration: "var(--dur-slow)" }} />)}</div>
        <div key={step} className="rise w-full max-w-[640px] text-center">
          {step === 1 && <><div className="eyebrow mb-5">Launcher and client, one product</div><h1 className="display text-[104px]">Minecraft, <span className="accent-word">lit</span> properly.</h1><p className="text-[17px] text-fg/75 mt-6 max-w-[48ch] mx-auto leading-relaxed">Fast to start, honest about what it installs, and your client is set up in the same place you launch from.</p><div className="mt-9 flex gap-3 justify-center"><button className="btn btn-primary !h-12 !px-7" onClick={() => setStep(2)}>Get started<Icon n="play" s={14} /></button></div></>}
          {step === 2 && <><div className="eyebrow mb-4">Step 1 of 3</div><h2 className="display text-[64px]">What should we <span className="accent-word">call you?</span></h2>
            <div className="glass rounded-[20px] p-5 mt-8 text-left"><input autoFocus className="field !h-14 !text-[18px]" placeholder="Your player name" value={name} onChange={(e) => setName(e.target.value.trim())} maxLength={20} aria-label="Player name" />
              <div className="mt-3 flex items-start gap-2.5 min-h-[44px]"><Badge tone={tone as any}>{load ? <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white" style={{ animation: "spin .8s linear infinite" }} /> : <Icon n={chk?.status === "free" ? "check" : chk?.status === "invalid" ? "x" : "user"} s={12} />}{!chk || load ? "Checking" : chk.status === "free" ? "Available" : chk.status === "premium" ? "Premium name" : chk.status === "invalid" ? "Not valid" : "Unverified"}</Badge><span className="text-[13px] text-mute leading-snug pt-0.5">{msg}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-[14px] p-3.5 hair" style={{ background: "rgba(143,180,255,.1)", borderColor: "rgba(143,180,255,.5)" }}><div className="font-semibold text-[14px]">Play offline</div><div className="text-[12px] text-mute mt-0.5">Single player and offline-friendly servers. Your skin and cape work.</div></div><div className="rounded-[14px] p-3.5 hair opacity-60"><div className="font-semibold text-[14px]">Microsoft account</div><div className="text-[12px] text-mute mt-0.5">Needed for premium servers. Sign-in isn't available in this release yet.</div></div></div></div>
            <div className="mt-7 flex gap-3 justify-center"><button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button><button className="btn btn-primary" disabled={!name || chk?.status === "invalid"} onClick={() => { if (isTauri) call("create_account", { name }); setStep(3); }}>Continue</button></div></>}
          {step === 3 && <><div className="eyebrow mb-4">Step 2 of 3</div><h2 className="display text-[64px]">Bring your <span className="accent-word">worlds</span></h2><p className="text-mute mt-3">We found other launchers on this PC. Importing copies; nothing is moved or changed.</p>
            <div className="glass rounded-[20px] p-2 mt-7 text-left">{(isTauri ? [] : [["prism", "Prism Launcher", "3 instances · 1.21.11, 26.2", "folder"], ["modrinth", "Modrinth App", "2 profiles · 26.3", "cube"], ["official", "Minecraft Launcher", "1 profile · 1.21.4", "globe"]]).map(([k, n, d, ic]) => (
              <div key={k} className="flex items-center gap-4 p-3.5 rounded-[14px] hover:bg-white/5 transition-colors"><div className="h-11 w-11 rounded-[12px] grid place-items-center hair bg-ink-2"><Icon n={ic} s={20} className="text-accent" /></div><div className="flex-1"><div className="font-semibold">{n}</div><div className="text-[12.5px] text-mute">{d}</div></div><Toggle on={imp[k]} onChange={(v) => setImp({ ...imp, [k]: v })} label={n} /></div>))}
              {isTauri && <div className="p-8 text-center text-mute">No other launchers found. You can import later from Instances.</div>}</div>
            <div className="mt-7 flex gap-3 justify-center"><button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button><button className="btn btn-primary" onClick={() => setStep(4)}>Continue</button></div></>}
          {step === 4 && <><div className="eyebrow mb-4">Last step</div><h2 className="display text-[64px]">Setting up <span className="accent-word">{name || "Player"}'s</span> client</h2>
            <div className="glass rounded-[20px] p-6 mt-8 text-left"><div className="flex items-center justify-between"><div><div className="font-semibold">Luminos Client for Minecraft 26.3</div><div className="text-[12.5px] text-mute">Sodium, Lithium and friends, version-matched and checked</div></div><Toggle on={pre} onChange={setPre} label="Preset" /></div>
              <div className="h-2.5 rounded-full bg-white/10 mt-6 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${prog * 100}%`, background: "linear-gradient(90deg,#3b6cf0,#8fb4ff)", transition: "width 160ms linear" }} /></div>
              <div className="mt-3 text-[12.5px] text-mute num">{prog < 0.3 ? "Reading mod metadata…" : prog < 0.7 ? "Solving versions for 26.3 (stable only)…" : prog < 1 ? "Downloading 31 mods…" : "Ready."}</div></div></>}
        </div>
      </div>
    </div>
  );
}
