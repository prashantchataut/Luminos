package dev.luminos.client;

import dev.luminos.client.core.ColorblindPalette;
import dev.luminos.client.core.CrashAssistant;
import dev.luminos.client.core.LogTail;
import dev.luminos.client.core.ModuleSearch;
import dev.luminos.client.core.ShareCode;
import dev.luminos.client.core.Waypoint;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;

import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

/**
 * The Luminos quick panel (Right Ctrl). Pure logic + drawing over {@link Gfx}; each Minecraft line's PanelScreen delegates here.
 * Tabs: Modules, HUD, Keybinds, Cosmetics, Waypoints, Performance, Profiles, Screenshot, Support. Typing anywhere searches every tab.
 */
public final class Panel {
	public enum Tab {
		MODULES("Modules"), HUD("HUD"), KEYBINDS("Keybinds"), COSMETICS("Cosmetics"), WAYPOINTS("Waypoints"), PERFORMANCE("Performance"), PROFILES("Profiles"), SCREENSHOT("Screenshot"), SUPPORT("Support");
		final String label;
		Tab(String l) { label = l; }
	}

	/** {@code id} is set on HUD-module rows (enables the right-click menu and favourites); {@code swatch} is an optional RGB stripe. */
	record Row(String title, String sub, String badge, boolean active, String reason, Runnable act, String id, int swatch) {
		Row(String title, String sub, String badge, boolean active, String reason, Runnable act) { this(title, sub, badge, active, reason, act, null, 0); }
	}
	private record Hit(int x, int y, int w, int h, Runnable r) {}
	private record RowHit(int x, int y, int w, int h, Row row) {}

	public static final int W = 400, H = 240;
	private static final int BG = 0xF2070B22, EDGE = 0xFF2B4488, SIDE = 0xFF050818, CARD = 0xFF0F1838, CARD_HOT = 0xFF18265A;
	private static final int ACCENT = 0xFF4F8CFF, TEXT = 0xFFE8EEFF, DIM = 0xFF8596C5;

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
	private final List<RowHit> rowHits = new ArrayList<>();
	private final List<Hit> ctxHits = new ArrayList<>();
	private String ctxId;
	private int ctxX, ctxY;
	private boolean showAllDims;
	private List<Row> corpus = List.of();
	private long corpusAt;
	private boolean supportLoaded;
	private CrashAssistant.Diagnosis diagnosis;
	private String diagnosisFile = "";
	private List<String> logLines = List.of();

