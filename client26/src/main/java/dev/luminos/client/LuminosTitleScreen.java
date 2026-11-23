package dev.luminos.client;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/** Replaces the vanilla title screen (switch off in the panel, or set LUMINOS_VANILLA_TITLE). */
public final class LuminosTitleScreen extends Screen {
	private TitleView view;

	public LuminosTitleScreen() { super(Component.literal("Luminos")); }

	@Override
	protected void init() { view = new TitleView(this, minecraft); }

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mx, int my, float pt) {
		if (view != null) view.render(new Adapter(g), minecraft, mx, my);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean dbl) { return view != null && view.click(minecraft, e.x(), e.y(), e.button()); }

	@Override
	public boolean keyPressed(KeyEvent e) { return view != null && view.key(e.key()); }

	@Override
	public boolean shouldCloseOnEsc() { return false; }

	@Override
	public boolean isPauseScreen() { return false; }
}
