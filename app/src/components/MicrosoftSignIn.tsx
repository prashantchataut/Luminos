import { useEffect, useRef, useState } from "react";
import { call } from "../api";
import { isTauri } from "../lib/tauri-bridge";

type Phase = "idle" | "starting" | "wait" | "ok" | "err";

/**
 * Microsoft device-code sign-in. Rust (`start_microsoft_device_login`) asks Microsoft for a code, keeps polling in the
 * background and, once the player approves, runs Xbox Live -> XSTS -> Minecraft services and stores the tokens in the OS
 * secure store. Progress comes back on the `ms-login` event. Needs LUMINOS_MS_CLIENT_ID (an Azure public-client app).
 */
export default function MicrosoftSignIn({ onDone }: { onDone: (name: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle"), [code, setCode] = useState(""), [uri, setUri] = useState(""), [err, setErr] = useState(""), [copied, setCopied] = useState(false);
  const unlisten = useRef<null | (() => void)>(null);
  useEffect(() => () => { unlisten.current?.(); }, []);

  const start = async () => {
    setPhase("starting"); setErr("");
    try {
      if (isTauri()) {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten.current?.();
        unlisten.current = await listen<{ ok: boolean; username?: string; error?: string }>("ms-login", (e) => {
          if (e.payload.ok) { setPhase("ok"); onDone(e.payload.username ?? "Player"); } else { setErr(e.payload.error ?? "Sign-in failed."); setPhase("err"); }
        });
      }
      const r: any = await call("start_microsoft_device_login", {});
      setCode(r.user_code); setUri(r.verification_uri || "https://www.microsoft.com/link"); setPhase("wait");
    } catch (e: any) { setErr(typeof e === "string" ? e : e?.message ?? "Could not start sign-in. Microsoft sign-in runs in the desktop app."); setPhase("err"); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };
  const openPage = async () => { try { await call("open_external", { url: uri }); } catch { window.open(uri, "_blank", "noopener"); } };

  return (
    <div className="rounded-[12px] p-5 space-y-4" style={{ background: "var(--surface)" }}>
      {phase === "idle" || phase === "starting" || phase === "err" ? (
        <>
          <p className="m-0 text-[13px] leading-relaxed mute">Sign in with your Microsoft account to play on online-mode servers and use your real skin. You approve it on microsoft.com; Luminos never sees your password.</p>
          {err && <div role="alert" className="text-[12.5px] leading-snug" style={{ color: "var(--bad)" }}>{err}</div>}
          <button className="btn-primary" disabled={phase === "starting"} onClick={() => void start()}>{phase === "starting" ? "Contacting Microsoft…" : phase === "err" ? "Try again" : "Sign in with Microsoft"}</button>
        </>
      ) : phase === "wait" ? (
        <>
          <div className="text-[12px] mute">1. Copy this code &nbsp;2. Open the page &nbsp;3. Paste it and approve</div>
          <div className="flex items-center gap-3"><code className="num text-[30px] font-bold tracking-[0.18em] select-text" aria-label="Device code">{code}</code><button className="btn-quiet" onClick={() => void copy()}>{copied ? "Copied" : "Copy code"}</button></div>
          <div className="flex items-center gap-3"><button className="btn-primary" onClick={() => void openPage()}>Open {uri.replace(/^https?:\/\//, "")}</button><span className="text-[12px] mute" role="status">Waiting for you to approve… this window updates by itself.</span></div>
        </>
      ) : (
        <div role="status" className="text-[13.5px] font-semibold" style={{ color: "var(--ok)" }}>Signed in.</div>
      )}
    </div>
  );
}
