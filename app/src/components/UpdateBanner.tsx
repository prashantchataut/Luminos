import { useCallback, useEffect, useRef, useState } from "react";
import { safeInvoke, isTauri } from "../lib/tauri-bridge";

export const APP_VERSION = "2.3.0";
export type UpdateInfo = {
  updateAvailable: boolean; currentVersion: string; latestVersion: string; downloadUrl: string | null; assetName?: string | null; assetSize?: number;
  releaseNotes: string; publishedAt?: string; page: string | null; sizeBytes: number;
};
export type UpdateProgress = { phase: "downloading" | "installing"; percent: number; done: number; total: number; bytesPerSec: number };

/**
 * Check GitHub through Rust (`check_app_update`), then stream + verify the installer and hand over to the detached silent installer
 * script (`install_app_update`). Rust always returns the latest release's URL, so "Reinstall latest" works while up to date.
 */
export function useAppUpdate(autoCheck: boolean) {
  const [info, setInfo] = useState<UpdateInfo | null>(null), [checking, setChecking] = useState(false), [error, setError] = useState("");
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const un = useRef<null | (() => void)>(null);
  const check = useCallback(async () => {
    if (!isTauri()) { setError("Updates are checked by the desktop app (this is a browser preview)."); return null; }
    setChecking(true); setError("");
    const r = await safeInvoke<UpdateInfo | string | "__failed__">("check_app_update", {}, "__failed__", 25000);
    setChecking(false);
    if (r === "__failed__") { setError("Could not reach GitHub releases. Check your connection and try again."); return null; }
    setInfo(r as UpdateInfo); return r as UpdateInfo;
  }, []);
  useEffect(() => { if (autoCheck) void check(); }, [autoCheck, check]);
  useEffect(() => () => { un.current?.(); }, []);
  const install = useCallback(async () => {
    if (!info?.downloadUrl) return;
    setError(""); setProgress({ phase: "downloading", percent: 0, done: 0, total: info.assetSize ?? info.sizeBytes ?? 0, bytesPerSec: 0 });
    const { listen } = await import("@tauri-apps/api/event");
    un.current?.();
    un.current = await listen<UpdateProgress>("update-progress", (e) => setProgress(e.payload));
    const { invoke } = await import("@tauri-apps/api/core");
    try { await invoke("install_app_update", { downloadUrl: info.downloadUrl }); }
    catch (e) { setProgress(null); setError(`The update failed and nothing was changed: ${String(e)}`); }
  }, [info]);
  return { info, checking, progress, pct: progress ? progress.percent : null, error, check, install };
}

/** Top notification bar: only visible when GitHub has a newer release. Clicking opens the Auto-Updater modal. */
export default function UpdateBanner({ u, onOpen }: { u: ReturnType<typeof useAppUpdate>; onOpen: () => void }) {
  if (!u.info?.updateAvailable) return null;
  return (
    <button onClick={onOpen} role="status" className="shrink-0 px-8 h-[44px] flex items-center gap-4 w-full text-left t" style={{ background: "#12203F", borderBottom: "1px solid #24407A" }}>
      <span className="text-[13px] font-semibold text-white">Luminos v{u.info.latestVersion} is available — Click to Auto-Update &amp; Restart</span>
      <span className="text-[12px] text-white/50">v{u.info.currentVersion} → v{u.info.latestVersion}</span>
      <span className="ml-auto h-7 px-3 rounded-[8px] text-[12px] font-semibold text-white grid place-items-center" style={{ background: "#2B6BFF" }}>Update now</span>
    </button>
  );
}
