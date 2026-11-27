package dev.luminos.client;

import net.minecraft.client.Minecraft;

/** Draws every enabled module at its configured place; also the editor's hit-testing, snapping and drag state. */
public final class Hud {
	private Hud() {}

	public static void drawAll(Gfx g, Minecraft mc, boolean preview) {
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			if (!c.enabled) continue;
			if (m.complianceFlagged() && Compliance.restricted(mc)) continue;   // a server may count it as an advantage: hidden, with the reason shown in the panel
			drawOne(g, mc, m, c, preview);
		}
	}

	public static void drawOne(Gfx g, Minecraft mc, HudModule m, Config.ModuleCfg c, boolean preview) {
		int w = (int) (m.width(mc) * c.scale), h = (int) (m.height(mc) * c.scale);
		int x = m.centered() ? (g.width() - w) / 2 : px(g.width(), w, c);
		int y = m.centered() ? (g.height() - h) / 2 : py(g.height(), h, c);
		g.push(x, y, c.scale);
		m.render(g, mc, preview);
		g.pop();
	}

	private static final int MARGIN = 4;

	/** Configured x clamped to the screen, with a small margin: an anchor of 9999 means flush with the right edge. */
	static int px(int screenW, int w, Config.ModuleCfg c) { return Math.max(0, Math.min(c.x, screenW - w - MARGIN)); }

	static int py(int screenH, int h, Config.ModuleCfg c) { return Math.max(0, Math.min(c.y, screenH - h - MARGIN)); }

	/** On-screen bounds of a module as {x, y, w, h}, scale applied. */
	/** Headless preview/tests only: the GUI size to lay out against when there is no game window. Null in the game. */
	private static int[] previewSize;
	public static void previewSize(int w, int h) { previewSize = w <= 0 ? null : new int[] { w, h }; }

	private static int guiW(Minecraft mc) { return previewSize != null ? previewSize[0] : mc.getWindow().getGuiScaledWidth(); }
	private static int guiH(Minecraft mc) { return previewSize != null ? previewSize[1] : mc.getWindow().getGuiScaledHeight(); }

	public static int[] bounds(Minecraft mc, HudModule m, Config.ModuleCfg c) {
		int w = (int) (m.width(mc) * c.scale), h = (int) (m.height(mc) * c.scale);
		if (!c.enabled) { w = HudModule.textWidth(m.title() + " (off)") + 10; h = 14; }   // off modules are a label chip in the editor, not a ghost of their full size
		int sw = guiW(mc), sh = guiH(mc);
		return new int[]{m.centered() ? (sw - w) / 2 : px(sw, w, c), m.centered() ? (sh - h) / 2 : py(sh, h, c), w, h};
	}

	// ---- editor logic (no Minecraft screen types, so every version's Screen just delegates) ----
	private static HudModule dragging, dragged;
	private static int grabX, grabY;
	private static int guideX = -1, guideY = -1;
	private static final int GRID = 4, MAGNET = 5;

	public static HudModule at(Minecraft mc, double mx, double my) {
		for (int i = Modules.ALL.size() - 1; i >= 0; i--) {
			HudModule m = Modules.ALL.get(i);
			Config.ModuleCfg c = Config.get().of(m);
			int[] b = bounds(mc, m, c);
			if (mx >= b[0] && mx <= b[0] + b[2] && my >= b[1] && my <= b[1] + b[3]) return m;
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
			int[] b = bounds(mc, m, c);
			grabX = (int) mx - b[0];
			grabY = (int) my - b[1];
			dragged = m;
		}
		return true;
	}

	public static boolean drag(Minecraft mc, double mx, double my) {
		if (dragging == null) return false;
		Config.ModuleCfg c = Config.get().of(dragging);
		int w = (int) (dragging.width(mc) * c.scale), h = (int) (dragging.height(mc) * c.scale);
		int sw = guiW(mc), sh = guiH(mc);
		int nx = Math.max(0, (int) mx - grabX), ny = Math.max(0, (int) my - grabY);
		guideX = -1;
		guideY = -1;
		if (Config.get().snap) {
			int[] xs = {0, (sw - w) / 2, sw - w}, ys = {0, (sh - h) / 2, sh - h};
			int bx = nx, by = ny, dx = MAGNET + 1, dy = MAGNET + 1;
			for (int t : xs) if (Math.abs(nx - t) < dx) { dx = Math.abs(nx - t); bx = t; guideX = t == (sw - w) ? sw - 1 : t == 0 ? 0 : sw / 2; }
			for (int t : ys) if (Math.abs(ny - t) < dy) { dy = Math.abs(ny - t); by = t; guideY = t == (sh - h) ? sh - 1 : t == 0 ? 0 : sh / 2; }
			for (HudModule o : Modules.ALL) {
				if (o == dragging || o.centered()) continue;
				Config.ModuleCfg oc = Config.get().of(o);
				if (!oc.enabled) continue;
				int ow = (int) (o.width(mc) * oc.scale), oh = (int) (o.height(mc) * oc.scale);
				for (int t : new int[]{oc.x, oc.x + ow - w, oc.x + ow, oc.x - w}) if (Math.abs(nx - t) < dx) { dx = Math.abs(nx - t); bx = t; guideX = t == oc.x + ow - w ? oc.x + ow : t == oc.x ? oc.x : t < oc.x ? oc.x : oc.x + ow; }
				for (int t : new int[]{oc.y, oc.y + oh - h, oc.y + oh, oc.y - h}) if (Math.abs(ny - t) < dy) { dy = Math.abs(ny - t); by = t; guideY = t == oc.y + oh - h ? oc.y + oh : t == oc.y ? oc.y : t < oc.y ? oc.y : oc.y + oh; }
			}
			if (dx > MAGNET) { bx = Math.round(nx / (float) GRID) * GRID; guideX = -1; }
			if (dy > MAGNET) { by = Math.round(ny / (float) GRID) * GRID; guideY = -1; }
			nx = bx;
			ny = by;
		}
		c.x = Math.max(0, Math.min(nx, sw - w));
		c.y = Math.max(0, Math.min(ny, sh - h));
		return true;
	}

	/** Alignment guides while dragging with snap on. */
	public static void drawGuides(Gfx g) {
		if (dragging == null) return;
		if (guideX >= 0) g.fill(guideX, 0, guideX + 1, g.height(), 0x66FFFFFF);
		if (guideY >= 0) g.fill(0, guideY, g.width(), guideY + 1, 0x66FFFFFF);
	}

	/** The module being dragged right now, for the editor's coordinate chip. */
	public static HudModule dragging() { return dragging; }

	public static void release() {
		if (dragging != null) Config.save();
		dragging = null;
		guideX = -1;
		guideY = -1;
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
