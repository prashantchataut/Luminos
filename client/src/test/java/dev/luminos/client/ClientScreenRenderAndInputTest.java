package dev.luminos.client;

import dev.luminos.client.preview.PreviewMain.J2D;
import dev.luminos.client.preview.WorldBackdrop;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Headless input + render verification of the three in-game Luminos screens.
 *
 * <p>What this really exercises: {@link MainMenuView}, {@link ModPanelView} and {@link HudEditor}, the classes that LuminosMainMenuScreen,
 * LuminosQuickPanelScreen and HudEditorScreen delegate every paint, click, drag, scroll and key to, painted through the Java2D {@link J2D} Gfx.
 * What it does not exercise: the thin {@code Screen} subclasses and the Mixins themselves (they need a live Minecraft with a window); those are
 * covered by source/registration checks here and by the CI smoke launch, never by a claim that they were seen running.
 */
class ClientScreenRenderAndInputTest {
	static final int GUI_W = 640, GUI_H = 400, SCALE = 4;   // 1280 x 800 logical window at 2x device pixels = 2560 x 1600 PNG

	@BeforeAll
	static void boot() throws Exception {
		System.setProperty("java.awt.headless", "true");
		System.setProperty("luminos.config.dir", Files.createTempDirectory("luminos-test").toString());
		net.minecraft.SharedConstants.tryDetectVersion();
		net.minecraft.server.Bootstrap.bootStrap();
		for (Feature f : Features.ALL) f.set.accept(false);
		headlessMc();   // installs the preview size + text metrics every HUD-touching test relies on
	}

	// ------------------------------------------------------------------ helpers
	record Exits(AtomicInteger closed, AtomicInteger editor, AtomicInteger advanced) {
		static Exits none() { return new Exits(new AtomicInteger(), new AtomicInteger(), new AtomicInteger()); }
		int total() { return closed.get() + editor.get() + advanced.get(); }
	}

	static ModPanelView panel(Exits e) {
		return new ModPanelView(e.closed::incrementAndGet, e.editor::incrementAndGet, e.advanced::incrementAndGet);
	}

	static J2D frame(ModPanelView v, int mx, int my) throws Exception {
		J2D g = null;
		for (int i = 0; i < 2; i++) { g = new J2D(GUI_W, GUI_H, 1); v.render(g, mx, my); }   // second pass: rects and hover settled
		return g;
	}

	static int[] mid(int[] r) { assertNotNull(r, "rectangle was not registered by the last frame"); return new int[] { r[0] + r[2] / 2, r[1] + r[3] / 2 }; }

	/** Click the named rectangle exactly where it was drawn; re-render afterwards the way the game does every frame. */
	static void click(ModPanelView v, String key, int button) throws Exception {
		int[] m = mid(v.rect(key));
		frame(v, m[0], m[1]);
		assertTrue(v.click(m[0], m[1], button));
		frame(v, m[0], m[1]);
	}

