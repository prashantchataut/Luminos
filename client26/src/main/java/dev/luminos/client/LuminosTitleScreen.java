package dev.luminos.client;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;

/**
 * Standalone copy of the Luminos title menu (CI smoke tour / fallback; players normally get Minecraft's own TitleScreen cleaned up in
 * place by TitleScreenMixin). Every button is a real Minecraft Button registered with addRenderableWidget, the backdrop is drawn
 * first and {@code super.extractRenderState} (Minecraft's own widget rendering) runs AFTER it. Clicks are never intercepted.
 */
public final class LuminosTitleScreen extends Screen {
	public LuminosTitleScreen() { super(Component.literal("Luminos")); }

	@Override
	protected void init() {
		for (TitleScene.Btn b : TitleMenu.layout(width, height)) addRenderableWidget(TitleMenu.widget(b, this));
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mx, int my, float pt) {
		Gfx gx = new Adapter(g);
		String mc = WindowBrand.mcVersion();
		TitleScene.paintBackdrop(gx, width, height);
		TitleScene.paintBrand(gx, width, height, mc);
		super.extractRenderState(g, mx, my, pt);   // the registered buttons
	}

	@Override
	public boolean keyPressed(KeyEvent e) { return super.keyPressed(e); }

	@Override
	public boolean shouldCloseOnEsc() { return false; }

	@Override
	public boolean isPauseScreen() { return false; }
}
