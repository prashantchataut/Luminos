package dev.luminos.client;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The Luminos quick panel (Right Ctrl). Pure logic + drawing over {@link Gfx}; each Minecraft line's PanelScreen delegates here.
 * Tabs: Modules, HUD, Keybinds, Cosmetics, Performance, Profiles, Screenshot. Typing anywhere searches every tab.
 */
public final class Panel {
	public enum Tab {
		MODULES("Modules"), HUD("HUD"), KEYBINDS("Keybinds"), COSMETICS("Cosmetics"), PERFORMANCE("Performance"), PROFILES("Profiles"), SCREENSHOT("Screenshot");
		final String label;
		Tab(String l) { label = l; }
	}

	record Row(String title, String sub, String badge, boolean active, String reason, Runnable act) {}
	private record Hit(int x, int y, int w, int h, Runnable r) {}

	public static final int W = 400, H = 240;
	private static final int BG = 0xF2070B22, EDGE = 0xFF2B4488, SIDE = 0xFF050818, CARD = 0xFF0F1838, CARD_HOT = 0xFF18265A;
	private static final int ACCENT = 0xFF4F8CFF, TEXT = 0xFFE8EEFF, DIM = 0xFF8596C5, OK = 0xFF5BE3A0, WARN = 0xFFFFC857;

	public Tab tab;
	private final StringBuilder query = new StringBuilder();
	private boolean searchFocus;
	private int page;
	private KeyMapping rebinding;
	private final long openedAt = System.currentTimeMillis();
	private final List<Hit> hits = new ArrayList<>();
	private final Runnable openEditor;
	private float s = 1, ox, oy;
	private String toast = "";
	private long toastAt;

	public Panel(Tab start, boolean focusSearch, Runnable openEditor) {
		this.tab = start;
		this.searchFocus = focusSearch;
		this.openEditor = openEditor;
	}