	// ------------------------------------------------------------------ Test 1: startup screen
	@Test
	void titleScreenInterception() throws Exception {
		List<String> fired = new ArrayList<>();
		MainMenuView menu = new MainMenuView(fired::add);
		J2D g = null;
		for (int i = 0; i < 6; i++) { g = new J2D(GUI_W, GUI_H, 1); menu.render(g, -1, -1, 0, "PlayerOne", 144, "1.21.11", "Sodium + Native Engine Active"); }

		assertEquals(7, menu.regions().size(), "the startup screen has exactly seven actions");
		assertEquals(Set.of("single", "multi", "panel", "hud", "capes", "options", "quit"), Set.copyOf(menu.regions().stream().map(MainMenuView.HitRegion::id).toList()));
		assertTrue(g.hasTexture(TitleScene.BG), "the custom title artwork is bundled");
		assertTrue(g.hasTexture(TitleScene.LOGO), "the dithered-moon emblem is bundled");
		assertEquals(0, g.blurCalls, "no blur pass may touch the custom menu");

		// every row is hit-testable at its own centre, nothing overlaps, nothing leaves the screen
		for (String id : List.of("single", "multi", "panel", "hud", "capes", "options", "quit")) {
			int[] r = menu.rect(id);
			assertTrue(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= GUI_W && r[1] + r[3] <= GUI_H, id + " is on screen");
			assertTrue(menu.click(r[0] + r[2] / 2.0, r[1] + r[3] / 2.0, 0));
			assertEquals(id, fired.get(fired.size() - 1));
		}
		assertFalse(menu.click(2, GUI_H / 2.0, 0), "a click on empty artwork is not an action");
		assertFalse(menu.click(menu.rect("panel")[0] + 5, menu.rect("panel")[1] + 5, 1), "right click does nothing on the menu");

		// keyboard: Down x3 reaches the Mod Panel row, Enter fires it, H opens the HUD studio
		MainMenuView kb = new MainMenuView(fired::add);
		kb.render(new J2D(GUI_W, GUI_H, 1), -1, -1, 0, "P", 60, "1.21.11", "x");
		fired.clear();
		assertFalse(kb.key(257), "Enter with nothing focused does nothing");
		for (int i = 0; i < 3; i++) assertTrue(kb.key(264));
		assertEquals(2, kb.focusIndex());
		assertTrue(kb.key(257));
		assertEquals(List.of("panel"), fired);
		assertTrue(kb.key(72));
		assertEquals("hud", fired.get(fired.size() - 1));
		assertTrue(kb.key(265) && kb.focusIndex() == 1, "Up moves back");

		// The click on "Luminos Mod Panel" lands in LuminosMainMenuScreen.run(PANEL) -> new LuminosQuickPanelScreen(...): checked in source.
		String screen = Files.readString(src("legacy/java/dev/luminos/client/LuminosMainMenuScreen.java"));
		assertTrue(screen.contains("case MainMenuView.PANEL -> mc.setScreen(new LuminosQuickPanelScreen("), "PANEL opens the quick panel screen");
		assertTrue(screen.contains("public void renderBackground(GuiGraphics g, int mx, int my, float pt) {}"), "renderBackground is a no-op (no 1.21 blur)");
		assertTrue(screen.contains("case MainMenuView.SINGLE -> mc.setScreen(new SelectWorldScreen(this))"));
		assertTrue(screen.contains("case MainMenuView.MULTI -> mc.setScreen(new JoinMultiplayerScreen(this))"));
		assertTrue(screen.contains("case MainMenuView.OPTIONS -> mc.setScreen(new OptionsScreen(this, mc.options))"));
	}

	@Test
	void mixinsAreRegisteredAndPresent() throws Exception {
		String legacy = Files.readString(src("legacy/resources/luminos-legacy.mixins.json"));
		String shared = Files.readString(src("main/resources/luminos.mixins.json"));
		String mod = Files.readString(src("main/resources/fabric.mod.json"));
		assertTrue(mod.contains("\"luminos.mixins.json\"") && mod.contains("\"luminos-legacy.mixins.json\""));
		assertTrue(shared.contains("\"TitleScreenMixin\""));
		for (String m : List.of("MinecraftClientMixin", "KeyboardMixin", "TitleScreenGuardMixin")) {
			assertTrue(legacy.contains("\"" + m + "\""), m + " is listed in luminos-legacy.mixins.json");
			assertTrue(Files.exists(src("legacy/java/dev/luminos/client/mixin/" + m + ".java")));
		}
		assertTrue(Files.readString(src("legacy/java/dev/luminos/client/mixin/MinecraftClientMixin.java")).contains("@ModifyVariable(method = \"setScreen\""));
		assertTrue(Files.readString(src("legacy/java/dev/luminos/client/mixin/MinecraftClientMixin.java")).contains("glfwGetKey(handle, GLFW.GLFW_KEY_RIGHT_CONTROL)"));
		assertTrue(Files.readString(src("legacy/java/dev/luminos/client/mixin/KeyboardMixin.java")).contains("@Inject(method = \"keyPress\", at = @At(\"HEAD\"), cancellable = true)"));
		assertTrue(Files.readString(src("legacy/java/dev/luminos/client/mixin/TitleScreenGuardMixin.java")).contains("method = \"init\""));
		// the quick panel owns no vanilla widget that could swallow a click or navigate away
		String qp = Files.readString(src("legacy/java/dev/luminos/client/LuminosQuickPanelScreen.java"));
		assertFalse(qp.contains("addRenderableWidget") || qp.contains("addDrawableChild"), "no invisible vanilla widgets in the quick panel");
		assertTrue(qp.contains("public void renderBackground(GuiGraphics g, int mx, int my, float pt) {}"));
	}

