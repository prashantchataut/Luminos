/** Typed bindings for the Tauri commands in `src-tauri/src/engine.rs`. `tools/bindings.test.mjs` fails if a name here has no Rust command.
 *  In the desktop app every call is real. In a plain browser (screenshots, `vite dev`) the live-panel calls run against a clearly
 *  labelled demo agent (`demo: true`), and the store talks to the real Modrinth API directly. */
import { isTauri } from "./api";

export type Verdict = { kind: string; disposition: "live" | "queued"; live_candidate: boolean; keep_on: boolean; registry_content: boolean; mixins: boolean; client_only: boolean; reasons: string[] };
export type ModRow = { id: string; file: string; name: string; version: string; enabled: boolean; requires: string[]; verdict: Verdict; pending: boolean | null };
export type Snapshot = {
  mods: ModRow[]; pending: { file: string; enable: boolean; label: string; batch: number }[];
  agent: { connected: boolean; mc: string | null; world: string | null; server: string | null };
  modules: { id: string; enabled: boolean }[]; packs: { id: string; enabled: boolean }[];
  kinds: Record<"module" | "resourcepack" | "datapack" | "shader", Verdict>; demo?: boolean;
};
export type ChangeKind = "module" | "resourcepack" | "mod" | "shader";
export type Change = { kind: ChangeKind; id: string; file?: string; label: string; to: boolean };
export type ApplyResult = { batch: number; results: { id: string; mode: "live" | "queued" | "error"; op?: number; error?: string; note?: string }[] };
export type AgentEvent = { seq: number; t: string; op?: number; stage?: string; pct?: number; detail?: string; ok?: boolean; paused?: boolean; world?: string; reason?: string };
export type StoreHit = { id: string; slug: string; title: string; description: string; icon_url: string | null; project_type: string; downloads: number; author: string; categories: string[] };
export type StoreKind = "mod" | "resourcepack" | "shader" | "datapack";
export type StoreQuery = { query: string; kind: StoreKind; limit: number; offset: number; sort: "downloads" | "relevance" | "updated"; categories: string[]; game_version?: string | null; loader?: string | null };
export type PresenceInput = { enabled: boolean; instanceName?: string | null; loader?: string | null; mcVersion?: string | null; state: string; serverAddress?: string | null; shareServer: boolean; shareInstanceName: boolean; startedUnix: number };
export type PresenceStatus = { state: "no-app-id" | "idle" | "connecting" | "waiting" | "connected"; detail: string };
export type Disagreement = { item: string; kind: "options" | "keybind" | "config" | "save"; sides: { instance: string; name: string; value: string; modified: number }[] };

async function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke: i } = await import("@tauri-apps/api/core");
  return i<T>(cmd, args);
}

// ---- demo agent (browser only): same shapes as the real thing, labelled, never used inside the desktop app --------------------------
const V = (o: Partial<Verdict>): Verdict => ({ kind: "mod", disposition: "queued", live_candidate: false, keep_on: false, registry_content: false, mixins: false, client_only: true, reasons: ["Applies on the next launch."], ...o });
const demo = {
  snap: {
    demo: true,
    mods: [
      { id: "sodium", file: "sodium.jar", name: "Sodium", version: "0.9.3", enabled: true, requires: [], pending: null, verdict: V({ keep_on: true, mixins: true, reasons: ["Keep-on list: Owns the renderer. Unloading it mid-session would tear down the GL state and redraw the world.", "Uses mixins merged into game classes at launch; they cannot be unloaded.", "Applies on the next launch."] }) },
      { id: "fabric-api", file: "fabric-api.jar", name: "Fabric API", version: "0.166.2", enabled: true, requires: [], pending: null, verdict: V({ keep_on: true, reasons: ["Keep-on list: Almost every other mod hooks into it, so removing it would break them all.", "Applies on the next launch."] }) },
      { id: "appleskin", file: "appleskin.jar", name: "AppleSkin", version: "3.1.0", enabled: true, requires: ["fabric-api"], pending: null, verdict: V({ live_candidate: true, reasons: ["Looks safe to swap live, but Luminos does not unload third-party code, so it applies on the next launch."] }) },
      { id: "zoomify", file: "zoomify.jar", name: "Zoomify", version: "2.15.0", enabled: true, requires: ["fabric-api"], pending: null, verdict: V({ mixins: true, reasons: ["Uses mixins merged into game classes at launch; they cannot be unloaded.", "Applies on the next launch."] }) },
      { id: "copperstuff", file: "copperstuff.jar", name: "Copper Stuff", version: "1.4.0", enabled: false, requires: ["fabric-api"], pending: null, verdict: V({ registry_content: true, client_only: false, reasons: ["Adds game content (blockstates (adds blocks)): the running game cannot remove blocks, items, entities, biomes or dimensions.", "Applies on the next launch."] }) },
    ] as ModRow[],
    pending: [], agent: { connected: true, mc: "1.21.11", world: "singleplayer", server: null },
    modules: [{ id: "fps", enabled: true }, { id: "keystrokes", enabled: false }, { id: "coordinates", enabled: true }, { id: "potions", enabled: true }],
    packs: [{ id: "file/Faithful 32x.zip", enabled: true }, { id: "file/Bare Bones.zip", enabled: false }],
    kinds: { module: V({ kind: "luminos_module", disposition: "live", reasons: ["Luminos module: switched in-process by the Luminos agent."] }), resourcepack: V({ kind: "resource_pack", disposition: "live", reasons: ["Resource pack: applied through the game's own resource reload."] }), datapack: V({ kind: "data_pack", disposition: "live", reasons: [] }), shader: V({ kind: "shader", reasons: ["Applies on the next launch."] }) },
  } as Snapshot,
  events: [] as AgentEvent[], seq: 0, batch: 1,
  emit(e: Omit<AgentEvent, "seq">) { demo.events.push({ ...e, seq: ++demo.seq }); },
};

