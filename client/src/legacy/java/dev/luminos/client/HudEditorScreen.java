package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/** Drag a module, right-click to toggle it, scroll over it to resize. Same behaviour on every version. */
public final class HudEditorScreen extends Screen {
	private final Screen parent;

	public HudEditorScreen(Screen parent) {
		super(Component.literal("Luminos HUD editor"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		int cx = width / 2;
		addRenderableWidget(Button.builder(Component.literal("Done"), b -> onClose()).bounds(cx - 155, height - 28, 100, 20).build());
		addRenderableWidget(Button.builder(Component.literal("Reset layout"), b -> { Config.get().resetLayout(); Config.save(); }).bounds(cx - 50, height - 28, 100, 20).build());
		addRenderableWidget(Button.builder(label(), b -> { Config.get().showBackground = !Config.get().showBackground; b.setMessage(label()); Config.save(); }).bounds(cx + 55, height - 28, 100, 20).build());
		addRenderableWidget(Button.builder(zoom(), b -> { Config c = Config.get(); c.zoomFov = c.zoomFov >= 70 ? 30 : c.zoomFov + 10; b.setMessage(zoom()); Config.save(); }).bounds(cx - 155, height - 52, 150, 20).build());
		addRenderableWidget(Button.builder(sprint(), b -> { Config.get().toggleSprint = !Config.get().toggleSprint; b.setMessage(sprint()); Config.save(); }).bounds(cx + 5, height - 52, 150, 20).build());
	}

	private static Component label() { return Component.literal("Backgrounds: " + (Config.get().showBackground ? "on" : "off")); }
	private static Component zoom() { return Component.literal("Zoom FOV: " + Config.get().zoomFov); }
	private static Component sprint() { return Component.literal("Toggle sprint: " + (Config.get().toggleSprint ? "on" : "off")); }

	@Override
	public void render(GuiGraphics g, int mx, int my, float pt) {
		super.render(g, mx, my, pt);
		Adapter a = new Adapter(g);
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			if (c.enabled) Hud.drawOne(a, minecraft, m, c, true);
			else {
				int w = (int) (m.width(minecraft) * c.scale), h = (int) (m.height(minecraft) * c.scale);
				g.renderOutline(c.x, c.y, w, h, 0x66FFFFFF);
				g.drawString(minecraft.font, m.title() + " (off)", c.x + 3, c.y + 3, 0xFF8596C5);
			}
		}
		Hud.drawGuides(a);
		g.drawCenteredString(minecraft.font, "Drag to move (snaps) · right-click toggles · scroll resizes", width / 2, 12, 0xFFE8EEFF);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean dbl) {
		return Hud.press(minecraft, e.x(), e.y(), e.button()) || super.mouseClicked(e, dbl);
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent e, double dx, double dy) {
		return Hud.drag(minecraft, e.x(), e.y()) || super.mouseDragged(e, dx, dy);
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent e) {
		Hud.release();
		return super.mouseReleased(e);
	}

	@Override
	public boolean mouseScrolled(double x, double y, double sx, double sy) {
		return Hud.scroll(minecraft, x, y, sy) || super.mouseScrolled(x, y, sx, sy);
	}

	@Override
	public void onClose() {
		Config.save();
		minecraft.setScreen(parent);
	}
}
