// Luminos 4.0.0 verification. Exits 1 if any check fails. Run from the repo root: node scripts/verify-v4.0.mjs
// Flags: --post-release also checks the live-site screenshot. --no-cargo skips the Rust unit tests.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const argv = new Set(process.argv.slice(2));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const rd = (p) => fs.readFileSync(path.join(root, p), "utf8");
const has = (p) => fs.existsSync(path.join(root, p));
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); if (!ok) failed++; };
const pngSize = (p) => { const b = fs.readFileSync(path.join(root, p)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

// 1. Mixins: registered, source present, compiled into the jar
const legacy = JSON.parse(rd("client/src/legacy/resources/luminos-legacy.mixins.json"));
const shared = JSON.parse(rd("client/src/main/resources/luminos.mixins.json"));
const registered = new Set([...legacy.client, ...shared.client]);
const required = ["WorldRendererMixin", "EntityRenderDispatcherMixin", "BlockEntityRenderDispatcherMixin", "ParticleManagerMixin", "BackgroundRendererMixin",
  "LightmapTextureManagerMixin", "CameraMixin", "GameRendererMixin", "MouseMixin", "FramerateLimitTrackerMixin", "HeldItemRendererMixin",
  "InGameOverlayRendererMixin", "ClientWorldMixin", "LevelWeatherMixin", "MinecraftClientMixin", "TitleScreenMixin"];
for (const m of required) {
  const src = has(`client/src/legacy/java/dev/luminos/client/mixin/${m}.java`) || has(`client/src/shared/java/dev/luminos/client/mixin/${m}.java`);
  check(`Mixin ${m} registered + source`, registered.has(m) && src);
}
check("26.x line does not register 1.21-only Mixins", !/WorldRendererMixin/.test(rd("client26/src/main/resources/luminos-legacy.mixins.json")));
const libs = has("client/build/libs") ? fs.readdirSync(path.join(root, "client/build/libs")).filter((f) => /^luminos-client-.*-mc1\.21\.11\.jar$/.test(f)) : [];
check("client jar built (luminos-client-4.0.0-mc1.21.11.jar)", libs.includes("luminos-client-4.0.0-mc1.21.11.jar"), libs.join(","));
if (libs.length) {
  const listing = execSync(`unzip -Z1 "${path.join(root, "client/build/libs", libs[0])}"`).toString();
  const missing = required.filter((m) => !listing.includes(`/mixin/${m}.class`));
  check("every Mixin class is inside the jar", missing.length === 0, missing.join(","));
  check("jar carries fabric.mod.json + both mixin configs", ["fabric.mod.json", "luminos.mixins.json", "luminos-legacy.mixins.json"].every((f) => listing.includes(f)));
}

// 2. Provisioner + configs + JVM flags
const preset = rd("launcher/crates/luminos-core/src/preset.rs");
for (const slug of ["sodium", "lithium", "ferrite-core", "immediatelyfast", "entityculling", "modernfix", "moreculling"]) check(`provisioner slug ${slug}`, preset.includes(`slug: "${slug}"`));
const pc = rd("launcher/crates/luminos-core/src/perfconfig.rs");
check("perfconfig writes sodium-options.json / immediatelyfast.json / modernfix-mixins.properties", ["sodium-options.json", "immediatelyfast.json", "modernfix-mixins.properties"].every((f) => pc.includes(f)));
check("sodium keys: block face + fog occlusion + entity culling + visible textures", ["use_block_face_culling", "use_fog_occlusion", "use_entity_culling", "animate_only_visible_textures"].every((k) => pc.includes(k)));
check("launch.rs writes the configs at launch", rd("launcher/crates/luminos-core/src/launch.rs").includes("perfconfig::write_defaults"));
const jv = rd("launcher/crates/luminos-core/src/jvmflags.rs");
check("JVM flags: G1, MaxGCPauseMillis=30, AlwaysPreTouch, G1HeapRegionSize=8M", ["UseG1GC", "MaxGCPauseMillis=30", "AlwaysPreTouch", "G1HeapRegionSize=8M", "G1ReservePercent=20"].every((k) => jv.includes(k)));
check("User-Agent is Luminos-Launcher/4.0.0", rd("launcher/crates/luminos-core/src/http.rs").includes("Luminos-Launcher/4.0.0"));
if (!argv.has("--no-cargo")) {
  try {
    const out = execSync("cargo test -p luminos-core --lib -- perfconfig jvmflags", { cwd: path.join(root, "launcher"), stdio: ["ignore", "pipe", "pipe"] }).toString();
    check("cargo test perfconfig + jvmflags", /test result: ok\. 4 passed/.test(out));
  } catch (e) { check("cargo test perfconfig + jvmflags", false, String(e.stdout || e).slice(-160)); }
}

// 3. Capes and skins
const capeDir = "client/src/main/resources/assets/luminos_client/textures/capes";
const capes = fs.readdirSync(path.join(root, capeDir)).filter((f) => f.endsWith(".png"));
check("10 cape textures", capes.length === 10, String(capes.length));
check("every cape is 512x256", capes.every((c) => { const [w, h] = pngSize(`${capeDir}/${c}`); return w === 512 && h === 256; }));
const cos = rd("app/src/screens/Cosmetics.tsx");
check("Cosmetics.tsx uses skinview3d", cos.includes("skinview3d"));
check("Cosmetics.tsx has no Wings / Pets", !/wing|\bpet/i.test(cos));

// 4. Tauri commands
const lib = rd("app/src-tauri/src/lib.rs");
for (const c of ["check_app_update", "install_app_update", "stop_game", "get_game_status", "scan_local_worlds_and_servers", "start_microsoft_device_login"])
  check(`tauri command ${c} registered`, new RegExp(`generate_handler!\\[[\\s\\S]*\\b${c}\\b[\\s\\S]*\\]`).test(lib));

// 5. Versions
const v = (p, re) => (rd(p).match(re) || [])[1];
check("app/package.json 4.0.0", v("app/package.json", /"version":\s*"([^"]+)"/) === "4.0.0");
check("tauri.conf.json 4.0.0", v("app/src-tauri/tauri.conf.json", /"version":\s*"([^"]+)"/) === "4.0.0");
check("src-tauri/Cargo.toml 4.0.0", v("app/src-tauri/Cargo.toml", /^version\s*=\s*"([^"]+)"/m) === "4.0.0");
check("client/gradle.properties 4.0.0", v("client/gradle.properties", /^mod_version=(.+)$/m) === "4.0.0");
check("client26/gradle.properties 4.0.0", v("client26/gradle.properties", /^mod_version=(.+)$/m) === "4.0.0");

// 6. Repo hygiene (the cause of the red Windows jobs) + website hero + docs
const names = execSync("git ls-files -z", { cwd: root }).toString().split("\0").filter(Boolean);
const bad = names.filter((n) => /[^\x20-\x7e]|[<>:"|?*\\]|[ .]$|(^|\/)(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(n));
check("no Windows-invalid file names tracked", bad.length === 0, JSON.stringify(bad.slice(0, 3)));
const heroDiff = execSync("git diff --name-only v2.3.0 -- site/src/components/Hero.tsx site/src/components/Sky.tsx site/src/assets", { cwd: root }).toString().trim();
check("site Dithered-Moon hero untouched since v2.3.0", heroDiff === "", heroDiff);
check("site hero source present", has("site/src/components/Hero.tsx") && has("site/src/components/Sky.tsx"));
check("audit document exists", has("docs/architecture/V4_ENGINE_AND_SKILLS_AUDIT.md") && rd("docs/architecture/V4_ENGINE_AND_SKILLS_AUDIT.md").includes("What was NOT built"));
const shots = ["home-3", "mods-3", "cosmetics-capes-3", "cosmetics-skins-3"].map((n) => `docs/design/rounds/${n}.png`);
check("launcher screenshots are 2560x1600 (1280x800 @2x)", shots.every((s) => has(s) && pngSize(s).join("x") === "2560x1600"));
check("same screenshots copied to site/public/screenshots", shots.every((s) => has(`site/public/screenshots/${path.basename(s)}`)));
if (argv.has("--post-release")) check("live-site-v4.0.0.png captured", has("docs/design/rounds/live-site-v4.0.0.png"));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
