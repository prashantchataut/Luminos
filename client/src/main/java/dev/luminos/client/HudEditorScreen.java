package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * Drag-and-drop HUD editor.
 * <ul>
 *   <li>Drag a module with the left mouse button</li>
 *   <li>Right-click toggles it on/off</li>
 *   <li>Mouse wheel over a module changes its size</li>
 * </ul>
 */
public final class HudEditorScreen extends Screen {
	private final Screen parent;
	private HudModule dragging;
	private int grabX;
	private int grabY;

	public HudEditorScreen(Screen parent) {
		super(Component.literal("Luminos HUD editor"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		int cx = width / 2;
		addRenderableWidget(Button.builder(Component.literal("Done"), b -> onClose()).bounds(cx - 155, height - 28, 100, 20).build());
		addRenderableWidget(Button.builder(Component.literal("Reset layout"), b -> {
			Config.get().resetLayout();
			Config.save();
		}).bounds(cx - 50, height - 28, 100, 20).build());
		addRenderableWidget(Button.builder(label(), b -> {
			Config.get().showBackground = !Config.get().showBackground;
			b.setMessage(label());
			Config.save();
		}).bounds(cx + 55, height - 28, 100, 20).build());
		addRenderableWidget(Button.builder(zoomLabel(), b -> {
			Config c = Config.get();
			c.zoomFov = c.zoomFov >= 70 ? 20 : c.zoomFov + 10;
			c.zoomFov = Math.max(30, c.zoomFov);
			b.setMessage(zoomLabel());
			Config.save();
		}).bounds(cx - 155, height - 52, 150, 20).build());
		addRenderableWidget(Button.builder(sprintLabel(), b -> {
			Config.get().toggleSprint = !Config.get().toggleSprint;
			b.setMessage(sprintLabel());
			Config.save();
		}).bounds(cx + 5, height - 52, 150, 20).build());
	}

	private static Component label() {
		return Component.literal("Backgrounds: " + (Config.get().showBackground ? "on" : "off"));
	}

	private static Component zoomLabel() {
		return Component.literal("Zoom FOV: " + Config.get().zoomFov);
	}

	private static Component sprintLabel() {
		return Component.literal("Toggle sprint: " + (Config.get().toggleSprint ? "on" : "off"));
	}

	@Override
	public void render(GuiGraphics g, int mouseX, int mouseY, float partial) {
		super.render(g, mouseX, mouseY, partial);
		Minecraft mc = Minecraft.getInstance();
		g.drawCenteredString(font, "Drag to move · Right-click to toggle · Scroll to resize", width / 2, 12, 0xFFE8EEFF);
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			int w = (int) (m.width(mc) * c.scale);
			int h = (int) (m.height(mc) * c.scale);
			clamp(m, c);
			if (c.enabled) {
				LuminosClient.drawOne(g, mc, m, c, true);
			}
			boolean hover = mouseX >= c.x && mouseX <= c.x + w && mouseY >= c.y && mouseY <= c.y + h;
			int col = m == dragging ? 0xFF9BBCFF : hover ? 0xFF4F8CFF : c.enabled ? 0x664F8CFF : 0x66FF6B6B;
			g.renderOutline(c.x - 1, c.y - 1, w + 2, h + 2, col);
			if (!c.enabled || hover) {
				g.drawString(font, m.title() + (c.enabled ? "" : " (off)"), c.x, c.y - 10, c.enabled ? 0xFF9BBCFF : 0xFFFF9B9B, true);
			}
		}
	}

	private void clamp(HudModule m, Config.ModuleCfg c) {
		Minecraft mc = Minecraft.getInstance();
		c.x = Math.max(0, Math.min(c.x, width - (int) (m.width(mc) * c.scale)));
		c.y = Math.max(0, Math.min(c.y, height - (int) (m.height(mc) * c.scale)));
	}

	private HudModule hit(double mx, double my) {
		Minecraft mc = Minecraft.getInstance();
		for (int i = Modules.ALL.size() - 1; i >= 0; i--) {
			HudModule m = Modules.ALL.get(i);
			Config.ModuleCfg c = Config.get().of(m);
			if (mx >= c.x && mx <= c.x + m.width(mc) * c.scale && my >= c.y && my <= c.y + m.height(mc) * c.scale) return m;
		}
		return null;
	}

	@Override
	public boolean mouseClicked(double mx, double my, int button) {
		if (super.mouseClicked(mx, my, button)) return true;
		HudModule m = hit(mx, my);
		if (m == null) return false;
		Config.ModuleCfg c = Config.get().of(m);
		if (button == 1) {
			c.enabled = !c.enabled;
			Config.save();
			return true;
		}
		if (button == 0) {
			dragging = m;
			grabX = (int) mx - c.x;
			grabY = (int) my - c.y;
			return true;
		}
		return false;
	}

	@Override
	public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
		if (dragging != null && button == 0) {
			Config.ModuleCfg c = Config.get().of(dragging);
			c.x = (int) mx - grabX;
			c.y = (int) my - grabY;
			return true;
		}
		return super.mouseDragged(mx, my, button, dx, dy);
	}

	@Override
	public boolean mouseReleased(double mx, double my, int button) {
		if (dragging != null) {
			dragging = null;
			Config.save();
			return true;
		}
		return super.mouseReleased(mx, my, button);
	}

	@Override
	public boolean mouseScrolled(double mx, double my, double sx, double sy) {
		HudModule m = hit(mx, my);
		if (m != null) {
			Config.ModuleCfg c = Config.get().of(m);
			c.scale = Math.max(0.5f, Math.min(2.5f, c.scale + (sy > 0 ? 0.1f : -0.1f)));
			c.scale = Math.round(c.scale * 10f) / 10f;
			Config.save();
			return true;
		}
		return super.mouseScrolled(mx, my, sx, sy);
	}

	@Override
	public void onClose() {
		Config.save();
		Minecraft.getInstance().setScreen(parent);
	}
}
