// Renders docs/design/rounds/ingame-titlescreen-3.png, ingame-quickpanel-3.png (1280x720) and ingame-quickpanel-settings-3.png.
// It runs the REAL layout/paint code of the in-game screens (TitleScene, ModPanelView in client/src/shared) through a Java2D Gfx,
// using Minecraft's own bitmap font from the game jar on the Gradle classpath. Needs JDK 25 (JAVA_HOME) like the client build.
// Honest limit: this is an offscreen render at GUI scale 2, not a screenshot of the running game.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "docs/design/rounds");
const r = spawnSync("./gradlew", ["renderPreview", "--no-daemon", `-PpreviewOut=${out}`], { cwd: resolve(root, "client"), stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
