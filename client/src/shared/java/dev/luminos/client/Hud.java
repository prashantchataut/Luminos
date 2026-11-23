package dev.luminos.client;

import net.minecraft.client.Minecraft;

/** Draws every enabled module at its configured place; also the editor's hit-testing and drag state. */
public final class Hud {
	private Hud() {}

	public static void drawAll(Gfx g, Minecraft mc, boolean preview) {
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			if (c.enabled) drawOne(g, mc, m, c, preview);
		}
	}

	public static void drawOne(Gfx g, Minecraft mc, HudModule m, Config.ModuleCfg c, boolean preview) {
		int w = (int) (m.width(mc) * c.scale), h = (int) (m.height(mc) * c.scale);
		int x = Math.max(0, Math.min(c.x, g.width() - w));
		int y = Math.max(0, Math.min(c.y, g.height() - h));
		g.push(x, y, c.scale);
		m.render(g, mc, preview);
		g.pop();
	}

	// ---- editor logic (no Minecraft screen types, so every version's Screen just delegates) ----
	private static HudModule dragging;
	private static int grabX, grabY;

	public static HudModule at(Minecraft mc, double mx, double my) {
		for (int i = Modules.ALL.size() - 1; i >= 0; i--) {
			HudModule m = Modules.ALL.get(i);
			Config.ModuleCfg c = Config.get().of(m);
			if (mx >= c.x && mx <= c.x + m.width(mc) * c.scale && my >= c.y && my <= c.y + m.height(mc) * c.scale) return m;
		}
		return null;
	}

	public static boolean press(Minecraft mc, double mx, double my, int button) {
		HudModule m = at(mc, mx, my);
		if (m == null) return false;
		Config.ModuleCfg c = Config.get().of(m);
		if (button == 1) {
			c.enabled = !c.enabled;
			Config.save();
		} else {
			dragging = m;
			grabX = (int) mx - c.x;
			grabY = (int) my - c.y;
		}
		return true;
	}

	public static boolean drag(double mx, double my) {
		if (dragging == null) return false;
		Config.ModuleCfg c = Config.get().of(dragging);
		c.x = Math.max(0, (int) mx - grabX);
		c.y = Math.max(0, (int) my - grabY);
		return true;
	}

	public static void release() {
		if (dragging != null) Config.save();
		dragging = null;
	}

	public static boolean scroll(Minecraft mc, double mx, double my, double dy) {
		HudModule m = at(mc, mx, my);
		if (m == null) return false;
		Config.ModuleCfg c = Config.get().of(m);
		c.scale = Math.max(0.5f, Math.min(3f, c.scale + (dy > 0 ? 0.1f : -0.1f)));
		Config.save();
		return true;
	}
}
