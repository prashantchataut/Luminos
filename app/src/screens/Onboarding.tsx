import { useEffect, useState } from "react";
import { Badge, Icon, Switch, SkinThumb } from "../kit";
import { call, isTauri } from "../api";

type Dev = { state: "idle" | "asking" | "waiting" | "done" | "error"; code?: string; uri?: string; msg?: string; who?: string };

export default function Onboarding({ step, setStep, done }: { step: number; setStep: (n: number) => void; done: (name: string) => void }) {
  const q = new URLSearchParams(location.search);
  const [name, setName] = useState(q.get("name") || ""); const [chk, setChk] = useState<any>(null); const [load, setLoad] = useState(false);
  const [imp, setImp] = useState<Record<string, boolean>>({ prism: true, modrinth: true, official: false }); const [pre, setPre] = useState(true); const [prog, setProg] = useState(0); const [err, setErr] = useState("");
  const [dev, setDev] = useState<Dev>({ state: q.get("demo") === "device" ? "idle" : "idle" });
  useEffect(() => { if (!name) { setChk(null); return; } setLoad(true); const t = setTimeout(() => call("name_check", { name }).then((r: any) => { setChk(r); setLoad(false); }), 350); return () => clearTimeout(t); }, [name]);
  useEffect(() => {
    if (step !== 4) return; let p = 0;
    const t = setInterval(() => { p = isTauri ? p + (0.92 - p) * 0.03 : p + 0.04; setProg(Math.min(1, p)); if (!isTauri && p >= 1) { clearInterval(t); setTimeout(() => done(name || dev.who || "Player"), 500); } }, 140);
    if (isTauri) call("create_instance", { name: "Luminos", mc: "26.3", withPreset: pre }).then(() => call("set_setting", { key: "setup_done", value: true })).then(() => { clearInterval(t); setProg(1); setTimeout(() => done(name || dev.who || "Player"), 600); }).catch((e) => { clearInterval(t); setErr(String(e)); });
    return () => clearInterval(t);
  }, [step]);
  const signIn = async () => {
    if (!isTauri) { setDev({ state: "error", msg: "Microsoft sign-in talks to your Microsoft account from the desktop app. Open Luminos on Windows to use it, or continue with an offline profile." }); return; }
    setDev({ state: "asking" });
    try {
      const d: any = await call("ms_device_begin"); setDev({ state: "waiting", code: d.user_code, uri: d.verification_uri });
      const who: any = await call("ms_device_finish", { deviceCode: d.device_code, expiresIn: d.expires_in, interval: d.interval });
      setDev({ state: "done", who: who.username }); setName(who.username);
    } catch (e) { setDev({ state: "error", msg: String(e) }); }
  };
  const tone = !chk ? "mute" : chk.status === "invalid" ? "bad" : chk.status === "premium" ? "warn" : chk.status === "free" ? "ok" : "mute";
  const msg = !name ? "Pick the name other players will see." : load ? "Checking…" : !chk ? "" : chk.status === "invalid" ? chk.reason : chk.status === "premium" ? "This name belongs to a premium account. You can still use it offline, but online servers will not accept it." : chk.status === "free" ? "Free to use." : chk.reason || "Could not check the name; you can continue.";
  const labels = ["Welcome", "Sign in", "Bring your stuff", "Get ready"];
  const found: [string, string, string, string][] = isTauri ? [] : [["prism", "Prism Launcher", "3 instances · 1.21.11, 26.2", "folder"], ["modrinth", "Modrinth App", "2 profiles · 26.3", "cube"], ["official", "Minecraft Launcher", "Saves, options and servers.dat", "layers"]];
  const Card = ({ children, w = 760 }: { children: React.ReactNode; w?: number }) => <div className="panel rise p-4 text-left" style={{ width: w, maxWidth: "92vw" }}>{children}</div>;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "var(--bg)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 50% 40%, color-mix(in srgb, var(--inset) 20%, transparent), color-mix(in srgb, var(--inset) 70%, transparent))" }} />
      <div className="relative h-full flex flex-col items-center justify-center px-8">
        <div className="absolute top-6 left-8 flex items-center gap-2.5"><img src="/luminos.png" className="h-7 w-7 rounded-lg" alt="" /><span className="t3 font-semibold">Luminos</span></div>
        <div className="absolute top-8 flex gap-1.5" aria-label={`Step ${step} of 4`}>{labels.map((s, i) => <div key={s} className="h-1 rounded-full transition-all" style={{ width: i + 1 === step ? 40 : 14, background: i + 1 <= step ? "var(--color-accent)" : "color-mix(in srgb, var(--color-fg) 25%, transparent)" }} />)}</div>
        <div key={step} className="rise flex flex-col items-center text-center">
          {step === 1 && <><div className="eyebrow mb-4">Launcher and client, one product</div><h1 className="display text-[96px] m-0">Minecraft, <span className="accent-word">lit</span> properly.</h1><p className="t3 mute mt-4 max-w-[480px]">Launcher and in-game client share one config. Nothing installs without your say.</p><button className="btn btn-primary mt-7 !h-11 !px-6 t3" onClick={() => setStep(2)}>Get started<Icon n="chev" s={14} /></button></>}
          {step === 2 && <><div className="eyebrow mb-2">Step 1 of 3</div><h2 className="display text-[52px] m-0">Who’s <span className="accent-word">playing?</span></h2>
            <div className="grid grid-cols-2 gap-3 mt-6 text-left" style={{ width: 760, maxWidth: "92vw" }}>
              <div className="panel p-4 flex flex-col"><div className="flex items-center gap-2 mb-1"><span className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: "color-mix(in srgb, var(--color-accent) 16%, transparent)" }}><Icon n="lock" s={16} /></span><span className="t3 font-semibold">Microsoft account</span><Badge tone="ok">Online servers</Badge></div>
                <p className="t2 mute m-0 mb-3">Sign in with a device code. You approve at microsoft.com/link, so your password never touches Luminos.</p>
                {dev.state === "waiting" ? <div className="rounded-lg p-3 text-center" style={{ background: "color-mix(in srgb, var(--inset) 45%, transparent)", border: "1px solid var(--color-line)" }}><div className="t1 mute">Enter this code at {dev.uri}</div><div className="font-semibold num tracking-[.25em] my-1" style={{ fontSize: 20 }}>{dev.code}</div><div className="t1 mute flex items-center justify-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white" style={{ animation: "spin .8s linear infinite" }} />Waiting for approval…</div></div>
                  : dev.state === "done" ? <div className="flex items-center gap-2 t2" style={{ color: "var(--color-ok)" }}><Icon n="check" s={14} />Signed in as {dev.who}</div>
                  : <button className="btn btn-primary !h-9" disabled={dev.state === "asking"} onClick={signIn}>{dev.state === "asking" ? "Asking Microsoft…" : "Sign in with Microsoft"}</button>}
                {dev.state === "error" && <div className="t1 mt-2" role="alert" style={{ color: "var(--color-warn)" }}>{dev.msg}</div>}
              </div>
              <div className="panel p-4 flex flex-col"><div className="flex items-center gap-2 mb-1"><span className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: "color-mix(in srgb, var(--color-accent) 16%, transparent)" }}><Icon n="user" s={16} /></span><span className="t3 font-semibold">Offline profile</span><Badge>Singleplayer · LAN</Badge></div>
                <p className="t2 mute m-0 mb-2">Pick a name. Works anywhere offline-mode is allowed.</p>
                <div className="relative"><Icon n="user" s={14} className="absolute left-2.5 top-[8px] mute" /><input autoFocus className="field" placeholder="Player name" value={name} maxLength={20} onChange={(e) => setName(e.target.value.trim())} aria-label="Offline player name" /></div>
                <div className="t1 mt-1.5 min-h-[30px] flex gap-1.5 items-start"><Badge tone={tone as any}>{load ? "…" : chk?.status === "free" ? "Free" : chk?.status === "premium" ? "Premium" : chk?.status === "invalid" ? "Invalid" : "Name"}</Badge><span className="mute">{msg}</span></div>
              </div>
            </div>
            <div className="mt-6 flex gap-2"><button className="btn" onClick={() => setStep(1)}>Back</button><button className="btn btn-primary" disabled={(!name || chk?.status === "invalid") && dev.state !== "done"} onClick={async () => { if (name && dev.state !== "done" && isTauri) await call("create_account", { name }).catch(() => {}); setStep(3); }}>Continue</button></div></>}
          {step === 3 && <><div className="eyebrow mb-2">Step 2 of 3</div><h2 className="display text-[52px] m-0">Bring your <span className="accent-word">worlds</span></h2><p className="t2 mute mt-2 mb-5">We looked for other launchers on this PC. Nothing is moved; we copy.</p>
            <Card>{found.length ? found.map(([k, n, d, ic]) => <div key={k} className="lrow !min-h-[44px]"><span className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: "color-mix(in srgb, var(--color-fg) 12%, transparent)" }}><Icon n={ic} s={16} /></span><span className="flex-1"><span className="t2 font-semibold block">{n}</span><span className="t1 mute">{d}</span></span><Switch label={`Import from ${n}`} on={!!imp[k]} onChange={(v) => setImp({ ...imp, [k]: v })} /></div>) : <div className="p-6 text-center t2 mute">No other launchers found. You can import later from Instances.</div>}</Card>
            <div className="mt-5 flex gap-2"><button className="btn" onClick={() => setStep(2)}>Back</button><button className="btn btn-primary" onClick={() => setStep(4)}>Continue</button></div></>}
          {step === 4 && <><div className="eyebrow mb-2">Last step</div><h2 className="display text-[52px] m-0">Setting up <span className="accent-word">{name || dev.who || "Player"}’s</span> client</h2>
            <div className="mt-6"><Card w={640}><div className="flex items-center gap-3"><SkinThumb src="/skins/luminos-default.png" scale={3} bust className="rounded-md" /><div className="flex-1"><div className="t3 font-semibold">Luminos Client for Minecraft 26.3</div><div className="t1 mute">Performance profile · Sodium · stable mods</div></div><label className="flex items-center gap-2 t2">Starter mods<Switch label="Install starter mods" on={pre} onChange={setPre} /></label></div>
              <div className="h-2 rounded-full bg-white/10 mt-4 overflow-hidden"><div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${prog * 100}%`, transition: "width 160ms linear" }} /></div>
              <div className="mt-2 t1 mute num">{err ? err : prog < 0.3 ? "Reading mod metadata…" : prog < 0.7 ? "Solving versions for 26.3 (stable only)…" : prog < 1 ? "Downloading 31 mods…" : "Ready."}</div></Card></div></>}
        </div>
      </div>
    </div>
  );
}
