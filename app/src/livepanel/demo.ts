import type { Mod } from "./plan";
/** Sample instance used when no desktop engine is attached (plain browser, screenshots). The UI says so with a "Sample data" badge. */
export const SAMPLE_INSTANCE = { id: "survival", name: "Survival 1.21", loader: "fabric", mc: "1.21.11" };
const m = (id: string, name: string, version: string, enabled: boolean, requires: string[], blurb: string): Mod => ({ id, slug: id, name, version, enabled, requires, blurb });
export const SAMPLE_MODS: Mod[] = [
  m("fabric-api", "Fabric API", "0.141.1", true, [], "Hooks the other mods build on"),
  m("sodium", "Sodium", "0.7.3", true, [], "Rendering engine"),
  m("lithium", "Lithium", "0.21.0", true, [], "Game logic optimisation"),
  m("modernfix", "ModernFix", "5.26.0", true, [], "Startup and memory fixes"),
  m("c2me", "C2ME", "0.3.5", true, [], "Chunk loading threads"),
  m("iris", "Iris Shaders", "1.9.6", true, ["sodium"], "Shader packs"),
  m("sodium-extra", "Sodium Extra", "0.8.2", true, ["sodium"], "More video options"),
  m("modmenu", "Mod Menu", "16.0.0", true, ["fabric-api"], "Lists installed mods"),
  m("xaero", "Xaero's Minimap", "25.3.1", true, [], "Minimap"),
  m("jade", "Jade", "19.1.0", false, ["fabric-api"], "Shows what you are looking at"),
  m("appleskin", "AppleSkin", "3.0.7", false, [], "Food and saturation overlay"),
  m("rei", "Roughly Enough Items", "21.1.0", false, ["cloth-config", "architectury"], "Recipe viewer"),
];
export type StoreItem = { id: string; title: string; author: string; kind: "mod" | "resourcepack" | "shader" | "datapack"; downloads: number; blurb: string; updated: string; requires?: string[] };
export const SAMPLE_STORE: StoreItem[] = [
  { id: "sodium", title: "Sodium", author: "jellysquid3", kind: "mod", downloads: 98e5, blurb: "Modern rendering engine", updated: "2026-02-11" },
  { id: "iris", title: "Iris Shaders", author: "coderbot", kind: "mod", downloads: 5.2e7 / 5, blurb: "Shader pack support", updated: "2026-02-08", requires: ["sodium"] },
  { id: "jade", title: "Jade", author: "Snownee", kind: "mod", downloads: 1.4e7, blurb: "Shows what you are looking at", updated: "2026-01-30", requires: ["fabric-api"] },
  { id: "ferritecore", title: "FerriteCore", author: "malte0811", kind: "mod", downloads: 2.1e7, blurb: "Memory usage fixes", updated: "2025-12-19" },
  { id: "immediatelyfast", title: "ImmediatelyFast", author: "RaphiMC", kind: "mod", downloads: 9.6e6, blurb: "Faster immediate-mode rendering", updated: "2026-01-12" },
  { id: "xaero-worldmap", title: "Xaero's World Map", author: "xaero96", kind: "mod", downloads: 1.1e7, blurb: "Full-screen world map", updated: "2026-02-02" },
  { id: "faithful", title: "Faithful 32x", author: "Faithful Team", kind: "resourcepack", downloads: 1.3e7, blurb: "Vanilla textures at 32x", updated: "2026-01-21" },
  { id: "fresh-animations", title: "Fresh Animations", author: "FreshLX", kind: "resourcepack", downloads: 8.8e6, blurb: "Animated mobs", updated: "2026-02-06" },
  { id: "better-leaves", title: "Better Leaves", author: "Motschen", kind: "resourcepack", downloads: 6.1e6, blurb: "Fuller leaf blocks", updated: "2025-12-02" },
  { id: "complementary", title: "Complementary Reimagined", author: "EminGT", kind: "shader", downloads: 2.4e7, blurb: "Balanced shader pack", updated: "2026-02-09" },
  { id: "bsl", title: "BSL Shaders", author: "capttatsu", kind: "shader", downloads: 1.9e7, blurb: "Classic cinematic look", updated: "2025-11-27" },
  { id: "vein-miner", title: "Veinminer", author: "Vein Team", kind: "datapack", downloads: 1.2e6, blurb: "Mine whole ore veins", updated: "2026-01-15" },
  { id: "armored-elytra", title: "Armored Elytra", author: "Kuuhaku", kind: "datapack", downloads: 9.4e5, blurb: "Combine elytra and chestplate", updated: "2025-12-28" },
];
export const SAMPLE_INSTALLED_PACKS = new Set(["faithful"]);
