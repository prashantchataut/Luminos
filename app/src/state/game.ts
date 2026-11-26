import { useSyncExternalStore } from "react";
import { isTauri, safeInvoke } from "../lib/tauri-bridge";
import { pullGameConfig } from "./client";

/**
 * The one source of truth for "is Minecraft running". Fed by three things so it can never get stuck on "Playing":
 *  - the `game-state` event the Rust watcher emits the moment the process exits (it polls try_wait every 400 ms),
 *  - the `launch` progress/failure events,
 *  - a 1000 ms poll of `get_game_status` while a game is starting or running.
 */
export type GameState = {
  status: "idle" | "preparing" | "running";
  pid: number | null;
  stage: string;
  fraction: number;
  message: string;
  msgSeq: number;
};

let state: GameState = { status: "idle", pid: null, stage: "", fraction: 0, message: "", msgSeq: 0 };
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
    if (r && r.status !== state.status) set({ status: r.status, pid: r.pid ?? null, stage: r.status === "idle" ? "" : state.stage });
  }, 1000);
}

let started = false;
export async function startGameWatch() {
  if (started || !isTauri()) return;
  started = true;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<any>("game-state", (e) => {
    const p = e.payload ?? {};
    set({ status: p.status ?? "idle", pid: p.pid ?? null, stage: p.status === "idle" ? "" : state.stage, fraction: 0 });
  });
  await listen<any>("launch", (e) => {
    const p = e.payload ?? {};
    if (p.phase === "preparing") set({ status: state.status === "idle" ? "preparing" : state.status, stage: p.stage ?? "", fraction: p.fraction ?? 0 });
    else if (p.phase === "client" && p.client && !p.client.ok) say(String(p.client.note ?? "The Luminos Client could not be installed."));
    else if (p.phase === "notice") say(String(p.note ?? ""));
    else if (p.phase === "failed") { set({ status: "idle", pid: null, stage: "" }); say(`Could not start Minecraft: ${p.error ?? "unknown error"}`); }
    else if (p.phase === "running") set({ status: "running", pid: p.pid ?? state.pid });
    else if (p.phase === "exited") set({ status: "idle", pid: null, stage: "" });
  });
  const r = await safeInvoke<{ status: GameState["status"]; pid: number | null } | null>("get_game_status", {}, null);
  if (r) set({ status: r.status, pid: r.pid ?? null });
}

export const useGame = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
export const markPreparing = () => set({ status: "preparing", stage: "Starting…" });
export const markIdle = () => set({ status: "idle", pid: null, stage: "" });
export const notify = say;

/** Kills the Java process (or cancels a launch that is still downloading) and puts the button back to Launch Game at once. */
export async function stopGame() {
  markIdle();
  await safeInvoke("stop_game", {}, null);
}
export async function quitLauncher() { await safeInvoke("quit_launcher", {}, null); }
