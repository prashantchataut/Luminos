import { useEffect } from "react";
import { useAppUpdate, APP_VERSION } from "./UpdateBanner";
import { safeInvoke } from "../lib/tauri-bridge";

const mb = (n: number) => (n / 1048576).toFixed(1);

/** Luminos Auto-Updater: version check, release notes, live 0-100 % streaming progress, one-click install (or reinstall when current). */
export default function UpdateModal({ u, onClose }: { u: ReturnType<typeof useAppUpdate>; onClose: () => void }) {
  useEffect(() => { void u.check(); }, []);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape" && !u.progress) onClose(); }; addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [u.progress]);
  const i = u.info, p = u.progress, busy = !!p, avail = !!i?.updateAvailable;
  const total = p?.total || i?.assetSize || i?.sizeBytes || 0;
  const label = busy ? (p!.phase === "installing" ? "Installing silently, Luminos will restart…" : "Downloading…") : avail ? "Download & Install Update Now" : "Test / Re-run Auto-Updater (v2.3.0)";
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center" style={{ background: "rgba(5,8,16,.66)" }} role="dialog" aria-modal="true" aria-label="Luminos Auto-Updater">
      <div className="w-[560px] max-w-[92vw] rounded-[16px] p-7 pop" style={{ background: "var(--side)", boxShadow: "0 30px 80px rgba(0,0,0,.55)", border: "1px solid var(--line, rgba(255,255,255,.08))" }}>
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-[18px] font-semibold">Luminos Auto-Updater</div><div className="text-[12.5px] mute mt-0.5">{avail ? "A newer launcher is on GitHub." : i ? "You are on the latest release. You can still re-run the updater to test it." : u.checking ? "Checking GitHub…" : "Check GitHub for a newer launcher."}</div></div>
          {!busy && <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-[8px] t press" style={{ background: "var(--surface-2)" }}>×</button>}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
          <div className="rounded-[10px] p-3" style={{ background: "var(--surface-2)" }}><dt className="mute text-[11px]">Current Version</dt><dd className="num font-semibold mt-0.5">v{i?.currentVersion ?? APP_VERSION}</dd></div>
          <div className="rounded-[10px] p-3" style={{ background: "var(--surface-2)" }}><dt className="mute text-[11px]">Latest GitHub Release</dt><dd className="num font-semibold mt-0.5">{i ? `v${i.latestVersion}` : u.checking ? "checking…" : "—"}{avail && <span className="ml-2 text-[11px]" style={{ color: "#86EFAC" }}>NEW</span>}</dd></div>
        </dl>
        {i?.releaseNotes ? <pre className="mt-4 max-h-[130px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed rounded-[10px] p-3 m-0 font-sans" style={{ background: "var(--surface-2)", color: "var(--mute)" }}>{i.releaseNotes.slice(0, 1400)}</pre> : null}
        {busy && (
          <div className="mt-5" aria-live="polite">
            <div className="h-[10px] rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}><div className="h-full" style={{ width: `${p!.percent}%`, background: "linear-gradient(90deg,#2B4BFF,#60A5FA)", transition: "width 120ms linear" }} /></div>
            <div className="mt-2 flex justify-between text-[12px] num"><span>{p!.percent}%</span><span className="mute">Downloaded {mb(p!.done)} MB / {total ? mb(total) : "?"} MB{p!.bytesPerSec ? ` · ${mb(p!.bytesPerSec)} MB/s` : ""}</span></div>
          </div>
        )}
        {u.error && <div role="alert" className="mt-4 text-[12.5px]" style={{ color: "#FCA5A5" }}>{u.error}</div>}
        <div className="mt-6 flex items-center gap-3">
          <button disabled={busy || !i?.downloadUrl} onClick={() => void u.install()} className="h-10 px-5 rounded-[10px] text-[13px] font-semibold t press disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>{label}</button>
          {!busy && <button onClick={() => void u.check()} className="h-10 px-4 rounded-[10px] text-[13px] font-medium t press" style={{ background: "var(--surface-2)" }}>{u.checking ? "Checking…" : "Check again"}</button>}
          {i?.page && !busy && <button onClick={() => void safeInvoke("open_external", { url: i.page }, null)} className="ml-auto text-[12px] underline mute">Release page</button>}
        </div>
        <p className="mt-4 text-[11.5px] mute m-0">Luminos downloads the installer to your temp folder, verifies it against the release checksum, closes, installs silently and reopens.</p>
      </div>
    </div>
  );
}
