/**
 * The ONLY place in the UI that touches Tauri's `invoke`.
 * A missing runtime (plain browser), a missing Rust command, a rejected promise or a hung command can never throw into React:
 * every failure is logged once and the caller's fallback is returned instead.
 */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && !!((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);

const TIMEOUT_MS = 4000;
const warned = new Set<string>();
const warn = (cmd: string, why: unknown) => {
  const k = cmd + String(why);
  if (warned.has(k)) return;
  warned.add(k);
  console.warn(`[luminos] ${cmd} failed, using fallback:`, why);
};

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
let invokeP: Promise<InvokeFn> | null = null;
const loadInvoke = () => (invokeP ??= import("@tauri-apps/api/core").then((m) => m.invoke as InvokeFn));

export async function safeInvoke<T>(cmd: string, args: Record<string, unknown> | undefined, fallback: T, timeoutMs = TIMEOUT_MS): Promise<T> {
  if (!isTauri()) return fallback;
  let timer = 0;
  try {
    const invoke = await loadInvoke();
    const timeout = new Promise<never>((_, rej) => { timer = window.setTimeout(() => rej(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs); });
    return await Promise.race([invoke<T>(cmd, args), timeout]);
  } catch (e) {
    warn(cmd, e);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/** Debounced fire-and-forget write to the Rust side. Never throws. */
const timers = new Map<string, number>();
export function safeWrite(cmd: string, args: Record<string, unknown>, delay = 180) {
  clearTimeout(timers.get(cmd));
  timers.set(cmd, window.setTimeout(() => { void safeInvoke(cmd, args, null); }, delay));
}