	// ------------------------------------------------------------------ Test 2: Right Ctrl
	/** A tiny model of "what screen is open", driven by the exact pure rule the key hook, the poll and the screens all call. */
	static final class Game {
		PanelRouting.Where where; boolean inWorld; PanelRouting.Where underPanel;
		Game(PanelRouting.Where w, boolean inWorld) { this.where = w; this.inWorld = inWorld; }
		/** @return whether the key event is consumed */
		boolean press(int key) {
			if (!Hotkeys.opensPanel(key)) return false;
			switch (PanelRouting.route(where, inWorld)) {
				case OPEN -> { underPanel = where; where = PanelRouting.Where.PANEL; return true; }
				case CLOSE -> { where = underPanel == null ? PanelRouting.Where.WORLD : underPanel; underPanel = null; return true; }
				default -> { return false; }
			}
		}
	}

	@Test
	void rightCtrlToggle() {
		assertTrue(Hotkeys.opensPanel(345) && Hotkeys.opensPanel(344), "Right Ctrl and Right Shift open the panel");
		assertFalse(Hotkeys.opensPanel(341), "Left Ctrl does not");
		for (PanelRouting.Where start : List.of(PanelRouting.Where.MAIN_MENU, PanelRouting.Where.WORLD, PanelRouting.Where.TITLE, PanelRouting.Where.PAUSE)) {
			Game gm = new Game(start, true);
			assertTrue(gm.press(345), "open from " + start);
			assertEquals(PanelRouting.Where.PANEL, gm.where);
			assertTrue(gm.press(345), "close again");
			assertEquals(start, gm.where, "closing returns to " + start);
		}
		assertFalse(new Game(PanelRouting.Where.WORLD, false).press(345), "no world loaded: nothing to open over");
		assertFalse(new Game(PanelRouting.Where.OTHER, true).press(345), "chat/inventory/options are never hijacked");
	}

	// ------------------------------------------------------------------ Test 3: tabs
	@Test
	void quickPanelTabSwitch() throws Exception {
		Exits e = Exits.none();
		ModPanelView v = panel(e);
		frame(v, -1, -1);
		assertEquals(ModPanelView.Cat.ALL, v.cat);
		frame(v, -1, -1);
		for (int i = 0; i < 6; i++) v.scroll(GUI_W / 2.0, GUI_H / 2.0, -3);   // scroll the grid first
		frame(v, -1, -1);
		assertTrue(v.scrollOffsetPx() > 0 || v.maxScrollPx() == 0, "grid scrolled (or fits without scrolling)");
		for (ModPanelView.Cat c : List.of(ModPanelView.Cat.HUD, ModPanelView.Cat.RENDER, ModPanelView.Cat.PVP, ModPanelView.Cat.FPS, ModPanelView.Cat.ALL)) {
			click(v, "tab:" + c.name(), 0);
			assertEquals(c, v.cat, "tab " + c + " selected by a real click");
			assertEquals(0f, v.scrollOffsetPx(), "switching tab resets the scroll");
			assertNull(v.expanded());
			List<Feature> shown = v.visible();
			assertFalse(shown.isEmpty(), c + " has modules");
			assertTrue(shown.stream().allMatch(c::has), "list filtered to " + c);
			if (c != ModPanelView.Cat.ALL) assertTrue(shown.size() < Features.ALL.size(), c + " is a strict subset");
			for (int i = 0; i < 4; i++) v.scroll(GUI_W / 2.0, GUI_H / 2.0, -2);
			frame(v, -1, -1);
			assertTrue(v.visible().stream().allMatch(c::has), "still filtered after scrolling");
		}
		assertEquals(0, e.total(), "tab clicks never leave the panel");
	}

