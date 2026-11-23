import MR from "./modrinth-meta.json";
// One call layer: real Tauri commands in the app, seeded believable data in a plain browser (screenshots, dev).
export const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

export type Inst = { id: string; name: string; mc: string; loader: string; mods?: number; playtime: number; last: string; java: number };
export type AuditReport = { ok: boolean; checked: number; replaced: string[]; dropped: { name: string; reason: string }[]; notes: string[] };

export const SEED = {
  version: "0.6.0",
  account: { username: "Mira", uuid: "7f3a…c91e", kind: "Offline", cape: "luminos-moon-cape", skin: "luminos-pilot" },
  instances: [
    { id: "luminos-263", name: "Luminos", mc: "26.3", loader: "Fabric", mods: 31, playtime: 51720, last: "Today", java: 25 },
    { id: "luminos-12111", name: "Luminos", mc: "1.21.11", loader: "Fabric", mods: 29, playtime: 148320, last: "2 days ago", java: 21 },
    { id: "survival", name: "Survival with Mira", mc: "26.2", loader: "Fabric", mods: 12, playtime: 90180, last: "Last week", java: 25 },
    { id: "snap", name: "Vanilla 26.1.2", mc: "26.1.2", loader: "Vanilla", mods: 0, playtime: 7200, last: "3 weeks ago", java: 25 },
    { id: "duels", name: "Sky Duels", mc: "1.21.4", loader: "Fabric", mods: 18, playtime: 33600, last: "Last month", java: 21 },
  ] as Inst[],
  audit: {
    ok: true, checked: 31,
    replaced: ["Sodium 0.9.4-beta.1 → 0.9.3 (stable)", "Luminos Client 0.2.0 → 0.3.0 (built for Minecraft 26.3)"],
    dropped: [{ name: "Iris Shaders", reason: "Only beta builds exist for Minecraft 26.3. Turn on “Allow beta mods” to use them." }],
    notes: ["Using Sodium 0.9.3 so Sodium Extra and Reese's Sodium Options can load."],
  } as AuditReport,
  worlds: [
    { name: "Mira's Hideout", mode: "Survival", played: "Today · 1h 12m", inst: "26.3", seed: 4 },
    { name: "Cliffside SMP", mode: "Survival", played: "Yesterday", inst: "26.3", seed: 9 },
    { name: "Redstone Lab", mode: "Creative", played: "3 days ago", inst: "1.21.11", seed: 2 },
  ],
  playtime: { total: 339000, week: 21600, streak: 5, daily: [["Mon", 3200], ["Tue", 0], ["Wed", 5400], ["Thu", 1800], ["Fri", 7200], ["Sat", 9800], ["Sun", 4300], ["Mon", 2600], ["Tue", 4100], ["Wed", 0], ["Thu", 6100], ["Fri", 3900], ["Sat", 8700], ["Sun", 5200]] as [string, number][] },
  mods: [
    { slug: "sodium", title: "Sodium", author: "jellysquid3", desc: "The fastest rendering engine for Minecraft, with big FPS gains.", downloads: 112000000, cat: "Performance", ver: "0.9.3", hue: 150 },
    { slug: "lithium", title: "Lithium", author: "jellysquid3", desc: "Game logic, physics and AI optimisations without changing behaviour.", downloads: 84000000, cat: "Performance", ver: "0.21.2", hue: 120 },
    { slug: "iris", title: "Iris Shaders", author: "coderbot", desc: "Shader pack support built for Sodium.", downloads: 61000000, cat: "Visuals", ver: "1.10.0-beta.2", beta: true, hue: 280 },
    { slug: "resourcify", title: "Resourcify", author: "DeDiamondPro", desc: "Browse and install resource packs, shaders and data packs from inside the game.", downloads: 3200000, cat: "Utility", ver: "1.8.1", hue: 205, builtin: true },
    { slug: "zoomify", title: "Zoomify", author: "isXander", desc: "Smooth, fully configurable zoom with scroll to adjust.", downloads: 9100000, cat: "Utility", ver: "2.15.0", hue: 40 },
    { slug: "entityculling", title: "Entity Culling", author: "tr7zw", desc: "Skips rendering entities you cannot see.", downloads: 47000000, cat: "Performance", ver: "1.9.1", hue: 12 },
    { slug: "appleskin", title: "AppleSkin", author: "squeek502", desc: "Hunger and saturation preview right on the food bar.", downloads: 38000000, cat: "HUD", ver: "3.1.0", hue: 355 },
    { slug: "controlify", title: "Controlify", author: "isXander", desc: "Full controller support with radial menus.", downloads: 6500000, cat: "Utility", ver: "2.4.0", hue: 320 },
    { slug: "ferrite-core", title: "FerriteCore", author: "malte0811", desc: "Memory usage optimisations for large mod lists.", downloads: 52000000, cat: "Performance", ver: "8.1.1", hue: 180 },
    { slug: "mouse-tweaks", title: "Mouse Tweaks", author: "YaLTeR", desc: "Faster inventory management with the mouse.", downloads: 27000000, cat: "Utility", ver: "2.30", hue: 95 },
  ],
  servers: [
    { name: "Hearthstone SMP", address: "play.hearthstone.example", online: 142, max: 300, ping: 38, offline_ok: true, tags: ["Survival", "Friendly"], ver: "26.3", fav: true },
    { name: "Cobalt Skyblock", address: "mc.cobalt.example", online: 612, max: 1000, ping: 61, offline_ok: false, tags: ["Skyblock"], ver: "1.21.11" },
    { name: "Pixel Parkour", address: "pp.example.net", online: 58, max: 120, ping: 24, offline_ok: true, tags: ["Parkour"], ver: "26.3" },
    { name: "Redstone Guild", address: "play.rsguild.example", online: 91, max: 200, ping: 47, offline_ok: true, tags: ["Technical", "Creative"], ver: "1.21.11" },
    { name: "Moonlit Realms", address: "moonlit.example.org", online: 233, max: 400, ping: 72, offline_ok: false, tags: ["RPG"], ver: "26.2" },
  ],
  storage: [
    { name: "Game files", detail: "Minecraft versions, libraries, assets", human: "2.4 GB", bytes: 2.4, reclaimable: true },
    { name: "Instances", detail: "Your worlds, mods and settings", human: "1.1 GB", bytes: 1.1, reclaimable: false },
    { name: "Java runtimes", detail: "Java 21 and Java 25", human: "612 MB", bytes: 0.6, reclaimable: true },
    { name: "Cache", detail: "Mod jars checked by the solver, icons", human: "184 MB", bytes: 0.18, reclaimable: true },
  ],
  hosts: [["api.modrinth.com", "Mod search and downloads"], ["meta.fabricmc.net", "Fabric loader versions"], ["piston-meta.mojang.com", "Minecraft files"], ["api.github.com", "Luminos updates"], ["sessionserver.mojang.com", "Premium name check"]],
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function norm(i: any): Inst {
  const loaders: Record<string, string> = { vanilla: "Vanilla", fabric: "Fabric", quilt: "Quilt", forge: "Forge", neoforge: "NeoForge" };
  return { id: i.id, name: i.name, mc: i.mc_version, loader: loaders[i.loader] || "Fabric", playtime: i.playtime_secs || 0, last: i.last_played ? new Date(i.last_played * 1000).toLocaleDateString() : "Never", java: Number(i.mc_version?.split(".")[0]) >= 26 ? 25 : 21 };
}

export async function bootstrap() {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const b: any = await invoke("bootstrap");
    return { version: b.version, setupDone: b.settings.setup_done, settings: b.settings, account: b.account, instances: (b.instances as any[]).map(norm) };
  }
  return { version: SEED.version, setupDone: true, settings: { memory_mb: 4096, allow_beta_mods: false, offline_skins: true, check_updates: true, reduce_motion: false }, account: SEED.account, instances: SEED.instances };
}
export async function call<T = any>(cmd: string, args: any = {}): Promise<T> {
  if (isTauri) { const { invoke } = await import("@tauri-apps/api/core"); return invoke<T>(cmd, args); }
  await wait(380);
  if (cmd === "name_check") {
    const n: string = args.name;
    if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) return { status: "invalid", reason: n.length < 3 ? "Names need at least 3 characters." : n.length > 16 ? "Names are at most 16 characters." : "Only letters, numbers and underscores." } as any;
    if (["notch", "dream", "hypixel"].includes(n.toLowerCase())) return { status: "premium", id: "069a79f4" } as any;
    return { status: "free" } as any;
  }
  if (cmd === "modrinth_search") { const q = (args.query || "").toLowerCase(); return { total: 10, hits: SEED.mods.filter((m) => !q || m.title.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)) } as any; }
  if (cmd === "sync_run") return Object.fromEntries(SEED.instances.map((i, n) => [i.name + " " + i.mc, { pulled: n === 1 ? ["options", "client-config"] : [], pushed: n === 0 ? ["options"] : [], conflicts: n === 2 ? [{ item: "options:key_key.luminos.panel", winner: "store" }] : [] }])) as any;
  if (cmd === "sync_export" || cmd === "sync_import") return 6 as any;
  return null as any;
}
export async function onLaunch(cb: (e: any) => void): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen("launch", (e) => cb(e.payload));
  return un;
}

