/** Live mod panel planner. Pure functions: what a switch would change, before anything is touched.
 *  Same dependency rules as the engine's `core/src/deps.rs` (closures are cycle-safe). */
/** `live`: the in-game agent can apply this row right now (module/pack with a connected game). Absent = fall back to `liveApply`. */
export type Mod = { id: string; slug: string; name: string; version: string; enabled: boolean; requires: string[]; blurb: string; live?: boolean };
export type Change = { id: string; name: string; to: boolean; why: "requested" | "needs" | "needed-by"; mode: "live" | "next-launch" };
export type Blocked = { id: string; name: string; reason: string };
export type Plan = { changes: Change[]; blocked: Blocked[]; download: string[]; tooMany: boolean };

export const MAX_LIVE = 5;
/** Never switched from the panel. One line each: it is the tooltip. */
export const KEEP_ON: Record<string, string> = {
  sodium: "Owns the renderer. Unloading it mid-session would tear down the GL state and redraw the world.",
  modernfix: "Patches core game classes at startup; those patches cannot be taken back while the game runs.",
  c2me: "Replaces the chunk loading threads; stopping it mid-session can corrupt chunks in flight.",
  lithium: "Rewrites core game logic in place; the original code is gone once it is loaded.",
  ferritecore: "Changes how block states are stored in memory; switching it would need every state rebuilt.",
  "fabric-api": "Almost every other mod hooks into it, so removing it would break them all.",
  immediatelyfast: "Replaces the renderer's buffers; same reason as Sodium.",
};
/** Can be switched, but only with a world reload or restart, so it is queued rather than applied. */
export const QUEUE_ONLY: Record<string, string> = {
  iris: "Changes the shader pipeline; switching it redraws the world.",
  "sodium-extra": "Adds options to the renderer; applied on the next launch.",
  "reeses-sodium-options": "Replaces the renderer's settings screen; applied on the next launch.",
  indium: "Renderer compatibility layer; applied on the next launch.",
};

const byId = (mods: Mod[]) => new Map(mods.map((m) => [m.id, m]));
const dependants = (mods: Mod[], id: string) => mods.filter((m) => m.enabled && m.requires.includes(id));

export function missing(mods: Mod[]) {
  const m = byId(mods); const out: { mod: Mod; needs: string; installed: boolean }[] = [];
  for (const x of mods.filter((x) => x.enabled)) for (const r of x.requires) { const d = m.get(r); if (!d?.enabled) out.push({ mod: x, needs: d?.name ?? r, installed: !!d }); }
  return out;
}
export function disableClosure(mods: Mod[], id: string): string[] {
  const seen = new Set<string>(); const stack = [id];
  while (stack.length) { const cur = stack.pop()!; for (const d of dependants(mods, cur)) if (d.id !== id && !seen.has(d.id)) { seen.add(d.id); stack.push(d.id); } }
  return [...seen].sort();
}
export function enableClosure(mods: Mod[], id: string): { on: string[]; absent: string[] } {
  const m = byId(mods); const on = new Set<string>(), absent = new Set<string>(), seen = new Set([id]); const stack = [id];
  while (stack.length) { const n = m.get(stack.pop()!); if (!n) continue; for (const r of n.requires) { const d = m.get(r); if (!d) absent.add(r); else { if (!d.enabled) on.add(r); if (!seen.has(r)) { seen.add(r); stack.push(r); } } } }
  return { on: [...on].sort(), absent: [...absent].sort() };
}

/** `requests`: the mods the user flipped (id -> wanted state). A change is "live" only when its row says `live`; nothing else can claim it. */
export function planSwitch(mods: Mod[], requests: Record<string, boolean>, liveApply = false): Plan {
  const m = byId(mods); const plan: Plan = { changes: [], blocked: [], download: [], tooMany: Object.keys(requests).length > MAX_LIVE };
  const seen = new Map<string, Change>();
  const mode = (x: Mod): Change["mode"] => ((x.live ?? (liveApply && !QUEUE_ONLY[x.slug])) ? "live" : "next-launch");
  const add = (x: Mod, to: boolean, why: Change["why"]) => { if (x.enabled !== to && !seen.has(x.id)) { const c = { id: x.id, name: x.name, to, why, mode: mode(x) }; seen.set(x.id, c); plan.changes.push(c); } };
  for (const [id, to] of Object.entries(requests)) {
    const x = m.get(id); if (!x) continue;
    if (KEEP_ON[x.slug]) { plan.blocked.push({ id, name: x.name, reason: KEEP_ON[x.slug] }); continue; }
    if (!to) {
      const deps = disableClosure(mods, id).map((d) => m.get(d)!).filter(Boolean);
      const pinned = deps.find((d) => KEEP_ON[d.slug]);
      if (pinned) { plan.blocked.push({ id, name: x.name, reason: `${pinned.name} needs it and ${pinned.name} cannot be turned off.` }); continue; }
      add(x, false, "requested"); deps.forEach((d) => add(d, false, "needed-by"));
    } else {
      const { on, absent } = enableClosure(mods, id);
      add(x, true, "requested"); on.forEach((d) => add(m.get(d)!, true, "needs")); absent.forEach((a) => plan.download.push(a));
    }
  }
  return plan;
}

export type History = { stack: Record<string, boolean>[] };
const snapshot = (mods: Mod[]) => Object.fromEntries(mods.map((x) => [x.id, x.enabled]));
/** Applies a plan and records the state before it, so one press of Undo restores it. */
export function applyPlan(mods: Mod[], plan: Plan, h: History): { mods: Mod[]; history: History } {
  if (!plan.changes.length) return { mods, history: h };
  const to = new Map(plan.changes.map((c) => [c.id, c.to]));
  return { mods: mods.map((x) => (to.has(x.id) ? { ...x, enabled: to.get(x.id)! } : x)), history: { stack: [...h.stack, snapshot(mods)] } };
}
export function undo(mods: Mod[], h: History): { mods: Mod[]; history: History; reverted: number } {
  const prev = h.stack[h.stack.length - 1]; if (!prev) return { mods, history: h, reverted: 0 };
  const next = mods.map((x) => (x.id in prev ? { ...x, enabled: prev[x.id] } : x));
  return { mods: next, history: { stack: h.stack.slice(0, -1) }, reverted: next.filter((x, i) => x.enabled !== mods[i].enabled).length };
}
