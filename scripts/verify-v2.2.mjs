#!/usr/bin/env node
// Static release gate for Luminos 2.2.0. Exits 1 if anything below is false. It proves the repo contents, NOT that the
// Windows app or the game were run: see docs/STATUS_v2.2.md for what is verified by execution and what is not.
import { readFileSync, existsSync, statSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => join(root, p), txt = (p) => (existsSync(R(p)) ? readFileSync(R(p), "utf8") : "");
let fails = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

function decode(p) { // PNGs written by scripts/gen-textured-skins.mjs (8-bit RGBA, filter 0)
  const b = readFileSync(R(p)); let o = 8, w = 0, h = 0; const idat = [];
  while (o < b.length) { const l = b.readUInt32BE(o), t = b.toString("ascii", o + 4, o + 8); if (t === "IHDR") { w = b.readUInt32BE(o + 8); h = b.readUInt32BE(o + 12); } if (t === "IDAT") idat.push(b.subarray(o + 8, o + 8 + l)); o += 12 + l; }
  const raw = inflateSync(Buffer.concat(idat)), px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) raw.copy(px, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  return { w, h, px };
}
const stats = ({ w, h, px }) => { const s = new Set(); for (let i = 0; i < px.length; i += 4) if (px[i + 3]) s.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
  let flat = 0; for (let y = 0; y + 4 <= h; y++) for (let x = 0; x + 4 <= w; x++) { let f = null, same = true; for (let j = 0; j < 4 && same; j++) for (let i = 0; i < 4; i++) { const k = ((y + j) * w + x + i) * 4; if (!px[k + 3]) { same = false; break; } const c = (px[k] << 16) | (px[k + 1] << 8) | px[k + 2]; if (f === null) f = c; else if (c !== f) { same = false; break; } } if (same) flat++; }
  return { colours: s.size, flat }; };

// 1. original logo + user art
const svg = txt("brand/luminos.svg");
ok(svg.includes("#e2eeff") && svg.includes("#060a1a"), "brand/luminos.svg is the dithered blue moon");
// the v2.1.0 crescent+crystal icons were 116 KB (.ico) and 36 KB (.png); the restored pixel-moon files are far smaller
ok(existsSync(R("app/src-tauri/icons/icon.ico")) && statSync(R("app/src-tauri/icons/icon.ico")).size < 60000, "src-tauri/icons/icon.ico is the restored pixel-moon .ico (not the 116 KB v2.1.0 one)");
ok(statSync(R("app/src-tauri/icons/icon.png")).size < 10000 && statSync(R("app/src-tauri/icons/128x128@2x.png")).size < 12000, "src-tauri png icons are the restored pixel-moon files");
ok(txt("app/src/components/LuminosLogo.tsx").includes("/luminos.svg") && !/crystal|crescent/i.test(txt("app/src/components/LuminosLogo.tsx")), "app sidebar/onboarding logo is the moon (no crystal/crescent mark)");
ok(txt("app/src-tauri/tauri.conf.json").includes("icons/icon.ico"), "NSIS installer icon points at icon.ico");
for (const f of ["app/public/art/hero-blue-hour.webp", "app/public/covers/overworld.webp", "app/public/covers/nether.webp", "app/public/art/title-bg.webp", "app/public/art/skin-studio.webp", "site/public/art/hero-blue-hour.webp", "site/public/art/title-bg.webp", "client/src/main/resources/assets/luminos_client/textures/gui/title_bg.png", "docs/design/USER_ART_AUDIT.md"]) ok(existsSync(R(f)) && statSync(R(f)).size > 2000, `art present: ${f}`);
ok(txt("app/src/screens/Home.tsx").includes("hero-blue-hour.webp") && txt("app/src/screens/Home.tsx").includes("covers/overworld.webp"), "Home hero + version covers use the user art");
ok(txt("app/src/components/OnboardingModal.tsx").includes("hero-blue-hour.webp"), "onboarding backdrop uses the user art");
ok(txt("app/src/screens/Cosmetics.tsx").includes("skin-studio.webp"), "Skin Showdown stage uses the studio backdrop");
ok(/hero-blue-hour|title-bg/.test(txt("site/src/App.tsx") + txt("site/src/components/Capes.tsx") + txt("site/src/components/ui.tsx") + txt("site/src/index.css")), "site/ source references the user art");
// 2/3. client
const wb = txt("client/src/shared/java/dev/luminos/client/WindowBrand.java"), lc = txt("client/src/shared/java/dev/luminos/client/LuminosClient.java"), ts = txt("client/src/legacy/java/dev/luminos/client/LuminosTitleScreen.java");
ok(wb.includes("glfwSetWindowIcon") && wb.includes("glfwSetWindowTitle") && wb.includes('"Luminos Client "'), 'client calls glfwSetWindowIcon + glfwSetWindowTitle("Luminos Client …")');
ok(lc.includes("WindowBrand.apply") && lc.includes("WindowBrand.tick"), "WindowBrand hooked on CLIENT_STARTED and every tick");
for (const s of [16, 32, 256]) ok(existsSync(R(`client/src/main/resources/assets/luminos_client/icons/icon_${s}x${s}.png`)), `window icon ${s}x${s} bundled`);
const widgets = (ts.match(/addRenderableWidget\(/g) || []).length; // Mojang-mapped name of Yarn's addDrawableChild
ok(widgets >= 7 && !/mouseClicked/.test(ts), `LuminosTitleScreen registers ${widgets} real widgets via addRenderableWidget (Mojang mappings) with no hand-rolled mouseClicked`);
for (const [label, call] of [["Singleplayer", "new SelectWorldScreen(this)"], ["Multiplayer", "new JoinMultiplayerScreen(this)"], ["Luminos Mods", "new LuminosQuickPanelScreen("], ["Cosmetics", "new HudEditorScreen(this)"], ["Options", "new OptionsScreen(this"], ["Quit Game", "minecraft.stop()"]]) ok(ts.includes(`"${label}`) || ts.includes(label), `title button ${label}`) && ok(ts.includes(call), `  -> ${call}`);
// 4/7. cosmetics purge + capes + skins
const clean = ["app/src/screens/Cosmetics.tsx", "app/src/locker/catalog.ts", "app/src/locker/scene.ts", "app/src/data/library.json"].map((f) => [f, (txt(f).match(/\b(wings?|pets?)\b/gi) || []).length]);
for (const [f, n] of clean) ok(n === 0, `0 wings/pets mentions in ${f}`);
ok(!existsSync(R("app/src/locker/wings.ts")) && !existsSync(R("app/src/locker/pets.ts")), "wings.ts / pets.ts deleted");
const lib = JSON.parse(txt("app/src/data/library.json")).capes; const want = ["Job Application", "Touch Grass 3D", "Ball Knowledge Tactician", "404 Skill Not Found", "Luminos Original Moon"];
for (const n of want) ok(lib.some((c) => c.name === n), `cape exists: ${n}`);
ok(lib.length >= 10, `${lib.length} capes`);
for (const c of lib) for (const f of c.frameFiles) { const d = decode("app/public/" + f), s = stats(d); ok(d.w === 128 && d.h === 64 && s.colours >= 50, `cape ${f}: 128x64, ${s.colours} colours`); }
ok(lib.find((c) => c.id === "ball-knowledge-tactician")?.frames > 1, "Ball Knowledge Tactician has multiple frames");
ok(lib.filter((c) => c.relief).length >= 3, "3D relief capes flagged");
const skins = JSON.parse(txt("app/src/data/skins.json")); ok(skins.length === 16, `16 skins (${skins.length})`);
for (const sk of skins) { const d = decode("app/public/" + sk.file), s = stats(d); ok(d.w === 64 && d.h === 64 && s.colours >= 50 && s.flat === 0, `skin ${sk.id}: ${s.colours} colours, ${s.flat} flat 4x4 windows`); }
const cos = txt("app/src/screens/Cosmetics.tsx"); for (const k of ["Moonlit Arena", "Nether Glow", "Daylight Shader", "Studio Rim Light"].map((s) => s)) ok(txt("app/src/locker/scene.ts").includes(k), `lighting preset ${k}`);
for (const k of ["Idle breathe", "Sprint, cape flow", "Sword block-hit", "Sneak", "360° turntable", "Compare", "Ely.by", "Pixel editor"]) ok(cos.includes(k), `studio: ${k}`);
// 6. mods
const mods = txt("app/src/data/modules.ts"), n = (mods.match(/^\s+M\("/gm) || []).length; ok(n >= 36, `${n} client modules (>= 36)`);
for (const id of ["replaymarker", "snaplook", "autogg", "nickhider", "packorganizer", "screenshotmanager", "tabeditor", "pingtag", "waypoints", "minimap", "fullbright", "freelook", "zoom", "keystrokes"]) ok(mods.includes(`"${id}"`), `module ${id}`);
const mt = txt("app/src/screens/Mods.tsx"); ok(mt.includes("#11141C") && mt.includes("w-[3px]") && mt.includes("#3B82F6") && mt.includes("gear"), "Mods screen is the Tactical Bento card");
// 5/4/8. rust + react
const lib_rs = txt("app/src-tauri/src/lib.rs"), hand = lib_rs.slice(lib_rs.indexOf("generate_handler!"));
for (const c of ["check_app_update", "install_app_update", "start_microsoft_device_login", "open_external"]) ok(hand.includes(c), `tauri command registered: ${c}`);
ok(txt("app/src/components/UpdateBanner.tsx").includes("check_app_update") && txt("app/src/components/UpdateBanner.tsx").includes("install_app_update") && txt("app/src/components/UpdateBanner.tsx").includes("Install &amp; Restart"), "updater wired in React");
ok(txt("app/src/components/MicrosoftSignIn.tsx").includes("start_microsoft_device_login") && txt("app/src/components/AccountModal.tsx").includes("MicrosoftSignIn"), "Microsoft device-code sign-in wired in React");
const upd = txt("launcher/crates/luminos-core/src/update.rs"); ok(upd.includes("releases/latest") && upd.includes('"/S"') && upd.includes("hash_from_sums"), "updater: /releases/latest, SHA-256 check, silent NSIS install");
ok(txt("launcher/crates/luminos-core/src/msauth.rs").includes("user.auth.xboxlive.com") && txt("launcher/crates/luminos-core/src/msauth.rs").includes("api.minecraftservices.com") && txt("launcher/crates/luminos-core/src/secrets.rs").includes("keyring"), "MS auth chain + OS keyring in core");
ok(["Welcome", "Account", "Performance", "Gameplay"].every((s) => txt("app/src/components/OnboardingModal.tsx").includes(s)), "4-step onboarding wizard");
const pre = txt("launcher/crates/luminos-core/src/preset.rs"); for (const s of ["sodium", "lithium", "ferrite-core", "immediatelyfast", "entityculling", "modernfix"]) ok(pre.includes(`slug: "${s}"`), `perf stack mod in preset: ${s}`);
// versions
for (const [f, re] of [["app/package.json", /"version": "2\.2\.0"/], ["app/src-tauri/tauri.conf.json", /"version": "2\.2\.0"/], ["app/src-tauri/Cargo.toml", /^version = "2\.2\.0"/m], ["client/gradle.properties", /^mod_version=2\.2\.0/m]]) ok(re.test(txt(f)), `${f} is 2.2.0`);
console.log(fails ? `\n${fails} check(s) FAILED` : "\nall checks passed"); process.exit(fails ? 1 : 0);
