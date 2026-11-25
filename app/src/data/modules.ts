/**
 * The built-in Luminos client modules (gameplay features you switch on and off).
 * Rendering and logic optimisations (the performance stack bundled with the client) are NOT modules: they run silently
 * and live under Preferences → Performance Engine. This list must never contain them (scripts/verify-client-sanity.mjs enforces it).
 */
export type CatId = "world" | "move" | "visuals" | "hud" | "pvp" | "qol";
export const CATEGORIES: { id: CatId | "all" | "favorites"; label: string }[] = [
  { id: "all", label: "All Modules" }, { id: "favorites", label: "Favorites" }, { id: "world", label: "World & Navigation" }, { id: "hud", label: "HUD" },
  { id: "visuals", label: "Visuals" }, { id: "pvp", label: "PvP & Combat" }, { id: "move", label: "Movement & Camera" }, { id: "qol", label: "Quality of Life" },
];

export type Setting =
  | { k: string; t: "toggle"; label: string; def: boolean }
  | { k: string; t: "slider"; label: string; def: number; min: number; max: number; step?: number; unit?: string }
  | { k: string; t: "color"; label: string; def: string }
  | { k: string; t: "select"; label: string; def: string; options: string[] };
export type Module = { id: string; name: string; cat: CatId; icon: string; on: boolean; blurb: string; settings: Setting[] };

const tg = (k: string, label: string, def = true): Setting => ({ k, t: "toggle", label, def });
const sl = (k: string, label: string, def: number, min: number, max: number, unit = "", step = 1): Setting => ({ k, t: "slider", label, def, min, max, step, unit });
const co = (k: string, label: string, def: string): Setting => ({ k, t: "color", label, def });
const se = (k: string, label: string, def: string, options: string[]): Setting => ({ k, t: "select", label, def, options });
const hud = [tg("bg", "Show background"), tg("shadow", "Text shadow"), co("color", "Text colour", "#FFFFFF"), sl("scale", "Scale", 100, 60, 200, "%", 5)];
const M = (id: string, name: string, cat: CatId, icon: string, on: boolean, blurb: string, settings: Setting[] = []): Module => ({ id, name, cat, icon, on, blurb, settings });