	private int ok() { return ColorblindPalette.byName(Config.get().colorblind).ok; }
	private int warn() { return ColorblindPalette.byName(Config.get().colorblind).warn; }

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
				List<HudModule> ordered = ModuleSearch.applyOrder(Modules.ALL, cfg.moduleOrder, HudModule::id);
				for (HudModule m : ModuleSearch.rank("", ordered, HudModule::id, HudModule::title, x -> "", new HashSet<>(cfg.favourites))) {
					Config.ModuleCfg c = cfg.of(m);
					String fav = cfg.favourites.contains(m.id()) ? "FAV  -  " : "";
					r.add(new Row(m.title(), fav + "HUD module  -  " + (c.enabled ? "visible" : "hidden"), c.enabled ? "ON" : "OFF", c.enabled, null,
						() -> { c.enabled = !c.enabled; Config.save(); }, m.id(), 0));
				}
				r.add(new Row("Toggle sprint", "Tap W once, keep sprinting", cfg.toggleSprint ? "ON" : "OFF", cfg.toggleSprint, null, () -> { cfg.toggleSprint = !cfg.toggleSprint; Config.save(); }));
				boolean restricted = Compliance.restricted(mc);
				r.add(new Row("Zoom", restricted ? "Compliance mode" : "Hold C  -  FOV " + cfg.zoomFov, restricted ? "LOCKED" : "FOV " + cfg.zoomFov, !restricted, restricted ? "Disabled by compliance mode on this server" : null,
					() -> { cfg.zoomFov = cfg.zoomFov >= 70 ? 30 : cfg.zoomFov + 10; Config.save(); }));
				r.add(new Row("Freelook", "Look around without turning", "N/A", false, "Not in this build: needs a camera mixin per version", null));
				r.add(new Row("Hit colour", "Tint the damage flash", "N/A", false, "Not in this build: needs a render mixin per version", null));
			}
			case HUD -> {
				r.add(new Row("HUD editor", "Drag, snap, hide, resize", "OPEN", true, null, openEditor));
				r.add(new Row("Snap to grid", "Grid, edges, other modules", cfg.snap ? "ON" : "OFF", cfg.snap, null, () -> { cfg.snap = !cfg.snap; Config.save(); }));
				r.add(new Row("Module backgrounds", "Plate behind HUD text", cfg.showBackground ? "ON" : "OFF", cfg.showBackground, null, () -> { cfg.showBackground = !cfg.showBackground; Config.save(); }));
				r.add(new Row("Copy layout code", "Share this HUD layout as text (LUM1-...)", "COPY", true, null, () -> copyLayout(mc)));
				r.add(new Row("Import layout code", "Reads a code from the clipboard", "PASTE", true, null, () -> importLayout(mc)));
				r.add(new Row("Reset layout", "Restore the default layout", "RESET", true, null, () -> { cfg.resetLayout(); Config.save(); say("Layout reset"); }));
				r.add(new Row("Layout profile", "Active: " + cfg.activeProfile, "PROFILE", true, null, () -> tab = Tab.PROFILES));
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
			case WAYPOINTS -> {
				boolean inWorld = mc.player != null && mc.level != null;
				r.add(new Row("Add waypoint here", inWorld ? "Saves your position in this dimension" : "Join a world first", "ADD", inWorld, inWorld ? null : "No world loaded",
					inWorld ? () -> { Waypoint w = WaypointStore.addHere(mc); say(w == null ? "Could not save" : "Saved " + w.name()); } : null));
				String dim = WaypointStore.dimension(mc);
				r.add(new Row("Other dimensions", showAllDims ? "Showing every dimension" : "Showing " + Waypoint.dimensionLabel(dim) + " only", showAllDims ? "ALL" : "HERE", true, null, () -> showAllDims = !showAllDims));
				double px = inWorld ? mc.player.getX() : 0, py = inWorld ? mc.player.getY() : 0, pz = inWorld ? mc.player.getZ() : 0;
				List<Waypoint> list = new ArrayList<>(inWorld ? Waypoint.nearest(WaypointStore.all(), dim, px, py, pz) : List.of());
				if (showAllDims || !inWorld) for (Waypoint w : WaypointStore.all()) if (!list.contains(w)) list.add(w);
				for (Waypoint w : list) {
					String where = Waypoint.dimensionLabel(w.dimension()) + (inWorld && w.dimension().equals(dim) ? "  -  " + Waypoint.distanceLabel(w.distance(px, py, pz)) : "");
					r.add(new Row(w.name(), where + "  -  click to delete", "DEL", true, null, () -> { WaypointStore.remove(w); say("Deleted " + w.name()); }, null, w.rgb()));
				}
				if (list.isEmpty()) r.add(new Row("No waypoints yet", "Add one above. They are kept per dimension", "-", false, null, null));
			}
			case SUPPORT -> {
				if (!supportLoaded) loadSupport();
				Path reqFile = FabricLoader.getInstance().getGameDir().resolve("luminos-fix-request.json");
				if (diagnosis != null) {
					CrashAssistant.Diagnosis d = diagnosis;
					r.add(new Row(d.title(), d.cause(), "CRASH", false, null, null));
					boolean fixable = !"none".equals(d.fixAction());
					r.add(new Row("What to do", d.fix(), fixable ? "FIX" : "-", fixable, null, fixable ? () -> {
						try { Files.writeString(reqFile, CrashAssistant.fixRequestJson(d)); say("Saved luminos-fix-request.json for the launcher"); }
						catch (java.io.IOException e) { say("Could not save the fix request"); }
					} : null));
				} else {
					r.add(new Row(diagnosisFile.isEmpty() ? "No crash reports" : "Last crash not recognised", diagnosisFile.isEmpty() ? "crash-reports/ is empty" : diagnosisFile, diagnosisFile.isEmpty() ? "OK" : "?", diagnosisFile.isEmpty(), null, null));
				}
				r.add(new Row("Copy log tail", logLines.size() + " warnings and errors from latest.log", "COPY", !logLines.isEmpty(), logLines.isEmpty() ? "Nothing to copy" : null,
					logLines.isEmpty() ? null : () -> { mc.keyboardHandler.setClipboard(String.join("\n", logLines)); say("Copied " + logLines.size() + " lines"); }));
				for (int i = Math.max(0, logLines.size() - 4); i < logLines.size(); i++) {
					String line = logLines.get(i);
					boolean err = LogTail.level(line) == LogTail.Level.ERROR;
					r.add(new Row(line, err ? "ERROR  -  click to copy" : "WARN  -  click to copy", err ? "ERROR" : "WARN", false, null, () -> { mc.keyboardHandler.setClipboard(line); say("Copied"); }));
				}
				r.add(new Row("Refresh", "Read crash-reports and latest.log again", "RELOAD", true, null, () -> supportLoaded = false));
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
				r.add(new Row("Colour-blind palette", "Status colours in this panel", cfg.colorblind.replace('_', ' '), true, null, () -> {
					ColorblindPalette[] all = ColorblindPalette.values();
					cfg.colorblind = all[(ColorblindPalette.byName(cfg.colorblind).ordinal() + 1) % all.length].name();
					Config.save();
				}));
				r.add(new Row("Compliance mode", "Auto locks zoom on listed servers", Compliance.label().toUpperCase(Locale.ROOT), true, null, Compliance::cycle));
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
				r.add(new Row("Capture", "F2 in the world", "F2", false, "Capture button not in this build", null));
			}
		}
		return r;
	}

	private List<Row> visibleRows(Minecraft mc) {
		String q = query.toString().trim();
		if (q.isEmpty()) return rows(tab, mc);
		long now = System.currentTimeMillis();
		if (now - corpusAt > 500) {   // building every tab's rows touches the disk (skins, screenshots); do it twice a second, not every frame
			List<Row> all = new ArrayList<>();
			for (Tab t : Tab.values()) all.addAll(rows(t, mc));
			corpus = all;
			corpusAt = now;
		}
		return ModuleSearch.rank(q, corpus, r -> r.id != null ? r.id : r.title, r -> r.title, r -> r.sub, new HashSet<>(Config.get().favourites));
	}

	// ------------------------------------------------------------------ CI smoke tour hooks (no effect unless LUMINOS_SMOKE drives them)
	public void smokeSearch(String q) { query.setLength(0); query.append(q); searchFocus = true; page = 0; }

	public void smokeContext(String moduleId) { ctxId = moduleId; ctxX = 200; ctxY = 62; }

	// ------------------------------------------------------------------ helpers
	private void loadSupport() {
		supportLoaded = true;
		corpusAt = 0;
		diagnosis = null;
		diagnosisFile = "";
		Path game = FabricLoader.getInstance().getGameDir();
		try {
			File[] crashes = game.resolve("crash-reports").toFile().listFiles((d, n) -> n.endsWith(".txt"));
			File newest = null;
			if (crashes != null) for (File f : crashes) if (newest == null || f.lastModified() > newest.lastModified()) newest = f;
			if (newest != null) {
				diagnosisFile = newest.getName();
				try (InputStream in = Files.newInputStream(newest.toPath())) {
					diagnosis = CrashAssistant.analyse(new String(in.readNBytes(256 * 1024), StandardCharsets.UTF_8)).orElse(null);
				}
			}
		} catch (Exception e) {
			LuminosClient.LOGGER.warn("crash report scan failed", e);
		}
		try {
			Path log = game.resolve("logs/latest.log");
			logLines = Files.exists(log) ? LogTail.tail(log, 40, LogTail.Level.WARN) : List.of();
		} catch (Exception e) {
			logLines = List.of();
		}
	}

	private void copyLayout(Minecraft mc) {
		List<ShareCode.Entry> entries = new ArrayList<>();
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			entries.add(new ShareCode.Entry(m.id(), c.enabled, c.x, c.y, c.scale));
		}
		mc.keyboardHandler.setClipboard(ShareCode.encode(entries));
		say("Layout code copied (" + entries.size() + " modules)");
	}

	private void importLayout(Minecraft mc) {
		try {
			List<ShareCode.Entry> entries = ShareCode.decode(mc.keyboardHandler.getClipboard());
			int applied = 0, skipped = 0;
			for (ShareCode.Entry e : entries) {
				HudModule m = moduleById(e.id());
				if (m == null) { skipped++; continue; }
				Config.ModuleCfg c = Config.get().of(m);
				c.enabled = e.enabled(); c.x = e.x(); c.y = e.y(); c.scale = e.scale();
				applied++;
			}
			Config.save();
			say("Imported " + applied + " modules" + (skipped > 0 ? ", skipped " + skipped + " unknown" : ""));
		} catch (IllegalArgumentException ex) {
			say(ex.getMessage());
		}
	}

	private static HudModule moduleById(String id) {
		for (HudModule m : Modules.ALL) if (m.id().equals(id)) return m;
		return null;
	}

	private void ctxAction(String label, int index, Runnable r, Gfx g) {
		int x = ctxX, y = ctxY + 3 + index * 14;
		boolean hot = inside(x, y, 112, 14);
		if (hot) g.fill(x + 2, y, x + 110, y + 14, a(0xCC1E3A7A));
		g.text(label, x + 8, y + 3, a(hot ? TEXT : DIM));
		ctxHits.add(new Hit(x, y, 112, 14, () -> { r.run(); Config.save(); corpusAt = 0; }));
	}

	private void drawContext(Gfx g) {
		ctxHits.clear();
		HudModule m = ctxId == null ? null : moduleById(ctxId);
		if (m == null) { ctxId = null; return; }
		Config cfg = Config.get();
		Config.ModuleCfg c = cfg.of(m);
		boolean fav = cfg.favourites.contains(m.id());
		box(g, ctxX, ctxY, 112, 3 + 7 * 14 + 3, 0xFF0B1230, ACCENT);
		ctxAction(c.enabled ? "Hide module" : "Show module", 0, () -> { c.enabled = !c.enabled; say(m.title() + (c.enabled ? " shown" : " hidden")); ctxId = null; }, g);
		ctxAction(fav ? "Remove favourite" : "Add favourite", 1, () -> { ModuleSearch.toggle(cfg.favourites, m.id()); say(fav ? "Removed from favourites" : "Pinned to the top"); ctxId = null; }, g);
		ctxAction("Smaller", 2, () -> { c.scale = Math.max(0.5f, Math.round((c.scale - 0.1f) * 10) / 10f); say("Scale " + c.scale); ctxId = null; }, g);
		ctxAction("Bigger", 3, () -> { c.scale = Math.min(2f, Math.round((c.scale + 0.1f) * 10) / 10f); say("Scale " + c.scale); ctxId = null; }, g);
		ctxAction("Move up", 4, () -> { cfg.moduleOrder = new ArrayList<>(ModuleSearch.move(Modules.ALL, cfg.moduleOrder, HudModule::id, m.id(), -1)); ctxId = null; }, g);
		ctxAction("Move down", 5, () -> { cfg.moduleOrder = new ArrayList<>(ModuleSearch.move(Modules.ALL, cfg.moduleOrder, HudModule::id, m.id(), 1)); ctxId = null; }, g);
		ctxAction("Reset position", 6, () -> { c.x = m.defaultX(); c.y = m.defaultY(); c.scale = 1f; say("Reset " + m.title()); ctxId = null; }, g);
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
		rowHits.clear();
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
			boolean act = query.length() == 0 && tb == tab, hot = inside(4, y, 86, 17);
			if (act) { g.fill(4, y, 90, y + 17, a(0xCC1E3A7A)); g.fill(4, y, 6, y + 17, a(ACCENT)); }
			else if (hot) g.fill(4, y, 90, y + 17, a(0x661E3A7A));
			g.text(tb.label, 14, y + 5, a(act ? TEXT : hot ? TEXT : DIM));
			final Tab target = tb;
			hits.add(new Hit(4, y, 86, 17, () -> { tab = target; query.setLength(0); page = 0; rebinding = null; ctxId = null; supportLoaded = false; }));
			y += 19;
		}
		g.text("RCtrl: panel", 10, H - 24, a(DIM));
		g.text("RShift: search", 10, H - 13, a(DIM));
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
			boolean hot = enabled && ctxId == null && inside(x, yy, cardW, cardH);
			rowHits.add(new RowHit(x, yy, cardW, cardH, row));
			box(g, x, yy, cardW, cardH, hot ? CARD_HOT : CARD, row.active && row.reason == null ? 0xFF35549E : 0xFF1F2E5F);
			int bw = g.textWidth(row.badge) + 10;
			g.text(fit(g, row.title, cardW - bw - 22), x + 8, yy + 4, a(enabled || row.act == null && row.reason == null ? TEXT : DIM));
			String sub = row.reason != null ? row.reason : row.sub;
			g.text(fit(g, sub, cardW - 14), x + 8, yy + (cardH - 12), a(row.reason != null ? warn() : DIM));
			int bc = row.reason != null ? 0xFF3A3A50 : row.active ? 0xFF2C4F9C : 0xFF1B2547;
			g.fill(x + cardW - bw - 6, yy + 5, x + cardW - 6, yy + 17, a(bc));
			g.text(row.badge, x + cardW - bw - 1, yy + 7, a(row.reason != null ? DIM : row.badge.equals("ON") || row.badge.equals("ACTIVE") || row.badge.equals("LOADED") ? ok() : TEXT));
			if (row.swatch != 0) g.fill(x + 2, yy + 4, x + 5, yy + cardH - 4, a(0xFF000000 | row.swatch));
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
		if (System.currentTimeMillis() - toastAt < 2200) g.text(fit(g, toast, cw - (pages > 1 ? 64 : 4)), sx + 4, py, a(ok()));
		else g.text(query.length() > 0 ? rows.size() + " results across all tabs" : tab == Tab.MODULES ? "Right-click a module for options  -  Esc closes" : "Esc closes", sx + 4, py, a(DIM));
		if (ctxId != null) drawContext(g);
		g.pop();
	}

	private boolean inside(int x, int y, int w, int h) { return mx >= x && mx < x + w && my >= y && my < y + h; }

	// ------------------------------------------------------------------ input
	public boolean click(double mouseX, double mouseY, int button) {
		mx = (int) Math.round((mouseX - ox) / s);
		my = (int) Math.round((mouseY - oy) / s);
		if (ctxId != null) {   // a menu is open: it takes the click, and any click outside closes it
			for (int i = ctxHits.size() - 1; i >= 0; i--) {
				Hit h = ctxHits.get(i);
				if (inside(h.x, h.y, h.w, h.h)) { h.r.run(); ctxId = null; return true; }
			}
			ctxId = null;
			return true;
		}
		searchFocus = false;
		if (button == 1) {
			for (RowHit rh : rowHits) {
				if (rh.row.id != null && moduleById(rh.row.id) != null && inside(rh.x, rh.y, rh.w, rh.h)) {
					ctxId = rh.row.id;
					ctxX = Math.max(100, Math.min(W - 116, mx));
					ctxY = Math.max(30, Math.min(H - 108, my));
					return true;
				}
			}
			return true;
		}
		if (button != 0) return true;
		corpusAt = 0;
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
		if (code == 256 && ctxId != null) { ctxId = null; return true; }
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
