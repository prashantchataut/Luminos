import { useCallback, useEffect, useRef, useState } from "react";
import { safeInvoke, isTauri } from "../lib/tauri-bridge";

export type UpdateInfo = { updateAvailable: boolean; currentVersion: string; latestVersion: string; downloadUrl: string | null; releaseNotes: string; page: string | null; sizeBytes: number };

/** Check GitHub through Rust, then download + verify + run the silent NSIS installer and let Rust exit the app. */
export function useAppUpdate(autoCheck: boolean) {
  const [info, setInfo] = useState<UpdateInfo | null>(null), [checking, setChecking] = useState(false), [pct, setPct] = useState<number | null>(null), [error, setError] = useState("");
  const un = useRef<null | (() => void)>(null);
  const check = useCallback(async () => {
    if (!isTauri()) { setError("Updates are checked by the desktop app."); return null; }
    setChecking(true); setError("");
    const r = await safeInvoke<UpdateInfo | "__failed__">("check_app_update", {}, "__failed__", 20000);
    setChecking(false);
    if (r === "__failed__") { setError("Could not reach GitHub. Check your connection."); return null; }
    setInfo(r); return r;
  }, []);
  useEffect(() => { if (autoCheck) void check(); }, [autoCheck, check]);
  useEffect(() => () => { un.current?.(); }, []);
  const install = useCallback(async () => {
    if (!info?.downloadUrl) return;
    setError(""); setPct(0);
    const { listen } = await import("@tauri-apps/api/event");
    un.current = await listen<{ percent: number }>("update-progress", (e) => setPct(e.payload.percent));
    const r = await safeInvoke<unknown>("install_app_update", { downloadUrl: info.downloadUrl }, "__failed__", 30 * 60 * 1000);
    if (r === "__failed__") { setPct(null); setError("The update could not be installed. Nothing was changed."); }
  }, [info]);
  return { info, checking, pct, error, check, install };
}

export default function UpdateBanner({ u }: { u: ReturnType<typeof useAppUpdate> }) {
  if (!u.info?.updateAvailable && !u.error) return null;
  const busy = u.pct !== null;
  return (
    <div role="status" className="shrink-0 px-8 h-[52px] flex items-center gap-5" style={{ background: "#12203F", borderBottom: "1px solid #24407A" }}>
      {u.info?.updateAvailable ? (
        <>
          <span className="text-[13px] font-semibold text-white">Update Available <span className="font-normal opacity-60">v{u.info.currentVersion} → v{u.info.latestVersion}</span></span>
          {busy ? (
            <div className="flex items-center gap-3 flex-1 max-w-[420px]" aria-label="Update progress">
              <div className="h-[6px] flex-1 rounded-full overflow-hidden" style={{ background: "#1F3260" }}><div className="h-full t" style={{ width: `${u.pct}%`, background: "#3B82F6" }} /></div>
              <span className="num text-[12px] w-[84px] text-white/80">{u.pct! >= 100 ? "Installing…" : `${u.pct}%`}</span>
            </div>
          ) : (
            <>
              <button className="h-8 px-4 rounded-[8px] text-[12.5px] font-semibold text-white t press" style={{ background: "#2B6BFF" }} onClick={() => void u.install()}>Install &amp; Restart</button>
              {u.info.page && <span className="text-[12px] text-white/50 truncate">Luminos closes, updates silently and reopens.</span>}
            </>
          )}
        </>
      ) : null}
      {u.error && <span className="text-[12.5px]" style={{ color: "#FCA5A5" }}>{u.error}</span>}
    </div>
  );
}
