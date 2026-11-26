import { useSyncExternalStore } from "react";
import { isTauri, safeInvoke } from "../lib/tauri-bridge";
import { pullGameConfig } from "./client";

/**
 * The one source of truth for "is Minecraft running". Fed by three things so it can never get stuck on "Playing":
 *  - the `game-state` event the Rust watcher emits the moment the process exits (it polls try_wait every 400 ms),
 *  - the `launch` progress/failure events,
 *  - a 1000 ms poll of `get_game_status` while a game is starting or running.
 */
/** One `launch-progress` event from the desktop shell: six real stages, then the game's own log until its window opens. */
export type LaunchProgress = { stage: string; percent: number; detail: string; stepIndex: number; totalSteps: number; logLine?: string };
export type LaunchCrash = { exitCode: number | null; errorLog: string };

export type GameState = {
  status: "idle" | "preparing" | "running";
  pid: number | null;
  stage: string;
  fraction: number;
  message: string;
  msgSeq: number;
  progress: LaunchProgress | null;
  crash: LaunchCrash | null;
};

let state: GameState = { status: "idle", pid: null, stage: "", fraction: 0, message: "", msgSeq: 0, progress: null, crash: null };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function set(p: Partial<GameState>) {
  const prev = state.status;
  state = { ...state, ...p };
  if (prev === "running" && state.status === "idle") void pullGameConfig(); // in-game toggles come back into the launcher
  emit();
  syncPoll();
}
function say(message: string) { set({ message, msgSeq: state.msgSeq + 1 }); }

let timer = 0;
function syncPoll() {
  if (state.status === "idle") { clearInterval(timer); timer = 0; return; }
  if (timer) return;
  timer = window.setInterval(async () => {
    const r = await safeInvoke<{ status: GameState["status"]; pid: number | null } | null>("get_game_status", {}, null);
    if (r && r.status !== state.status) set({ status: r.status, pid: r.pid ?? null, stage: r.status === "idle" ? "" : state.stage, progress: r.status === "preparing" ? state.progress : null });
  }, 1000);
}

let started = false;
export async function startGameWatch() {
  // Screenshot-only: ?demo=launching shows the launch panel mid-way in a plain browser, never inside the desktop app.
  if (!isTauri() && typeof location !== "undefined" && location.search.includes("demo=launching")) {
    set({ status: "preparing", progress: { stage: "4. Provisioning Sodium & Performance Stack", percent: 65, detail: "Syncing performance stack: Sodium, Lithium, FerriteCore, ImmediatelyFast ready", stepIndex: 4, totalSteps: 6, logLine: "[main/INFO] (FabricLoader) Loading 52 mods" } });
  }
  if (started || !isTauri()) return;
  started = true;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<any>("game-state", (e) => {
    const p = e.payload ?? {};
    if (p.status === "crashed") {
      // The game died before its window opened: back to idle, with the real log for the diagnostic dialog.
      set({ status: "idle", pid: null, stage: "", fraction: 0, progress: null, crash: { exitCode: p.exitCode ?? null, errorLog: String(p.errorLog ?? "") } });
      return;
    }
    set({ status: p.status ?? "idle", pid: p.pid ?? null, stage: p.status === "idle" ? "" : state.stage, fraction: 0, progress: p.status === "preparing" ? state.progress : null });
  });
  await listen<LaunchProgress>("launch-progress", (e) => {
    const p = e.payload;
    if (!p || state.status === "running") return; // late events after the window opened change nothing
    set({ status: state.status === "idle" ? "preparing" : state.status, progress: p, stage: p.stage });
  });
  await listen<any>("launch", (e) => {
    const p = e.payload ?? {};
    if (p.phase === "preparing") set({ status: state.status === "idle" ? "preparing" : state.status, stage: p.stage ?? "", fraction: p.fraction ?? 0 });
    else if (p.phase === "client" && p.client && !p.client.ok) say(String(p.client.note ?? "The Luminos Client could not be installed."));
    else if (p.phase === "notice") say(String(p.note ?? ""));
    else if (p.phase === "failed") { set({ status: "idle", pid: null, stage: "", progress: null }); if (!state.crash) say(`Could not start Minecraft: ${p.error ?? "unknown error"}`); }
    else if (p.phase === "running") set({ status: "running", pid: p.pid ?? state.pid, progress: null });
    else if (p.phase === "exited") set({ status: "idle", pid: null, stage: "", progress: null });
  });
  const r = await safeInvoke<{ status: GameState["status"]; pid: number | null } | null>("get_game_status", {}, null);
  if (r) set({ status: r.status, pid: r.pid ?? null });
}

export const useGame = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
export const markPreparing = () => set({ status: "preparing", stage: "Starting…", crash: null, progress: { stage: "1. Checking Java Runtime", percent: 2, detail: "Starting the launch…", stepIndex: 1, totalSteps: 6 } });
export const markIdle = () => set({ status: "idle", pid: null, stage: "", progress: null });
export const dismissCrash = () => set({ crash: null });
export const notify = say;

/** Kills the Java process (or cancels a launch that is still downloading) and puts the button back to Launch Game at once. */
export async function stopGame() {
  markIdle();
  await safeInvoke("stop_game", {}, null);
}
export async function quitLauncher() { await safeInvoke("quit_launcher", {}, null); }
