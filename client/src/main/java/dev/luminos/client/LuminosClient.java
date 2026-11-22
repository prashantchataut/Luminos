package dev.luminos.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWMouseButtonCallbackI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Entry point: config, key bindings, HUD host, CPS hook, toggle sprint and zoom. */
public final class LuminosClient implements ClientModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("LuminosClient");
	private static final String CATEGORY = "key.categories.luminos";

	public static KeyMapping openEditor;
	private static KeyMapping zoomKey;
	private static KeyMapping sprintKey;

	public static boolean sprintLatched = false;
	private static boolean zooming = false;
	private static int savedFov = -1;

	@Override
	public void onInitializeClient() {
		Config.load();
		openEditor = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.luminos.editor", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, CATEGORY));
		zoomKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.luminos.zoom", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_C, CATEGORY));
		sprintKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.luminos.toggle_sprint", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_V, CATEGORY));

		HudRenderCallback.EVENT.register(LuminosClient::renderHud);
		ClientTickEvents.END_CLIENT_TICK.register(LuminosClient::tick);
		ClientLifecycleEvents.CLIENT_STARTED.register(LuminosClient::hookMouse);
		ClientLifecycleEvents.CLIENT_STOPPING.register(c -> {
			restoreFov(c);
			Config.save();
		});
		LOGGER.info("Luminos Client loaded — press Right Shift to edit the HUD");
	}

	/** Chain onto GLFW's mouse callback so we see every click, however fast, without a mixin. */
	private static void hookMouse(Minecraft mc) {
		long window = mc.getWindow().getWindow();
		final GLFWMouseButtonCallbackI[] prev = new GLFWMouseButtonCallbackI[1];
		prev[0] = GLFW.glfwSetMouseButtonCallback(window, (w, button, action, mods) -> {
			if (action == GLFW.GLFW_PRESS) Modules.Cps.click(button);
			if (prev[0] != null) prev[0].invoke(w, button, action, mods);
		});
	}

	private static void renderHud(GuiGraphics g, net.minecraft.client.DeltaTracker delta) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.options.hideGui || mc.screen instanceof HudEditorScreen) return;
		drawAll(g, mc, mc.player == null);
	}

	/** Draws every enabled module at its configured position. */
	static void drawAll(GuiGraphics g, Minecraft mc, boolean preview) {
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			if (!c.enabled) continue;
			drawOne(g, mc, m, c, preview);
		}
	}

	static void drawOne(GuiGraphics g, Minecraft mc, HudModule m, Config.ModuleCfg c, boolean preview) {
		int sw = g.guiWidth();
		int sh = g.guiHeight();
		int x = Math.max(0, Math.min(c.x, sw - (int) (m.width(mc) * c.scale)));
		int y = Math.max(0, Math.min(c.y, sh - (int) (m.height(mc) * c.scale)));
		g.pose().pushPose();
		g.pose().translate(x, y, 0);
		g.pose().scale(c.scale, c.scale, 1f);
		m.render(g, mc, preview);
		g.pose().popPose();
	}

	private static void tick(Minecraft mc) {
		while (openEditor.consumeClick()) {
			if (mc.screen == null) mc.setScreen(new HudEditorScreen(null));
		}
		while (sprintKey.consumeClick()) {
			Config.get().toggleSprint = !Config.get().toggleSprint;
			sprintLatched = false;
			if (mc.player != null) mc.player.displayClientMessage(net.minecraft.network.chat.Component.literal("Luminos: toggle sprint " + (Config.get().toggleSprint ? "ON" : "OFF")), true);
			Config.save();
		}
		if (mc.player == null) {
			sprintLatched = false;
			return;
		}
		// Toggle sprint: once the player starts walking forward, keep sprint held until they stop.
		if (Config.get().toggleSprint && mc.screen == null) {
			if (mc.options.keyUp.isDown()) {
				sprintLatched = true;
				mc.options.keySprint.setDown(true);
			} else if (sprintLatched) {
				sprintLatched = false;
				mc.options.keySprint.setDown(false);
			}
		}
		// Zoom: hold the key to narrow the FOV, release to restore the player's own value.
		boolean want = zoomKey.isDown() && mc.screen == null;
		if (want && !zooming) {
			savedFov = mc.options.fov().get();
			zooming = true;
		}
		if (zooming) {
			if (want) {
				mc.options.fov().set(Math.max(30, Math.min(110, Config.get().zoomFov)));
			} else {
				restoreFov(mc);
			}
		}
	}

	private static void restoreFov(Minecraft mc) {
		if (zooming && savedFov > 0 && mc.options != null) mc.options.fov().set(savedFov);
		zooming = false;
	}
}