// Real Modrinth projects (icons + download counts fetched from the Modrinth API at design time, see docs/ASSETS.md).
{
  const meta = MR as Record<string, { title: string; icon: string; downloads: number; desc: string }>;
  for (const m of SEED.mods as any[]) { const r = meta[m.slug]; if (r) { m.icon = r.icon; m.downloads = r.downloads; } }
  const extra: [string, string, string, string, string][] = [
    ["fabric-api", "FabricMC", "Performance", "0.166.2", "Hooks and APIs most Fabric mods rely on."],
    ["immediatelyfast", "RaphiMC", "Performance", "1.17.1", "Faster immediate-mode rendering for menus, HUD and text."],
    ["moreculling", "FxMorin", "Performance", "1.9.2", "Skips drawing block faces you can never see."],
    ["dynamic-fps", "juliand665", "Utility", "3.11.10", "Drops the frame rate when the window is in the background."],
    ["betterf3", "TreyRuffy", "HUD", "20.0.0", "A cleaner, colour-coded debug screen."],
    ["modmenu", "Prospector", "Utility", "21.0.1", "See and configure every installed mod in one list."],
  ];
  for (const [slug, author, cat, ver, desc] of extra) { const r = meta[slug]; if (r) (SEED.mods as any[]).push({ slug, title: r.title, author, cat, ver, desc, downloads: r.downloads, icon: r.icon, hue: 210 }); }
}
