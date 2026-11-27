package dev.luminos.client;

import net.minecraft.client.Minecraft;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.util.Locale;

/**
 * The Right Ctrl panel (v4.4): one centred dark modal, one coordinate space, one {@link HitRegion} list.
 *
 * <p>Every interactive rectangle is registered in {@link #render} with the exact (x, y, w, h) it was drawn at, and the list is cleared at the
 * start of every frame. Nothing here owns a vanilla widget, so there is no invisible button underneath a card that can swallow a click.
 *
 * <ul>
 *   <li><b>Clipped hits.</b> Rectangles that live inside a scrolling viewport (module cards, drawer rows) are clamped to
 *       {@code [gridTop, gridBottom]} when they are registered and checked against it again in {@link #click}. A card scrolled half
 *       under the header can therefore never receive a click that was aimed at a tab or the search box (the v4.3 bug).</li>
 *   <li><b>No screen hopping.</b> Toggling a module, switching a tab, opening the settings drawer: all in place. The only things that leave
 *       this screen are the two explicit buttons (Edit HUD, Keybinds link) and Close.</li>
 *   <li><b>Inline drawer.</b> The gear (or a right click on a card) opens a 210 px column on the right of the modal with the module's
 *       sliders and toggles; the grid reflows to the remaining width.</li>
 * </ul>
 *
 * Written against {@link Gfx} only, so the in-game screen and the offscreen preview draw the very same pixels.
 */
public final class ModPanelView {
	public enum Cat {
		ALL("All"), HUD("HUD"), RENDER("Render"), WORLD("World"), PVP("PvP"), MOVEMENT("Movement"), FPS("FPS");
		final String label;
		Cat(String l) { label = l; }
		boolean has(Feature f) {
			return switch (this) {
				case ALL -> true;
				case HUD -> f.group == Feature.Group.HUD;
				case RENDER -> f.group == Feature.Group.VISUALS && !movement(f);
				case WORLD -> f.group == Feature.Group.UTILITY;
				case PVP -> f.group == Feature.Group.PVP && !movement(f);
				case MOVEMENT -> movement(f);
				case FPS -> f.group == Feature.Group.PERFORMANCE;
			};
		}
		private static boolean movement(Feature f) {
			String id = f.id;
			return id.contains("sprint") || id.contains("zoom") || id.contains("freelook") || id.contains("perspective") || id.contains("swim") || id.contains("sneak");
		}
	}

	/** One clickable rectangle, exactly as drawn. {@code scrolled} marks rectangles inside the grid/drawer viewport. */
	record HitRegion(int x, int y, int w, int h, Runnable onLeftClick, Runnable onRightClick, boolean scrolled) {
		boolean contains(double mx, double my) { return mx >= x && mx < x + w && my >= y && my < y + h; }
	}
	private record Slider(int x, int w, Feature f, Feature.Opt o) {}

	// palette
	private static final int SCRIM = 0x8806080C, SURFACE = 0xF2101420, EDGE = 0x33FFFFFF, BAR = 0xFF0D111A;
	private static final int CARD = 0xFF151A26, CARD_HOT = 0xFF1B2232, FIELD = 0xFF0B0E16;
	private static final int INK = 0xFFF2F4F8, MUTE = 0xFF8A94A6, DIM = 0xFF64748B, COBALT = 0xFF2B4BFF, OFF = 0xFF1E2433, ON_TXT = 0xFF93C5FD;
	public static final int MAX_W = 560, MAX_H = 340, BAR_H = 32, CARD_H = 44, GAP = 8, FOOT_H = 26, DRAWER_W = 210;

	public Cat cat = Cat.ALL;
	private final StringBuilder query = new StringBuilder();
	private final Runnable close, openEditor, openAdvanced;
	private Runnable clickSound = () -> {};
	private final List<HitRegion> hitRegions = new ArrayList<>();
	/** Named rectangles of the last frame ("tab:HUD", "card:keystrokes", "gear:keystrokes", "slider:@scale", ...): what the headless input tests aim at. */
	private final Map<String, int[]> rects = new LinkedHashMap<>();
	private float scrollOffset, maxScroll, drawerScroll, maxDrawerScroll;
	private Feature expandedModule;
	private boolean searchFocused = true;
	private Slider dragging;
	private int mx, my;
	private int gridTop, gridBottom, gridLeft, gridRight;   // the scrolling viewport; every scrolled hit is clamped to it

