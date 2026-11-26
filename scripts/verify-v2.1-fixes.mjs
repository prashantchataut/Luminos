#!/usr/bin/env node
// v2.1.0 objective gate. Exits 1 if any check fails. Run from the repository root:  node scripts/verify-v2.1-fixes.mjs
// It checks the source tree. It does NOT prove the game runs: that needs a Windows desktop (see docs/REAL_DESKTOP_CHECKLIST.md).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -  " + detail : ""}`); };
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "");
function walk(dir, exts, out = []) {
  const d = join(root, dir);
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d)) {
    if (["node_modules", "target", "build", "dist", ".gradle", "gen"].includes(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(relative(root, p), exts, out);
    else if (exts.includes(extname(e))) out.push(relative(root, p));
  }
  return out;
}

// 1. zero competitor / reference strings in anything a player or visitor can see
const BANNED = /OneClient|OneConfig|Polyfrost|Ankama|Lunar Practice|Hypixel Network|EvergreenHUD|Xyrios|Badlion|Lunar Client|Wurst/i;
const scanned = [...walk("app/src", [".ts", ".tsx", ".html", ".css", ".json"]), ...walk("app/src-tauri/src", [".rs"]), ...walk("client/src", [".java", ".json"]), ...walk("client26/src", [".java"]), ...walk("site/src", [".ts", ".tsx", ".html", ".css", ".json"]), "app/index.html", "site/index.html"];
const hits = [];
for (const f of scanned) { const t = read(f); t.split("\n").forEach((l, i) => { if (BANNED.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 90)}`); }); }
check("1. zero competitor strings", hits.length === 0, hits.length ? `${hits.length} hit(s): ${hits.slice(0, 3).join(" | ")}` : `${scanned.length} files scanned`);
const themes = read("app/src/theme.ts");
check("1b. themes renamed", ["Luminos Cobalt (Default)", "Luminos Obsidian", "Luminos Slate", "Luminos Light"].every((n) => themes.includes(`"${n}"`)));

// 2. logo + installer icons
const sidebar = read("app/src/components/Sidebar.tsx");
check("2a. LuminosLogo exists and Sidebar uses it", existsSync(join(root, "app/src/components/LuminosLogo.tsx")) && /import LuminosLogo/.test(sidebar) && /<LuminosLogo/.test(sidebar));
const ico = existsSync(join(root, "app/src-tauri/icons/icon.ico")) ? readFileSync(join(root, "app/src-tauri/icons/icon.ico")) : Buffer.alloc(0);
const layers = ico.length > 6 ? ico.readUInt16LE(4) : 0;
const sizes = []; for (let i = 0; i < layers; i++) { const w = ico[6 + i * 16]; sizes.push(w === 0 ? 256 : w); }
check("2b. icon.ico is multi-layer (256,128,64,48,32,16) and > 10 KB", ico.length > 10240 && [256, 128, 64, 48, 32, 16].every((s) => sizes.includes(s)), `${ico.length} bytes, layers ${sizes.join(",")}`);
for (const f of ["icon.png", "32x32.png", "128x128.png", "128x128@2x.png", "nsis-header.bmp", "nsis-sidebar.bmp"]) check(`2c. icons/${f} exists`, existsSync(join(root, "app/src-tauri/icons", f)));
const bmpOk = (f, w, h) => { const b = existsSync(join(root, f)) ? readFileSync(join(root, f)) : Buffer.alloc(60); return b.toString("latin1", 0, 2) === "BM" && b.readInt32LE(18) === w && b.readInt32LE(22) === h && b.readUInt16LE(28) === 24; };
check("2d. NSIS bitmaps are 24-bit, 164x314 and 150x57", bmpOk("app/src-tauri/icons/nsis-sidebar.bmp", 164, 314) && bmpOk("app/src-tauri/icons/nsis-header.bmp", 150, 57));
let conf = {}; try { conf = JSON.parse(read("app/src-tauri/tauri.conf.json")); } catch { /* reported below */ }
const nsis = conf.bundle?.windows?.nsis ?? {};
check("2e. tauri.conf.json wires icons + NSIS bitmaps", nsis.installerIcon === "icons/icon.ico" && nsis.headerImage === "icons/nsis-header.bmp" && nsis.sidebarImage === "icons/nsis-sidebar.bmp" && ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.ico"].every((i) => (conf.bundle?.icon ?? []).includes(i)) && (conf.bundle?.targets ?? []).includes("nsis"));
check("2f. installer bundles the client jars as resources", (conf.bundle?.resources ?? []).some((r) => String(r).includes("resources/mods")));

// 3. real worlds + servers
const home = read("app/src/screens/Home.tsx");
const prodHome = home.replace(/const DEMO: Local = \{[\s\S]*?\n\};/, "");
check("3a. Home calls scan_local_worlds_and_servers", /"scan_local_worlds_and_servers"/.test(home));
check("3b. no hardcoded worlds/servers outside the ?demo=1 sample", !/Hypixel|Survival World|Lunar Practice|Hideout|Hearthstone|SEED\.worlds/.test(prodHome), "demo sample is gated by !isTauri() && ?demo=1");
check("3c. demo data only reachable outside Tauri", /!isTauri\(\)[^\n]*demo=1/.test(home));
check("3d. honest empty state with Launch Minecraft + Add Server", /No Local Worlds or Saved Servers Yet/.test(home) && /Launch Minecraft/.test(home) && /\+ Add Server/.test(home) && /Browse \.minecraft Folder/.test(home));
const game = read("app/src-tauri/src/game.rs"), worlds = read("launcher/crates/luminos-core/src/worlds.rs");
check("3e. Rust scans saves/level.dat/icon.png and servers.dat, can add a server", /level\.dat/.test(worlds) && /icon\.png/.test(worlds) && /servers\.dat/.test(worlds) && /fn add_server/.test(worlds) && /fn add_saved_server/.test(game) && /fn scan_local_worlds_and_servers/.test(game));

// 4. process exit + stop
const lib = read("app/src-tauri/src/lib.rs"), core = read("launcher/crates/luminos-core/src/launch.rs"), gameTs = read("app/src/state/game.ts");
check("4a. src-tauri has stop_game + get_game_status + GameProcessState", /fn stop_game/.test(game) && /fn get_game_status/.test(game) && /struct GameProcessState/.test(game) && /game::stop_game/.test(lib) && /game::get_game_status/.test(lib));
check("4b. try_wait exit monitoring emits game-state", /try_wait/.test(game + core) && /"game-state"/.test(game) && /game::finish/.test(lib));
check("4c. UI polls get_game_status every 1000 ms and listens to game-state", /get_game_status/.test(gameTs) && /,\s*1000\)/.test(gameTs) && /"game-state"/.test(gameTs));
check("4d. Home renders Stop Game while running", /status === "running"/.test(home) && /Stop Game/.test(home) && /bg-\[#EF4444\]/.test(home) && /StopGameButton/.test(sidebar));
check("4e. quit_launcher + Quit Luminos button", /fn quit_launcher/.test(game) && /Quit Luminos/.test(sidebar));

// 5. in-game client
const javaFiles = walk("client/src", [".java"]).map((f) => [f, read(f)]);
const allJava = javaFiles.map(([, t]) => t).join("\n");
check("5a. client has LuminosTitleScreen, LuminosQuickPanelScreen, TitleScreenMixin", ["LuminosTitleScreen.java", "LuminosQuickPanelScreen.java", "TitleScreenMixin.java"].every((n) => javaFiles.some(([f]) => f.endsWith(n))));
check("5b. mixin is registered in fabric.mod.json", /luminos\.mixins\.json/.test(read("client/src/main/resources/fabric.mod.json")) && /TitleScreenMixin/.test(read("client/src/main/resources/luminos.mixins.json")));
check("5c. Right Ctrl + Right Shift open the panel from the title screen", /GLFW_KEY_RIGHT_CONTROL/.test(allJava) && /GLFW_KEY_RIGHT_SHIFT/.test(allJava) && /ScreenKeyboardEvents/.test(allJava) && /KEY_RCONTROL/.test(allJava));
check("5d. client reads/writes config/luminos/config.json", /"luminos"\)\.resolve\("config\.json"\)/.test(allJava));
check("5e. launcher copies luminos-client-<mc>.jar into <game dir>/mods and refuses a non-Knot launch", /luminos-client/.test(game) && /game_dir\(\)\.join\("mods"\)/.test(game) && /fs::copy|std::fs::copy/.test(game) && /KnotClient/.test(lib));
const wf = read(".github/workflows/release.yml");
check("5f. release workflow builds the jars first and bundles them into the installer", /needs:\s*\[?client-jars/.test(wf) && /resources\/mods/.test(wf));
check("5g. keybind default shown in the launcher is RCTRL", /key: "RCTRL"/.test(read("app/src/data/keybinds.ts")));

// versions
const v = (f, re) => (read(f).match(re) ?? [])[1];
const ver = { "app/package.json": v("app/package.json", /"version":\s*"([^"]+)"/), "tauri.conf.json": conf.version, "Cargo.toml": v("app/src-tauri/Cargo.toml", /^version = "([^"]+)"/m), "client/gradle.properties": v("client/gradle.properties", /^mod_version=(.+)$/m) };
check("6. version is the same everywhere", new Set(Object.values(ver)).size === 1, JSON.stringify(ver));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