	// ------------------------------------------------------------------ rows
	private List<Row> rows(Tab t, Minecraft mc) {
		List<Row> r = new ArrayList<>();
		Config cfg = Config.get();
		switch (t) {
			case MODULES -> {
				for (HudModule m : Modules.ALL) {
					Config.ModuleCfg c = cfg.of(m);
					r.add(new Row(m.title(), "HUD module  -  " + (c.enabled ? "visible" : "hidden"), c.enabled ? "ON" : "OFF", c.enabled, null, () -> { c.enabled = !c.enabled; Config.save(); }));
				}
				r.add(new Row("Toggle sprint", "Hold W once, keep sprinting", cfg.toggleSprint ? "ON" : "OFF", cfg.toggleSprint, null, () -> { cfg.toggleSprint = !cfg.toggleSprint; Config.save(); }));
				boolean restricted = Compliance.restricted(mc);
				r.add(new Row("Zoom", restricted ? "Compliance mode" : "Hold C  -  FOV " + cfg.zoomFov, restricted ? "LOCKED" : "FOV " + cfg.zoomFov, !restricted, restricted ? "Disabled by compliance mode on this server" : null,
					() -> { cfg.zoomFov = cfg.zoomFov >= 70 ? 30 : cfg.zoomFov + 10; Config.save(); }));
				r.add(new Row("Freelook", "Look around without turning", "N/A", false, "Not in this build: needs a camera mixin per version", null));
				r.add(new Row("Hit colour", "Tint the damage flash", "N/A", false, "Not in this build: needs a render mixin per version", null));
			}
			case HUD -> {
				r.add(new Row("HUD editor", "Drag, snap, right-click to hide, scroll to resize", "OPEN", true, null, openEditor));
				r.add(new Row("Snap to grid", "4 px grid, screen edges, other modules", cfg.snap ? "ON" : "OFF", cfg.snap, null, () -> { cfg.snap = !cfg.snap; Config.save(); }));
				r.add(new Row("Module backgrounds", "Dark plate behind HUD text", cfg.showBackground ? "ON" : "OFF", cfg.showBackground, null, () -> { cfg.showBackground = !cfg.showBackground; Config.save(); }));
				r.add(new Row("Reset layout", "Put every module back where it started", "RESET", true, null, () -> { cfg.resetLayout(); Config.save(); say("Layout reset"); }));
				r.add(new Row("Layout profile", "Active: " + cfg.activeProfile + "  (Profiles tab)", "PROFILE", true, null, () -> tab = Tab.PROFILES));
			}
			case KEYBINDS -> {
				for (KeyMapping k : LuminosClient.KEYS) {
					boolean waiting = k == rebinding;
					r.add(new Row(net.minecraft.client.resources.language.I18n.get(k.getName()), waiting ? "Press a key, Esc cancels" : "Click to rebind", waiting ? "..." : Nav.keyName(k), true, null, () -> rebinding = k));
				}
				r.add(new Row("Vanilla keybinds", "Synced across instances by the launcher", "SYNC", false, "Managed in the launcher: Settings, Sync", null));
			}
			case COSMETICS -> {
				File dir = new File(FabricLoader.getInstance().getGameDir().toFile(), "luminos-cosmetics/skins");
				File[] skins = dir.listFiles((d, n) -> n.toLowerCase(Locale.ROOT).endsWith(".png"));
				if (skins == null || skins.length == 0) r.add(new Row("No skins found", "Pick one in the launcher, or add PNGs to luminos-cosmetics/skins", "-", false, "Nothing to switch to yet", null));
				else {
					java.util.Arrays.sort(skins);
					for (File f : skins) {
						String n = f.getName();
						boolean on = n.equals(cfg.cosmeticSkin);
						r.add(new Row(n.replace(".png", ""), on ? "Selected, kept across restarts" : "Click to select", on ? "ACTIVE" : "USE", on, null, () -> { cfg.cosmeticSkin = n; Config.save(); say("Skin saved: applies on next join"); }));
					}
				}
				r.add(new Row("Live swap", "Changing skin without rejoining", "N/A", false, "Not in this build: selection applies on next join. Others see it via the Luminos cosmetics service only", null));
			}
			case PERFORMANCE -> {
				Runtime rt = Runtime.getRuntime();
				r.add(new Row("Frame rate", "Right now", mc.getFps() + " FPS", true, null, null));
				r.add(new Row("Memory", ((rt.totalMemory() - rt.freeMemory()) >> 20) + " of " + (rt.maxMemory() >> 20) + " MB", "JVM", true, null, null));
				String[][] mods = {{"sodium", "Sodium"}, {"lithium", "Lithium"}, {"entityculling", "Entity Culling"}, {"immediatelyfast", "ImmediatelyFast"}, {"ferritecore", "FerriteCore"}};
				for (String[] m : mods) {
					boolean on = FabricLoader.getInstance().isModLoaded(m[0]);
					r.add(new Row(m[1], on ? "Loaded" : "Not installed in this instance", on ? "LOADED" : "MISSING", on, null, null));
				}
				r.add(new Row("Luminos title screen", "Off shows the vanilla one", cfg.customTitle ? "ON" : "OFF", cfg.customTitle, null, () -> { cfg.customTitle = !cfg.customTitle; Config.save(); }));
				r.add(new Row("Compliance mode", "Auto turns off zoom on listed servers", Compliance.label().toUpperCase(Locale.ROOT), true, null, Compliance::cycle));
			}
			case PROFILES -> {
				for (String p : Profiles.list()) {
					boolean on = p.equals(cfg.activeProfile);
					r.add(new Row(p, on ? "Active layout" : "Click to switch", on ? "ACTIVE" : "LOAD", on, null, () -> { if (!on) say(Profiles.load(p) ? "Loaded " + p : "Could not load " + p); }));
				}
				r.add(new Row("Save current as new", "Snapshot layout and settings", "NEW", true, null, () -> say("Saved " + Profiles.create())));
				r.add(new Row("Export / import", Profiles.dir().toString(), "FOLDER", false, "Copy .json files in or out of this folder", null));
			}
			case SCREENSHOT -> {
				File dir = new File(FabricLoader.getInstance().getGameDir().toFile(), "screenshots");
				File[] shots = dir.listFiles((d, n) -> n.toLowerCase(Locale.ROOT).endsWith(".png"));
				int n = shots == null ? 0 : shots.length;
				String newest = "none yet";
				long best = -1;
				if (shots != null) for (File f : shots) if (f.lastModified() > best) { best = f.lastModified(); newest = f.getName(); }
				r.add(new Row("Screenshots taken", "In " + dir.getName() + "/", String.valueOf(n), true, null, null));
				r.add(new Row("Latest", newest, "NEW", n > 0, null, null));
				r.add(new Row("Capture", "Press F2 in the world; this panel hides itself first", "F2", false, "Capture button not in this build", null));
			}
		}
		return r;
	}