	public ModPanelView(Runnable close, Runnable openEditor, Runnable openAdvanced) {
		this.close = close;
		this.openEditor = openEditor;
		this.openAdvanced = openAdvanced;
	}

	/** Played once for every accepted click (the screen supplies SoundEvents.UI_BUTTON_CLICK). */
	public void setClickSound(Runnable r) { this.clickSound = r == null ? () -> {} : r; }

	// ------------------------------------------------------------------ data
	public List<Feature> visible() {
		String q = query.toString().trim().toLowerCase(Locale.ROOT);
		List<Feature> out = new ArrayList<>();
		for (Feature f : Features.ALL) {
			if (!cat.has(f)) continue;
			if (!q.isEmpty() && !(f.name.toLowerCase(Locale.ROOT).contains(q) || f.desc.toLowerCase(Locale.ROOT).contains(q) || f.id.contains(q))) continue;
			out.add(f);
		}
		return out;
	}

	private static String lockReason(Feature f) {
		if (f.lock == null) return null;
		try { return f.lock.apply(Minecraft.getInstance()); } catch (RuntimeException e) { return null; }
	}

	/** Test/preview hook: pre-fill the search box. */
	public void setQuery(String q) { query.setLength(0); query.append(q); scrollOffset = 0; }
	public void setScroll(float s) { scrollOffset = s; }
	public void setCategory(Cat c) { cat = c; scrollOffset = 0; expandedModule = null; }
	public void focusSearch(boolean f) { searchFocused = f; }
	public void openSettings(String featureId) { expandedModule = Features.byId(featureId); drawerScroll = 0; }
	public Feature expanded() { return expandedModule; }
	/** Last frame's regions, for the headless hit-test. */
	java.util.List<HitRegion> regions() { return hitRegions; }
	int[] rect(String key) { return rects.get(key); }
	float scrollOffsetPx() { return scrollOffset; }
	float maxScrollPx() { return maxScroll; }
	int gridTopPx() { return gridTop; }
	int gridBottomPx() { return gridBottom; }

	// ------------------------------------------------------------------ geometry
	public static int modalW(int screenW) { return Math.min(MAX_W, screenW - 40); }
	public static int modalH(int screenH) { return Math.min(MAX_H, screenH - 40); }

	/** Registers a hit rectangle. Scrolled rectangles are clamped to the viewport; fully clipped ones are dropped. */
	private void region(int x, int y, int w, int h, Runnable left, Runnable right, boolean scrolled) {
		if (scrolled) {
			int y0 = Math.max(y, gridTop), y1 = Math.min(y + h, gridBottom);
			if (y1 <= y0) return;
			y = y0; h = y1 - y0;
		}
		hitRegions.add(new HitRegion(x, y, w, h, left, right, scrolled));
	}

	private boolean over(int x, int y, int w, int h) { return mx >= x && mx < x + w && my >= y && my < y + h; }

