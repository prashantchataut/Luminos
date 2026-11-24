package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import dev.luminos.client.core.HudPresets;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/** Entry point, shared by every Minecraft line (version-specific names are behind {@link Nav}). */
public final class LuminosClient implements ClientModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("LuminosClient");
	public static final String VERSION = "0.5.0";
	public static final List<KeyMapping> KEYS = new ArrayList<>();
	public static KeyMapping panelKey, searchKey, zoomKey, sprintKey;
	private static boolean sprintLatched, zooming, customShown;
	private static int savedFov = -1;
	private static double savedGamma = -1;
	/** CI: counts client ticks after the title screen is first seen; -1 when not in smoke mode. */
	private static int smokeTick = -1;
	private static int ticksSinceSave;

	private static KeyMapping bind(String id, int key, KeyMapping.Category cat) {
		KeyMapping k = Nav.register(new KeyMapping(id, key, cat));
		KEYS.add(k);
		return k;
	}

	@Override
	public void onInitializeClient() {
		StartupProbe.initialised();
		Config.load();
		KeyMapping.Category cat = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("luminos", "main"));
		panelKey = bind("key.luminos.panel", InputConstants.KEY_RCONTROL, cat);   // Wurst convention: Right Ctrl = menu
		searchKey = bind("key.luminos.search", InputConstants.KEY_RSHIFT, cat);   // Right Shift = jump to search
		zoomKey = bind("key.luminos.zoom", InputConstants.KEY_C, cat);
		sprintKey = bind("key.luminos.toggle_sprint", InputConstants.KEY_V, cat);

		// first layer of the frame: sample input (and wait for the GPU if the frame guard is on); last layer: the HUD, then the fence
		HudElementRegistry.addFirst(Identifier.fromNamespaceAndPath("luminos", "input"), (g, delta) -> InputSampler.frame(Minecraft.getInstance()));
		HudElementRegistry.addLast(Identifier.fromNamespaceAndPath("luminos", "hud"), (g, delta) -> {
			Minecraft mc = Minecraft.getInstance();
			if (!(Nav.screen(mc) instanceof HudEditorScreen)) Hud.drawAll(new Adapter(g), mc, mc.player == null);
			InputSampler.frameEnd(mc);
		});
		ClientTickEvents.START_CLIENT_TICK.register(mc -> { InputSampler.tick(mc); Probes.tick(mc); });
		ClientTickEvents.END_CLIENT_TICK.register(LuminosClient::tick);
		ClientLifecycleEvents.CLIENT_STOPPING.register(c -> { restoreFov(c); restoreGamma(c); Config.save(); });
		ShulkerTooltip.register();

		// CI hook: the smoke job looks for this exact line, then runs a short scripted tour and exits.
		ScreenEvents.AFTER_INIT.register((client, screen, w, h) -> {
			if (screen instanceof TitleScreen) {
				StartupProbe.titleReached();
				LOGGER.info("[luminos] title-screen reached (minecraft {})", Nav.version(Minecraft.getInstance()));
				if (System.getenv("LUMINOS_SMOKE") != null && smokeTick < 0) smokeTick = 0;
			}
		});
		LOGGER.info("Luminos Client {} loaded: Right Ctrl opens the quick panel, Right Shift searches", VERSION);
	}

	private static void openPanel(Minecraft mc, boolean search, String via) {
		LOGGER.info("[luminos] quick panel opened via {}", via);
		Nav.open(mc, new PanelScreen(Panel.Tab.MODULES, search, null));
	}

	// ------------------------------------------------------------------ CI smoke tour (no effect unless LUMINOS_SMOKE drives it)
	private record Step(String name, Consumer<Minecraft> open) {}

	private static PanelScreen panelScreen(Minecraft mc, Panel.Tab tab) {
		PanelScreen ps = new PanelScreen(tab, true, null);
		Nav.open(mc, ps);
		return ps;
	}

	private static final List<Step> STEPS = List.of(
			new Step("title", mc -> Nav.open(mc, new LuminosTitleScreen())),
			new Step("panel", mc -> { Features.applyPreset("minimal"); panelScreen(mc, Panel.Tab.MODULES); }),
			new Step("panel-all", mc -> panelScreen(mc, Panel.Tab.MODULES).panel().smokeOpenAll()),
			new Step("panel-search", mc -> panelScreen(mc, Panel.Tab.MODULES).panel().smokeSearch("key")),
			new Step("panel-popover", mc -> panelScreen(mc, Panel.Tab.MODULES).panel().smokeContext("keystrokes")),
			new Step("panel-appearance", mc -> panelScreen(mc, Panel.Tab.MODULES).panel().smokeAppearance()),
			new Step("panel-solid", mc -> { Config.get().solidPanels = true; panelScreen(mc, Panel.Tab.MODULES); }),
			new Step("panel-hud", mc -> { Config.get().solidPanels = false; panelScreen(mc, Panel.Tab.HUD); }),
			new Step("panel-performance", mc -> panelScreen(mc, Panel.Tab.PERFORMANCE)),
			new Step("panel-cosmetics", mc -> panelScreen(mc, Panel.Tab.COSMETICS)),
			new Step("panel-keybinds", mc -> panelScreen(mc, Panel.Tab.KEYBINDS)),
			new Step("panel-waypoints", mc -> { smokeSeedWaypoints(); panelScreen(mc, Panel.Tab.WAYPOINTS); }),
			new Step("panel-support", mc -> { smokeSeedCrash(); panelScreen(mc, Panel.Tab.SUPPORT); }),
			new Step("hud-editor", mc -> { Features.applyPreset("minimal"); Nav.open(mc, new HudEditorScreen(null)); }),
			new Step("hud-editor-full", mc -> { Features.applyPreset("full"); Nav.open(mc, new HudEditorScreen(null)); }),
			// ---- frames for the interaction GIF: every one is a real render of the real client, state set by the tour (no cursor, no mouse)
			new Step("panel-all-scrolled", mc -> { var ps = panelScreen(mc, Panel.Tab.MODULES); ps.panel().smokeOpenAll(); ps.panel().smokeScroll(250); }),
			new Step("type-1", mc -> panelScreen(mc, Panel.Tab.MODULES).panel().smokeSearch("f")),
			new Step("type-2", mc -> panelScreen(mc, Panel.Tab.MODULES).panel().smokeSearch("ful")),
			new Step("type-3", mc -> panelScreen(mc, Panel.Tab.MODULES).panel().smokeSearch("fullb")),
			new Step("glass-0", mc -> { Config.get().glassIntensity = 0; panelScreen(mc, Panel.Tab.MODULES); }),
			new Step("glass-35", mc -> { Config.get().glassIntensity = 35; panelScreen(mc, Panel.Tab.MODULES); }),
			new Step("glass-100", mc -> { Config.get().glassIntensity = 100; panelScreen(mc, Panel.Tab.MODULES); }),
			new Step("panel-comfortable", mc -> { Config.get().glassIntensity = 70; Config.get().comfortable = true; panelScreen(mc, Panel.Tab.MODULES); }),
			new Step("drag-1", mc -> { Config.get().comfortable = false; Features.applyPreset("minimal"); smokeMove("fps", 8, 8); Nav.open(mc, new HudEditorScreen(null)); }),
			new Step("drag-2", mc -> { smokeMove("fps", 230, 96); Nav.open(mc, new HudEditorScreen(null)); }),
			new Step("drag-3", mc -> { smokeMove("fps", 430, 176); Nav.open(mc, new HudEditorScreen(null)); }));

	/** Smoke tour only: put one HUD module at an absolute position, standing in for a mouse drag in the GIF frames. */
	private static void smokeMove(String id, int x, int y) {
		for (HudModule m : Modules.ALL) if (m.id().equals(id)) { Config.ModuleCfg c = Config.get().of(m); c.x = x; c.y = y; }
	}
	private static int smokeIdx;
	private static boolean stepOpened;
	private static int phaseTicks;
	private static String pendingShot;
	private static int pendingWait;
	private static Runnable afterShot;

	/** Logs a marker the CI job reacts to, then waits (up to 60 s) for the job to confirm the capture before going on. */
	private static void shot(String name, Runnable next) {
		LOGGER.info("[luminos] shot {}", name);
		pendingShot = name;
		pendingWait = 0;
		afterShot = next;
	}

	/** Smoke tour only: the title screen has no world, so give the Waypoints tab three sample entries to render. Labelled as sample data in docs/client-shots. */
	private static void smokeSeedWaypoints() {
		var wp = Config.get().waypoints;
		if (!wp.isEmpty()) return;
		wp.add(new dev.luminos.client.core.Waypoint("Home", 128, 64, -40, "minecraft:overworld", 0x8CB4FF).encode());
		wp.add(new dev.luminos.client.core.Waypoint("Diamond cave", 410, 11, 250, "minecraft:overworld", 0x7BE0A8).encode());
		wp.add(new dev.luminos.client.core.Waypoint("Fortress", 32, 70, 18, "minecraft:the_nether", 0xFFC857).encode());
	}

	/** Smoke tour only: write a synthetic crash report (the standard OutOfMemoryError shape) so the Support tab has something to analyse. */
	private static void smokeSeedCrash() {
		try {
			java.nio.file.Path dir = net.fabricmc.loader.api.FabricLoader.getInstance().getGameDir().resolve("crash-reports");
			java.nio.file.Files.createDirectories(dir);
			java.nio.file.Files.writeString(dir.resolve("crash-smoke-synthetic.txt"),
				"---- Minecraft Crash Report ----\n// synthetic report written by the Luminos CI smoke tour\n\nDescription: Exception in server tick loop\n\njava.lang.OutOfMemoryError: Java heap space\n\tat java.base/java.util.Arrays.copyOf(Arrays.java:3482)\n");
		} catch (java.io.IOException e) {
			LOGGER.warn("smoke: could not write the synthetic crash report", e);
		}
	}

	private static void smokeStep(Minecraft mc) {
		if (pendingShot != null) {
			String dir = System.getenv("LUMINOS_SMOKE_ACK_DIR");
			boolean acked = dir != null && java.nio.file.Files.exists(java.nio.file.Path.of(dir, "ack-" + pendingShot));
			if (acked || ++pendingWait > 1200) { pendingShot = null; phaseTicks = 0; afterShot.run(); }
			return;
		}
		phaseTicks++;
		if (smokeIdx >= STEPS.size()) { LOGGER.info("[luminos] smoke-ok"); mc.stop(); return; }
		if (smokeIdx == 0 && !stepOpened && smokeTick < 60) return;
		Step st = STEPS.get(smokeIdx);
		if (!stepOpened) { st.open.accept(mc); stepOpened = true; phaseTicks = 0; return; }
		if (phaseTicks >= 50) shot(st.name, () -> { smokeIdx++; stepOpened = false; });
	}

	// ------------------------------------------------------------------ per-tick work
	private static void fullbright(Minecraft mc) {
		boolean want = Config.flag("fullbright.on", true) && !Compliance.restricted(mc);
		var gamma = mc.options.gamma();
		if (want) {
			if (savedGamma < 0) savedGamma = gamma.get();
			double target = Math.max(0, Math.min(1, Config.num("fullbright.level", 100f) / 100f));
			if (Math.abs(gamma.get() - target) > 1e-6) gamma.set(target);
		} else if (savedGamma >= 0) {
			gamma.set(savedGamma);
			savedGamma = -1;
		}
	}

	private static void restoreGamma(Minecraft mc) {
		if (savedGamma >= 0 && mc.options != null) mc.options.gamma().set(savedGamma);
		savedGamma = -1;
	}

	private static void tick(Minecraft mc) {
		Screen cur = Nav.screen(mc);
		if (smokeTick >= 0) { smokeTick++; smokeStep(mc); }
		boolean smoke = smokeTick >= 0;
		boolean wantCustom = Config.get().customTitle && System.getenv("LUMINOS_VANILLA_TITLE") == null;
		if (cur instanceof TitleScreen && wantCustom && (!smoke || smokeIdx > 0 || stepOpened)) {
			if (!customShown) { customShown = true; LOGGER.info("[luminos] custom title screen shown"); }
			if (!smoke) Nav.open(mc, new LuminosTitleScreen());
		}
		if (cur instanceof TitleScreen && wantCustom && smoke && !stepOpened && smokeIdx == 0) { /* the tour opens the title itself */ }
		// Right Ctrl / Right Shift only open the panel from the bare in-game view: never over chat, inventories or any other screen.
		while (panelKey.consumeClick()) if (Nav.screen(mc) == null && mc.player != null) openPanel(mc, false, "key");
		while (searchKey.consumeClick()) if (Nav.screen(mc) == null && mc.player != null) openPanel(mc, true, "key");
		while (sprintKey.consumeClick()) {
			Config.get().toggleSprint = !Config.get().toggleSprint;
			sprintLatched = false;
			Nav.toast(mc, "Luminos: toggle sprint " + (Config.get().toggleSprint ? "ON" : "OFF"));
			Config.save();
		}
		if (mc.player == null) { sprintLatched = false; return; }
		fullbright(mc);
		Config.get().playtimeMs += 50;
		if (++ticksSinceSave >= 6000) { ticksSinceSave = 0; Config.save(); }
		if (Config.get().toggleSprint && cur == null) {
			if (mc.options.keyUp.isDown()) { sprintLatched = true; mc.options.keySprint.setDown(true); }
			else if (sprintLatched) { sprintLatched = false; mc.options.keySprint.setDown(false); }
		}
		boolean want = zoomKey.isDown() && cur == null && Config.flag("zoom.on", true) && !Compliance.restricted(mc);
		if (want && !zooming) { savedFov = mc.options.fov().get(); zooming = true; }
		if (zooming) {
			if (want) mc.options.fov().set(Math.max(30, Math.min(110, Config.get().zoomFov)));
			else restoreFov(mc);
		}
	}

	private static void restoreFov(Minecraft mc) {
		if (zooming && savedFov > 0 && mc.options != null) mc.options.fov().set(savedFov);
		zooming = false;
	}
}