export const engine = {
  liveSnapshot: (instance: string): Promise<Snapshot> => isTauri ? invoke("live_snapshot", { instance }) : Promise.resolve(structuredClone(demo.snap)),
  async liveApply(instance: string, changes: Change[]): Promise<ApplyResult> {
    if (isTauri) return invoke("live_apply", { instance, changes });
    const batch = demo.batch++; const results: ApplyResult["results"] = [];
    for (const c of changes) {
      if (c.kind === "module" || c.kind === "resourcepack") {
        const op = ++demo.seq + 1000; results.push({ id: c.id, mode: "live", op });
        const list = c.kind === "module" ? demo.snap.modules : demo.snap.packs; const row = list.find((x) => x.id === c.id); if (row) row.enabled = c.to;
        const steps = c.kind === "module" ? ["received", "applying", "applied"] : ["received", "applying", "reloading", "applied"];
        steps.forEach((stage, i) => setTimeout(() => { demo.emit({ t: "progress", op, stage }); if (i === steps.length - 1) demo.emit({ t: "done", op, ok: true }); }, 120 * (i + 1)));
      } else {
        const row = demo.snap.mods.find((m) => m.id === c.id); if (row) row.pending = c.to === row.enabled ? null : c.to;
        demo.snap.pending = demo.snap.pending.filter((p) => p.file !== c.file).concat(row?.pending === null ? [] : [{ file: c.file!, enable: c.to, label: c.label, batch }]);
        results.push({ id: c.id, mode: "queued" });
      }
    }
    return { batch, results };
  },
  async liveCancelBatch(_instance: string, batch: number): Promise<number> {
    if (isTauri) return invoke("live_cancel_batch", { instance: _instance, batch });
    const gone = demo.snap.pending.filter((p) => p.batch === batch); demo.snap.pending = demo.snap.pending.filter((p) => p.batch !== batch);
    for (const g of gone) { const m = demo.snap.mods.find((x) => x.file === g.file); if (m) m.pending = null; }
    return gone.length;
  },
  liveEvents: (since: number): Promise<{ events: AgentEvent[]; seq: number; connected: boolean }> => isTauri ? invoke("live_events", { since }) : Promise.resolve({ events: demo.events.filter((e) => e.seq > since), seq: demo.seq, connected: true }),
  async livePause(on: boolean): Promise<number> {
    if (isTauri) return invoke("live_pause", { on });
    demo.emit({ t: "state", paused: on, world: "singleplayer" }); return 0;
  },
  storeSearch: async (q: StoreQuery): Promise<{ total: number; hits: StoreHit[] }> => {
    if (isTauri) return invoke("store_search", { q });
    const facets: string[][] = [[`project_type:${q.kind}`], ...(q.kind === "mod" && q.loader ? [[`categories:${q.loader}`]] : []), ...(q.game_version ? [[`versions:${q.game_version}`]] : []), ...q.categories.map((c) => [`categories:${c}`])];
    const u = `https://api.modrinth.com/v2/search?${new URLSearchParams({ query: q.query, facets: JSON.stringify(facets), index: q.sort, offset: String(q.offset), limit: String(q.limit) })}`;
    const r = await fetch(u); if (!r.ok) throw new Error(`Modrinth answered ${r.status}`);
    const j = await r.json();
    return { total: j.total_hits, hits: j.hits.map((h: any): StoreHit => ({ id: h.project_id, slug: h.slug, title: h.title, description: h.description, icon_url: h.icon_url ?? null, project_type: h.project_type, downloads: h.downloads, author: h.author, categories: h.categories })) };
  },
  storeInstall: (instance: string, slug: string, kind: StoreKind): Promise<string[]> => isTauri ? invoke("store_install", { instance, slug, kind }) : new Promise((r) => setTimeout(() => r([`${slug}.jar`]), 900)),
  storeInstalled: (instance: string): Promise<string[]> => isTauri ? invoke("store_installed", { instance }) : Promise.resolve(["mod:sodium", "mod:fabric-api", "mod:appleskin", "mod:zoomify"]),
  dedupStatus: (): Promise<{ total_saved: number; per_instance: Record<string, number> }> => isTauri ? invoke("dedup_status") : Promise.resolve({ total_saved: 1.6e9, per_instance: { "luminos-263": 0.9e9, "luminos-12111": 0.7e9 } }),
  dedupRun: (): Promise<{ total_saved: number; per_instance: Record<string, number>; report: { newly_linked: number; reflinked: number; hardlinked: number } }> => isTauri ? invoke("dedup_run") : Promise.resolve({ total_saved: 1.6e9, per_instance: {}, report: { newly_linked: 0, reflinked: 0, hardlinked: 0 } }),
  depsCheck: (instance: string): Promise<{ missing: { mod: string; needs: string }[]; required_by: Record<string, string[]> }> => isTauri ? invoke("deps_check", { instance }) : Promise.resolve({ missing: [], required_by: {} }),
  redactScrub: (text: string): Promise<string> => isTauri ? invoke("redact_scrub", { text }) : Promise.resolve(text),
  quickplayParse: (link: string): Promise<{ instance: string; kind: "world" | "server"; value: string }> => invoke("quickplay_parse", { link }),
  quickplayShortcut: (instance: string, kind: "world" | "server", value: string): Promise<string> => isTauri ? invoke("quickplay_shortcut", { instance, kind, value }) : Promise.resolve(`Desktop/${instance} - ${value}.url`),
  presenceUpdate: (input: PresenceInput): Promise<PresenceStatus> => isTauri ? invoke("presence_update", { input }) : Promise.resolve({ state: "no-app-id", detail: "Browser preview: the launcher sends presence." }),
  presenceStatus: (): Promise<PresenceStatus> => isTauri ? invoke("presence_status") : Promise.resolve({ state: "no-app-id", detail: "Browser preview: the launcher sends presence." }),
  presencePreview: (input: PresenceInput): Promise<unknown> => invoke("presence_preview", { input }),
  sharesScan: (saves: boolean): Promise<{ instances: { id: string; name: string }[]; disagreements: Disagreement[] }> => isTauri ? invoke("shares_scan", { saves }) : Promise.resolve({
    instances: [{ id: "luminos-263", name: "Luminos 26.3" }, { id: "luminos-12111", name: "Luminos 1.21.11" }],
    disagreements: [
      { item: "options:fov", kind: "options", sides: [{ instance: "luminos-263", name: "Luminos 26.3", value: "90.0", modified: 1 }, { instance: "luminos-12111", name: "Luminos 1.21.11", value: "70.0", modified: 2 }] },
      { item: "options:key_key.luminos.panel", kind: "keybind", sides: [{ instance: "luminos-263", name: "Luminos 26.3", value: "key.keyboard.right.control", modified: 1 }, { instance: "luminos-12111", name: "Luminos 1.21.11", value: "key.keyboard.g", modified: 2 }] },
      ...(saves ? [{ item: "save:Mira's Hideout", kind: "save" as const, sides: [{ instance: "luminos-263", name: "Luminos 26.3", value: "212 MB, last played today", modified: 3 }, { instance: "luminos-12111", name: "Luminos 1.21.11", value: "198 MB, last played 3 days ago", modified: 1 }] }] : []),
    ] }),
  sharesResolve: (item: string, choice: string): Promise<string[]> => isTauri ? invoke("shares_resolve", { item, choice }) : Promise.resolve([]),
  p2pRoomCode: (): Promise<string> => invoke("p2p_room_code"),
  p2pGuestListen: (): Promise<number> => invoke("p2p_guest_listen"),
  p2pHostDial: (port: number): Promise<number> => invoke("p2p_host_dial", { port }),
  p2pWrite: (conn: number, b64: string): Promise<void> => invoke("p2p_write", { conn, b64 }),
  p2pClose: (conn: number): Promise<void> => invoke("p2p_close", { conn }),
};

export const fmtBytes = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : n > 0 ? `${Math.max(1, Math.round(n / 1e3))} KB` : "0 MB";
