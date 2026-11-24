package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/** Shell around {@link HudEditor}: drag a module, scroll to scale, right-click to switch it on or off. Same behaviour on every version. */
public final class HudEditorScreen extends Screen {
	private final Screen parent;
	private final HudEditor editor;

	public HudEditorScreen(Screen parent) {
		super(Component.literal("Luminos HUD editor"));
		this.parent = parent;
		this.editor = new HudEditor(this::onClose);
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mx, int my, float pt) {
		editor.render(new Adapter(g), minecraft, mx, my);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean dbl) { return editor.click(minecraft, e.x(), e.y(), e.button()); }

	@Override
	public boolean mouseDragged(MouseButtonEvent e, double dx, double dy) { return editor.drag(minecraft, e.x(), e.y()); }

	@Override
	public boolean mouseReleased(MouseButtonEvent e) { editor.release(); return true; }

	@Override
	public boolean mouseScrolled(double x, double y, double sx, double sy) { return editor.scroll(minecraft, x, y, sy); }

	@Override
	public boolean isPauseScreen() { return false; }

	@Override
	public void onClose() {
		Config.save();
		Nav.open(minecraft, parent);
	}
}