	private List<Row> visibleRows(Minecraft mc) {
		String q = query.toString().trim().toLowerCase(Locale.ROOT);
		if (q.isEmpty()) return rows(tab, mc);
		List<Row> all = new ArrayList<>();
		for (Tab t : Tab.values()) for (Row row : rows(t, mc)) if ((row.title + " " + row.sub).toLowerCase(Locale.ROOT).contains(q)) all.add(row);
		return all;
	}

	// ------------------------------------------------------------------ drawing
	private float k = 1;

	private int a(int c) {
		int al = Math.max(8, Math.round(((c >>> 24) & 0xFF) * k));
		return (al << 24) | (c & 0xFFFFFF);
	}

	private void say(String m) { toast = m; toastAt = System.currentTimeMillis(); }

	private void box(Gfx g, int x, int y, int w, int h, int fill, int edge) {
		// chamfered corners: a pixel-art look that matches the voxel brand
		g.fill(x + 1, y, x + w - 1, y + h, a(fill));
		g.fill(x, y + 1, x + w, y + h - 1, a(fill));
		if (edge != 0) {
			g.fill(x + 1, y, x + w - 1, y + 1, a(edge));
			g.fill(x + 1, y + h - 1, x + w - 1, y + h, a(edge));
			g.fill(x, y + 1, x + 1, y + h - 1, a(edge));
			g.fill(x + w - 1, y + 1, x + w, y + h - 1, a(edge));
		}
	}

	private static String fit(Gfx g, String t, int max) {
		if (g.textWidth(t) <= max) return t;
		while (t.length() > 1 && g.textWidth(t + "...") > max) t = t.substring(0, t.length() - 1);
		return t + "...";
	}

	private int mx, my;

	public void render(Gfx g, Minecraft mc, int mouseX, int mouseY) {
		float t = Math.min(1f, (System.currentTimeMillis() - openedAt) / 180f);
		k = 1f - (1f - t) * (1f - t) * (1f - t);
		s = Math.min(1f, Math.min(g.width() / (float) (W + 16), g.height() / (float) (H + 16)));
		ox = (g.width() - W * s) / 2f;
		oy = (g.height() - H * s) / 2f + (1f - k) * 10f;
		mx = Math.round((mouseX - ox) / s);
		my = Math.round((mouseY - oy) / s);
		hits.clear();
		g.fill(0, 0, g.width(), g.height(), a(0xB0040612));
		g.push(ox, oy, s);
		box(g, 0, 0, W, H, BG, EDGE);
		g.fill(1, 1, 94, H - 1, a(SIDE));
		g.fill(94, 1, 95, H - 1, a(EDGE));
		// brand
		g.fill(10, 11, 14, 15, a(ACCENT));
		g.fill(14, 15, 18, 19, a(0xFF9CC2FF));
		g.text("LUMINOS", 24, 11, a(TEXT));
		g.text("Quick panel", 12, 24, a(DIM));
		int y = 40;
		for (Tab tb : Tab.values()) {
			boolean act = query.length() == 0 && tb == tab, hot = inside(4, y, 86, 20);
			if (act) { g.fill(4, y, 90, y + 20, a(0xCC1E3A7A)); g.fill(4, y, 6, y + 20, a(ACCENT)); }
			else if (hot) g.fill(4, y, 90, y + 20, a(0x661E3A7A));
			g.text(tb.label, 14, y + 6, a(act ? TEXT : hot ? TEXT : DIM));
			final Tab target = tb;
			hits.add(new Hit(4, y, 86, 20, () -> { tab = target; query.setLength(0); page = 0; rebinding = null; }));
			y += 22;
		}
		g.text("Right Ctrl  toggles", 10, H - 22, a(DIM));
		g.text("Right Shift  searches", 10, H - 12, a(DIM));
		// search
		int sx = 104, sw = W - 116;
		box(g, sx, 8, sw, 18, searchFocus ? 0xFF101C48 : CARD, searchFocus ? ACCENT : 0xFF22346A);
		String shown = query.length() == 0 ? "Search modules, keys, settings" : query.toString();
		boolean caret = searchFocus && (System.currentTimeMillis() / 500) % 2 == 0;
		g.text(fit(g, shown, sw - 16) + (caret ? "_" : ""), sx + 6, 14, a(query.length() == 0 ? DIM : TEXT));
		hits.add(new Hit(sx, 8, sw, 18, () -> searchFocus = true));
		// cards
		List<Row> rows = visibleRows(mc);
		boolean two = query.length() > 0 || tab == Tab.MODULES || tab == Tab.HUD || tab == Tab.PERFORMANCE || tab == Tab.PROFILES;
		int cw = W - 116, cardW = two ? (cw - 6) / 2 : cw, cardH = two ? 32 : 28, pitch = cardH + 6;
		int top = 34, avail = H - top - 28;
		int rowsPerPage = Math.max(1, avail / pitch), perPage = rowsPerPage * (two ? 2 : 1);
		int pages = Math.max(1, (rows.size() + perPage - 1) / perPage);
		page = Math.max(0, Math.min(page, pages - 1));
		for (int i = 0; i < perPage; i++) {
			int idx = page * perPage + i;
			if (idx >= rows.size()) break;
			Row row = rows.get(idx);
			int col = two ? i % 2 : 0, rw = two ? i / 2 : i;
			int x = sx + col * (cardW + 6), yy = top + rw * pitch;
			boolean enabled = row.reason == null && row.act != null;
			boolean hot = enabled && inside(x, yy, cardW, cardH);
			box(g, x, yy, cardW, cardH, hot ? CARD_HOT : CARD, row.active && row.reason == null ? 0xFF35549E : 0xFF1F2E5F);
			g.text(fit(g, row.title, cardW - 60), x + 8, yy + 6, a(enabled || row.act == null && row.reason == null ? TEXT : DIM));
			String sub = row.reason != null ? row.reason : row.sub;
			g.text(fit(g, sub, cardW - 14), x + 8, yy + (cardH - 14), a(row.reason != null ? WARN : DIM));
			int bw = g.textWidth(row.badge) + 10;
			int bc = row.reason != null ? 0xFF3A3A50 : row.active ? 0xFF2C4F9C : 0xFF1B2547;
			g.fill(x + cardW - bw - 6, yy + 5, x + cardW - 6, yy + 17, a(bc));
			g.text(row.badge, x + cardW - bw - 1, yy + 7, a(row.reason != null ? DIM : row.badge.equals("ON") || row.badge.equals("ACTIVE") || row.badge.equals("LOADED") ? OK : TEXT));
			if (enabled) hits.add(new Hit(x, yy, cardW, cardH, row.act));
		}
		if (rows.isEmpty()) g.text("No matches. Try a module name or a key.", sx + 4, top + 8, a(DIM));
		// pager
		int py = H - 20;
		if (pages > 1) {
			g.text("< " + (page + 1) + " / " + pages + " >", sx + cw - 52, py, a(DIM));
			hits.add(new Hit(sx + cw - 56, py - 3, 20, 14, () -> page = Math.max(0, page - 1)));
			hits.add(new Hit(sx + cw - 20, py - 3, 20, 14, () -> page = Math.min(pages - 1, page + 1)));
		}
		if (System.currentTimeMillis() - toastAt < 2200) g.text(toast, sx + 4, py, a(OK));
		else g.text(query.length() > 0 ? rows.size() + " results across all tabs" : "Esc closes", sx + 4, py, a(DIM));
		g.pop();
	}