	// ------------------------------------------------------------------ paint
	public void render(Gfx g, int mouseX, int mouseY) {
		mx = mouseX; my = mouseY;
		hitRegions.clear();
		rects.clear();
		int sw = g.width(), sh = g.height();
		g.fill(0, 0, sw, sh, SCRIM);
		int w = modalW(sw), h = modalH(sh), x = (sw - w) / 2, y = (sh - h) / 2;
		Glass.shadow(g, x, y, w, h, 10, 1f);
		Glass.roundFill(g, x, y, w, h, 10, SURFACE);
		Glass.roundOutline(g, x, y, w, h, 10, EDGE);

		topBar(g, x, y, w);
		int pad = 14;
		int rowY = y + BAR_H + 8;
		List<Feature> list = visible();
		long on = list.stream().filter(Feature::on).count();

		// search box (right end of the tab row), then tabs on the left
		int sFw = Math.min(170, Math.max(96, w / 3));
		int sX = x + w - pad - sFw;
		Glass.roundFill(g, sX, rowY, sFw, 20, 6, FIELD);
		Glass.roundOutline(g, sX, rowY, sFw, 20, 6, searchFocused ? 0xCC2B4BFF : 0x26FFFFFF);
		boolean caret = searchFocused && (System.currentTimeMillis() / 500) % 2 == 0;
		String shown = query.length() == 0 ? "Search modules" : Glass.fit(g, query.toString(), 1f, sFw - 20) + (caret ? "_" : "");
		g.text(shown, sX + 8, rowY + 6, query.length() == 0 ? DIM : INK);
		region(sX, rowY, sFw, 20, () -> searchFocused = true, null, false);
		tabs(g, x + pad, rowY, sX - 8 - (x + pad));

		// grid viewport (and the drawer column beside it)
		gridTop = rowY + 20 + 10; gridBottom = y + h - FOOT_H - 2; gridLeft = x + pad;
		int gw = w - 2 * pad, gh = gridBottom - gridTop;
		boolean drawer = expandedModule != null;
		int gridW = drawer ? gw - DRAWER_W - 10 : gw;
		gridRight = gridLeft + gridW;
		int cols = gridW >= 440 ? 3 : gridW >= 300 ? 2 : 1;
		int cw = (gridW - GAP * (cols - 1)) / cols;
		int rows = (list.size() + cols - 1) / cols;
		int content = Math.max(1, rows * (CARD_H + GAP) - GAP);
		maxScroll = Math.max(0, content - gh);
		scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset));
		g.clip(gridLeft, gridTop, gridLeft + gridW, gridBottom);
		if (list.isEmpty()) {
			String none = "No modules match \"" + query + "\"";
			g.text(none, gridLeft + (gridW - g.textWidth(none)) / 2, gridTop + 30, DIM);
		}
		int firstRow = Math.max(0, (int) (scrollOffset / (CARD_H + GAP)));
		for (int i = firstRow * cols; i < list.size(); i++) {
			int r = i / cols, c = i % cols;
			int cx = gridLeft + c * (cw + GAP), cy = gridTop + r * (CARD_H + GAP) - Math.round(scrollOffset);
			if (cy > gridBottom) break;
			if (cy + CARD_H < gridTop) continue;
			card(g, list.get(i), cx, cy, cw);
		}
		g.unclip();
		if (maxScroll > 0) {
			int th = Math.max(18, Math.round(gh * (gh / (float) content)));
			int ty = gridTop + Math.round((gh - th) * (scrollOffset / maxScroll));
			g.fill(gridLeft + gridW + 2, ty, gridLeft + gridW + 4, ty + th, 0x40FFFFFF);
		}
		footer(g, x, y, w, h, on, list.size());
		if (drawer) drawer(g, gridLeft + gw - DRAWER_W, gridTop, DRAWER_W, gh);
	}

	private void tabs(Gfx g, int x0, int y, int avail) {
		int textTotal = 0;
		Cat[] cats = Cat.values();
		for (Cat c : cats) textTotal += g.textWidth(c.label);
		int pad = Math.max(3, Math.min(10, (avail - textTotal - cats.length * 2) / (cats.length * 2)));
		int tx = x0;
		for (Cat c : cats) {
			int tw = g.textWidth(c.label) + pad * 2, th = 20;
			boolean sel = c == cat, hot = over(tx, y, tw, th);
			if (sel) Glass.roundFill(g, tx, y, tw, th, 6, OFF);
			else if (hot) Glass.roundFill(g, tx, y, tw, th, 6, 0x601E2433);
			g.text(c.label, tx + pad, y + 6, sel ? INK : hot ? 0xFFCBD5E1 : MUTE);
			if (sel) g.fill(tx + pad, y + th - 2, tx + tw - pad, y + th, COBALT);
			final Cat cc = c;
			rects.put("tab:" + c.name(), new int[] { tx, y, tw, th });
			region(tx, y, tw, th, () -> { cat = cc; scrollOffset = 0; expandedModule = null; clickSound.run(); }, null, false);
			tx += tw + 2;
		}
	}

	private void topBar(Gfx g, int x, int y, int w) {
		Glass.roundFill(g, x, y, w, BAR_H, 10, BAR);
		g.fill(x, y + BAR_H - 10, x + w, y + BAR_H, BAR);   // square the bar's lower corners
		g.fill(x, y + BAR_H, x + w, y + BAR_H + 1, 0x1AFFFFFF);
		Glass.text(g, "LUMINOS MODS", x + 14, y + 12, 1f, INK);
		// close
		int cx = x + w - 14 - 20, cy = y + 6;
		boolean hotX = over(cx, cy, 20, 20);
		Glass.roundFill(g, cx, cy, 20, 20, 6, hotX ? 0xFF3A1519 : OFF);
		Icons.draw(g, "close", cx + 6, cy + 6, hotX ? 0xFFFCA5A5 : INK);
		region(cx, cy, 20, 20, () -> { clickSound.run(); close.run(); }, null, false);
		// Edit HUD (the only way out of this screen besides close and the keybinds link)
		int ew = g.textWidth("Edit HUD") + 16, ex = cx - 8 - ew;
		boolean hotE = over(ex, cy, ew, 20);
		Glass.roundFill(g, ex, cy, ew, 20, 6, hotE ? COBALT : OFF);
		g.text("Edit HUD", ex + 8, cy + 6, INK);
		rects.put("editor", new int[] { ex, cy, ew, 20 });
		region(ex, cy, ew, 20, () -> { clickSound.run(); openEditor.run(); }, null, false);
	}

	private void card(Gfx g, Feature f, int x, int y, int w) {
		boolean inGrid = my >= gridTop && my < gridBottom && mx >= gridLeft && mx < gridRight;
		boolean hotCard = inGrid && over(x, y, w, CARD_H);
		String lock = lockReason(f);
		boolean on = f.on() && lock == null;
		boolean open = expandedModule == f;
		Glass.roundFill(g, x, y, w, CARD_H, 7, hotCard || open ? CARD_HOT : CARD);
		Glass.roundOutline(g, x, y, w, CARD_H, 7, open ? 0xCC60A5FA : on ? 0x552B4BFF : 0x1FFFFFFF);
		boolean gear = !f.opts.isEmpty() && lock == null;
		int right = x + w - 10;
		int gearX = right - 16;
		int toggleX = (gear ? gearX - 6 : right) - 28;
		int textMax = toggleX - (x + 10) - 6;
		g.text(Glass.fit(g, f.name, 1f, textMax), x + 10, y + 10, lock != null ? DIM : INK);
		String status = lock != null ? "Locked" : on ? "Enabled" : "Disabled";
		Glass.text(g, status, x + 10, y + 25, 0.75f, lock != null ? DIM : on ? ON_TXT : DIM);
		int ty = y + (CARD_H - 14) / 2;
		pill(g, toggleX, ty, 28, 14, on, lock != null);
		final Feature ff = f;
		// registration order = paint order: body first, the switch and the gear on top of it
		Runnable flip = lock != null ? null : () -> { ff.toggle(); clickSound.run(); };   // toggle() saves the config; never opens a screen
		Runnable expand = !gear ? null : () -> { expandedModule = expandedModule == ff ? null : ff; drawerScroll = 0; clickSound.run(); };
		rects.put("card:" + f.id, new int[] { x, y, w, CARD_H });
		rects.put("toggle:" + f.id, new int[] { toggleX - 4, y, 36, CARD_H });
		region(x, y, w, CARD_H, flip, expand, true);
		if (lock == null) region(toggleX - 4, y, 36, CARD_H, flip, expand, true);
		if (gear) {
			boolean hg = inGrid && over(gearX - 4, y + 8, 24, CARD_H - 16);
			if (open || hg) Glass.roundFill(g, gearX - 2, y + 12, 20, 20, 6, OFF);
			Icons.draw(g, "gear", gearX + 4, y + 18, open ? ON_TXT : hg ? INK : MUTE);
			rects.put("gear:" + f.id, new int[] { gearX - 4, y + 8, 24, CARD_H - 16 });
			region(gearX - 4, y + 8, 24, CARD_H - 16, expand, expand, true);
		}
	}

	private static void pill(Gfx g, int x, int y, int w, int h, boolean on, boolean locked) {
		Glass.roundFill(g, x, y, w, h, h / 2, locked ? 0xFF171C28 : on ? COBALT : OFF);
		int k = h - 4;
		Glass.roundFill(g, on ? x + w - k - 2 : x + 2, y + 2, k, k, k / 2, locked ? 0xFF3A4152 : 0xFFFFFFFF);
	}

	private void footer(Gfx g, int x, int y, int w, int h, long on, int total) {
		int fy = y + h - FOOT_H;
		g.fill(x + 1, fy, x + w - 1, fy + 1, 0x14FFFFFF);
		String adv = "Keybinds, waypoints, support";
		boolean hot = over(x + 14, fy + 4, g.textWidth(adv), 18);
		g.text(adv, x + 14, fy + 9, hot ? INK : MUTE);
		region(x + 14, fy + 4, g.textWidth(adv), 18, () -> { clickSound.run(); openAdvanced.run(); }, null, false);
		String hint = on + " of " + total + " on  |  Esc or Right Ctrl closes";
		g.text(hint, x + w - 14 - g.textWidth(hint), fy + 9, DIM);
	}

	// ------------------------------------------------------------------ inline settings drawer
	private void drawer(Gfx g, int dx, int dy, int dw, int dh) {
		Feature f = expandedModule;
		Glass.roundFill(g, dx, dy, dw, dh, 8, 0xFF111623);
		Glass.roundOutline(g, dx, dy, dw, dh, 8, 0x40FFFFFF);
		g.text(Glass.fit(g, f.name, 1f, dw - 44), dx + 10, dy + 9, INK);
		int cx = dx + dw - 26, cy = dy + 5;
		boolean hotX = over(cx, cy, 18, 18);
		Glass.roundFill(g, cx, cy, 18, 18, 5, hotX ? 0xFF3A1519 : OFF);
		Icons.draw(g, "close", cx + 5, cy + 5, hotX ? 0xFFFCA5A5 : INK);
		region(cx, cy, 18, 18, () -> { expandedModule = null; clickSound.run(); }, null, false);
		Glass.text(g, Glass.fit(g, f.desc, 0.75f, dw - 20), dx + 10, dy + 24, 0.75f, DIM);
		// master switch row
		boolean on = f.on();
		g.text(on ? "Enabled" : "Disabled", dx + 10, dy + 40, on ? ON_TXT : MUTE);
		int sx = dx + dw - 10 - 28;
		pill(g, sx, dy + 37, 28, 14, on, false);
		final Feature ff = f;
		region(dx + 6, dy + 34, dw - 12, 20, () -> { ff.toggle(); clickSound.run(); }, null, false);
		g.fill(dx + 8, dy + 56, dx + dw - 8, dy + 57, 0x14FFFFFF);

		int areaTop = dy + 60, areaBottom = dy + dh - 6;
		java.util.List<Feature.Opt> opts = drawerOpts(f);
		int content = 1;
		for (Feature.Opt o : opts) content += o.slider() ? 30 : 22;
		maxDrawerScroll = Math.max(0, content - (areaBottom - areaTop));
		drawerScroll = Math.max(0, Math.min(maxDrawerScroll, drawerScroll));
		// the drawer's rows are a scrolling viewport too: clamp their hits to it, like the grid's
		int savedTop = gridTop, savedBottom = gridBottom;
		gridTop = areaTop; gridBottom = areaBottom;
		g.clip(dx + 1, areaTop, dx + dw - 1, areaBottom);
		int cyRow = areaTop - Math.round(drawerScroll);
		for (Feature.Opt o : opts) {
			float v = optValue(f, o);
			if (o.slider()) {
				String val = (Math.abs(v - Math.round(v)) < 0.001f ? String.valueOf(Math.round(v)) : String.format(Locale.ROOT, "%.1f", v)) + o.unit();
				Glass.text(g, Glass.fit(g, o.label(), 0.75f, dw - 60), dx + 10, cyRow, 0.75f, MUTE);
				Glass.text(g, val, dx + dw - 10 - Glass.width(g, val, 0.75f), cyRow, 0.75f, INK);
				int tx = dx + 10, tw = dw - 20, ty = cyRow + 13;
				float t = Math.max(0, Math.min(1, (v - o.min()) / (o.max() - o.min())));
				Glass.roundFill(g, tx, ty, tw, 4, 2, OFF);
				Glass.roundFill(g, tx, ty, Math.max(4, Math.round(tw * t)), 4, 2, COBALT);
				Glass.roundFill(g, tx + Math.round((tw - 8) * t), ty - 2, 8, 8, 4, 0xFFFFFFFF);
				final Slider s = new Slider(tx, tw, f, o);
				rects.put("slider:" + o.key(), new int[] { tx - 4, ty - 8, tw + 8, 18 });
				region(tx - 4, ty - 8, tw + 8, 18, () -> { dragging = s; setSlider(s, mx); }, null, true);
				cyRow += 30;
			} else {
				boolean b = v >= 0.5f;
				g.text(Glass.fit(g, o.label(), 1f, dw - 56), dx + 10, cyRow + 3, MUTE);
				pill(g, dx + dw - 10 - 24, cyRow + 1, 24, 12, b, false);
				final Feature.Opt oo = o;
				region(dx + 6, cyRow - 2, dw - 12, 20, () -> { Features.optSet(ff, oo, b ? 0 : 1); Config.save(); clickSound.run(); }, null, true);
				cyRow += 22;
			}
		}
		g.unclip();
		gridTop = savedTop; gridBottom = savedBottom;
		if (maxDrawerScroll > 0) {
			int th = Math.max(14, Math.round((areaBottom - areaTop) * ((areaBottom - areaTop) / (float) content)));
			int ty = areaTop + Math.round(((areaBottom - areaTop) - th) * (drawerScroll / maxDrawerScroll));
			g.fill(dx + dw - 4, ty, dx + dw - 2, ty + th, 0x40FFFFFF);
		}
	}

	private void setSlider(Slider s, double x) {
		float t = (float) Math.max(0, Math.min(1, (x - s.x) / s.w));
		float v = s.o.min() + t * (s.o.max() - s.o.min());
		if (s.o.step() > 0) v = Math.max(s.o.min(), Math.min(s.o.max(), Math.round(v / s.o.step()) * s.o.step()));
		optStore(s.f, s.o, v);
	}

	private static List<Feature.Opt> drawerOpts(Feature f) { return f.opts; }   // HUD widgets already carry a real "@scale" option (Features.java)
	static float optValue(Feature f, Feature.Opt o) { return Features.optGet(f, o); }
	private static void optStore(Feature f, Feature.Opt o, float v) { Features.optSet(f, o, v); }

	// ------------------------------------------------------------------ input
	/** Left (0) or right (1) click. The modal swallows every click so nothing underneath can react. */
	public boolean click(double x, double y, int button) {
		if (button != 0 && button != 1) return true;
		mx = (int) x; my = (int) y;
		for (int i = hitRegions.size() - 1; i >= 0; i--) {
			HitRegion h = hitRegions.get(i);
			if (!h.contains(x, y)) continue;
			Runnable r = button == 0 ? h.onLeftClick() : h.onRightClick();
			if (r == null) continue;
			r.run();
			return true;
		}
		return true;
	}

	public boolean drag(double x, double y) {
		if (dragging == null) return false;
		setSlider(dragging, x);
		return true;
	}

	public void release() {
		if (dragging != null) { dragging = null; Config.save(); }
	}

	/** Wheel over the drawer scrolls the drawer; anywhere else it scrolls the grid. */
	public void scroll(double dy) { scroll(mx, my, dy); }

	public void scroll(double x, double y, double dy) {
		if (expandedModule != null && x >= gridRight + 10) drawerScroll = Math.max(0, Math.min(maxDrawerScroll, drawerScroll - (float) dy * 22));
		else scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset - (float) dy * 26));
	}

	/** Returns true when the key was used (Backspace edits the search). */
	public boolean key(int code) {
		if (code == 259 && searchFocused && query.length() > 0) { query.setLength(query.length() - 1); scrollOffset = 0; return true; }   // Backspace
		return false;
	}

	public void type(int codepoint) {
		if (!searchFocused || codepoint < 32 || codepoint == 127 || query.length() >= 24) return;
		query.appendCodePoint(codepoint);
		scrollOffset = 0;
	}

	public boolean popoverOpen() { return expandedModule != null; }
	public void closePopover() { expandedModule = null; }
}
