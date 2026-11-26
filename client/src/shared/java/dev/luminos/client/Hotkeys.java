package dev.luminos.client;

import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.ScreenKeyboardEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.TitleScreen;

/**
 * Right Ctrl (GLFW_KEY_RIGHT_CONTROL) and Right Shift (GLFW_KEY_RIGHT_SHIFT) open the Luminos Quick Panel from the title screen and the pause
 * menu (in the world the registered key bindings do it, see LuminosClient). The key stored as "open_mod_menu" in
 * config/luminos/config.json works too. Right Shift opens the panel with the search box focused.
 */
final class Hotkeys {
	private Hotkeys() {}

	/** GLFW_KEY_RIGHT_CONTROL / GLFW_KEY_RIGHT_SHIFT (the same values InputConstants.KEY_RCONTROL / KEY_RSHIFT carry). */
	static final int GLFW_KEY_RIGHT_CONTROL = 345, GLFW_KEY_RIGHT_SHIFT = 344;
	static final int RIGHT_CTRL = GLFW_KEY_RIGHT_CONTROL;
	static final int RIGHT_SHIFT = GLFW_KEY_RIGHT_SHIFT;

	static boolean opensPanel(int code) {
		return code == RIGHT_CTRL || code == RIGHT_SHIFT || (LauncherSync.openMenuKey > 0 && code == LauncherSync.openMenuKey);
	}

	static void register() {
		ScreenEvents.AFTER_INIT.register((client, screen, w, h) -> {
			if (screen instanceof TitleScreen || screen instanceof LuminosTitleScreen || screen instanceof PauseScreen) {
				ScreenKeyboardEvents.allowKeyPress(screen).register((s, event) -> {
					int code = event.key();
					if (!opensPanel(code)) return true;
					Minecraft mc = Minecraft.getInstance();
					LuminosClient.LOGGER.info("[luminos] quick panel opened via key {} on {}", code, s.getClass().getSimpleName());
					Nav.open(mc, new LuminosQuickPanelScreen(Panel.Tab.MODULES, code == RIGHT_SHIFT, s));
					return false;
				});
			}
		});
	}
}
