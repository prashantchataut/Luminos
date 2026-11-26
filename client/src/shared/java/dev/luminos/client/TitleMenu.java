package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;

import java.util.List;

/**
 * The five title-screen buttons, defined once. Both the in-place {@code TitleScreenMixin} (which adds them to Minecraft's own
 * TitleScreen) and {@link LuminosTitleScreen} build their widgets from here, so a button is always a real Minecraft {@link Button}
 * registered with {@code addRenderableWidget} (Mojang's name for Yarn's {@code addDrawableChild}). Minecraft's Screen code then owns
 * hit-testing, hover, Tab/Enter navigation, GUI scaling and the click sound: nothing here ever touches {@code mouseClicked}.
 */
public final class TitleMenu {
	private TitleMenu() {}

	/** Layout from {@link TitleScene#layout}: x = width/2 - 100, y = height/4 + 48 / 72 / 96 / 124. */
	public static List<TitleScene.Btn> layout(int width, int height) { return TitleScene.layout(width, height); }

	/** One real widget for a layout entry; pressing it runs the action for its id with {@code parent} as the screen to return to. */
	public static Button widget(TitleScene.Btn spec, Screen parent) {
		return Nav.menuButton(spec, () -> run(spec.id(), parent));
	}

	static void run(String id, Screen parent) {
		Minecraft mc = Minecraft.getInstance();
		switch (id) {
			case "single" -> Nav.open(mc, new SelectWorldScreen(parent));
			case "multi" -> Nav.open(mc, new JoinMultiplayerScreen(parent));
			case "mods" -> Nav.open(mc, new LuminosQuickPanelScreen(Panel.Tab.MODULES, false, parent));
			case "options" -> Nav.open(mc, new OptionsScreen(parent, mc.options));
			case "quit" -> mc.stop();
			default -> { }
		}
	}
}
