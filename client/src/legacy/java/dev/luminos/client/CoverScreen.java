package dev.luminos.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** CI only: an empty screen that shows just the vanilla panorama, so the launcher's cover art has no menu in front of it. */
public final class CoverScreen extends Screen {
	public CoverScreen() { super(Component.literal("cover")); }

	@Override
	public void render(GuiGraphics g, int mx, int my, float pt) { super.render(g, mx, my, pt); }
}
