package dev.luminos.client;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * The Luminos startup screen (v4.4), written against {@link Gfx} only so the game and the offscreen preview paint the same pixels.
 *
 * <p>No vanilla widgets: every control is a rectangle drawn at (x, y, w, h) and registered in the same {@link HitRegion} list in the same
 * call, and the list is rebuilt at the start of every frame. {@link #click} walks that list, so a click lands on exactly what was drawn.
 *
 * <p>Layout (GUI pixels): top bar at y = 14 (h 26): brand and engine pill on the left, account / Mod Panel / HUD Studio / Capes on the right.
 * Hero block centred on the vertical middle; primary stack 220 wide at centerY + 8 (26 high, 6 px gaps); a split row of three 22 px buttons.
 */
public final class MainMenuView {
	/** Ids passed to the action callback. */
	public static final String SINGLE = "single", MULTI = "multi", PANEL = "panel", HUD = "hud", CAPES = "capes", OPTIONS = "options", QUIT = "quit";

	record HitRegion(int x, int y, int w, int h, String id) {
		boolean contains(double mx, double my) { return mx >= x && mx < x + w && my >= y && my < y + h; }
	}
	private enum Kind { PRIMARY, ACCENT, SECONDARY, DANGER, CHIP, CHIP_ACCENT }

	private static final int COBALT = 0xFF2B4BFF, EDGE = 0xFF3B82F6, FILL = 0xE6141822, INK = 0xFFFFFFFF, MUTED = 0xFF8A94A6, FOOT = 0xFF64748B, SKY = 0xFF60A5FA, CRIMSON = 0xFFEF4444;
	private static final int PARTICLES = 35;
	private static final String SEP = "\u0001";

	private record Row(String id, String label, String hint, Kind kind) {}
	/** The seven startup actions, top to bottom. */
	private static final Row[] ROWS = {
		new Row(SINGLE, "Singleplayer", "", Kind.PRIMARY),
		new Row(MULTI, "Multiplayer", "", Kind.PRIMARY),
		new Row(PANEL, "Luminos Mod Panel", "R-CTRL", Kind.ACCENT),
		new Row(HUD, "HUD Design Studio", "H", Kind.SECONDARY),
		new Row(CAPES, "3D Capes & Cosmetics", "", Kind.SECONDARY),
		new Row(OPTIONS, "Minecraft Options", "", Kind.SECONDARY),
		new Row(QUIT, "Quit Game", "", Kind.DANGER),
	};
	private final List<HitRegion> hitRegions = new ArrayList<>();
	private final Map<String, int[]> rects = new HashMap<>();
	private int focus = -1;
	private final Map<String, Float> hover = new HashMap<>();
	private final Consumer<String> action;
	private Runnable clickSound = () -> {};

	public MainMenuView(Consumer<String> action) { this.action = action; }

	public void setClickSound(Runnable r) { clickSound = r == null ? () -> {} : r; }

	/** What the last frame registered, for tests. */
	List<HitRegion> regions() { return hitRegions; }
	int[] rect(String id) { return rects.get(id); }
	int focusIndex() { return focus; }

	private static int lerp(int a, int b, float t) {
		t = Math.max(0f, Math.min(1f, t));
		int r = 0;
		for (int s = 24; s >= 0; s -= 8) r |= Math.round(((a >>> s) & 0xFF) * (1 - t) + ((b >>> s) & 0xFF) * t) << s;
		return r;
	}

	// ------------------------------------------------------------------ paint
	/**
	 * @param timeMs   monotonic clock for the drifting particles (pass 0 for a still frame)
	 * @param engine   the live engine label, e.g. "Sodium + Native Engine Active" (the caller decides what is true)
	 */
	public void render(Gfx g, int mx, int my, long timeMs, String user, int fps, String mcVersion, String engine) {
		hitRegions.clear();
		rects.clear();
		int w = g.width(), h = g.height();
		backdrop(g, w, h);
		particles(g, w, h, timeMs);
		leftScrim(g, w, h);
		vignette(g, w, h);
		topBar(g, mx, my, w, user, fps, mcVersion, engine);

		// brand block, left column
		boolean tight = h < 300;
		int x = Math.max(22, Math.min(58, w / 11)), bw = Math.max(150, Math.min(236, w / 2 - x));
		int y = tight ? 56 : 68, logo = tight ? 28 : 40;
		if (!g.texture(TitleScene.LOGO, x, y, logo, logo, 64, 64)) Glass.roundFill(g, x, y, logo, logo, logo / 2, COBALT);
		spacedLeft(g, "LUMINOS", x + logo + 10, y + (logo - 16) / 2, 2f, 3, INK);
		Glass.text(g, "HIGH-PERFORMANCE MINECRAFT CLIENT", x, y + logo + 8, 1f, MUTED);

		// seven actions: one column, one hit rectangle each, registered where it is drawn
		int by = y + logo + (tight ? 22 : 30), gap = tight ? 3 : 5, foot = 30;
		int bh = Math.max(15, Math.min(24, (h - by - foot - gap * (ROWS.length - 1)) / ROWS.length));
		for (int i = 0; i < ROWS.length; i++) {
			Row r = ROWS[i];
			row(g, mx, my, r, x, by + i * (bh + gap), bw, bh, i == focus);
		}

		String left = "Luminos Engine v" + LuminosClient.VERSION + "  |  Entity/Particle Culling + Fast Render Pipeline";
		String right = "Minecraft " + mcVersion + " / Mojang AB";
		int fy = h - 16;
		if (Glass.width(g, left, 1f) + Glass.width(g, right, 1f) + 40 > w) left = "Luminos Engine v" + LuminosClient.VERSION;
		g.text(left, 16, fy, FOOT);
		g.text(right, w - 16 - Glass.width(g, right, 1f), fy, FOOT);
	}

	/** Darkens the left ~60% so the controls stay legible over any artwork, and leaves the right side of the picture alone. */
	private static void leftScrim(Gfx g, int w, int h) {
		int span = (int) (w * 0.62f);
		for (int x = 0; x < span; x += 2) {
			float t = 1f - x / (float) span;
			g.fill(x, 0, x + 2, h, ((int) (0x90 * t * t) << 24) | 0x06080E);
		}
	}

	private static void spacedLeft(Gfx g, String s, int x0, int y, float scale, int track, int color) {
		float x = x0;
		for (char c : s.toCharArray()) {
			String t = String.valueOf(c);
			Glass.text(g, t, Math.round(x), y, scale, color);
			x += Glass.width(g, t, scale) + track;
		}
	}

	private void backdrop(Gfx g, int w, int h) {
		if (g.cover(TitleScene.BG, TitleScene.BG_W, TitleScene.BG_H, 0, 0, w, h)) {
			g.fill(0, 0, w, h, 0x4D07090E);   // a light veil: the left scrim and vignette protect the controls, the artwork keeps its colour
			return;
		}
		// fallback: a midnight-cobalt aurora, drawn with fills only
		for (int y = 0; y < h; y += 2) g.fill(0, y, w, Math.min(h, y + 2), lerp(0xFF070A14, 0xFF0B1330, y / (float) Math.max(1, h - 1)));
		for (int i = 0; i < 3; i++) {
			int by = h / 3 + i * 22, bh = 26 - i * 6, col = i == 1 ? 0x182B4BFF : 0x1060A5FA;
			for (int y = 0; y < bh; y += 2) g.fill(0, by + y, w, by + y + 2, lerp(0x00000000 | (col & 0xFFFFFF), col, 1f - Math.abs(y - bh / 2f) / (bh / 2f)));
		}
	}

	/** 35 slow-drifting motes. Position is a pure function of (index, time): no per-frame allocation, no state. */
	private static void particles(Gfx g, int w, int h, long t) {
		for (int i = 0; i < PARTICLES; i++) {
			int hx = (int) (((i + 1) * 2654435761L) >>> 8) & 0xFFFF;
			int hy = (int) (((i + 7) * 2246822519L) >>> 12) & 0xFFFF;
			float speed = 0.006f + (hx % 7) * 0.0016f;
			float px = ((hx / 65535f) * w + FastMathLUT.sin((t * 0.0004f) + i) * 6f) % w;
			float py = h - (((hy / 65535f) * h + t * speed) % h);
			int a = 0x18 + (hy % 5) * 0x08;
			int sz = (i % 4 == 0) ? 2 : 1;
			g.fill((int) px, (int) py, (int) px + sz, (int) py + sz, (a << 24) | 0xBFD4FF);
		}
	}

	/** Dark edge falloff from 0x7007090E to 0xCC07090E, as stacked frames (cheap, no texture needed). */
	private static void vignette(Gfx g, int w, int h) {
		int steps = 14, band = Math.max(4, Math.min(w, h) / 22);
		for (int i = 0; i < steps; i++) {
			float t = 1f - i / (float) steps;   // 1 at the very edge
			int col = lerp(0x0007090E, 0xCC07090E, t * t);
			int o = i * band / 2;
			g.fill(0, o, w, o + band / 2 + 1, col);
			g.fill(0, h - o - band / 2 - 1, w, h - o, col);
			g.fill(o, 0, o + band / 2 + 1, h, col);
			g.fill(w - o - band / 2 - 1, 0, w - o, h, col);
		}
	}

	private void topBar(Gfx g, int mx, int my, int w, String user, int fps, String mcVersion, String engine) {
		int y = 14, hh = 26;
		// right: Right Ctrl hint pill (a label: the Mod Panel row is the clickable control), then the account pill, built right to left
		String hint = "Right Ctrl: Mod Panel";
		int hw = Glass.width(g, hint, 1f) + 20, x = w - 16 - hw;
		Glass.roundFill(g, x, y, hw, hh, hh / 2, 0xE62B4BFF);
		Glass.roundOutline(g, x, y, hw, hh, hh / 2, 0x66FFFFFF);
		g.text(hint, x + 10, y + 9, INK);
		String name = (user == null || user.isEmpty()) ? "Offline" : user;
		int aw = 8 + 6 + 8 + Glass.width(g, name, 1f) + 12;
		x -= 6 + aw;
		int acc = x;
		Glass.roundFill(g, x, y, aw, hh, hh / 2, 0xB0141822);
		Glass.roundOutline(g, x, y, aw, hh, hh / 2, 0x26FFFFFF);
		Glass.roundFill(g, x + 10, y + 10, 6, 6, 3, 0xFF22C55E);
		g.text(name, x + 22, y + 9, INK);

		// left: emblem, "LUMINOS CLIENT v4.5.0", then the live engine badge; the badge degrades to fit the room the right side leaves
		String brand = "LUMINOS CLIENT v" + LuminosClient.VERSION, live = fps + " FPS";
		String badge = "MC " + mcVersion + SEP + live;
		int avail = acc - 12 - 16;
		String[] tiers = { brand + SEP + badge, brand + SEP + live, brand };
		String text = tiers[tiers.length - 1];
		for (String t : tiers) if (8 + 16 + 6 + Glass.width(g, t.replace(SEP, "     "), 1f) + 12 <= avail) { text = t; break; }
		int pw = 8 + 16 + 6 + Glass.width(g, text.replace(SEP, "     "), 1f) + 12;
		Glass.roundFill(g, 16, y, pw, hh, hh / 2, 0xB0141822);
		Glass.roundOutline(g, 16, y, pw, hh, hh / 2, 0x26FFFFFF);
		if (!g.texture(TitleScene.LOGO, 24, y + 5, 16, 16, 64, 64)) Glass.roundFill(g, 24, y + 5, 16, 16, 8, COBALT);
		// the live engine badge: its own pill under the brand pill (what is really loaded, as decided by the caller)
		int ew = 8 + 8 + Glass.width(g, engine, 1f) + 14, ey = y + hh + 5;
		Glass.roundFill(g, 16, ey, ew, 16, 8, 0xA00B1226);
		Glass.roundOutline(g, 16, ey, ew, 16, 8, 0x552B4BFF);
		Glass.roundFill(g, 24, ey + 6, 4, 4, 2, 0xFF60A5FA);
		g.text(engine, 34, ey + 4, SKY);
		int tx = 46;
		String[] parts = text.split(SEP);
		for (int i = 0; i < parts.length; i++) {
			int col = i == 0 ? INK : parts[i].equals(live) ? MUTED : SKY;
			g.text(parts[i], tx, y + 9, col);
			tx += Glass.width(g, parts[i], 1f);
			if (i < parts.length - 1) { g.fill(tx + 6, y + 12, tx + 8, y + 14, FOOT); tx += 14; }   // a drawn dot: the bitmap font has no bullet glyph
		}
	}

	/** One action row: left-aligned label, shortcut on the right, and the hit rectangle registered with the identical (x, y, w, h). */
	private void row(Gfx g, int mx, int my, Row r, int x, int y, int w, int h, boolean focused) {
		boolean over = mx >= x && mx < x + w && my >= y && my < y + h;
		float hot = hover.getOrDefault(r.id, 0f);
		hot = Math.max(0f, Math.min(1f, hot + (over || focused ? 0.25f : -0.25f)));
		hover.put(r.id, hot);
		int fill, edge;
		switch (r.kind) {
			case DANGER -> { fill = lerp(FILL, 0xFF3A1519, hot); edge = lerp(0x33FFFFFF, CRIMSON, hot); }
			case ACCENT -> { fill = lerp(0xE60F1A44, COBALT, hot); edge = lerp(0x802B4BFF, EDGE, hot); }
			default -> { fill = lerp(FILL, 0xFF1B2440, hot); edge = lerp(0x33FFFFFF, EDGE, hot); }
		}
		Glass.roundFill(g, x, y, w, h, 6, fill);
		Glass.roundOutline(g, x, y, w, h, 6, edge);
		g.fill(x + 1, y + 5, x + 3, y + h - 5, r.kind == Kind.DANGER ? CRIMSON : COBALT);   // the cobalt bar on the left of every row
		int ty = y + (h - 8) / 2 + 1;
		g.text(r.label, x + 12, ty, INK);
		if (!r.hint.isEmpty()) g.text(r.hint, x + w - 10 - Glass.width(g, r.hint, 1f), ty, hot > 0.5f ? 0xFFBFD4FF : FOOT);
		if (focused) Glass.roundOutline(g, x - 2, y - 2, w + 4, h + 4, 7, 0xFFFFFFFF);
		rects.put(r.id, new int[] { x, y, w, h });
		hitRegions.add(new HitRegion(x, y, w, h, r.id));
	}

	private static String shortVersion() {
		String v = LuminosClient.VERSION;
		int dot = v.indexOf('.');
		int dot2 = dot < 0 ? -1 : v.indexOf('.', dot + 1);
		return dot2 < 0 ? v : v.substring(0, dot2);
	}

	private static void spaced(Gfx g, String s, int cx, int y, float scale, int track, int color) {
		int ww = 0;
		for (char c : s.toCharArray()) ww += Glass.width(g, String.valueOf(c), scale) + track;
		ww -= track;
		float x = cx - ww / 2f;
		for (char c : s.toCharArray()) {
			String t = String.valueOf(c);
			Glass.text(g, t, Math.round(x), y, scale, color);
			x += Glass.width(g, t, scale) + track;
		}
	}

	// ------------------------------------------------------------------ input
	/** Left click only. Returns true when a button took it. */
	public boolean click(double mx, double my, int button) {
		if (button != 0) return false;
		for (int i = hitRegions.size() - 1; i >= 0; i--) {
			HitRegion r = hitRegions.get(i);
			if (r.contains(mx, my)) {
				clickSound.run();
				action.accept(r.id());
				return true;
			}
		}
		return false;
	}

	/** Keyboard navigation: Up/Down/Tab move the focus ring, Enter/Space activates, H opens the HUD studio. */
	public boolean key(int code) {
		int n = ROWS.length;
		switch (code) {
			case 265 -> focus = focus <= 0 ? n - 1 : focus - 1;          // Up
			case 264, 258 -> focus = (focus + 1) % n;                     // Down, Tab
			case 257, 335, 32 -> {                                        // Enter, keypad Enter, Space
				if (focus < 0) return false;
				clickSound.run();
				action.accept(ROWS[focus].id);
			}
			case 72 -> { clickSound.run(); action.accept(HUD); }          // H
			default -> { return false; }
		}
		return true;
	}
}