	private boolean inside(int x, int y, int w, int h) { return mx >= x && mx < x + w && my >= y && my < y + h; }

	// ------------------------------------------------------------------ input
	public boolean click(double mouseX, double mouseY, int button) {
		mx = (int) Math.round((mouseX - ox) / s);
		my = (int) Math.round((mouseY - oy) / s);
		searchFocus = false;
		if (button != 0) return true;
		for (int i = hits.size() - 1; i >= 0; i--) {
			Hit h = hits.get(i);
			if (inside(h.x, h.y, h.w, h.h)) { h.r.run(); return true; }
		}
		return true;
	}

	public void scroll(double dy) { page = Math.max(0, page + (dy < 0 ? 1 : -1)); }

	/** @return true if the panel consumed the key (otherwise the screen may close itself). */
	public boolean key(int code, int panelKeyCode, Object event) {
		if (rebinding != null) {
			if (code != 256) { Nav.rebind(Minecraft.getInstance(), rebinding, event); say("Bound to " + Nav.keyName(rebinding)); }
			rebinding = null;
			return true;
		}
		if (code == 256) {
			if (searchFocus || query.length() > 0) { searchFocus = false; query.setLength(0); return true; }
			return false;
		}
		if (code == panelKeyCode && !searchFocus) return false;
		if (searchFocus) {
			if (code == 259 && query.length() > 0) { query.setLength(query.length() - 1); page = 0; }
			return true;
		}
		return false;
	}

	public void type(int cp) {
		if (rebinding != null) return;
		if (!searchFocus) { searchFocus = true; }
		if (cp >= 32 && cp != 127 && query.length() < 40) { query.appendCodePoint(cp); page = 0; }
	}
}
