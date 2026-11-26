// Objective gate for v4.1.0. Exits 1 if any check fails. Run from the repo root after building the client jar.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const rd = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const fails = []; let n = 0;
const check = (name, ok, why = "") => { n++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !why ? "" : "  -> " + why}`); if (!ok) fails.push(name); };
const V = "4.1.0";

// 1. Skin Showdown and preset skins removed
const cos = rd("app/src/screens/Cosmetics.tsx");
check("app/public/skins is gone", !existsSync("app/public/skins"));
check("preset skin generators/verifiers are gone", ["scripts/gen-authentic-skins.mjs", "scripts/gen-textured-skins.mjs", "scripts/verify-skins.mjs", "app/src/data/skins.json"].every((p) => !existsSync(p)));
check("Cosmetics.tsx has no Showdown, preset grid, Wings or Pets", !/showdown|BUILTIN_SKINS|skins\.json|\bwings?\b|\bpets?\b/i.test(cos), (cos.match(/showdown|BUILTIN_SKINS|wings?|pets?/i) || [""])[0]);
check("Cosmetics.tsx has the locker controls", ["Sync from Minecraft Username", "Upload Custom Skin (.PNG)", "Classic (4px)", "Slim (3px)", "3D Capes", "Unequip Cape"].every((t) => cos.includes(t)));
check("no preset skin ids remain in the locker catalog", !/BUILTIN_SKINS|luminos-moon-knight/.test(rd("app/src/locker/catalog.ts")));

// 2. Real launch progress
const lib = rd("app/src-tauri/src/lib.rs"), game = rd("app/src-tauri/src/game.rs"), core = rd("launcher/crates/luminos-core/src/launch.rs"), watch = rd("app/src-tauri/src/launch_watch.rs");
const steps = [1, 2, 3, 4, 5].filter((i) => new RegExp(`step\\(${i},`).test(lib));
check("src-tauri emits launch-progress for stages 1-5 and stage 6", lib.includes('"launch-progress"') && steps.length === 5 && /progress\(6,/.test(lib), `stages found: ${steps}`);
check("stage 6 follows the child's piped stdout/stderr until the window opens", core.includes("Stdio::piped()") && core.includes("child.stdout.take()") && core.includes("child.stderr.take()") && /tr\.feed\(&l\)/.test(lib) && /Backend library: LWJGL/.test(watch) && /Sound engine started/.test(watch) && /-atlas/.test(watch));
check("crash before the window emits game-state crashed with the last 30 lines", lib.includes("finish_crashed") && /error_log\(&h\.log_tail\(300\), 30\)/.test(lib) && game.includes('"status": "crashed"'));
const home = rd("app/src/screens/Home.tsx"), gs = rd("app/src/state/game.ts"), lp = rd("app/src/components/LaunchProgress.tsx");
check("game.ts listens to launch-progress", gs.includes('listen<LaunchProgress>("launch-progress"'));
check("Home.tsx renders the progress panel, In-Game badge and Quit Game", home.includes("<LaunchProgressPanel") && home.includes("In-Game (Luminos") && home.includes("Quit Game"));
check("progress panel has % badge, bar, stage text, log line, Cancel", /pct\}%/.test(lp) && lp.includes('role="progressbar"') && lp.includes("p?.stage") && lp.includes("launch-logline") && lp.includes("Cancel"));
check("diagnostic modal has Copy Log", lp.includes("Copy Log") && lp.includes("Launch error log"));

// 3. Stale jar purge + fresh jar
const iPurge = game.indexOf("purge_stale_client_jars(&mods)"), iCopy = game.indexOf("std::fs::copy(src, mods.join(&name))");
check("launch purges luminos-client* / luminos_client* / luminos-*.jar BEFORE copying the bundled jar", iPurge > 0 && iCopy > iPurge && /starts_with\("luminos-client"\)/.test(watch) && /starts_with\("luminos_client"\)/.test(watch) && /starts_with\("luminos-"\) && n\.ends_with\("\.jar"\)/.test(watch));
check("a last single-client check runs right before the JVM spawns", lib.indexOf("enforce_single_client") > 0 && lib.indexOf("enforce_single_client") < lib.indexOf("launch::spawn_ext"));
const built = `client/build/libs/luminos-client-${V}-mc1.21.11.jar`, bundled = `app/src-tauri/resources/mods/luminos-client-${V}-mc1.21.11.jar`;
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
check(`freshly built ${built} exists`, existsSync(built));
check("bundled jar exists and matches the built jar SHA-256", existsSync(bundled) && existsSync(built) && sha(bundled) === sha(built), existsSync(bundled) ? "sha mismatch" : "missing");
const jars = existsSync("app/src-tauri/resources/mods") ? readdirSync("app/src-tauri/resources/mods").filter((f) => f.endsWith(".jar")) : [];
check("resources/mods holds only 4.1.0 client jars", jars.length > 0 && jars.every((f) => f.startsWith(`luminos-client-${V}-`)), jars.join(","));
let jarText = "";
try { jarText = execFileSync("unzip", ["-p", bundled, "*.class", "*.json"], { maxBuffer: 1 << 28 }).toString("latin1"); } catch { /* checked below */ }
check("bundled jar contains 4.1.0 and zero '4.0.0' strings", jarText.includes(V) && !jarText.includes("4.0.0"));
const v = (p, re) => (rd(p).match(re) || [])[1];
const vers = { "app/package.json": v("app/package.json", /"version": "([^"]+)"/), "tauri.conf.json": v("app/src-tauri/tauri.conf.json", /"version": "([^"]+)"/), "Cargo.toml": v("app/src-tauri/Cargo.toml", /^version = "([^"]+)"/m), "client/gradle.properties": v("client/gradle.properties", /mod_version=(\S+)/), "client26/gradle.properties": v("client26/gradle.properties", /mod_version=(\S+)/), "LuminosClient.VERSION": v("client/src/shared/java/dev/luminos/client/LuminosClient.java", /VERSION = "([^"]+)"/) };
check(`every version is ${V}`, Object.values(vers).every((x) => x === V), JSON.stringify(vers));

// 4. In-game screens
const ts = rd("client/src/legacy/java/dev/luminos/client/LuminosTitleScreen.java"), scene = rd("client/src/shared/java/dev/luminos/client/TitleScene.java");
// Mojang mappings name Yarn's addDrawableChild "addRenderableWidget": same method, same behaviour.
check("title screen registers every button with addRenderableWidget (= addDrawableChild) as a Button subclass", /class LuminosPillButton extends Button/.test(ts) && /addRenderableWidget\(new LuminosPillButton/.test(ts) && /TitleScene\.layout\(/.test(ts));
check("title screen keeps super.mouseClicked", /return super\.mouseClicked\(event, doubleClick\)/.test(ts));
const ids = [...scene.matchAll(/new Btn\("(\w+)"/g)].map((m) => m[1]);
check("title screen has Singleplayer, Multiplayer, Mods, Options, Quit, HUD Studio, Capes", ["single", "multi", "mods", "options", "quit", "hud", "capes"].every((i) => ids.includes(i) && ts.includes(`case "${i}"`)), ids.join(","));
check("title screen shows 4.1.0 via LuminosClient.VERSION and no '4.0.0' in client sources", scene.includes("LuminosClient.VERSION") && !/4\.0\.0/.test(execFileSync("grep", ["-rh", "-e", "VERSION", "-e", "4.", "client/src/legacy", "client/src/shared"]).toString().split("\n").filter((l) => /["']4\.0\.0["']/.test(l)).join("\n")));
check("cover-fit math (never stretched)", /Math\.max\(w \/ \(float\) texW, h \/ \(float\) texH\)/.test(rd("client/src/legacy/java/dev/luminos/client/Adapter.java")));
const png = (p) => existsSync(p) && statSync(p).size > 30000 && readFileSync(p).subarray(1, 4).toString() === "PNG";
check("ingame-titlescreen-3.png exists and is not blank (PNG, > 30 KB: a flat image compresses to a few KB)", png("docs/design/rounds/ingame-titlescreen-3.png"));
check("ingame-quickpanel-3.png exists and is not blank", png("docs/design/rounds/ingame-quickpanel-3.png"));
const qp = rd("client/src/legacy/java/dev/luminos/client/LuminosQuickPanelScreen.java"), mp = rd("client/src/shared/java/dev/luminos/client/ModPanelView.java");
check("quick panel has tabs, 44px cards, toggle, gear popover and saves on change", /"All"/.test(mp) && /"PvP"/.test(mp) && /CARD_H = 44/.test(mp) && /Icons\.draw\(g, "gear"/.test(mp) && /Config\.save\(\)/.test(mp) && /new ModPanelView/.test(qp));

console.log(`\n${n - fails.length}/${n} checks passed`);
if (fails.length) { console.log("FAILED:\n - " + fails.join("\n - ")); process.exit(1); }
