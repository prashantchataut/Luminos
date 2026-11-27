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

	private final List<HitRegion> hitRegions = new ArrayList<>();
	private final Map<String, Float> hover = new HashMap<>();
	private final Consumer<String> action;
	private Runnable clickSound = () -> {};

	public MainMenuView(Consumer<String> action) { this.action = action; }

	public void setClickSound(Runnable r) { clickSound = r == null ? () -> {} : r; }

	/** What the last frame registered, for tests. */
	List<HitRegion> regions() { return hitRegions; }

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
		int w = g.width(), h = g.height(), cx = w / 2, cy = h / 2;
		backdrop(g, w, h);
		particles(g, w, h, timeMs);
		vignette(g, w, h);
		topBar(g, mx, my, w, user, fps, engine);

		// hero
		int logo = 44;
		if (!g.texture(TitleScene.LOGO, cx - logo / 2, cy - 94, logo, logo, 64, 64)) Glass.roundFill(g, cx - logo / 2, cy - 94, logo, logo, 22, COBALT);
		spaced(g, "LUMINOS", cx, cy - 44, 2f, 4, INK);
		String sub = "HIGH-PERFORMANCE MINECRAFT CLIENT  |  " + mcVersion;
		Glass.text(g, sub, cx - Glass.width(g, sub, 1f) / 2f, cy - 22, 1f, MUTED);

		// primary stack
		int bw = 220, bx = cx - bw / 2;
		button(g, mx, my, SINGLE, "SINGLEPLAYER", bx, cy + 8, bw, 26, Kind.PRIMARY);
		button(g, mx, my, MULTI, "MULTIPLAYER", bx, cy + 40, bw, 26, Kind.PRIMARY);
		button(g, mx, my, PANEL, "LUMINOS MOD PANEL [R-CTRL]", bx, cy + 72, bw, 26, Kind.ACCENT);
		// split row: 70 + 72 + 70 across 220 with 4 px gaps
		button(g, mx, my, HUD, "HUD Studio", bx, cy + 104, 70, 22, Kind.SECONDARY);
		button(g, mx, my, OPTIONS, "Options", bx + 74, cy + 104, 72, 22, Kind.SECONDARY);
		button(g, mx, my, QUIT, "Quit", bx + 150, cy + 104, 70, 22, Kind.DANGER);

		String left = "Luminos Engine v" + LuminosClient.VERSION + "  |  Entity/Particle Culling + Fast Render Pipeline";
		String right = "Minecraft " + mcVersion + " / Mojang AB";
		int fy = h - 16;
		if (Glass.width(g, left, 1f) + Glass.width(g, right, 1f) + 40 > w) left = "Luminos Engine v" + LuminosClient.VERSION;
		g.text(left, 16, fy, FOOT);
		g.text(right, w - 16 - Glass.width(g, right, 1f), fy, FOOT);
	}

	private void backdrop(Gfx g, int w, int h) {
		if (g.cover(TitleScene.BG, TitleScene.BG_W, TitleScene.BG_H, 0, 0, w, h)) {
			g.fill(0, 0, w, h, 0x9907090E);   // quiet the artwork so the controls own the screen
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

	private void topBar(Gfx g, int mx, int my, int w, String user, int fps, String engine) {
		int y = 14, hh = 26;
		// right pills, right-aligned at w - 16, built right to left
		String name = (user == null || user.isEmpty()) ? "Offline" : user;
		String[][] chips = { { CAPES, "Capes" }, { HUD, "HUD Studio" }, { PANEL, "Mod Panel [R-Ctrl]" } };
		int x = w - 16;
		for (String[] c : chips) {
			int cw = Glass.width(g, c[1], 1f) + 20;
			x -= cw;
			button(g, mx, my, c[0], c[1], x, y, cw, hh, c[0].equals(PANEL) ? Kind.CHIP_ACCENT : Kind.CHIP);
			x -= 6;
		}
		int aw = 8 + 6 + 8 + Glass.width(g, name, 1f) + 12;
		x -= aw;
		int acc = x;
		Glass.roundFill(g, x, y, aw, hh, hh / 2, 0xB0141822);
		Glass.roundOutline(g, x, y, aw, hh, hh / 2, 0x26FFFFFF);
		Glass.roundFill(g, x + 10, y + 10, 6, 6, 3, 0xFF22C55E);
		g.text(name, x + 22, y + 9, INK);

		// left pill: logo, name, engine, fps; degrade gracefully when the right side needs the room
		String live = fps + " FPS", brand = "LUMINOS " + shortVersion();
		int avail = acc - 12 - 16;
		String[] tiers = { brand + SEP + engine + SEP + live, brand + SEP + live, brand };
		String text = tiers[tiers.length - 1];
		for (String t : tiers) if (8 + 16 + 6 + Glass.width(g, t.replace(SEP, "     "), 1f) + 12 <= avail) { text = t; break; }
		int pw = 8 + 16 + 6 + Glass.width(g, text.replace(SEP, "     "), 1f) + 12;
		Glass.roundFill(g, 16, y, pw, hh, hh / 2, 0xB0141822);
		Glass.roundOutline(g, 16, y, pw, hh, hh / 2, 0x26FFFFFF);
		if (!g.texture(TitleScene.LOGO, 24, y + 5, 16, 16, 64, 64)) Glass.roundFill(g, 24, y + 5, 16, 16, 8, COBALT);
		int tx = 46;
		String[] parts = text.split(SEP);
		for (int i = 0; i < parts.length; i++) {
			int col = i == 0 ? INK : parts[i].equals(live) ? MUTED : SKY;
			g.text(parts[i], tx, y + 9, col);
			tx += Glass.width(g, parts[i], 1f);
			if (i < parts.length - 1) { g.fill(tx + 6, y + 12, tx + 8, y + 14, FOOT); tx += 14; }   // a drawn dot: the bitmap font has no bullet glyph
		}
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

	/** Draws one button and registers its hit rectangle with the identical (x, y, w, h). */
	private void button(Gfx g, int mx, int my, String id, String label, int x, int y, int w, int h, Kind kind) {
		boolean over = mx >= x && mx < x + w && my >= y && my < y + h;
		float hot = hover.getOrDefault(id, 0f);
		hot = Math.max(0f, Math.min(1f, hot + (over ? 0.25f : -0.25f)));
		hover.put(id, hot);
		int fill, edge;
		switch (kind) {
			case DANGER -> { fill = lerp(FILL, 0xFF3A1519, hot); edge = lerp(0x33FFFFFF, CRIMSON, hot); }
			case CHIP -> { fill = lerp(0xB0141822, 0xFF1E2433, hot); edge = lerp(0x26FFFFFF, 0x66FFFFFF, hot); }
			case CHIP_ACCENT -> { fill = lerp(0xE62B4BFF, 0xFF3B5BFF, hot); edge = lerp(0x66FFFFFF, EDGE, hot); }
			case SECONDARY -> { fill = lerp(FILL, 0xFF1E2433, hot); edge = lerp(0x33FFFFFF, 0x80FFFFFF, hot); }
			default -> { fill = lerp(FILL, COBALT, hot); edge = lerp(kind == Kind.ACCENT ? 0x802B4BFF : 0x33FFFFFF, EDGE, hot); }
		}
		int r = kind == Kind.CHIP || kind == Kind.CHIP_ACCENT ? h / 2 : 6;
		Glass.roundFill(g, x, y, w, h, r, fill);
		Glass.roundOutline(g, x, y, w, h, r, edge);
		if (kind == Kind.ACCENT) {   // the glowing cobalt bar on the left of the panel button
			g.fill(x + 1, y + 5, x + 3, y + h - 5, COBALT);
			g.fill(x + 3, y + 7, x + 4, y + h - 7, 0x552B4BFF);
		}
		int tw = Glass.width(g, label, 1f);
		g.text(label, x + (w - tw) / 2, y + (h - 8) / 2 + 1, INK);
		hitRegions.add(new HitRegion(x, y, w, h, id));
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
}
