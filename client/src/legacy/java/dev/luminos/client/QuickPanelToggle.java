package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;

/**
 * The single place that opens or closes the quick panel. Right Ctrl / Right Shift reach it from three independent hooks (the raw
 * {@code KeyboardHandler.keyPress} mixin, the per-frame GLFW poll in {@code Minecraft.runTick}, and the screens' own key handlers),
 * so a 250 ms debounce makes sure one physical key press toggles exactly once, whichever hook sees it first.
 */
public final class QuickPanelToggle {
	private QuickPanelToggle() {}

	private static final long DEBOUNCE_NS = 250_000_000L;
	private static long lastNs = System.nanoTime() - DEBOUNCE_NS * 2;

	/** Right Ctrl, Right Shift, or the key stored as "open_mod_menu" by the launcher. */
	public static boolean isPanelKey(int key) { return Hotkeys.opensPanel(key); }

	static PanelRouting.Where where(Minecraft mc) {
		Screen s = mc.screen;
		if (s == null) return PanelRouting.Where.WORLD;
		if (s instanceof LuminosQuickPanelScreen) return PanelRouting.Where.PANEL;
		if (s instanceof LuminosMainMenuScreen) return PanelRouting.Where.MAIN_MENU;
		if (s instanceof LuminosTitleScreen || s instanceof TitleScreen) return PanelRouting.Where.TITLE;
		if (s instanceof PauseScreen) return PanelRouting.Where.PAUSE;
		return PanelRouting.Where.OTHER;
	}

	/** True when the panel can be opened from (or closed on) the screen the player is looking at. */
	public static boolean applicable(Minecraft mc) {
		return PanelRouting.route(where(mc), mc.player != null && mc.level != null) != PanelRouting.Action.IGNORE;
	}

	/** @return true when this press was an open/close request for the panel (the caller may cancel the key event). */
	public static boolean press(int keyCode) {
		Minecraft mc = Minecraft.getInstance();
		if (mc == null || !applicable(mc)) return false;
		long now = System.nanoTime();
		if (now - lastNs < DEBOUNCE_NS) return true;   // the same physical press, already handled by another hook
		lastNs = now;
		Screen s = mc.screen;
		if (s instanceof LuminosQuickPanelScreen q) {
			q.onClose();
		} else {
			LuminosClient.LOGGER.info("[luminos] quick panel opened via key {} on {}", keyCode, s == null ? "world" : s.getClass().getSimpleName());
			mc.setScreen(new LuminosQuickPanelScreen(Panel.Tab.MODULES, keyCode == Hotkeys.RIGHT_SHIFT, s));
		}
		return true;
	}
}
