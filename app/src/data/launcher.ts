import SERVERS from "./servers-cache.json";
import NEWS from "./news-cache.json";
import LIB from "./library.json";
import MR from "../modrinth-meta.json";

export const servers = SERVERS;
export const news = NEWS.entries;
export const library = LIB;
type Meta = { title: string; icon: string; downloads: number; desc: string };
export const meta = MR as Record<string, Meta>;

/** Luminos Picks: the mods the Luminos profile ships or recommends. `reason` is the one-line why.
 *  `tested` is honest: "ci" = part of the default preset that smoke.yml launches to the title screen; "ref" = recommended from upstream docs, not run by us. */
export type Pick = { slug: string; reason: string; cat: "Renderer" | "Logic" | "Memory" | "HUD" | "Utility"; tested: "ci" | "ref"; requires?: string[]; conflicts?: string[]; installed?: boolean; update?: string };
export const PICKS: Pick[] = [
  { slug: "sodium", cat: "Renderer", tested: "ci", reason: "The baseline renderer every other mod here assumes.", installed: true },
  { slug: "vulkanmod", cat: "Renderer", tested: "ref", reason: "Vulkan 1.2 renderer; fastest on CPU-bound PCs, no shader packs.", conflicts: ["sodium", "iris"] },
  { slug: "nvidium", cat: "Renderer", tested: "ref", reason: "Mesh-shader culling on top of Sodium; Turing-or-newer NVIDIA only.", requires: ["sodium"] },
  { slug: "lithium", cat: "Logic", tested: "ci", reason: "Game-logic speedups that do not change behaviour.", installed: true, update: "0.21.2" },
  { slug: "entityculling", cat: "Logic", tested: "ci", reason: "Skips entities you cannot see; big win in farms and cities.", installed: true },
  { slug: "c2me-fabric", cat: "Logic", tested: "ref", reason: "Parallel chunk generation; singleplayer only.", conflicts: [] },
  { slug: "moreculling", cat: "Renderer", tested: "ci", reason: "Skips block faces you can never see.", installed: true },
  { slug: "immediatelyfast", cat: "HUD", tested: "ci", reason: "Faster HUD, text and GUI drawing.", installed: true },
  { slug: "exordium", cat: "HUD", tested: "ref", reason: "Throttles HUD and GUI rendering to a fixed lower FPS." },
  { slug: "ferrite-core", cat: "Memory", tested: "ci", reason: "Cuts RAM use on large mod lists.", installed: true },
  { slug: "modernfix", cat: "Memory", tested: "ci", reason: "Faster startup and lower memory; dynamic resource loading." },
  { slug: "krypton", cat: "Utility", tested: "ci", reason: "Faster networking stack for servers.", installed: true },
  { slug: "scalablelux", cat: "Logic", tested: "ci", reason: "Light engine rewrite; fixes lag spikes while building.", installed: true },
  { slug: "iris", cat: "Renderer", tested: "ref", reason: "Shader packs on Sodium. Not compatible with VulkanMod.", requires: ["sodium"], conflicts: ["vulkanmod"] },
];
export const authorOf: Record<string, string> = { sodium: "jellysquid3", vulkanmod: "xCollateral", nvidium: "cortex", lithium: "jellysquid3", entityculling: "tr7zw", "c2me-fabric": "RelativityMC", moreculling: "FxMorin", immediatelyfast: "RaphiMC", exordium: "tr9zw", "ferrite-core": "malte0811", modernfix: "embeddedt", krypton: "astei", scalablelux: "Tuinity", iris: "coderbot", appleskin: "squeek502", zoomify: "isXander", modmenu: "Prospector", controlify: "isXander", resourcify: "DeDiamondPro", "dynamic-fps": "juliand665", betterf3: "TreyRuffy", "mouse-tweaks": "YaLTeR", "sodium-extra": "FlashyReese", "reeses-sodium-options": "FlashyReese" };

export const QUICK = {
  server: { name: servers.servers[0].name, address: servers.servers[0].address, online: servers.servers[0].online, icon: servers.servers[0].icon, ago: "2 days ago" },
  world: { name: "Mira's Hideout", mode: "Survival", instance: "Luminos 26.3", ago: "Today · 1h 12m" },
  pack: { name: "Luminos Performance", detail: "31 mods · Sodium, Lithium, Entity Culling", ago: "Default profile" },
};

export const PRESETS = {
  pvp: { id: "pvp", name: "PvP", icon: "swords", line: "Keystrokes top-left, small dot crosshair, low fire and shield, fog off, 240 FPS profile.", set: { keystrokes: "A", crosshair: "dot-ring", fogOverworld: false, fogNether: false, fogEnd: false, lowFire: true, lowShield: true, profile: "luminos-performance", hudFps: 30 } },
  survival: { id: "survival", name: "Survival", icon: "leaf", line: "Keystrokes above the hotbar, cross crosshair, light fog kept, death markers on.", set: { keystrokes: "B", crosshair: "cross-gap", fogOverworld: true, fogNether: true, fogEnd: true, lowFire: false, lowShield: false, profile: "luminos-performance", hudFps: 60 } },
} as const;

export const OUTFITS_SEED = [
  { id: "o1", name: "Duel night", skin: "luminos-default", cape: "luminos-moon", wings: false },
  { id: "o2", name: "Builder day", skin: "foreman-flint", cape: "luminos-tide", wings: false },
  { id: "o3", name: "Flight test", skin: "mochi", cape: "luminos-aurora", wings: true },
];