	// ------------------------------------------------------------------ Test 4: in-place toggle, no pop-out
	@Test
	void quickPanelInPlaceToggleNoPopOut() throws Exception {
		Exits e = Exits.none();
		ModPanelView v = panel(e);
		String perf = Features.ALL.stream().filter(f -> f.group == Feature.Group.PERFORMANCE).findFirst().orElseThrow().id;
		for (String id : List.of(perf, "fullbright", "keystrokes", "cps", "zoom")) {
			Feature f = Features.byId(id);
			assertNotNull(f, id);
			v.setCategory(ModPanelView.Cat.ALL);
			v.setQuery(f.name);                      // brings the card to the top of the grid
			frame(v, -1, -1);
			boolean before = f.on();
			click(v, "card:" + id, 0);
			assertEquals(!before, f.on(), id + " flipped on the first click");
			click(v, "card:" + id, 0);
			assertEquals(before, f.on(), id + " flipped back on the second click");
			click(v, "toggle:" + id, 0);
			assertEquals(!before, f.on(), id + " switch flips it too");
			click(v, "toggle:" + id, 0);
			assertEquals(before, f.on());
			assertEquals(0, e.total(), "no exit callback (= no other screen) fired for " + id);
		}
	}

	// ------------------------------------------------------------------ Test 5: inline drawer
	@Test
	void quickPanelInlineSettingsDrawer() throws Exception {
		Exits e = Exits.none();
		ModPanelView v = panel(e);
		v.setQuery("keystrokes");
		frame(v, -1, -1);
		click(v, "card:keystrokes", 1);   // right click opens the drawer
		assertNotNull(v.expanded());
		assertEquals("keystrokes", v.expanded().id);
		click(v, "gear:keystrokes", 0);   // the gear closes it again
		assertNull(v.expanded());
		click(v, "gear:keystrokes", 0);   // and opens it
		assertEquals("keystrokes", v.expanded().id);
		assertEquals(0, e.total(), "the drawer is inline: nothing was opened");

		// drag the real Scale slider (bound to the widget's saved scale) from 10% to 90% of its track
		int[] r = v.rect("slider:@scale");
		assertNotNull(r, "Scale slider is drawn in the drawer");
		HudModule ks = Modules.ALL.stream().filter(m -> m.id().equals("keystrokes")).findFirst().orElseThrow();
		int y = r[1] + r[3] / 2, x10 = r[0] + 4 + (int) ((r[2] - 8) * 0.10), x90 = r[0] + 4 + (int) ((r[2] - 8) * 0.90);
		assertTrue(v.click(x10, y, 0));
		float low = Config.get().of(ks).scale;
		assertTrue(v.drag(x90, y));
		v.release();
		float high = Config.get().of(ks).scale;
		assertTrue(low <= 0.7f && high >= 1.7f && high > low, "slider moved the scale: " + low + " -> " + high);
		frame(v, -1, -1);
		assertEquals("keystrokes", v.expanded().id);
		assertEquals(0, e.total());
		Config.get().of(ks).scale = 1f;
	}

	// ------------------------------------------------------------------ renders
	static Path src(String rel) { return Path.of(System.getProperty("luminos.src.dir", "."), "src", rel); }

	static File out(String name) throws Exception {
		File dir = new File(System.getProperty("luminos.rounds.dir", "build/renders"));
		dir.mkdirs();
		return new File(dir, name + "-" + System.getProperty("luminos.round", "1") + ".png");
	}