export const MODULES: Module[] = [
  M("waypoints", "Waypoints", "world", "waypoints", true, "Mark places and see a beam to them.", [co("beam", "Beam colour", "#2B4BFF"), sl("range", "Beam range", 400, 50, 2000, " blocks", 10), tg("names", "Show names"), tg("deathpoint", "Auto death waypoint"), se("shape", "Marker shape", "Diamond", ["Diamond", "Pin", "Dot"])]),
  M("minimap", "Minimap", "world", "minimap", true, "A corner map with a radar.", [sl("zoom", "Zoom", 2, 1, 6, "×", 0.5), se("shape", "Shape", "Square", ["Square", "Circle"]), tg("radar", "Entity radar"), tg("rotate", "Rotate with player", false), sl("size", "Size", 128, 80, 220, "px", 4)]),
  M("fullbright", "Fullbright", "world", "fullbright", false, "See clearly in caves and at night.", [sl("gamma", "Gamma", 12, 1, 15, "", 1), tg("nv", "Night-vision fade", false)]),
  M("timechanger", "Time Changer", "world", "time", false, "Lock the sky to any time of day.", [sl("time", "Time of day", 6000, 0, 24000, " ticks", 500), tg("freeze", "Freeze the clock")]),
  M("weatherchanger", "Weather Changer", "world", "weather", false, "Clear, rain or snow, only on your screen.", [se("weather", "Weather", "Clear", ["Clear", "Rain", "Snow", "Thunder"])]),
  M("coordinates", "Coordinates", "world", "coords", true, "XYZ, direction and biome.", [...hud, tg("biome", "Show biome"), tg("facing", "Show facing")]),
  M("zoom", "Zoom", "move", "zoom", true, "Hold a key to look far away.", [sl("fov", "Zoom amount", 4, 1.5, 10, "×", 0.5), tg("scroll", "Scroll to adjust"), tg("smooth", "Smooth camera"), tg("cinematic", "Cinematic camera", false)]),
  M("freelook", "Freelook", "move", "freelook", true, "Look around without turning your character.", [tg("invert", "Invert pitch", false), se("perspective", "Perspective", "Third person", ["First person", "Third person"]), sl("sens", "Sensitivity", 100, 20, 200, "%", 5)]),
  M("togglesprint", "ToggleSprint", "move", "sprint", true, "Sprint without holding the key.", [tg("fly", "Also toggle while flying"), tg("status", "Show status on HUD"), tg("sneak", "Toggle sneak too", false)]),
  M("anim17", "1.7 Animations", "move", "anim", false, "The classic block, bow and sword poses.", [tg("block", "Sword blocking"), tg("bow", "Bow pull"), tg("eat", "Eat and drink"), tg("sneak", "Smooth sneak", false)]),
  M("motionblur", "Motion Blur", "move", "blur", false, "A soft blur when you turn fast.", [sl("amount", "Strength", 35, 5, 90, "%", 5)]),
  M("lowfire", "Low Fire", "visuals", "lowfire", true, "A fire overlay that stays out of your way.", [sl("height", "Height offset", -30, -60, 0, "%", 5), sl("opacity", "Opacity", 60, 10, 100, "%", 5)]),
  M("clearfog", "Clear Fog", "visuals", "fog", false, "Remove the fog in the overworld, nether and end.", [tg("overworld", "Overworld", true), tg("nether", "Nether", true), tg("end", "End", false)]),
  M("blockoverlay", "Block Overlay", "visuals", "block", true, "Outline and tint the block you are looking at.", [co("outline", "Outline colour", "#2B4BFF"), sl("width", "Line width", 2, 1, 6, "px"), tg("fill", "Fill the face", false), sl("alpha", "Fill opacity", 20, 0, 80, "%", 5)]),
  M("hitbox", "Hitbox", "visuals", "hitbox", false, "Show entity hitboxes without the debug screen.", [tg("eye", "Eye-height line"), tg("look", "Look vector", false), co("color", "Colour", "#FFFFFF")]),
  M("nametags", "Nametags", "visuals", "nametag", true, "Cleaner player nametags.", [tg("shadow", "Text shadow"), tg("self", "Show your own tag", false), sl("opacity", "Background", 25, 0, 100, "%", 5)]),
  M("hurtcam", "Hurt Cam", "visuals", "hurtcam", false, "Tone down the screen shake when hit.", [sl("shake", "Shake amount", 30, 0, 100, "%", 5)]),
  M("damagetint", "Damage Tint", "visuals", "damage", false, "Choose the colour of the hit flash.", [co("color", "Tint colour", "#FF3B3B"), sl("opacity", "Opacity", 45, 0, 100, "%", 5)]),
  M("itemphysics", "Item Physics", "visuals", "itemphys", false, "Dropped items lie flat and settle on the ground.", [sl("speed", "Rotation speed", 100, 0, 200, "%", 10)]),
  M("keystrokes", "Keystrokes", "hud", "keyboard", true, "WASD, space and mouse buttons on screen.", [...hud, tg("mouse", "Show mouse buttons"), tg("space", "Show space bar"), co("pressed", "Pressed colour", "#2B4BFF")]),
  M("cps", "CPS Display", "hud", "cps", true, "Clicks per second, left and right.", [...hud, tg("right", "Show right click")]),
  M("fps", "FPS Display", "hud", "fps", true, "Your frame rate.", [...hud, tg("min", "Show 1% low", false)]),
  M("ping", "Ping Display", "hud", "ping", false, "Latency to the server.", hud),
  M("armor", "Armor Status", "hud", "shield", true, "Armour and held item durability.", [tg("bg", "Show background", false), se("layout", "Layout", "Vertical", ["Vertical", "Horizontal"]), se("dur", "Durability", "Bar", ["Bar", "Number", "Percent"])]),
  M("potions", "Potion Effects", "hud", "potion", true, "Active effects with a countdown.", [tg("icons", "Show icons"), tg("blink", "Blink when ending"), se("layout", "Layout", "Vertical", ["Vertical", "Horizontal"])]),
  M("crosshair", "Crosshair", "hud", "crosshair", true, "Pick a shape, size and colour.", [se("shape", "Shape", "Dot ring", ["Dot ring", "Cross", "Dot", "Circle"]), sl("size", "Size", 10, 4, 30, "px"), co("color", "Colour", "#FFFFFF"), tg("dynamic", "Grow while moving", false)]),
  M("scoreboard", "Scoreboard", "hud", "scoreboard", true, "Move, resize or hide the sidebar scoreboard.", [tg("numbers", "Show red numbers", false), sl("opacity", "Background", 30, 0, 100, "%", 5), sl("scale", "Scale", 100, 60, 150, "%", 5)]),
  M("bossbar", "Bossbar", "hud", "bossbar", false, "Smaller, quieter boss bars.", [tg("text", "Show title"), sl("scale", "Scale", 80, 40, 120, "%", 5)]),
  M("combo", "Combo Counter", "pvp", "bolt", true, "Count your consecutive hits.", [...hud, sl("reset", "Reset after", 2, 1, 5, " s", 0.5)]),
  M("reach", "Reach Display", "pvp", "reach", false, "Distance to the last player you hit.", [...hud, sl("decimals", "Decimals", 2, 0, 3)]),
  M("tnt", "TNT Timer", "pvp", "tnt", false, "A countdown above lit TNT.", [tg("color", "Colour by time left"), sl("scale", "Size", 100, 50, 200, "%", 10)]),
  M("packdisplay", "Pack Display", "pvp", "pack", false, "Show the resource packs you have active.", [...hud]),
  M("chatting", "Chatting", "qol", "chat", true, "Longer history, timestamps and copy.", [tg("time", "Timestamps", false), sl("history", "History lines", 500, 100, 2000, "", 100), tg("compact", "Merge repeated messages")]),
  M("deathrecap", "Death Recap", "qol", "death", true, "A short summary of how you died, with your coordinates.", [tg("coords", "Include coordinates"), tg("copy", "Copy to clipboard", false)]),
];

export const modById = (id: string) => MODULES.find((m) => m.id === id)!;
