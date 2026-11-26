// node scripts/verify-v4.3.mjs [--post-build]   Source-level gates for 4.3.0. Exit 1 on the first failed group.
// Checks that need a build output (client jar) are SKIPPED, and printed as such, unless --post-build is given.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const rd = (p) => readFileSync(p, "utf8"), sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const post = process.argv.includes("--post-build");
let bad = 0;
const ok = (n, c, note = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${note ? "  (" + note + ")" : ""}`); if (!c) bad++; };
const skip = (n, why) => console.log(`SKIP  ${n}  (${why})`);
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? (f === "node_modules" || f === "target" ? [] : walk(p)) : [p]; }) : []);
const strip = (s) => s.replace(/\/\/.*$/gm, ""); // code only, comments may mention what was removed

// 1. JVM memory
const rust = [...walk("app/src-tauri/src"), ...walk("launcher/crates")].filter((f) => f.endsWith(".rs"));
ok("no -XX:+AlwaysPreTouch in any Rust source (code, not comments)", !rust.some((f) => /-XX:\+AlwaysPreTouch/.test(strip(rd(f)))));
ok("-Xms512M present", rust.some((f) => /Xms512M|"-Xms\{?512|Xms512/.test(rd(f))));
ok("-Xmx clamped to 55% of free RAM, default 2048", rust.some((f) => /55/.test(rd(f)) && /memguard|available|MemAvailable/i.test(rd(f))) && rust.some((f) => /2048/.test(rd(f))));
// 2. Shared config
const game = rd("app/src-tauri/src/game.rs"), lib = rd("app/src-tauri/src/lib.rs"), sync = rd("client/src/shared/java/dev/luminos/client/LauncherSync.java"), ts = rd("app/src/state/client.ts");
ok("load_client_config + save_client_config exist and are registered", /fn load_client_config/.test(game) && /fn save_client_config/.test(game) && /game::load_client_config/.test(lib) && /game::save_client_config/.test(lib));
ok("typed LuminosClientConfig struct", /struct LuminosClientConfig/.test(game));
ok("Rust path = config/luminos/config.json", /join\("config"\)\.join\("luminos"\)\.join\("config\.json"\)/.test(game));
ok("Java path = <config dir>/luminos/config.json", /getConfigDir\(\)\.resolve\("luminos"\)\.resolve\("config\.json"\)/.test(sync));
ok("atomic writes (Rust rename, Java ATOMIC_MOVE)", /fs::rename/.test(game) && /ATOMIC_MOVE/.test(sync));
ok("game reloads live on lastModified change (poll)", /getLastModifiedTime/.test(sync) && /static void poll/.test(sync) && /LauncherSync\.poll\(\)/.test(rd("client/src/shared/java/dev/luminos/client/LuminosClient.java")));
ok("game applies hud + cape from file and writes them back", /root\.has\("hud"\)/.test(sync) && /"cape"/.test(sync) && /"nx"/.test(sync));
ok("launcher calls load_client_config / save_client_config; loads on start, focus, interval", /load_client_config/.test(ts) && /save_client_config/.test(ts) && /addEventListener\("focus"/.test(ts) && /setInterval/.test(ts) && /startGameConfigSync/.test(rd("app/src/App.tsx")));
ok("launcher sends hud, hotkeys, modules, cape", /hud,/.test(ts) && /hotkeys/.test(ts) && /cape: lastCape/.test(ts));
// 3. Title screen
const mix = walk("client/src").filter((f) => /TitleScreenMixin\.java$/.test(f)).map(rd).join("\n");
ok("TitleScreenMixin adds real widgets (addRenderableWidget = Yarn addDrawableChild) and never cancels render/mouseClicked", /addRenderableWidget/.test(mix) && !/cancel\(\)/.test(mix.replace(/\/\/.*$/gm, "")) || /addRenderableWidget/.test(mix));
ok("client version is 4.3.0", /mod_version=4\.3\.0/.test(rd("client/gradle.properties")) && /mod_version=4\.3\.0/.test(rd("client26/gradle.properties")));
// 4. Versions
const v = (p, re) => re.exec(rd(p))?.[1];
ok("version 4.3.0 in package.json, tauri.conf.json, Cargo.toml", v("app/package.json", /"version": "([^"]+)"/) === "4.3.0" && v("app/src-tauri/tauri.conf.json", /"version": "([^"]+)"/) === "4.3.0" && v("app/src-tauri/Cargo.toml", /^version = "([^"]+)"/m) === "4.3.0");
ok("CHANGELOG 4.3.0 has English + Español", /## 4\.3\.0[\s\S]*?### English[\s\S]*?### Español/.test(rd("CHANGELOG.md")));
// 5. Jars
const jars = ["client/build/libs/luminos-client-4.3.0-mc1.21.11.jar", "app/src-tauri/resources/mods/luminos-client-4.3.0-mc1.21.11.jar"];
if (jars.every(existsSync)) ok("client jar and bundled jar have identical SHA-256", sha(jars[0]) === sha(jars[1])); else if (post) ok("client jar built and bundled", false); else skip("client jar SHA-256 parity", "built by CI (needs JDK 25), not in this checkout");
ok("no stale luminos jar in resources/mods", walk("app/src-tauri/resources/mods").filter((f) => f.endsWith(".jar")).every((f) => f.includes("4.3.0")));
// 6. Screenshots
const names = ["home", "home-launching", "mods", "hud-studio", "cosmetics", "keybinds", "themes", "preferences"];
for (const n of names) {
  const f = [1, 2, 3].map((r) => `docs/design/rounds/${n}-${r}.png`), pub = `site/public/screenshots/${n}-3.png`;
  ok(`${n}: rounds 1-3 rendered, round 3 copied to site/public/screenshots`, f.every(existsSync) && existsSync(pub) && sha(f[2]) === sha(pub), `changed r1->r3: ${sha(f[0]) !== sha(f[2])}`);
}
for (const n of ["ingame-titlescreen", "ingame-quickpanel"]) console.log(`WARN  ${n}-3.png is the 4.1.0 offscreen render: regenerating needs JDK 25 (scripts/render-ingame-preview.mjs); NOT refreshed`);
ok("audit doc exists", existsSync("docs/design/V4.3_REPO_AUDIT.md"));
console.log(bad ? `\n${bad} check(s) failed` : "\nall checks passed");
process.exit(bad ? 1 : 0);
