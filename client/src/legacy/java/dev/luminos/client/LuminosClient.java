package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Entry point for Minecraft 26.x: config, key mappings, HUD host, toggle sprint, zoom, CI title-screen signal. */
public final class LuminosClient implements ClientModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("LuminosClient");
	private static KeyMapping openEditor, zoomKey, sprintKey;
	private static boolean sprintLatched, zooming;
	private static int savedFov = -1;
	private static int smokeTicks = -1;

	@Override
	public void onInitializeClient() {
		Config.load();
		KeyMapping.Category cat = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("luminos", "main"));
		openEditor = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.luminos.editor", InputConstants.KEY_RSHIFT, cat));
		zoomKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.luminos.zoom", InputConstants.KEY_C, cat));
		sprintKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.luminos.toggle_sprint", InputConstants.KEY_V, cat));

		HudElementRegistry.addLast(Identifier.fromNamespaceAndPath("luminos", "hud"), (g, delta) -> {
			Minecraft mc = Minecraft.getInstance();
			if (mc.screen instanceof HudEditorScreen) return;
			Hud.drawAll(new Adapter(g), mc, mc.player == null);
		});
		ClientTickEvents.END_CLIENT_TICK.register(LuminosClient::tick);
		ClientLifecycleEvents.CLIENT_STOPPING.register(c -> { restoreFov(c); Config.save(); });

		// CI hook: the smoke job looks for this exact line, then lets the panorama render and exits.
		ScreenEvents.AFTER_INIT.register((client, screen, w, h) -> {
			if (screen instanceof TitleScreen) {
				LOGGER.info("[luminos] title-screen reached (minecraft {})", Minecraft.getInstance().getLaunchedVersion());
				if (System.getenv("LUMINOS_SMOKE") != null && smokeTicks < 0) smokeTicks = 160;
			}
		});
		LOGGER.info("Luminos Client loaded - press Right Shift to edit the HUD");
	}

	private static void tick(Minecraft mc) {
		if (smokeTicks > 0 && --smokeTicks == 0) {
			LOGGER.info("[luminos] smoke-ok");
			mc.stop();
		}
		while (openEditor.consumeClick()) {
			if (mc.screen == null) mc.setScreen(new HudEditorScreen(null));
		}
		while (sprintKey.consumeClick()) {
			Config.get().toggleSprint = !Config.get().toggleSprint;
			sprintLatched = false;
			if (mc.player != null) mc.player.displayClientMessage(Component.literal("Luminos: toggle sprint " + (Config.get().toggleSprint ? "ON" : "OFF")), true);
			Config.save();
		}
		Modules.Cps.tick(mc);
		if (mc.player == null) { sprintLatched = false; return; }
		if (Config.get().toggleSprint && mc.screen == null) {
			if (mc.options.keyUp.isDown()) { sprintLatched = true; mc.options.keySprint.setDown(true); }
			else if (sprintLatched) { sprintLatched = false; mc.options.keySprint.setDown(false); }
		}
		boolean want = zoomKey.isDown() && mc.screen == null;
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
