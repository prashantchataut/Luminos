// node scripts/verify-v4.2.mjs [--post-release]   Source-level gates for 4.2.0. Exits 1 on the first failed group.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
let bad = 0; const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`); if (!c) bad++; };
const rd = (p) => fs.readFileSync(p, "utf8"); const ex = (p) => fs.existsSync(p);
const walk = (d, o = []) => { if (!ex(d)) return o; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", "target", "build", ".gradle", "dist"].includes(e.name)) continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };
const src = ["app/src-tauri/src", "launcher/crates", "app/src", "client/src", "client26/src"].flatMap((d) => walk(d)).filter((f) => /\.(rs|ts|tsx|java|json)$/.test(f));
// 1. JVM memory
ok("no -XX:+AlwaysPreTouch anywhere in source", !src.some((f) => rd(f).includes("-XX:+AlwaysPreTouch")));
const mg = rd("launcher/crates/luminos-core/src/memguard.rs"), ln = rd("launcher/crates/luminos-core/src/launch.rs");
ok('Rust passes -Xms512M (XMS_MB=512, never equal to Xmx)', /XMS_MB: u32 = 512/.test(mg) && mg.includes('"-Xms512M"'));
ok("Xmx = requested.min(55% of FREE ram).clamp(1024, 3072), default 2048", mg.includes("FREE_RAM_FRACTION: f64 = 0.55") && /requested_mb\.min\(safe_max\)\.clamp\(MIN_XMX_MB, MAX_XMX_MB\)/.test(mg) && /MIN_XMX_MB: u32 = 1024/.test(mg) && /MAX_XMX_MB: u32 = 3072/.test(mg) && /DEFAULT_XMX_MB: u32 = 2048/.test(mg));
ok("free RAM read via GlobalMemoryStatusEx / MemAvailable", mg.includes("GlobalMemoryStatusEx") && mg.includes("MemAvailable"));
ok("launch.rs uses memguard::heap_args and no raw -Xmx{mem}", ln.includes("memguard::heap_args") && !/-Xmx\{mem\}/.test(ln));
ok("default RAM 2048 (core + UI)", /memory_mb: 2048/.test(rd("launcher/crates/luminos-core/src/config.rs")) && /memoryMb: 2048/.test(rd("app/src/store.ts")));
ok("ModernFix dynamic_resources=true default; FerriteCore+ModernFix in preset", rd("launcher/crates/luminos-core/src/perfconfig.rs").includes("mixin.perf.dynamic_resources=true") && rd("launcher/crates/luminos-core/src/preset.rs").includes('slug: "ferrite-core"') && rd("launcher/crates/luminos-core/src/preset.rs").includes('slug: "modernfix"'));
// 2. client jar + title screen
const gm = rd("app/src-tauri/src/game.rs"), lw = rd("app/src-tauri/src/launch_watch.rs");
ok("Rust purges every *luminos*.jar in mods/ and the cache BEFORE copying", gm.indexOf("purge_stale_client_jars(&mods)") > 0 && gm.indexOf("purge_cache_jars") > 0 && gm.indexOf("purge_stale_client_jars(&mods)") < gm.indexOf("std::fs::copy(src") && lw.includes('n.contains("luminos")'));
const mx = rd("client/src/shared/java/dev/luminos/client/mixin/TitleScreenMixin.java"), tm = rd("client/src/shared/java/dev/luminos/client/TitleMenu.java"), ts = rd("client/src/shared/java/dev/luminos/client/TitleScene.java");
ok("TitleScreenMixin does not cancel anything and does not touch render()", !/cancellable|ci\.cancel|method\s*=\s*"render"|mouseClicked/.test(mx.replace(/\/\*[\s\S]*?\*\//g, "")));
ok("mixin clears vanilla widgets and registers via addRenderableWidget at init TAIL", /method = "init", at = @At\("TAIL"\)/.test(mx) && mx.includes("this.clearWidgets()") && mx.includes("this.addRenderableWidget("));
ok("all 5 buttons exist (Singleplayer, Multiplayer, Luminos Mods [Right Ctrl], Options..., Quit Game) with the spec positions", ["Singleplayer", "Multiplayer", "Luminos Mods [Right Ctrl]", "Options...", "Quit Game"].every((l) => ts.includes(`"${l}"`)) && ts.includes("w / 2 - 100") && ts.includes("h / 4 + 48") && ts.includes("y0 + 76") && ["SelectWorldScreen", "JoinMultiplayerScreen", "LuminosQuickPanelScreen", "OptionsScreen", "mc.stop()"].every((k) => tm.includes(k)));
ok("no screen swap / TitleView click handler left", !ex("client/src/shared/java/dev/luminos/client/TitleView.java") && !src.some((f) => f.endsWith(".java") && /replaceTitleScreen|new TitleView/.test(rd(f))));
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
for (const [mc, dir] of [["1.21.11", "client"], ["26.3", "client26"]]) {
  const a = `${dir}/build/libs/luminos-client-4.2.0-mc${mc}.jar`, b = `app/src-tauri/resources/mods/luminos-client-4.2.0-mc${mc}.jar`;
  ok(`jar for ${mc}: built and bundled copy have identical SHA-256`, ex(a) && ex(b) && sha(a) === sha(b), ex(a) ? sha(a).slice(0, 12) : "missing; build with gradlew build and copy");
}
ok("no stale client jar in resources/mods", walk("app/src-tauri/resources/mods").filter((f) => f.endsWith(".jar")).every((f) => f.includes("-4.2.0-")));
// 3. design
ok("skill audit written", ex("docs/design/V4.2_SKILL_AUDIT.md"));
for (const s of ["home", "mods", "cosmetics", "preferences"]) for (const r of [1, 2, 3]) { const p = `docs/design/rounds/${s}-${r}.png`; ok(`round ${r} ${s} png (>20 KB)`, ex(p) && fs.statSync(p).size > 20000); }
// 4. versions
const j = (p) => JSON.parse(rd(p)).version;
ok("version 4.2.0 in app/package.json, tauri.conf.json, Cargo.toml, client + client26 gradle.properties", j("app/package.json") === "4.2.0" && j("app/src-tauri/tauri.conf.json") === "4.2.0" && /^version = "4\.2\.0"/m.test(rd("app/src-tauri/Cargo.toml")) && /^mod_version=4\.2\.0/m.test(rd("client/gradle.properties")) && /^mod_version=4\.2\.0/m.test(rd("client26/gradle.properties")));
if (process.argv.includes("--post-release")) { const r = JSON.parse(rd("site/public/release.json")); ok("site/public/release.json points to v4.2.0", r.tag === "v4.2.0" && r.published === true); }
console.log(bad ? `\n${bad} check(s) FAILED` : "\nALL CHECKS PASSED (source-level; nothing here was run inside a real Minecraft)");
process.exit(bad ? 1 : 0);
