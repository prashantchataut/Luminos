package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.CharacterEvent;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/** Thin shell around {@link Panel}. Opened by Right Ctrl (or Right Shift for search) only when no other screen is open. */
public final class LuminosQuickPanelScreen extends Screen {
	private final Screen parent;
	private final Panel panel;

	public LuminosQuickPanelScreen(Panel.Tab tab, boolean focusSearch, Screen parent) {
		super(Component.literal("Luminos quick panel"));
		this.parent = parent;
		this.panel = new Panel(tab, focusSearch, () -> Nav.open(Minecraft.getInstance(), new HudEditorScreen(this)));
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mx, int my, float pt) {
		panel.render(new Adapter(g), minecraft, mx, my);
	}

	/** For the CI smoke tour, which drives the panel without a mouse. */
	public Panel panel() { return panel; }

	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean dbl) { return panel.click(e.x(), e.y(), e.button()); }

	@Override
	public boolean mouseDragged(MouseButtonEvent e, double dx, double dy) { return panel.drag(e.x(), e.y()) || super.mouseDragged(e, dx, dy); }

	@Override
	public boolean mouseReleased(MouseButtonEvent e) { panel.release(); return super.mouseReleased(e); }

	@Override
	public boolean mouseScrolled(double x, double y, double sx, double sy) { panel.scroll(sy); return true; }

	@Override
	public boolean keyPressed(KeyEvent e) {
		int code = e.key(), pk = Nav.boundCode(LuminosClient.panelKey);
		if (panel.key(code, pk, e)) return true;
		if (code == 256 || code == pk) { onClose(); return true; }
		return false;
	}

	@Override
	public boolean charTyped(CharacterEvent e) { panel.type(e.codepoint()); return true; }

	@Override
	public boolean isPauseScreen() { return false; }

	@Override
	public void onClose() {
		Config.save();
		Adapter.restoreBlur();
		Nav.open(minecraft, parent);
	}

	@Override
	public void removed() { Adapter.restoreBlur(); super.removed(); }
}
