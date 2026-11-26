import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { dismissCrash, stopGame, useGame } from "../state/game";

/**
 * Game-opening progress, driven only by real `launch-progress` events from the desktop shell (six stages, then the game's own
 * stdout until its window opens). Nothing here is timed or faked: the bar moves when a stage finishes or a log line arrives.
 */
const RING = "border-white/5";

function Spinner() {
  return <span aria-hidden className="block w-[14px] h-[14px] rounded-full border-2 border-[#2B4BFF] border-t-transparent animate-spin motion-reduce:animate-none shrink-0" />;
}

export function LaunchProgressPanel() {
  const g = useGame();
  const [showLog, setShowLog] = useState(true);
  const p = g.progress;
  const pct = Math.max(0, Math.min(100, Math.round(p?.percent ?? 0)));
  const total = p?.totalSteps ?? 6;
  const step = p?.stepIndex ?? 1;
  return (
    <div role="status" aria-live="polite" data-testid="launch-progress" className={`w-full max-w-[520px] bg-[#121620]/95 rounded-[12px] p-4 border ${RING} space-y-3`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Spinner />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white truncate" title={p?.stage}>{p?.stage ?? "Starting…"}</div>
            <div className="text-[12px] text-[#8A94A6] truncate" title={p?.detail}>{p?.detail ?? "Preparing the launch…"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="h-6 px-2 rounded-[6px] bg-[#1C2230] text-[12px] font-mono tabular-nums text-white grid place-items-center min-w-[46px]" aria-label={`${pct} percent`}>{pct}%</span>
          <button onClick={() => void stopGame()} aria-label="Cancel launch" className="h-8 px-3 rounded-[8px] text-[12.5px] font-medium text-[#CBD5E1] hover:text-white hover:bg-[#1C2230] t press">✕ Cancel</button>
        </div>
      </div>
      <div className="h-[6px] rounded-full bg-[#1C2230] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-[#2B4BFF] transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#64748B] tabular-nums shrink-0">Step {step} of {total}</span>
        <button onClick={() => setShowLog((v) => !v)} aria-expanded={showLog} className="text-[11px] text-[#64748B] hover:text-[#CBD5E1] t">{showLog ? "Hide log" : "Show log"}</button>
      </div>
      {showLog && (
        <div className="text-[11px] font-mono text-[#64748B] truncate" title={p?.logLine || p?.detail} data-testid="launch-logline">
          {p?.logLine || p?.detail || "Waiting for the first message…"}
        </div>
      )}
    </div>
  );
}

/** Sidebar footer: the same real numbers in one compact block. */
export function LaunchProgressMini() {
  const g = useGame();
  if (g.status !== "preparing") return null;
  const pct = Math.max(0, Math.min(100, Math.round(g.progress?.percent ?? 0)));
  return (
    <div className={`rounded-[10px] bg-[#121620]/95 border ${RING} p-3 space-y-2`} role="status">
      <div className="flex items-center justify-between gap-2 text-[11.5px]">
        <span className="truncate text-[#CBD5E1]" title={g.progress?.stage}>{g.progress?.stage ?? "Starting…"}</span>
        <span className="font-mono tabular-nums text-white shrink-0">{pct}%</span>
      </div>
      <div className="h-[4px] rounded-full bg-[#1C2230] overflow-hidden"><div className="h-full rounded-full bg-[#2B4BFF] transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Shown when the game dies before its window opens, or a launch step fails: the real log, copyable. */
export function LaunchCrashModal() {
  const g = useGame();
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(t); }, [copied]);
  if (!g.crash) return null;
  const log = g.crash.errorLog || "Minecraft exited without printing anything. Run it once from the official launcher to see if Java itself is broken.";
  const copy = async () => {
    try { await navigator.clipboard.writeText(log); setCopied(true); }
    catch {
      const ta = document.createElement("textarea"); ta.value = log; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); setCopied(true); } finally { ta.remove(); }
    }
  };
  return (
    <Modal title="Minecraft did not start" onClose={dismissCrash} w={640}>
      <div className="space-y-4" data-testid="launch-diagnostic">
        <p className="m-0 text-[13px] leading-relaxed text-[#8A94A6]">
          {g.crash.exitCode != null ? <>The game process exited with code <span className="font-mono text-white">{g.crash.exitCode}</span> before its window opened.</> : <>The launch stopped before the game could start.</>} These are the last lines it printed.
        </p>
        <pre tabIndex={0} aria-label="Launch error log" className="m-0 max-h-[300px] overflow-auto rounded-[10px] bg-[#0B0D12] p-4 text-[11.5px] leading-[1.6] font-mono text-[#CBD5E1] whitespace-pre-wrap break-words select-text">{log}</pre>
        <div className="flex justify-end gap-3">
          <button onClick={dismissCrash} className="h-[40px] px-4 rounded-[10px] text-[13px] card t press">Close</button>
          <button onClick={() => void copy()} className="h-[40px] px-5 rounded-[10px] text-[13px] font-semibold text-white t press" style={{ background: "#2B4BFF" }}>{copied ? "Copied" : "Copy Log"}</button>
        </div>
      </div>
    </Modal>
  );
}
