export type Cat = "favorites" | "pvp" | "perf" | "visuals" | "hud" | "utility" | "qol" | "other";
export const CATS: { id: Cat | "all"; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "" }, { id: "favorites", label: "Favorites", icon: "star" }, { id: "pvp", label: "Hypixel / PvP", icon: "swords" },
  { id: "perf", label: "Performance", icon: "bolt" }, { id: "visuals", label: "Visuals", icon: "brush" }, { id: "hud", label: "HUD", icon: "hud" },
  { id: "utility", label: "Utility", icon: "sliders" }, { id: "qol", label: "Quality of Life", icon: "wand" }, { id: "other", label: "Other", icon: "" },
];
export type Setting =
  | { k: string; t: "toggle"; label: string; desc?: string; def: boolean }
  | { k: string; t: "slider"; label: string; desc?: string; def: number; min: number; max: number; step?: number; unit?: string }
  | { k: string; t: "color"; label: string; def: string }
  | { k: string; t: "key"; label: string; def: string }
  | { k: string; t: "select"; label: string; def: string; options: string[] };
export type Mod = { id: string; name: string; cats: Cat[]; blurb: string; src: "luminos" | "modrinth"; on: boolean; needs?: string[]; settings: Setting[] };

const T = (k: string, label: string, def: boolean, desc?: string): Setting => ({ k, t: "toggle", label, def, desc });
const SL = (k: string, label: string, def: number, min: number, max: number, unit = "", step = 1): Setting => ({ k, t: "slider", label, def, min, max, unit, step });
const hudBase = (): Setting[] => [T("shadow", "Text shadow", true), SL("scale", "Scale", 100, 50, 200, "%", 5), { k: "color", t: "color", label: "Text colour", def: "#ffffff" }];

