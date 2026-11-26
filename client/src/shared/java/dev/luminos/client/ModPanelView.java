package dev.luminos.client;

import net.minecraft.client.Minecraft;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The Right Ctrl panel: a centred dark modal with a 32 px top bar (title, category tabs, Edit HUD, close), a search field, and a
 * scrolling grid of 44 px module cards. Each card: name and Enabled/Disabled on the left, a pill switch and (when the module has
 * settings) a gear that opens its sliders and toggles in a small popover. Every change is written with {@link Config#save()} at once.
 *
 * Written against {@link Gfx} only, so the in-game screen and the offscreen preview draw the very same pixels.
 */
public final class ModPanelView {
	public enum Cat {
		ALL("All"), HUD("HUD"), VISUALS("Visuals"), WORLD("World"), PVP("PvP");
		final String label;
		Cat(String l) { label = l; }
		boolean has(Feature f) {
			return switch (this) {
				case ALL -> true;
				case HUD -> f.group == Feature.Group.HUD;
				case VISUALS -> f.group == Feature.Group.VISUALS;
				case WORLD -> f.group == Feature.Group.UTILITY || f.group == Feature.Group.PERFORMANCE;
				case PVP -> f.group == Feature.Group.PVP;
			};
		}
	}

	private record Hit(int x, int y, int w, int h, Runnable r) {
		boolean in(double mx, double my) { return mx >= x && mx < x + w && my >= y && my < y + h; }
	}
	private record Slider(int x, int w, Feature f, Feature.Opt o) {}

	// palette
	private static final int SCRIM = 0x8806080C, SURFACE = 0xF2101420, EDGE = 0x33FFFFFF, BAR = 0xFF0D111A;
	private static final int CARD = 0xFF151A26, CARD_HOT = 0xFF1B2232, FIELD = 0xFF0B0E16;
	private static final int INK = 0xFFF2F4F8, MUTE = 0xFF8A94A6, DIM = 0xFF64748B, COBALT = 0xFF2B4BFF, OFF = 0xFF1E2433, ON_TXT = 0xFF93C5FD;
	public static final int MAX_W = 560, MAX_H = 340, BAR_H = 32, CARD_H = 44, GAP = 8, FOOT_H = 26;

	public Cat cat = Cat.ALL;
	private final StringBuilder query = new StringBuilder();
	private final Runnable close, openEditor, openAdvanced;
	private final List<Hit> hits = new ArrayList<>();
	private final List<Hit> popHits = new ArrayList<>();
	private float scroll, maxScroll;
	private Feature popFeature;
	private int popX, popY, popW = 196, popH;
	private Slider dragging;
	private int hoverCard = -1;
	private int mx, my;
	private int gx, gy, gw, gh;   // the grid viewport

	public ModPanelView(Runnable close, Runnable openEditor, Runnable openAdvanced) {
		this.close = close;
		this.openEditor = openEditor;
		this.openAdvanced = openAdvanced;
	}

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
	public void setQuery(String q) { query.setLength(0); query.append(q); scroll = 0; }

	public void setScroll(float s) { scroll = s; }

	public void openSettings(String featureId) { popFeature = Features.byId(featureId); popX = -1; }

	// ------------------------------------------------------------------ geometry
	public static int modalW(int screenW) { return Math.min(MAX_W, screenW - 40); }
	public static int modalH(int screenH) { return Math.min(MAX_H, screenH - 40); }

	// ------------------------------------------------------------------ paint
	public void render(Gfx g, int mouseX, int mouseY) {
		mx = mouseX; my = mouseY;
		hits.clear(); popHits.clear();
		int sw = g.width(), sh = g.height();
		g.fill(0, 0, sw, sh, SCRIM);
		int w = modalW(sw), h = modalH(sh), x = (sw - w) / 2, y = (sh - h) / 2;
		Glass.shadow(g, x, y, w, h, 10, 1f);
		Glass.roundFill(g, x, y, w, h, 10, SURFACE);
		Glass.roundOutline(g, x, y, w, h, 10, EDGE);

		topBar(g, x, y, w);
		int pad = 14;
		// search row
		int sy = y + BAR_H + 8;
		int fw = Math.min(200, w - 2 * pad - 90);
		Glass.roundFill(g, x + pad, sy, fw, 20, 6, FIELD);
		Glass.roundOutline(g, x + pad, sy, fw, 20, 6, query.length() > 0 ? 0x802B4BFF : 0x26FFFFFF);
		boolean caret = (System.currentTimeMillis() / 500) % 2 == 0;
		String shown = query.length() == 0 ? "Search modules" : Glass.fit(g, query.toString(), 1f, fw - 20) + (caret ? "_" : "");
		g.text(shown, x + pad + 8, sy + 6, query.length() == 0 ? DIM : INK);
		List<Feature> list = visible();
		long on = list.stream().filter(Feature::on).count();
		String count = on + " of " + list.size() + " on";
		g.text(count, x + w - pad - g.textWidth(count), sy + 6, DIM);

		// grid viewport
		gx = x + pad; gy = sy + 20 + 10; gw = w - 2 * pad; gh = y + h - FOOT_H - gy;
		int cols = gw >= 440 ? 3 : 2;
		int cw = (gw - GAP * (cols - 1)) / cols;
		int rows = (list.size() + cols - 1) / cols;
		int content = rows * (CARD_H + GAP) - GAP;
		maxScroll = Math.max(0, content - gh);
		scroll = Math.max(0, Math.min(maxScroll, scroll));
		hoverCard = -1;
		g.clip(gx, gy, gx + gw, gy + gh);
		if (list.isEmpty()) {
			String none = "No modules match \"" + query + "\"";
			g.text(none, gx + (gw - g.textWidth(none)) / 2, gy + 30, DIM);
		}
		int firstRow = Math.max(0, (int) (scroll / (CARD_H + GAP)));
		for (int i = firstRow * cols; i < list.size(); i++) {
			int r = i / cols, c = i % cols;
			int cx = gx + c * (cw + GAP), cy = gy + r * (CARD_H + GAP) - Math.round(scroll);
			if (cy > gy + gh) break;
			if (cy + CARD_H < gy) continue;
			card(g, list.get(i), i, cx, cy, cw);
		}
		g.unclip();
		// scroll cue: a thin thumb on the right edge, plus a fade where content continues
		if (maxScroll > 0) {
			int th = Math.max(18, Math.round(gh * (gh / (float) content)));
			int ty = gy + Math.round((gh - th) * (scroll / maxScroll));
			g.fill(x + w - 8, ty, x + w - 5, ty + th, 0x40FFFFFF);
		}

		footer(g, x, y, w, h);
		if (popFeature != null) popover(g, x, y, w, h);
	}

	private void topBar(Gfx g, int x, int y, int w) {
		Glass.roundFill(g, x, y, w, BAR_H, 10, BAR);
		g.fill(x, y + BAR_H - 10, x + w, y + BAR_H, BAR);   // square the bar's lower corners
		g.fill(x, y + BAR_H, x + w, y + BAR_H + 1, 0x1AFFFFFF);
		Glass.text(g, "LUMINOS MODS", x + 14, y + 12, 1f, INK);
		// tabs, centred between the title and the right-hand actions
		int tabsW = 0;
		for (Cat c : Cat.values()) tabsW += g.textWidth(c.label) + 20;
		int tx = x + (w - tabsW) / 2 + 20;
		for (Cat c : Cat.values()) {
			int tw = g.textWidth(c.label) + 20;
			boolean sel = c == cat, hot = mx >= tx && mx < tx + tw && my >= y + 4 && my < y + BAR_H - 4;
			if (sel) Glass.roundFill(g, tx, y + 6, tw, 20, 6, OFF);
			else if (hot) Glass.roundFill(g, tx, y + 6, tw, 20, 6, 0x601E2433);
			g.text(c.label, tx + 10, y + 12, sel ? INK : hot ? 0xFFCBD5E1 : MUTE);
			if (sel) g.fill(tx + 10, y + 25, tx + tw - 10, y + 27, COBALT);
			final Cat cc = c;
			hits.add(new Hit(tx, y + 4, tw, BAR_H - 8, () -> { cat = cc; scroll = 0; popFeature = null; }));
			tx += tw;
		}
		// Edit HUD + close
		int cx = x + w - 14 - 20;
		boolean hotX = mx >= cx && mx < cx + 20 && my >= y + 6 && my < y + 26;
		Glass.roundFill(g, cx, y + 6, 20, 20, 6, hotX ? 0xFF3A1519 : OFF);
		Icons.draw(g, "close", cx + 6, y + 12, hotX ? 0xFFFCA5A5 : INK);
		hits.add(new Hit(cx, y + 6, 20, 20, close));
		int ew = g.textWidth("Edit HUD") + 16, ex = cx - 8 - ew;
		boolean hotE = mx >= ex && mx < ex + ew && my >= y + 6 && my < y + 26;
		Glass.roundFill(g, ex, y + 6, ew, 20, 6, hotE ? COBALT : OFF);
		g.text("Edit HUD", ex + 8, y + 12, INK);
		hits.add(new Hit(ex, y + 6, ew, 20, openEditor));
	}

	private void card(Gfx g, Feature f, int index, int x, int y, int w) {
		boolean hotCard = mx >= x && mx < x + w && my >= y && my < y + CARD_H && my >= gy && my < gy + gh && popFeature == null;
		if (hotCard) hoverCard = index;
		String lock = lockReason(f);
		boolean on = f.on() && lock == null;
		Glass.roundFill(g, x, y, w, CARD_H, 7, hotCard ? CARD_HOT : CARD);
		Glass.roundOutline(g, x, y, w, CARD_H, 7, on ? 0x552B4BFF : 0x1FFFFFFF);
		boolean gear = !f.opts.isEmpty() && lock == null;
		int right = x + w - 10;
		int gearX = right - 16;
		int toggleX = (gear ? gearX - 6 : right) - 28;
		int textMax = toggleX - (x + 10) - 6;
		g.text(Glass.fit(g, f.name, 1f, textMax), x + 10, y + 10, lock != null ? DIM : INK);
		String status = lock != null ? "Locked" : on ? "Enabled" : "Disabled";
		Glass.text(g, status, x + 10, y + 25, 0.75f, lock != null ? DIM : on ? ON_TXT : DIM);
		// pill switch: 28 x 14
		int ty = y + (CARD_H - 14) / 2;
		Glass.roundFill(g, toggleX, ty, 28, 14, 7, lock != null ? 0xFF171C28 : on ? COBALT : OFF);
		int kx = on ? toggleX + 28 - 12 : toggleX + 2;
		Glass.roundFill(g, kx, ty + 2, 10, 10, 5, lock != null ? 0xFF3A4152 : 0xFFFFFFFF);
		if (lock == null) {
			final Feature ff = f;
			hits.add(new Hit(x, y, toggleX + 34 - x, CARD_H, () -> ff.toggle()));
			hits.add(new Hit(toggleX - 4, y, 36, CARD_H, () -> ff.toggle()));
		}
		if (gear) {
			boolean open = popFeature == f;
			boolean hg = mx >= gearX - 4 && mx < gearX + 20 && my >= y + 8 && my < y + CARD_H - 8;
			if (open || hg) Glass.roundFill(g, gearX - 2, y + 12, 20, 20, 6, OFF);
			Icons.draw(g, "gear", gearX + 4, y + 18, open ? ON_TXT : hg ? INK : MUTE);
			final Feature ff = f; final int px = x, py = y, pw = w;
			hits.add(new Hit(gearX - 4, y + 8, 24, CARD_H - 16, () -> {
				if (popFeature == ff) { popFeature = null; return; }
				popFeature = ff; popX = px + pw - popW; popY = py + CARD_H + 4;
			}));
		}
	}

	private void footer(Gfx g, int x, int y, int w, int h) {
		int fy = y + h - FOOT_H;
		g.fill(x + 1, fy, x + w - 1, fy + 1, 0x14FFFFFF);
		String adv = "Keybinds, waypoints, support";
		boolean hot = mx >= x + 14 && mx < x + 14 + g.textWidth(adv) && my >= fy + 6 && my < fy + 20;
		g.text(adv, x + 14, fy + 9, hot ? INK : MUTE);
		hits.add(new Hit(x + 14, fy + 4, g.textWidth(adv), 18, openAdvanced));
		String hint = "Esc or Right Ctrl closes";
		g.text(hint, x + w - 14 - g.textWidth(hint), fy + 9, DIM);
	}

	private void popover(Gfx g, int x, int y, int w, int h) {
		Feature f = popFeature;
		int rowsH = 0;
		for (Feature.Opt o : f.opts) rowsH += o.slider() ? 30 : 22;
		popH = 28 + rowsH + 8;
		if (popX < 0) { popX = x + w - 14 - popW; popY = y + BAR_H + 40; }
		int px = Math.max(x + 8, Math.min(popX, x + w - popW - 8));
		int py = popY + popH > y + h - 8 ? Math.max(y + BAR_H + 4, popY - popH - CARD_H - 8) : popY;
		Glass.shadow(g, px, py, popW, popH, 8, 1f);
		Glass.roundFill(g, px, py, popW, popH, 8, 0xFF111623);
		Glass.roundOutline(g, px, py, popW, popH, 8, 0x40FFFFFF);
		g.text(Glass.fit(g, f.name, 1f, popW - 20), px + 10, py + 9, INK);
		popHits.add(new Hit(px, py, popW, popH, () -> {}));   // swallow clicks inside the popover
		int cy = py + 26;
		for (Feature.Opt o : f.opts) {
			float v = Features.optGet(f, o);
			if (o.slider()) {
				String val = (Math.abs(v - Math.round(v)) < 0.001f ? String.valueOf(Math.round(v)) : String.format(Locale.ROOT, "%.1f", v)) + o.unit();
				Glass.text(g, o.label(), px + 10, cy, 0.75f * 1.0f, MUTE);
				Glass.text(g, val, px + popW - 10 - Glass.width(g, val, 0.75f), cy, 0.75f, INK);
				int tx = px + 10, tw = popW - 20, ty = cy + 13;
				float t = (v - o.min()) / (o.max() - o.min());
				Glass.roundFill(g, tx, ty, tw, 4, 2, OFF);
				Glass.roundFill(g, tx, ty, Math.max(4, Math.round(tw * t)), 4, 2, COBALT);
				Glass.roundFill(g, tx + Math.round((tw - 8) * t), ty - 2, 8, 8, 4, 0xFFFFFFFF);
				final Slider s = new Slider(tx, tw, f, o);
				popHits.add(new Hit(tx - 4, ty - 6, tw + 8, 16, () -> { dragging = s; setSlider(s, mx); }));
				cy += 30;
			} else {
				boolean b = v >= 0.5f;
				g.text(Glass.fit(g, o.label(), 1f, popW - 60), px + 10, cy + 3, MUTE);
				int sx = px + popW - 10 - 24;
				Glass.roundFill(g, sx, cy + 1, 24, 12, 6, b ? COBALT : OFF);
				Glass.roundFill(g, b ? sx + 14 : sx + 2, cy + 3, 8, 8, 4, 0xFFFFFFFF);
				final Feature.Opt oo = o;
				popHits.add(new Hit(px + 6, cy - 2, popW - 12, 20, () -> { Features.optSet(f, oo, b ? 0 : 1); Config.save(); }));
				cy += 22;
			}
		}
	}

	private void setSlider(Slider s, double x) {
		float t = (float) Math.max(0, Math.min(1, (x - s.x) / s.w));
		Features.optSet(s.f, s.o, s.o.min() + t * (s.o.max() - s.o.min()));
	}

	// ------------------------------------------------------------------ input
	public boolean click(double x, double y, int button) {
		if (button != 0) return false;
		mx = (int) x; my = (int) y;
		if (popFeature != null) {
			for (int i = popHits.size() - 1; i >= 0; i--) if (popHits.get(i).in(x, y)) { popHits.get(i).r.run(); return true; }
			popFeature = null;   // a click outside the popover closes it and does nothing else
			return true;
		}
		for (int i = hits.size() - 1; i >= 0; i--) {
			Hit h = hits.get(i);
			if (!h.in(x, y)) continue;
			// card hits are clipped to the grid viewport
			boolean inGrid = x >= gx && x < gx + gw && y >= gy && y < gy + gh;
			boolean isChrome = y < gy || y >= gy + gh;
			if (isChrome || inGrid) { h.r.run(); Config.save(); return true; }
		}
		return true;   // the modal swallows every click
	}

	public boolean drag(double x, double y) {
		if (dragging == null) return false;
		setSlider(dragging, x);
		return true;
	}

	public void release() {
		if (dragging != null) { dragging = null; Config.save(); }
	}

	public void scroll(double dy) {
		scroll = Math.max(0, Math.min(maxScroll, scroll - (float) dy * 26));
	}

	/** Returns true when the key was used (Backspace edits the search). */
	public boolean key(int code) {
		if (code == 259 && query.length() > 0) { query.setLength(query.length() - 1); scroll = 0; return true; }   // Backspace
		return false;
	}

	public void type(int codepoint) {
		if (codepoint < 32 || codepoint == 127 || query.length() >= 24) return;
		query.appendCodePoint(codepoint);
		scroll = 0;
		popFeature = null;
	}

	public boolean popoverOpen() { return popFeature != null; }
	public void closePopover() { popFeature = null; }
}
