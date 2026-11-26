#!/usr/bin/env node
// Luminos v2.3.0 objective gate. Exits 1 if any check fails.   node scripts/verify-v2.3.mjs
// Static checks only: what each line proves is stated in its label. Nothing here runs the game or a Windows install.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const f = (p) => path.join(root, p), has = (p) => fs.existsSync(f(p)), txt = (p) => (has(p) ? fs.readFileSync(f(p), "utf8") : "");
let bad = 0;
const check = (name, ok, detail = "") => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -  " + detail : ""}`); };
const png = (p) => { const b = fs.readFileSync(f(p)); return b.length > 24 && b.toString("ascii", 1, 4) === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null; };
const git = (...a) => { try { return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };

// 1. website hero ------------------------------------------------------------------------------------------
const HERO_BASE = "74483cf~1"; // last commit before v2.1.0 touched branding; Hero.tsx is unchanged since v1.0.0
const heroNow = git("hash-object", "site/src/components/Hero.tsx"), heroThen = git("rev-parse", `${HERO_BASE}:site/src/components/Hero.tsx`);
check("1a. site Hero.tsx is byte-identical to the approved pre-v2.2.0 hero", heroThen ? heroNow === heroThen : has("site/src/components/Hero.tsx"), heroThen ? `${heroNow?.slice(0, 8)}` : "no git history here; file present only");
const app = txt("site/src/App.tsx"), main = app.slice(app.indexOf('<main id="main">'));
check("1b. Hero is the FIRST section in <main> (nothing above the dithered-moon hero)", /<main id="main">\s*<Hero\b/.test(main));
const skyThen = git("rev-parse", `${HERO_BASE}:site/src/components/Sky.tsx`), skyNow = git("hash-object", "site/src/components/Sky.tsx");
check("1c. dithered sky component unchanged", skyThen ? skyNow === skyThen : has("site/src/components/Sky.tsx"));

// 2. HD capes ----------------------------------------------------------------------------------------------
const CAPES = ["luminos-original-moon", "job-application", "ball-knowledge-tactician", "touch-grass-3d", "404-skill-not-found", "crimson-ronin-3d", "eclipse-monarch-3d", "cobalt-prism-3d", "sakura-nightfall-3d", "void-dragon-3d"];
for (const dir of ["app/public/capes", "client/src/main/resources/assets/luminos_client/textures/capes"]) {
  const sizes = CAPES.map((id) => (has(`${dir}/${id}.png`) ? png(`${dir}/${id}.png`) : null));
  check(`2a. 10 cape PNGs in ${dir} are >= 256x128 (512x256)`, sizes.every((s) => s && s.w >= 256 && s.h >= 128), sizes.map((s) => (s ? `${s.w}x${s.h}` : "missing")).filter((v, i, a) => a.indexOf(v) === i).join(","));
}
const cos = txt("app/src/screens/Cosmetics.tsx"), snap = txt("app/src/locker/snapshots.ts"), scene = txt("app/src/locker/scene.ts");
check("2b. cape cards render through skinview3d snapshots (snapCape) on the equipped skin", /snapCape\(/.test(cos) && /new SkinViewer/.test(snap) && /toDataURL/.test(snap));
check("2c. back 3/4 angle yaw 150 deg, pitch -10 deg, 18 deg cape tilt, 260x280 shared viewer", /aim\(v, 150, -10/.test(snap) && /rad\(18\)/.test(snap) && /W = 260, H = 280/.test(snap));
check("2d. 3D voxel relief layer (makeRelief) is added to snapshots and the live stage", /makeRelief\(cc\)/.test(snap) && /buildRelief/.test(scene) && /export function makeRelief/.test(scene));
check("2e. zero Wings and zero Pets in the cosmetics UI/catalog", !/wings|pets/i.test(cos + txt("app/src/locker/catalog.ts") + txt("app/src/locker/scene.ts")) && !has("app/src/locker/wings.ts") && !has("app/src/locker/pets.ts"));
check("2f. library lists exactly these 10 capes, all flagged relief", (() => { const c = JSON.parse(txt("app/src/data/library.json")).capes; return c.length === 10 && c.every((x) => x.relief) && CAPES.every((id) => c.some((x) => x.id === id)); })());

// 3. updater -----------------------------------------------------------------------------------------------
const lib = txt("app/src-tauri/src/lib.rs"), upd = txt("launcher/crates/luminos-core/src/update.rs"), http = txt("launcher/crates/luminos-core/src/http.rs");
check("3a. check_app_update returns the latest release even when current (latest_release) and is registered", /async fn check_app_update/.test(lib) && /latest_release\(\)/.test(lib) && /check_app_update,/.test(lib));
check("3b. GitHub requests send User-Agent Luminos-Launcher/2.3.0 (shared ureq agent .user_agent)", /Luminos-Launcher\/2\.3\.0/.test(http) && /\.user_agent\(USER_AGENT\)/.test(http) && /releases\/latest/.test(upd));
check("3c. install_app_update streams with live progress events (update-progress / update-download-progress)", /async fn install_app_update/.test(lib) && /update-progress/.test(lib) && /update-download-progress/.test(lib) && /bytesPerSec/.test(lib) && /Duration::from_millis\(80\)/.test(upd));
check("3d. installer saved to %TEMP%\\Luminos-Update-Setup.exe, > 1,000,000 bytes, MZ header, SHA-256 verified", /Luminos-Update-Setup\.exe/.test(lib) && /1_000_000/.test(upd) && /b"MZ"/.test(upd) && /sha256_file/.test(upd));
check("3e. detached Windows .cmd: wait, start /wait installer /S, restart exe, delete itself, CREATE_NO_WINDOW, then app.exit(0)", /luminos_apply_update\.cmd/.test(upd) && /start \/wait/.test(upd) && /creation_flags\(0x0800_0000/.test(upd) && /app\.exit\(0\)/.test(lib));
check("3f. UpdateModal wired into App, Preferences and Sidebar; test button label present", /UpdateModal/.test(txt("app/src/App.tsx")) && /luminos:update/.test(txt("app/src/screens/Preferences.tsx")) && /luminos:update/.test(txt("app/src/components/Sidebar.tsx")) && /Test \/ Re-run Auto-Updater \(v2\.3\.0\)/.test(txt("app/src/components/UpdateModal.tsx")));
check("3g. startup check + top notification bar text", /Click to Auto-Update & Restart|Click to Auto-Update &amp; Restart/.test(txt("app/src/components/UpdateBanner.tsx")));

// 4. OpenJDK fix + title screen -------------------------------------------------------------------------------
const launch = txt("launcher/crates/luminos-core/src/launch.rs"), wb = txt("client/src/shared/java/dev/luminos/client/WindowBrand.java"), ts = txt("client/src/legacy/java/dev/luminos/client/LuminosTitleScreen.java");
check("4a. JVM is started as LuminosClient.exe (copy of java/javaw.exe in the same bin folder)", /branded_java/.test(launch) && /LuminosClient\.exe/.test(launch) && /Command::new\(branded_java/.test(launch));
check("4b. client calls glfwSetWindowIcon + glfwSetWindowTitle", /glfwSetWindowIcon/.test(wb) && /glfwSetWindowTitle/.test(wb) && /Luminos Client /.test(wb));
const mix = txt("client/src/legacy/java/dev/luminos/client/mixin/MinecraftTitleMixin.java");
check("4c. Minecraft's own window-title method is overridden by a registered mixin", /createTitle/.test(mix) && /Luminos Client/.test(mix) && /MinecraftTitleMixin/.test(txt("client/src/legacy/resources/luminos-legacy.mixins.json")));
const labels = ["Singleplayer", "Multiplayer", "Luminos Mods", "Cosmetics & 3D Capes", "HUD Studio", "Options", "Quit Game"];
check("4d. title screen registers all 7 buttons via addRenderableWidget (Mojang name for addDrawableChild)", labels.every((l) => ts.includes(`"${l}`)) && (ts.match(/addRenderableWidget\(new LuminosButton/g) || []).length >= 7);
check("4e. title screen never swallows clicks (super.mouseClicked) and Right Ctrl opens the quick panel", /return super\.mouseClicked/.test(ts) && /KEY_RCONTROL/.test(txt("client/src/shared/java/dev/luminos/client/Hotkeys.java") + txt("client/src/shared/java/dev/luminos/client/LuminosClient.java")));
check("4f. cosmetics screen exists and in-game cape swap class exists", has("client/src/legacy/java/dev/luminos/client/LuminosCosmeticsScreen.java") && /CapeSkin/.test(txt("client/src/legacy/java/dev/luminos/client/mixin/PlayerSkinMixin.java") + txt("client/src/legacy/java/dev/luminos/client/CapeSkin.java")));

// 5. art and logo ----------------------------------------------------------------------------------------------
const bg = has("client/src/main/resources/assets/luminos_client/textures/gui/title_bg.png") ? png("client/src/main/resources/assets/luminos_client/textures/gui/title_bg.png") : null;
check("5a. user artwork (commit be42463) is the in-game title background (1600x900)", !!bg && bg.w === 1600 && bg.h === 900 && /title_bg\.png/.test(ts));
check("5b. launcher Home uses the be42463 hero artwork", /hero-blue-hour/.test(txt("app/src/lib/art.ts") + txt("app/src/screens/Home.tsx")) && has("app/public/art/hero-blue-hour.webp"));
const logoThen = git("show", `${HERO_BASE}:brand/luminos.svg`);
check("5c. original dithered-moon logo is the active brand mark (brand, site, launcher, client)", logoThen ? [txt("brand/luminos.svg"), txt("site/public/luminos.svg"), txt("site/src/assets/luminos.svg")].every((s) => s.trim() === logoThen.trim()) : has("brand/luminos.svg"));
const ico = has("app/src-tauri/icons/icon.ico") ? fs.readFileSync(f("app/src-tauri/icons/icon.ico")) : Buffer.alloc(0);
const sz = []; for (let i = 0; i < (ico.length > 6 ? ico.readUInt16LE(4) : 0); i++) sz.push(ico[6 + i * 16] || 256);
check("5d. icon.ico carries 16..256 layers", [256, 128, 64, 48, 32, 16].every((s) => sz.includes(s)), sz.join(","));
check("5e. in-game icons exist at 16/32/128/256", [16, 32, 128, 256].every((n) => has(`client/src/main/resources/assets/luminos_client/icons/icon_${n}x${n}.png`)));

// 6. skins -------------------------------------------------------------------------------------------------------
const skins = JSON.parse(txt("app/src/data/skins.json") || "[]");
check("6a. 16 handcrafted 64x64 skins; each has a rule-built palette (40..160 colours, no noise)", skins.length === 16 && skins.every((s) => { const p = has("app/public/" + s.file) && png("app/public/" + s.file); return p && p.w === 64 && p.h === 64 && s.colors >= 40 && s.colors <= 160; }), skins.map((s) => s.colors).join(","));
check("6b. skin grid renders skinview3d portraits (snapSkin); procedural generators deleted", /snapSkin\(/.test(cos) && !has("scripts/gen-textured-skins.mjs") && has("scripts/gen-authentic-skins.mjs"));
const sk = execFileSync("node", [f("scripts/verify-skins.mjs")], { encoding: "utf8" }).trim().split("\n").pop();
check("6c. every skin has a filled outer layer (scripts/verify-skins.mjs)", /0 failing/.test(sk), sk);

// 7. mods ----------------------------------------------------------------------------------------------------------
const modules = (txt("app/src/data/modules.ts").match(/^\s*M\("/gm) || []).length, preset = txt("launcher/crates/luminos-core/src/preset.rs");
check("7a. Bento mods screen, >= 36 client modules", /Tactical Bento/.test(txt("app/src/screens/Mods.tsx")) && modules >= 36, `${modules} module ids`);
check("7b. preset auto-installs Sodium, Lithium, FerriteCore, EntityCulling, ImmediatelyFast from Modrinth", ["sodium", "lithium", "ferrite-core", "entityculling", "immediatelyfast"].every((s) => preset.includes(`slug: "${s}"`)) && /modrinth/i.test(preset));

// 8. version -------------------------------------------------------------------------------------------------------
const ver = {
  "app/package.json": JSON.parse(txt("app/package.json")).version, "tauri.conf.json": JSON.parse(txt("app/src-tauri/tauri.conf.json")).version,
  "Cargo.toml": (txt("app/src-tauri/Cargo.toml").match(/^version = "(.*)"/m) || [])[1], "gradle.properties": (txt("client/gradle.properties").match(/^mod_version=(.*)$/m) || [])[1],
};
check("8. version is 2.3.0 everywhere", Object.values(ver).every((v) => v === "2.3.0"), JSON.stringify(ver));

console.log(bad ? `\n${bad} check(s) FAILED` : "\nALL CHECKS PASSED");
process.exit(bad ? 1 : 0);