export const MODS: Mod[] = [
  { id: "fps", name: "FPS", cats: ["hud", "pvp", "perf"], blurb: "Frames per second, drawn from the render loop.", src: "luminos", on: true, settings: [...hudBase(), SL("rate", "Update rate", 4, 1, 20, "/s")] },
  { id: "cps", name: "CPS", cats: ["hud", "pvp"], blurb: "Clicks per second for each mouse button.", src: "luminos", on: true, settings: [...hudBase(), T("both", "Show both buttons", true)] },
  { id: "keystrokes", name: "Keystrokes", cats: ["hud", "pvp"], blurb: "WASD and mouse buttons, pressed keys light up.", src: "luminos", on: true, settings: [...hudBase(), T("mouse", "Show LMB / RMB", true), T("space", "Show space bar", true)] },
  { id: "ping", name: "Ping", cats: ["hud"], blurb: "Round-trip time to the current server.", src: "luminos", on: true, settings: hudBase() },
  { id: "armor", name: "Armor Status", cats: ["hud", "pvp"], blurb: "Worn armour with durability.", src: "luminos", on: true, settings: [...hudBase(), T("dur", "Show durability", true)] },
  { id: "potions", name: "Potion Effects", cats: ["hud", "pvp"], blurb: "Active effects with time left.", src: "luminos", on: true, settings: hudBase() },
  { id: "coordinates", name: "Coordinates", cats: ["hud", "utility"], blurb: "XYZ position and facing direction.", src: "luminos", on: false, settings: [...hudBase(), T("dir", "Show direction", true)] },
  { id: "sprint", name: "Sprint Status", cats: ["hud", "qol"], blurb: "Shows when sprint is held or toggled.", src: "luminos", on: false, settings: hudBase() },
  { id: "crosshair", name: "Crosshair", cats: ["hud", "pvp"], blurb: "Pick a crosshair shape, size and colour.", src: "luminos", on: true, settings: [{ k: "shape", t: "select", label: "Shape", def: "Cross", options: ["Cross", "Dot", "Circle", "Square"] }, SL("size", "Size", 8, 2, 24, "px"), { k: "color", t: "color", label: "Colour", def: "#ffffff" }] },
  { id: "chatting", name: "Chatting", cats: ["qol"], blurb: "Longer history, search, copy and timestamps in chat.", src: "luminos", on: true, settings: [T("stamps", "Timestamps", false), SL("history", "History lines", 500, 100, 2000, "", 50), T("search", "Search with Ctrl+F", true)] },
  { id: "lowfire", name: "Low Fire", cats: ["visuals", "pvp"], blurb: "Lowers the fire overlay so you can see the target.", src: "luminos", on: true, settings: [SL("height", "Overlay height", 40, 0, 100, "%", 5)] },
  { id: "clearfog", name: "Clear Fog", cats: ["visuals", "perf"], blurb: "Removes overworld, nether or end fog.", src: "luminos", on: true, settings: [T("ow", "Overworld", true), T("nether", "Nether", true), T("end", "The End", false)] },
  { id: "anim17", name: "1.7 Animations", cats: ["pvp", "visuals"], blurb: "Block-hitting, bow and rod animations from 1.7.", src: "luminos", on: false, settings: [T("block", "Block-hit swing", true), T("bow", "Bow pull", true), T("rod", "Fishing rod", true)] },
  { id: "motionblur", name: "Motion Blur", cats: ["visuals"], blurb: "Camera blur that scales with turn speed.", src: "luminos", on: false, settings: [SL("amount", "Strength", 30, 0, 100, "%", 5)] },
  { id: "blockoverlay", name: "Simple Block Overlay", cats: ["visuals", "pvp"], blurb: "Outline and fill for the block you target.", src: "luminos", on: true, settings: [{ k: "color", t: "color", label: "Outline colour", def: "#2b4bff" }, SL("w", "Line width", 2, 1, 6, "px"), T("fill", "Fill face", false)] },
  { id: "overlay", name: "Overlay Tweaks", cats: ["visuals"], blurb: "Pumpkin, water and portal overlays at your opacity.", src: "luminos", on: false, settings: [SL("water", "Water", 60, 0, 100, "%", 5), SL("pumpkin", "Pumpkin", 0, 0, 100, "%", 5)] },
  { id: "polyblur", name: "PolyBlur", cats: ["visuals"], blurb: "Background blur behind menus.", src: "luminos", on: false, settings: [SL("radius", "Radius", 6, 0, 20, "px")] },
  { id: "deathrecap", name: "Death Recap", cats: ["utility"], blurb: "What hit you, from whom, in the last five seconds.", src: "luminos", on: false, settings: [T("chat", "Also print to chat", false)] },
  { id: "clicksampler", name: "Render-Loop Click Sampler", cats: ["perf", "pvp"], blurb: "Samples mouse input on the render loop instead of the tick, so clicks are not quantised to 20 Hz.", src: "luminos", on: true, settings: [T("sync", "Sample before frame", true)] },
  { id: "hotwire", name: "Live Modrinth Hotwire", cats: ["utility"], blurb: "Resource packs and Luminos modules apply live; third-party mods queue for the next start.", src: "luminos", on: true, settings: [T("queue", "Queue mods that cannot swap live", true)] },
  { id: "sodium", name: "Sodium", cats: ["perf"], blurb: "Rendering engine rewrite. The base of the performance stack.", src: "modrinth", on: true, settings: [T("cull", "Block face culling", true), SL("chunks", "Chunk updates", 3, 1, 8)] },
  { id: "lithium", name: "Lithium", cats: ["perf"], blurb: "Game logic, physics and mob AI optimisations.", src: "modrinth", on: true, settings: [T("ai", "Mob AI", true)] },
  { id: "entityculling", name: "Entity Culling", cats: ["perf"], blurb: "Skips entities and block entities you cannot see.", src: "modrinth", on: true, settings: [SL("dist", "Check distance", 64, 16, 128, " blocks", 8)] },
  { id: "ferrite", name: "FerriteCore", cats: ["perf"], blurb: "Lower memory use for large mod lists.", src: "modrinth", on: true, settings: [] },
  { id: "immediatelyfast", name: "ImmediatelyFast", cats: ["perf"], blurb: "Faster immediate-mode drawing for the HUD, text and GUI.", src: "modrinth", on: true, settings: [T("hud", "Batch HUD drawing", true)] },
  { id: "modernfix", name: "ModernFix", cats: ["perf", "qol"], blurb: "Faster startup and lower memory use.", src: "modrinth", on: true, settings: [] },
  { id: "dynfps", name: "Dynamic FPS", cats: ["perf"], blurb: "Drops the frame rate while the window is unfocused.", src: "modrinth", on: false, settings: [SL("bg", "Unfocused cap", 15, 1, 60, " fps")] },
  { id: "sodiumextra", name: "Sodium Extra", cats: ["perf", "visuals"], blurb: "Extra video options for Sodium.", src: "modrinth", on: false, needs: ["sodium"], settings: [] },
  { id: "iris", name: "Iris Shaders", cats: ["visuals"], blurb: "Shader pack support. Requires Sodium.", src: "modrinth", on: false, needs: ["sodium"], settings: [] },
  { id: "nvidium", name: "Nvidium", cats: ["perf"], blurb: "Mesh-shader renderer for recent Nvidia GPUs. Requires Sodium.", src: "modrinth", on: false, needs: ["sodium"], settings: [] },
  { id: "zoomify", name: "Zoomify", cats: ["utility", "qol"], blurb: "Smooth zoom with scroll to adjust.", src: "modrinth", on: false, settings: [SL("fov", "Zoom level", 4, 1, 10, "x")] },
];
export const modById = (id: string) => MODS.find((m) => m.id === id)!;