	/** A Minecraft object with no window, player or level: the HUD modules fall back to their built-in sample data, exactly like the editor preview. */
	static net.minecraft.client.Minecraft headlessMc() throws Exception {
		var f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
		f.setAccessible(true);
		Hud.previewSize(GUI_W, GUI_H);
		J2D metrics = new J2D(1, 1, 1);
		HudModule.previewMeasure(metrics::textWidth);
		return (net.minecraft.client.Minecraft) ((sun.misc.Unsafe) f.get(null)).allocateInstance(net.minecraft.client.Minecraft.class);
	}

	static void believableState() {
		for (Feature f : Features.ALL) {
			String n = f.name.toLowerCase();
			f.set.accept(n.contains("keystroke") || n.contains("cps") || n.contains("fps") || n.contains("coordinates") || n.contains("fullbright") || n.contains("zoom") || n.contains("armor") || n.contains("minimap") || n.contains("sprint") || n.contains("potion") || n.contains("health"));
		}
	}

	@Test
	void renderStartupScreen() throws Exception {
		believableState();
		MainMenuView menu = new MainMenuView(id -> {});
		J2D g = null;
		int[] panelRow = null;
		for (int i = 0; i < 8; i++) {
			g = new J2D(GUI_W, GUI_H, SCALE);
			menu.render(g, panelRow == null ? -1 : panelRow[0] + panelRow[2] / 2, panelRow == null ? -1 : panelRow[1] + panelRow[3] / 2, 0, "PlayerOne", 144, "1.21.11", "Sodium + Luminos Native Mixins");
			panelRow = menu.rect("panel");
		}
		g.save(out("mc-startup-screen"));
	}

	@Test
	void renderQuickPanel() throws Exception {
		believableState();
		var mc = headlessMc();
		ModPanelView v = panel(Exits.none());
		v.openSettings("keystrokes");
		J2D g = null;
		for (int i = 0; i < 2; i++) { g = new J2D(GUI_W, GUI_H, SCALE); WorldBackdrop.draw(g); Hud.drawAll(g, mc, true); v.render(g, -1, -1); }
		int[] cps = mid(v.rect("card:cps"));   // hover a card, as a player's cursor would
		for (int i = 0; i < 2; i++) { g = new J2D(GUI_W, GUI_H, SCALE); WorldBackdrop.draw(g); Hud.drawAll(g, mc, true); v.render(g, cps[0], cps[1]); }
		g.save(out("mc-quick-panel"));
	}

	@Test
	void renderHudStudio() throws Exception {
		believableState();
		var mc = headlessMc();
		HudEditor ed = new HudEditor(() -> {});
		J2D g = null;
		// really grab the Keystrokes widget and drag it toward the centre line, so the magnetic guide is drawn by the editor itself
		HudModule ks = Modules.ALL.stream().filter(m -> m.id().equals("keystrokes")).findFirst().orElseThrow();
		for (int i = 0; i < 2; i++) { g = new J2D(GUI_W, GUI_H, SCALE); WorldBackdrop.draw(g); ed.render(g, mc, -1, -1); }
		int[] b = Hud.bounds(mc, ks, Config.get().of(ks));
		int px = b[0] + b[2] / 2, py = b[1] + b[3] / 2;
		assertTrue(ed.click(mc, px, py, 0), "pressing the widget starts a drag");
		int tx = GUI_W / 2 + 3, ty = GUI_H / 2 + 60;   // 3 px off centre: inside the magnet, so it must snap
		assertTrue(ed.drag(mc, tx, ty));
		for (int i = 0; i < 2; i++) { g = new J2D(GUI_W, GUI_H, SCALE); WorldBackdrop.draw(g); ed.render(g, mc, tx, ty); }
		int[] snapped = Hud.bounds(mc, ks, Config.get().of(ks));
		assertEquals(GUI_W / 2, snapped[0] + snapped[2] / 2, 2, "the widget snapped its centre onto the centre guide");
		g.save(out("mc-hud-studio"));
		ed.release();
	}
}
