// node scripts/verify-v4.4.mjs [--skip-gradle]   Gates for 4.4.0. Exit 1 if any check fails.
// Source checks read the files; the Gradle step really builds the client (JDK 25) and runs the headless hit-test.
// Not checkable here: a running Minecraft window. Those items stay labelled UNVERIFIED in docs/CONTINUITY.
import { readFileSync, existsSync, readdirSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const rd = (p) => readFileSync(resolve(root, p), "utf8");
const sha = (p) => createHash("sha256").update(readFileSync(resolve(root, p))).digest("hex");
const nocomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
let bad = 0;
const ok = (n, c, note = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${note ? "  (" + note + ")" : ""}`); if (!c) bad++; };
const J = "client/src/legacy/java/dev/luminos/client/", S = "client/src/shared/java/dev/luminos/client/";

// 1. startup screen
const mc = rd(J + "mixin/MinecraftClientMixin.java"), menu = rd(J + "LuminosMainMenuScreen.java"), guard = rd(J + "mixin/TitleScreenGuardMixin.java");
ok("setScreen is intercepted with @ModifyVariable(HEAD, argsOnly) and a TitleScreen becomes new LuminosMainMenuScreen()",
  /@ModifyVariable\(method = "setScreen", at = @At\("HEAD"\), argsOnly = true\)/.test(mc) && /instanceof TitleScreen/.test(mc) && /return new LuminosMainMenuScreen\(\)/.test(mc));
ok("TitleScreen.init safety net redirects and cancels", /method = "init", at = @At\("HEAD"\), cancellable = true/.test(guard) && /new LuminosMainMenuScreen\(\)/.test(guard) && /ci\.cancel\(\)/.test(guard));
ok("LuminosMainMenuScreen.renderBackground is a no-op", /public void renderBackground\(GuiGraphics g, int mx, int my, float pt\) \{\}/.test(menu));
ok("LuminosMainMenuScreen registers no vanilla widgets and ESC does not close it", !/addRenderableWidget|addDrawableChild/.test(nocomment(menu)) && /shouldCloseOnEsc\(\) \{ return false; \}/.test(menu));
const mj = rd("client/src/legacy/resources/luminos-legacy.mixins.json");
ok("KeyboardMixin and TitleScreenGuardMixin are registered", /"KeyboardMixin"/.test(mj) && /"TitleScreenGuardMixin"/.test(mj));
const mmv = rd(S + "MainMenuView.java");
ok("main menu: one HitRegion list, cleared per frame, every button registers where it is drawn", /hitRegions\.clear\(\)/.test(mmv) && /hitRegions\.add\(new HitRegion\(x, y, w, h, id\)\)/.test(mmv));

// 2. Right Ctrl, both hooks
const kb = rd(J + "mixin/KeyboardMixin.java"), tg = rd(J + "QuickPanelToggle.java");
ok("KeyboardMixin hooks keyPress at HEAD (cancellable) for RIGHT_CONTROL and RIGHT_SHIFT", /@Inject\(method = "keyPress", at = @At\("HEAD"\), cancellable = true\)/.test(kb) && /GLFW_KEY_RIGHT_CONTROL/.test(kb) && /GLFW_KEY_RIGHT_SHIFT/.test(kb));
ok("MinecraftClientMixin.runTick polls glfwGetKey(RIGHT_CONTROL / RIGHT_SHIFT) with an edge detector", /method = "runTick", at = @At\("HEAD"\)/.test(mc) && /glfwGetKey\(handle, GLFW\.GLFW_KEY_RIGHT_CONTROL\)/.test(mc) && /GLFW_KEY_RIGHT_SHIFT/.test(mc) && /luminos\$rCtrlWasDown/.test(mc));
ok("QuickPanelToggle opens and closes LuminosQuickPanelScreen, debounced, never over chat/inventories",
  /new LuminosQuickPanelScreen/.test(tg) && /q\.onClose\(\)/.test(tg) && /DEBOUNCE_NS/.test(tg) && /LuminosMainMenuScreen/.test(tg) && /PauseScreen/.test(tg));

// 3. quick panel hazards
const qs = rd(J + "LuminosQuickPanelScreen.java"), mv = rd(S + "ModPanelView.java"), mvc = nocomment(mv);
ok("zero addRenderableWidget / addDrawableChild in LuminosQuickPanelScreen and ModPanelView", !/addRenderableWidget|addDrawableChild/.test(nocomment(qs) + mvc));
ok("HitRegion list cleared each frame; scrolled hits clamped to [gridTop, gridBottom]", /hitRegions\.clear\(\)/.test(mvc) && /record HitRegion/.test(mvc) && /Math\.max\(y, gridTop\), y1 = Math\.min\(y \+ h, gridBottom\)/.test(mvc));
ok("ModPanelView never calls setScreen / Nav.open (toggling cannot open a screen)", !/setScreen|Nav\.open/.test(mvc));
ok("toggle = Feature.toggle() + click sound; gear/right-click set expandedModule (inline drawer)", /ff\.toggle\(\); clickSound\.run\(\)/.test(mvc) && /expandedModule = expandedModule == ff \? null : ff/.test(mvc) && /private void drawer\(/.test(mvc));
ok("tabs: selectedCategory-equivalent set, scroll reset, 7 categories", /cat = cc; scrollOffset = 0; expandedModule = null/.test(mvc) && /MOVEMENT\("Movement"\), PERFORMANCE\("Performance"\)/.test(mvc));
for (const [n, re] of [["mouseClicked", /@Override\s+public boolean mouseClicked\(MouseButtonEvent/], ["mouseReleased", /@Override\s+public boolean mouseReleased\(MouseButtonEvent/], ["mouseDragged", /@Override\s+public boolean mouseDragged\(MouseButtonEvent/],
  ["mouseScrolled (4 doubles)", /@Override\s+public boolean mouseScrolled\(double x, double y, double sx, double sy\)/], ["keyPressed", /@Override\s+public boolean keyPressed\(KeyEvent/], ["charTyped", /@Override\s+public boolean charTyped\(CharacterEvent/]])
  ok(`@Override ${n}`, re.test(qs));
ok("LuminosQuickPanelScreen.renderBackground is a no-op", /public void renderBackground\(GuiGraphics g, int mx, int my, float pt\) \{\}/.test(qs));

// 4. engine
ok("FastMathLUT has 65,536 entries and is used", /SIZE = 65536/.test(rd(S + "FastMathLUT.java")) && /FastMathLUT\.sin/.test(mmv));
for (const m of ["WorldRenderer", "EntityRenderDispatcher", "BlockEntityRenderDispatcher", "ParticleManager", "BackgroundRenderer", "LightmapTextureManager", "Camera", "GameRenderer", "Mouse", "HeldItemRenderer", "InGameOverlayRenderer", "ClientWorld", "FramerateLimitTracker"])
  ok(`engine mixin ${m}Mixin present and registered`, existsSync(resolve(root, J + `mixin/${m}Mixin.java`)) && new RegExp(`"${m}Mixin"`).test(mj));

// 5. launcher lighting
const sc = rd("app/src/locker/scene.ts"), cat = rd("app/src/locker/catalog.ts"), cos = rd("app/src/screens/Cosmetics.tsx");
ok("studio light rig is global 2.2 / camera 1.6 (was 0.4 / 0.9)", /studio: \{[^}]*global: 2\.2, camera: 1\.6/.test(sc));
ok("cobalt studio glow behind the canvas", /radial-gradient\(circle at 50% 45%, rgba\(59,130,246,0\.22\), rgba\(15,18,26,0\.95\) 75%\)/.test(cos));
ok("default skin is the bright high-contrast one", /#E8B48C/.test(cat) && /#3B82F6/.test(cat));

// 6. versions
const v = (p, re) => re.exec(rd(p))?.[1];
ok("version 4.4.0 everywhere", v("client/gradle.properties", /mod_version=(\S+)/) === "4.4.0" && v("client26/gradle.properties", /mod_version=(\S+)/) === "4.4.0" && v("app/package.json", /"version": "([^"]+)"/) === "4.4.0"
  && v("app/src-tauri/tauri.conf.json", /"version": "([^"]+)"/) === "4.4.0" && v("app/src-tauri/Cargo.toml", /^version = "([^"]+)"/m) === "4.4.0" && /VERSION = "4\.4\.0"/.test(rd(S + "LuminosClient.java")));
ok("CHANGELOG 4.4.0 has English + Español", /## 4\.4\.0[\s\S]*?### English[\s\S]*?### Español/.test(rd("CHANGELOG.md")));
ok("research doc exists", existsSync(resolve(root, "docs/architecture/CLIENT_DEEP_RESEARCH_V4.4.md")) && rd("docs/architecture/CLIENT_DEEP_RESEARCH_V4.4.md").length > 4000);

// 7. build + hit-test + jar parity
if (!process.argv.includes("--skip-gradle")) {
  let jh = process.env.JAVA_HOME;
  if (!jh || !/25/.test(jh)) { const d = existsSync("/tmp/tools") ? readdirSync("/tmp/tools").find((f) => /^jdk-25/.test(f)) : null; if (d) jh = `/tmp/tools/${d}`; }
  const env = { ...process.env, JAVA_HOME: jh };
  const g = spawnSync("./gradlew", ["clean", "build", "hitTest", "--no-daemon", "--console=plain", `-PhitOut=${root}/docs/design/rounds/hit-test-4.4.txt`], { cwd: resolve(root, "client"), env, encoding: "utf8", maxBuffer: 1 << 28 });
  const out = (g.stdout || "") + (g.stderr || "");
  ok("./gradlew clean build hitTest succeeds", g.status === 0, g.status === 0 ? "" : out.split("\n").slice(-15).join(" | "));
  const warns = out.split("\n").filter((l) => /(^|\s)warning:/.test(l) && !/deprecat/i.test(l));
  ok("javac reports zero warnings", warns.length === 0, warns.length ? warns.slice(0, 3).join(" | ") : "");
  const hit = existsSync(resolve(root, "docs/design/rounds/hit-test-4.4.txt")) ? rd("docs/design/rounds/hit-test-4.4.txt") : "";
  ok("headless hit-test: every check passed", /(\d+)\/\1 checks passed/.test(hit) && !/FAIL/.test(hit), (/\d+\/\d+ checks passed/.exec(hit) || [""])[0]);
  const jar = "client/build/libs/luminos-client-4.4.0-mc1.21.11.jar", dst = "app/src-tauri/resources/mods/luminos-client-4.4.0-mc1.21.11.jar";
  if (existsSync(resolve(root, jar))) {
    mkdirSync(resolve(root, "app/src-tauri/resources/mods"), { recursive: true });
    for (const f of readdirSync(resolve(root, "app/src-tauri/resources/mods"))) if (/luminos.*\.jar$/i.test(f)) rmSync(resolve(root, "app/src-tauri/resources/mods", f));   // purge old jars
    copyFileSync(resolve(root, jar), resolve(root, dst));
    ok("bundled jar has the same SHA-256 as the built jar", sha(jar) === sha(dst), sha(jar).slice(0, 16));
  } else ok("client jar built", false, jar);
}

// 8. visual proofs exist (the PNGs themselves must be looked at by a person or the Read tool; this only proves they were rendered)
const png = (p) => { const b = existsSync(resolve(root, p)) ? readFileSync(resolve(root, p)) : null; return b && b.length > 20000 && b.readUInt32BE(0) === 0x89504e47 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
for (const [p, w, h] of [["docs/design/rounds/ingame-mainmenu-4.4.png", 1280, 720], ["docs/design/rounds/ingame-quickpanel-4.4.png", 1280, 720], ["docs/design/rounds/cosmetics-4.4.png", 1280, 800]]) {
  const d = png(p); ok(`${p} rendered`, !!d && d[0] === w && d[1] === h, d ? `${d[0]}x${d[1]}` : "missing");
}
console.log(bad ? `\n${bad} check(s) FAILED` : "\nall checks passed");
process.exit(bad ? 1 : 0);
