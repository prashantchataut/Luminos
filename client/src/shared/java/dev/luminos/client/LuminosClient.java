package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
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

/** Entry point, shared by every Minecraft line (version-specific names are behind {@link Nav}). */
public final class LuminosClient implements ClientModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("LuminosClient");
	public static final String VERSION = "0.4.0";
	public static final List<KeyMapping> KEYS = new ArrayList<>();
	public static KeyMapping panelKey, searchKey, zoomKey, sprintKey;
	private static boolean sprintLatched, zooming, customShown;
	private static int savedFov = -1;
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
		Config.load();
		KeyMapping.Category cat = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("luminos", "main"));
		panelKey = bind("key.luminos.panel", InputConstants.KEY_RCONTROL, cat);   // Wurst convention: Right Ctrl = menu
		searchKey = bind("key.luminos.search", InputConstants.KEY_RSHIFT, cat);   // Right Shift = jump to search
		zoomKey = bind("key.luminos.zoom", InputConstants.KEY_C, cat);
		sprintKey = bind("key.luminos.toggle_sprint", InputConstants.KEY_V, cat);

		HudElementRegistry.addLast(Identifier.fromNamespaceAndPath("luminos", "hud"), (g, delta) -> {
			Minecraft mc = Minecraft.getInstance();
			if (Nav.screen(mc) instanceof HudEditorScreen) return;
			Hud.drawAll(new Adapter(g), mc, mc.player == null);
		});
		ClientTickEvents.END_CLIENT_TICK.register(LuminosClient::tick);
		ClientLifecycleEvents.CLIENT_STOPPING.register(c -> { restoreFov(c); Config.save(); });

		// CI hook: the smoke job looks for this exact line, then runs a short scripted tour and exits.
		ScreenEvents.AFTER_INIT.register((client, screen, w, h) -> {
			if (screen instanceof TitleScreen) {
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

	private static int phase, phaseTicks;
	private static String pendingShot;
	private static int pendingWait;
	private static Runnable afterShot;
	private static boolean coverDone;

	/** Logs a marker the CI job reacts to, then waits (up to 60 s) for the job to confirm the capture before going on. */
	private static void shot(String name, Runnable next) {
		LOGGER.info("[luminos] shot {}", name);
		pendingShot = name;
		pendingWait = 0;
		afterShot = next;
	}

	private static void smokeStep(Minecraft mc) {
		if (pendingShot != null) {
			String dir = System.getenv("LUMINOS_SMOKE_ACK_DIR");
			boolean acked = dir != null && java.nio.file.Files.exists(java.nio.file.Path.of(dir, "ack-" + pendingShot));
			if (acked || ++pendingWait > 1200) { pendingShot = null; phaseTicks = 0; afterShot.run(); }
			return;
		}
		phaseTicks++;
		switch (phase) {
			case 0 -> { if (smokeTick >= 80) { Nav.open(mc, new CoverScreen()); phase = 5; } }                          // bare vanilla panorama = per-version cover art
			case 5 -> { if (phaseTicks >= 30) shot("cover", () -> { coverDone = true; Nav.open(mc, new LuminosTitleScreen()); phase = 1; }); }
			case 1 -> { if (phaseTicks >= 60) shot("title", () -> { Nav.open(mc, new PanelScreen(Panel.Tab.MODULES, false, Nav.screen(mc))); LOGGER.info("[luminos] quick panel opened via smoke"); phase = 2; }); }
			case 2 -> { if (phaseTicks >= 40) shot("panel", () -> { Nav.open(mc, new PanelScreen(Panel.Tab.KEYBINDS, false, null)); phase = 3; }); }
			case 3 -> { if (phaseTicks >= 40) shot("panel-keys", () -> phase = 4); }
			default -> { LOGGER.info("[luminos] smoke-ok"); mc.stop(); }
		}
	}

	private static void tick(Minecraft mc) {
		Screen cur = Nav.screen(mc);
		if (smokeTick >= 0) { smokeTick++; smokeStep(mc); }
		boolean smoke = smokeTick >= 0;
		boolean wantCustom = Config.get().customTitle && System.getenv("LUMINOS_VANILLA_TITLE") == null;
		if (cur instanceof TitleScreen && wantCustom && (!smoke || coverDone)) {
			if (!customShown) { customShown = true; LOGGER.info("[luminos] custom title screen shown"); }
			Nav.open(mc, new LuminosTitleScreen());
		}
		// Right Ctrl / Right Shift only open the panel from the bare in-game view: never over chat, inventories or any other screen.
		while (panelKey.consumeClick()) if (Nav.screen(mc) == null && mc.player != null) openPanel(mc, false, "key");
		while (searchKey.consumeClick()) if (Nav.screen(mc) == null && mc.player != null) openPanel(mc, true, "key");
		while (sprintKey.consumeClick()) {
			Config.get().toggleSprint = !Config.get().toggleSprint;
			sprintLatched = false;
			Nav.toast(mc, "Luminos: toggle sprint " + (Config.get().toggleSprint ? "ON" : "OFF"));
			Config.save();
		}
		Modules.Cps.tick(mc);
		if (mc.player == null) { sprintLatched = false; return; }
		Config.get().playtimeMs += 50;
		if (++ticksSinceSave >= 6000) { ticksSinceSave = 0; Config.save(); }
		if (Config.get().toggleSprint && cur == null) {
			if (mc.options.keyUp.isDown()) { sprintLatched = true; mc.options.keySprint.setDown(true); }
			else if (sprintLatched) { sprintLatched = false; mc.options.keySprint.setDown(false); }
		}
		boolean want = zoomKey.isDown() && cur == null && !Compliance.restricted(mc);
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
