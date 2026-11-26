package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.CharacterEvent;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/**
 * Right Ctrl / Right Shift. The default view is {@link ModPanelView}: a centred modal with a card grid. The older {@link Panel}
 * (keybinds, waypoints, support, performance, profiles) stays reachable from its "Keybinds, waypoints, support" link and is what the
 * CI smoke tour drives, so it is built lazily.
 */
public final class LuminosQuickPanelScreen extends Screen {
	private final Screen parent;
	private final Panel.Tab tab;
	private final boolean focusSearch;
	private final boolean legacy;
	private Panel panel;
	private final ModPanelView view;

	public LuminosQuickPanelScreen(Panel.Tab tab, boolean focusSearch, Screen parent) { this(tab, focusSearch, parent, tab != Panel.Tab.MODULES); }

	public LuminosQuickPanelScreen(Panel.Tab tab, boolean focusSearch, Screen parent, boolean legacy) {
		super(Component.literal("Luminos quick panel"));
		this.parent = parent;
		this.tab = tab;
		this.focusSearch = focusSearch;
		this.legacy = legacy;
		this.view = new ModPanelView(this::onClose,
				() -> Nav.open(Minecraft.getInstance(), new HudEditorScreen(this)),
				() -> Nav.open(Minecraft.getInstance(), new LuminosQuickPanelScreen(Panel.Tab.MODULES, true, parent, true)));
	}

	/** For the CI smoke tour, which drives the classic panel without a mouse. */
	public Panel panel() {
		if (panel == null) panel = new Panel(tab, focusSearch, () -> Nav.open(Minecraft.getInstance(), new HudEditorScreen(this)));
		return panel;
	}

	@Override
	public void render(GuiGraphics g, int mx, int my, float pt) {
		if (legacy) panel().render(new Adapter(g), minecraft, mx, my);
		else view.render(new Adapter(g), mx, my);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean dbl) { return legacy ? panel().click(e.x(), e.y(), e.button()) : view.click(e.x(), e.y(), e.button()); }

	@Override
	public boolean mouseDragged(MouseButtonEvent e, double dx, double dy) { return (legacy ? panel().drag(e.x(), e.y()) : view.drag(e.x(), e.y())) || super.mouseDragged(e, dx, dy); }

	@Override
	public boolean mouseReleased(MouseButtonEvent e) { if (legacy) panel().release(); else view.release(); return super.mouseReleased(e); }

	@Override
	public boolean mouseScrolled(double x, double y, double sx, double sy) { if (legacy) panel().scroll(sy); else view.scroll(sy); return true; }

	@Override
	public boolean keyPressed(KeyEvent e) {
		int code = e.key(), pk = Nav.boundCode(LuminosClient.panelKey);
		if (legacy) {
			if (panel().key(code, pk, e)) return true;
			if (code == 256 || code == pk) { onClose(); return true; }
			return false;
		}
		if (code == 256 && view.popoverOpen()) { view.closePopover(); return true; }   // Esc closes the settings popover first
		if (view.key(code)) return true;
		if (code == 256 || code == pk) { onClose(); return true; }
		return false;
	}

	@Override
	public boolean charTyped(CharacterEvent e) {
		if (legacy) panel().type(e.codepoint()); else view.type(e.codepoint());
		return true;
	}

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
