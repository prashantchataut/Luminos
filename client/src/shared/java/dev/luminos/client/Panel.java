package dev.luminos.client;

import dev.luminos.client.core.ClickStats;
import dev.luminos.client.core.CrashAssistant;
import dev.luminos.client.core.FpsDoctor;
import dev.luminos.client.core.HudPresets;
import dev.luminos.client.core.LogTail;
import dev.luminos.client.core.ModuleSearch;
import dev.luminos.client.core.RendererAdvisor;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The Luminos quick panel (Right Ctrl). Liquid-glass surface, icon rail, search focused on open, grouped collapsible module list
 * (HUD, PvP, Visuals, Utility, Performance) with counts, 22 px rows (icon, name, one-line description, switch) and a right-click
 * popover for per-module settings. Type scale: label 0.75, body 1.0, panel title 1.5. One accent colour.
 */
public final class Panel {
	public enum Tab {
		MODULES("Modules", "grid"), HUD("HUD layout", "layout"), KEYBINDS("Keybinds", "keys"), COSMETICS("Cosmetics", "shirt"), WAYPOINTS("Waypoints", "pin"),
		PERFORMANCE("Performance", "bolt"), PROFILES("Profiles", "layers"), SUPPORT("Support", "lifebuoy");
		final String label, icon;
		Tab(String l, String i) { label = l; icon = i; }
	}

	interface Painter { void paint(Gfx g, int x, int y, int w, int h); }

	/** One list row. {@code id} set = a Feature (right-click opens its popover). {@code painter} set = custom card of height {@code h}. */
	record Row(String title, String sub, String badge, boolean active, String reason, Runnable act, String id, int swatch, String icon, Painter painter, int h) {
		Row(String title, String sub, String badge, boolean active, String reason, Runnable act) { this(title, sub, badge, active, reason, act, null, 0, null, null, rowH()); }
		Row(String title, String sub, String badge, boolean active, String reason, Runnable act, String icon) { this(title, sub, badge, active, reason, act, null, 0, icon, null, rowH()); }
		Row(String title, String sub, String badge, boolean active, String reason, Runnable act, String id, int swatch) { this(title, sub, badge, active, reason, act, id, swatch, null, null, rowH()); }
		/** Comfortable: 30 px rows, Compact (default): 24 px. Nothing else changes between the two. */
	static int rowH() { return Config.get().comfortable ? 30 : 24; }
	static Row card(String title, int h, Painter p) { return new Row(title, "", "", true, null, null, null, 0, null, p, h); }
	}

	private record Hit(int x, int y, int w, int h, Runnable r) {}
	private record RowHit(int x, int y, int w, int h, Row row) {}
	private record SliderHit(int x, int y, int w, int h, Feature f, Feature.Opt o) {}
	private sealed interface Item permits Head, Line {}
	private record Head(String key, String label, String icon, String count, boolean open) implements Item {}
	private record Line(Row row) implements Item {}

	public static final int W = 330, H = 236, RAIL = 32;
	private static final Feature.Group[] ORDER = Feature.Group.values();

	public Tab tab;
	private final StringBuilder query = new StringBuilder();
	private boolean searchFocus = true;   // search-first: the panel always opens with the field focused
	private KeyMapping rebinding;
	private final Runnable openEditor;
	private float s = 1, ox, oy;
	private int mx, my;
	private String toast = "";
	private long toastAt;
	private final List<Hit> hits = new ArrayList<>();
	private final List<RowHit> rowHits = new ArrayList<>();
	private final List<SliderHit> sliderHits = new ArrayList<>();
	private final List<Hit> popHits = new ArrayList<>();
	private final Set<String> open = new LinkedHashSet<>(Set.of(Feature.Group.HUD.name()));
	private float scrollTarget;
	private String popId;
	private int popX, popY, popW = 168, popH;
	private SliderHit dragging;
	private String tooltip;
	private boolean showAllDims, supportLoaded;
	private CrashAssistant.Diagnosis diagnosis;
	private String diagnosisFile = "";
	private List<String> logLines = List.of();
	private List<Row> corpus = List.of();
	private long corpusAt;

	private int ok() { return Glass.OK; }

	public Panel(Tab start, boolean focusSearch, Runnable openEditor) {
		this.tab = start;
		this.openEditor = openEditor;
		Anim.snap("open", 0f);
		Anim.forget("scroll");
		Anim.forget("tg.");
		Glass.probeOs();
	}

	// ------------------------------------------------------------------ rows for the non-module tabs
	private static String yn(boolean b) { return b ? "ON" : "OFF"; }

	private Row featureRow(Feature f, Minecraft mc) {
		String lock = f.lock == null ? null : f.lock.apply(mc);
		boolean fav = Config.get().favourites.contains(f.id);
		return new Row(f.name, lock != null ? lock : f.desc, lock != null ? "LOCKED" : yn(f.on()), f.on() && lock == null, lock, lock != null ? null : f::toggle, f.id, 0, f.icon, null, Row.rowH());
	}

	private List<Row> rows(Tab t, Minecraft mc) {
		List<Row> r = new ArrayList<>();
		Config cfg = Config.get();
		switch (t) {
			case MODULES -> {
				for (Feature f : Features.ALL) r.add(featureRow(f, mc));
			}
			case HUD -> {
				r.add(Row.card("HUD preset", 36, (g, x, y, w, h) -> presetChips(g, x, y, w)));
				r.add(new Row("HUD editor", "Drag to move, snaps to a grid and to other modules", "OPEN", true, null, openEditor, "layout"));
				r.add(new Row("Snap to grid", "Grid, screen edges and other modules", yn(cfg.snap), cfg.snap, null, () -> { cfg.snap = !cfg.snap; Config.save(); }, "grid"));
				r.add(new Row("Glass plates", "A smoked-glass plate behind every HUD module", yn(cfg.showBackground), cfg.showBackground, null, () -> { cfg.showBackground = !cfg.showBackground; Config.save(); }, "layers"));
				r.add(new Row("Copy layout code", "Share this layout as text (LUM1-...)", "COPY", true, null, () -> copyLayout(mc), "reset"));
				r.add(new Row("Import layout code", "Reads a code from the clipboard", "PASTE", true, null, () -> importLayout(mc), "reset"));
				r.add(new Row("Reset layout", "Back to the minimal preset", "RESET", true, null, () -> { Features.applyPreset("minimal"); say("Layout reset to Minimal"); }, "reset"));
				r.add(new Row("Layout profile", "Active: " + cfg.activeProfile, "SWITCH", true, null, () -> tab = Tab.PROFILES, "layers"));
			}
			case KEYBINDS -> {
				for (KeyMapping k : LuminosClient.KEYS) {
					boolean waiting = k == rebinding;
					r.add(new Row(net.minecraft.client.resources.language.I18n.get(k.getName()), waiting ? "Press a key, Esc cancels" : "Click to rebind", waiting ? "..." : Nav.keyName(k), true, null, () -> rebinding = k, "keys"));
				}
				r.add(note("Vanilla keybinds sync across instances through the launcher (Settings, Sync)."));
			}
			case COSMETICS -> {
				File dir = new File(FabricLoader.getInstance().getGameDir().toFile(), "luminos-cosmetics/skins");
				File[] skins = dir.listFiles((d, n) -> n.toLowerCase(Locale.ROOT).endsWith(".png"));
				if (skins == null || skins.length == 0) r.add(new Row("No skins yet", "Pick one in the launcher, or add PNGs to luminos-cosmetics/skins", "-", false, null, null, "shirt"));
				else {
					java.util.Arrays.sort(skins);
					for (File f : skins) {
						String n = f.getName();
						boolean on = n.equals(cfg.cosmeticSkin);
						r.add(new Row(n.replace(".png", ""), on ? "Selected" : "Click to select", on ? "ACTIVE" : "USE", on, null, () -> { cfg.cosmeticSkin = n; Config.save(); say("Skin saved: applies on next join"); }, "shirt"));
					}
				}
				r.add(note("A skin applies on your next join. Other players see it only through the Luminos cosmetics service."));
			}
			case WAYPOINTS -> {
				boolean inWorld = mc.player != null && mc.level != null;
				r.add(new Row("Add waypoint here", inWorld ? "Saves your position in this dimension" : "Join a world first", "ADD", inWorld, inWorld ? null : "Join a world first",
						inWorld ? () -> { Waypoint w = WaypointStore.addHere(mc); say(w == null ? "Could not save" : "Saved " + w.name()); } : null, "pin"));
				String dim = WaypointStore.dimension(mc);
				r.add(new Row("Other dimensions", showAllDims ? "Showing every dimension" : "Showing " + Waypoint.dimensionLabel(dim) + " only", showAllDims ? "ALL" : "HERE", true, null, () -> showAllDims = !showAllDims, "layers"));
				double px = inWorld ? mc.player.getX() : 0, py = inWorld ? mc.player.getY() : 0, pz = inWorld ? mc.player.getZ() : 0;
				List<Waypoint> list = new ArrayList<>(inWorld ? Waypoint.nearest(WaypointStore.all(), dim, px, py, pz) : List.of());
				if (showAllDims || !inWorld) for (Waypoint w : WaypointStore.all()) if (!list.contains(w)) list.add(w);
				for (Waypoint w : list) {
					String where = Waypoint.dimensionLabel(w.dimension()) + (inWorld && w.dimension().equals(dim) ? "  -  " + Waypoint.distanceLabel(w.distance(px, py, pz)) : "");
					r.add(new Row(w.name(), where, "DELETE", true, null, () -> { WaypointStore.remove(w); say("Deleted " + w.name()); }, null, w.rgb()));
				}
				if (list.isEmpty()) r.add(note("No waypoints yet. Add one above; they are kept per dimension."));
			}
			case SUPPORT -> {
				if (!supportLoaded) loadSupport();
				Path reqFile = FabricLoader.getInstance().getGameDir().resolve("luminos-fix-request.json");
				if (diagnosis != null) {
					CrashAssistant.Diagnosis d = diagnosis;
					r.add(new Row(d.title(), d.cause(), "CRASH", false, null, null, "lifebuoy"));
					boolean fixable = !"none".equals(d.fixAction());
					r.add(new Row("What to do", d.fix(), fixable ? "FIX" : "-", fixable, null, fixable ? () -> {
						try { Files.writeString(reqFile, CrashAssistant.fixRequestJson(d)); say("Saved luminos-fix-request.json for the launcher"); }
						catch (java.io.IOException e) { say("Could not save the fix request"); }
					} : null, "check"));
				} else {
					r.add(new Row(diagnosisFile.isEmpty() ? "No crash reports" : "Last crash not recognised", diagnosisFile.isEmpty() ? "crash-reports/ is empty" : diagnosisFile, diagnosisFile.isEmpty() ? "OK" : "?", diagnosisFile.isEmpty(), null, null, "lifebuoy"));
				}
				r.add(new Row("Copy log tail", logLines.size() + " warnings and errors from latest.log", "COPY", !logLines.isEmpty(), logLines.isEmpty() ? "Nothing to copy" : null,
						logLines.isEmpty() ? null : () -> { mc.keyboardHandler.setClipboard(String.join("\n", logLines)); say("Copied " + logLines.size() + " lines"); }, "reset"));
				for (int i = Math.max(0, logLines.size() - 3); i < logLines.size(); i++) {
					String line = logLines.get(i);
					boolean err = LogTail.level(line) == LogTail.Level.ERROR;
					r.add(new Row(line, (err ? "ERROR" : "WARN") + "  -  click to copy", err ? "ERROR" : "WARN", false, null, () -> { mc.keyboardHandler.setClipboard(line); say("Copied"); }, "debug"));
				}
				r.add(new Row("Refresh", "Read crash-reports and latest.log again", "RELOAD", true, null, () -> supportLoaded = false, "reset"));
			}
			case PERFORMANCE -> {
				r.add(Row.card("Why is my FPS low?", 56, (g, x, y, w, h) -> doctorCard(g, x, y, w, mc)));
				r.add(Row.card("Click test", 70, (g, x, y, w, h) -> clickTest(g, x, y, w)));
				String gpu = Probes.gpu();
				boolean shaders = Probes.loaded("iris") || Probes.loaded("oculus");
				for (RendererAdvisor.Rec rec : RendererAdvisor.advise(gpu, Probes.vulkanRuntime(), Probes.loaded("sodium"), Probes.loaded("vulkanmod"), Probes.loaded("nvidium"), shaders))
					r.add(Row.card(rec.name(), 40, (g, x, y, w, h) -> rendererRow(g, x, y, w, rec)));
				r.add(note("GPU: " + gpu + ". Luminos never installs a renderer by itself; change it in the launcher."));
				r.add(Row.card("Performance mods", 34, (g, x, y, w, h) -> modChips(g, x, y, w)));
				r.add(new Row("Compliance mode", "Auto turns advantage-capable modules off on listed servers", Compliance.label().toUpperCase(Locale.ROOT), true, null, Compliance::cycle, "lock"));
				r.add(new Row("Colour-blind palette", "Status colours in this panel", cfg.colorblind.replace('_', ' '), true, null, () -> {
					var all = dev.luminos.client.core.ColorblindPalette.values();
					cfg.colorblind = all[(dev.luminos.client.core.ColorblindPalette.byName(cfg.colorblind).ordinal() + 1) % all.length].name();
					Config.save();
				}, "eye"));
				if (cfg.devTools) r.add(Row.card("Startup profile", 34, (g, x, y, w, h) -> startupCard(g, x, y)));
				r.add(new Row("Developer tools", "Shows the startup profile card", yn(cfg.devTools), cfg.devTools, null, () -> { cfg.devTools = !cfg.devTools; Config.save(); }, "debug"));
			}
			case PROFILES -> {
				for (String p : Profiles.list()) {
					boolean on = p.equals(cfg.activeProfile);
					r.add(new Row(p, on ? "Active layout" : "Click to switch", on ? "ACTIVE" : "LOAD", on, null, () -> { if (!on) say(Profiles.load(p) ? "Loaded " + p : "Could not load " + p); }, "layers"));
				}
				r.add(new Row("Save current as new", "Snapshot layout and settings", "NEW", true, null, () -> say("Saved " + Profiles.create()), "star"));
				r.add(note("Export or import by copying .json files in " + Profiles.dir()));
			}
		}
		return r;
	}

	private static Row note(String text) { return Row.card(text, 8 + 8 * Math.max(1, (text.length() + 55) / 56), null); }

	// ------------------------------------------------------------------ custom cards
	private void presetChips(Gfx g, int x, int y, int w) {
		Glass.text(g, Glass.fit(g, "Start from a preset. Minimal keeps five modules and leaves space around them.", Glass.LABEL, (w - 16)), x + 8, y + 5, Glass.LABEL, Glass.INK3);
		int cw = (w - 16 - 8) / 3;
		for (int i = 0; i < HudPresets.NAMES.size(); i++) {
			String n = HudPresets.NAMES.get(i);
			int cx = x + 8 + i * (cw + 4), cy = y + 17;
			boolean act = n.equals(Config.get().hudPreset), hot = inside(cx, cy, cw, 14);
			Glass.card(g, cx, cy, cw, 14, 4, act ? 1f : hot ? 0.6f : 0f);
			if (act) Glass.roundOutline(g, cx, cy, cw, 14, 4, Glass.alpha(Glass.ACCENT, 0.8f));
			String l = HudPresets.label(n);
			Glass.text(g, l, cx + (cw - g.textWidth(l)) / 2f, cy + 3, 1f, act ? Glass.INK : Glass.INK2);
			addHit(cx, cy, cw, 14, () -> { Features.applyPreset(n); say(HudPresets.label(n) + " preset applied"); });
		}
	}

	private void doctorCard(Gfx g, int x, int y, int w, Minecraft mc) {
		var sum = Probes.FRAMES.summary();
		double avg = sum.avgFps() > 0 ? sum.avgFps() : mc.getFps();
		FpsDoctor.Advice a = Probes.advice(mc, avg, sum.p99Ms());
		Icons.draw(g, "bolt", x + 8, y + 7, "ok".equals(a.id()) ? Glass.OK : Glass.WARN);
		g.text("Why is my FPS low?", x + 22, y + 5, Glass.INK);
		int ly = y + 16;
		for (String line : Glass.wrap(g, a.change(), 1f, w - 30, 2)) { Glass.text(g, line, x + 22, ly, 1f, "ok".equals(a.id()) ? Glass.INK2 : Glass.WARN); ly += 9; }
		for (String line : Glass.wrap(g, a.why(), Glass.LABEL, w - 30, 2)) { Glass.text(g, line, x + 22, ly + 2, Glass.LABEL, Glass.INK3); ly += 8; }
	}

	private void clickTest(Gfx g, int x, int y, int w) {
		ClickStats st = InputSampler.stats();
		long now = System.nanoTime();
		st.onFrame(now);
		boolean hot = inside(x, y, w, 70);
		Icons.draw(g, "pointer", x + 8, y + 7, Glass.INK);
		g.text("Click test", x + 22, y + 5, Glass.INK);
		int cy = y + 16;
		for (String line : Glass.wrap(g, "Click this card as fast as you can. Vanilla merges presses that land inside one 50 ms tick; Luminos counts each one.", Glass.LABEL, w - 30, 2)) { Glass.text(g, line, x + 22, cy, Glass.LABEL, Glass.INK3); cy += 8; }
		int cw = (w - 24) / 3, by = y + 38;
		stat(g, x + 8, by, "Raw input", st.rawPerSecond(now) + "/s", Glass.INK);
		stat(g, x + 8 + cw, by, "Vanilla tick", st.tickPerSecond(now) + "/s", Glass.INK2);
		stat(g, x + 8 + cw * 2, by, "Wait tick / frame", st.samples() == 0 ? "-" : String.format(Locale.ROOT, "%.0f / %.0f ms", st.avgTickWaitMs(), st.avgFrameWaitMs()), Glass.OK);
		addHit(x, y, w, 70, () -> st.press(System.nanoTime()));
		if (hot) Glass.roundOutline(g, x, y, w, 70, 4, 0x30FFFFFF);
	}

	private void stat(Gfx g, int x, int y, String label, String value, int color) {
		Glass.text(g, label, x, y, Glass.LABEL, Glass.INK3);
		Glass.text(g, value, x, y + 8, value.length() > 6 ? Glass.LABEL * 1.34f : 1.5f, color);
	}

	private void rendererRow(Gfx g, int x, int y, int w, RendererAdvisor.Rec rec) {
		String chip = switch (rec.state()) { case ACTIVE -> "ACTIVE"; case RECOMMENDED -> "RECOMMENDED"; case AVAILABLE -> "AVAILABLE"; case BLOCKED -> "BLOCKED"; };
		int col = switch (rec.state()) { case ACTIVE -> Glass.OK; case RECOMMENDED -> Glass.ACCENT; case AVAILABLE -> Glass.INK2; case BLOCKED -> Glass.INK3; };
		Icons.draw(g, rec.state() == RendererAdvisor.State.BLOCKED ? "lock" : "bolt", x + 8, y + 7, col);
		g.text(rec.name(), x + 22, y + 4, rec.state() == RendererAdvisor.State.BLOCKED ? Glass.INK2 : Glass.INK);
		int cwid = Glass.width(g, chip, Glass.LABEL) + 8;
		Glass.roundOutline(g, x + w - cwid - 8, y + 4, cwid, 11, 5, Glass.alpha(col, 0.7f));
		Glass.text(g, chip, x + w - cwid - 4, y + 7, Glass.LABEL, col);
		int ry = y + 17;
		for (String line : Glass.wrap(g, rec.oneLine(), Glass.LABEL, w - 30, 2)) { Glass.text(g, line, x + 22, ry, Glass.LABEL, Glass.INK3); ry += 8; }
	}

	private void modChips(Gfx g, int x, int y, int w) {
		String[][] mods = {{"sodium", "Sodium"}, {"lithium", "Lithium"}, {"entityculling", "Entity Culling"}, {"immediatelyfast", "ImmediatelyFast"}, {"ferritecore", "FerriteCore"},
				{"moreculling", "More Culling"}, {"krypton", "Krypton"}, {"c2me", "C2ME"}, {"modernfix", "ModernFix"}, {"scalablelux", "ScalableLux"}};
		int cx = x + 8, cy = y + 6, loaded = 0;
		for (String[] m : mods) if (Probes.loaded(m[0])) loaded++;
		Glass.text(g, loaded + " of " + mods.length + " loaded", x + w - 8 - Glass.width(g, loaded + " of " + mods.length + " loaded", Glass.LABEL), y + 3, Glass.LABEL, Glass.INK3);
		for (String[] m : mods) {
			boolean on = Probes.loaded(m[0]);
			int cw = Glass.width(g, m[1], Glass.LABEL) + 14;
			if (cx + cw > x + w - 8) { cx = x + 8; cy += 12; }
			Glass.roundOutline(g, cx, cy + 6, cw, 10, 5, on ? Glass.alpha(Glass.OK, 0.55f) : 0x22FFFFFF);
			Glass.roundFill(g, cx + 4, cy + 9, 4, 4, 2, on ? Glass.OK : 0x40FFFFFF);
			Glass.text(g, m[1], cx + 11, cy + 8.5f, Glass.LABEL, on ? Glass.INK2 : Glass.INK3);
			cx += cw + 3;
		}
	}

	private void startupCard(Gfx g, int x, int y) {
		Icons.draw(g, "clock", x + 8, y + 7, Glass.INK);
		g.text("Startup profile", x + 22, y + 4, Glass.INK);
		Glass.text(g, StartupProbe.summary(), x + 22, y + 18, Glass.LABEL, Glass.INK3);
	}

	// ------------------------------------------------------------------ search
	private List<Row> visibleRows(Minecraft mc) {
		String q = query.toString().trim();
		if (q.isEmpty()) return rows(tab, mc);
		long now = System.currentTimeMillis();
		if (now - corpusAt > 500) {   // building every tab's rows touches the disk; twice a second is enough
			List<Row> all = new ArrayList<>();
			for (Tab t : Tab.values()) all.addAll(rows(t, mc));
			corpus = all;
			corpusAt = now;
		}
		List<Row> noNotes = new ArrayList<>();
		for (Row r : corpus) if (r.painter == null && r.act != null || r.id != null) noNotes.add(r);
		return ModuleSearch.rank(q, noNotes, r -> r.id != null ? r.id : r.title, r -> r.title, r -> r.sub, new HashSet<>(Config.get().favourites));
	}

	public void smokeSearch(String q) { query.setLength(0); query.append(q); searchFocus = true; scrollTarget = 0; }

	public void smokeContext(String featureId) { popId = featureId; popX = 150; popY = 60; }

	public void smokeScroll(int px) { scrollTarget = px; Anim.snap("scroll", px); }

	public void smokeOpenAll() { for (Feature.Group g : ORDER) open.add(g.name()); }

	public void smokeAppearance() { popId = Features.APPEARANCE.id; popX = 8; popY = 100; }

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
				try (InputStream in = Files.newInputStream(newest.toPath())) { diagnosis = CrashAssistant.analyse(new String(in.readNBytes(256 * 1024), StandardCharsets.UTF_8)).orElse(null); }
			}
		} catch (Exception e) { LuminosClient.LOGGER.warn("crash report scan failed", e); }
		try {
			Path log = game.resolve("logs/latest.log");
			logLines = Files.exists(log) ? LogTail.tail(log, 40, LogTail.Level.WARN) : List.of();
		} catch (Exception e) { logLines = List.of(); }
	}

	private void copyLayout(Minecraft mc) {
		List<ShareCode.Entry> entries = new ArrayList<>();
		for (HudModule m : Modules.ALL) { Config.ModuleCfg c = Config.get().of(m); entries.add(new ShareCode.Entry(m.id(), c.enabled, c.x, c.y, c.scale)); }
		mc.keyboardHandler.setClipboard(ShareCode.encode(entries));
		say("Layout code copied (" + entries.size() + " modules)");
	}

	private void importLayout(Minecraft mc) {
		try {
			int applied = 0, skipped = 0;
			for (ShareCode.Entry e : ShareCode.decode(mc.keyboardHandler.getClipboard())) {
				HudModule m = moduleById(e.id());
				if (m == null) { skipped++; continue; }
				Config.ModuleCfg c = Config.get().of(m);
				c.enabled = e.enabled(); c.x = e.x(); c.y = e.y(); c.scale = e.scale();
				applied++;
			}
			Config.get().hudPreset = "custom";
			Config.save();
			say("Imported " + applied + " modules" + (skipped > 0 ? ", skipped " + skipped + " unknown" : ""));
		} catch (IllegalArgumentException ex) { say(ex.getMessage()); }
	}

	private static HudModule moduleById(String id) {
		for (HudModule m : Modules.ALL) if (m.id().equals(id)) return m;
		return null;
	}

	private void say(String m) { toast = m; toastAt = System.currentTimeMillis(); }

	private boolean inside(int x, int y, int w, int h) { return mx >= x && mx < x + w && my >= y && my < y + h && !popBlocks(x, y, w, h); }

	private boolean popBlocks(int x, int y, int w, int h) {
		return popId != null && mx >= popX && mx < popX + popW && my >= popY && my < popY + popH && !(x >= popX && y >= popY);
	}

	private int viewTop() { return 34; }

	private int viewBottom() { return H - 20; }

	private void addHit(int x, int y, int w, int h, Runnable r) {
		int y0 = Math.max(y, viewTop()), y1 = Math.min(y + h, viewBottom());
		if (y1 <= y0 && y >= viewTop() - 1 && y <= viewBottom()) { hits.add(new Hit(x, y, w, h, r)); return; }
		if (y1 > y0) hits.add(new Hit(x, y0, w, y1 - y0, r));
	}

	// ------------------------------------------------------------------ drawing
	public void render(Gfx g, Minecraft mc, int mouseX, int mouseY) {
		Anim.frame();
		float k = Anim.spring("open", 1f);
		float kc = Math.max(0f, Math.min(1f, k));
		s = Math.min(1f, Math.min(g.width() / (float) (W + 16), g.height() / (float) (H + 16)));
		float sc = s * (0.94f + 0.06f * k);
		ox = (g.width() - W * sc) / 2f;
		oy = (g.height() - H * sc) / 2f + (1f - k) * 14f;
		mx = Math.round((mouseX - ox) / sc);
		my = Math.round((mouseY - oy) / sc);
		this.s = sc;
		hits.clear(); rowHits.clear(); sliderHits.clear(); popHits.clear();
		tooltip = null;
		g.blur(Glass.blurLevel());
		g.fill(0, 0, g.width(), g.height(), Glass.alpha(Glass.scrim(), kc));
		g.push(ox, oy, sc);
		Glass.surface(g, 0, 0, W, H, 9, 1f);
		drawRail(g);
		drawHeader(g, mc);
		drawList(g, mc);
		drawFooter(g);
		if (tooltip != null) drawTooltip(g, tooltip);
		if (popId != null) drawPopover(g, mc);
		g.pop();
	}

	private void drawRail(Gfx g) {
		g.fill(RAIL, 8, RAIL + 1, H - 8, 0x14FFFFFF);
		Icons.draw(g, "brand", 12, 10, Glass.ACCENT);
		int y = 30;
		for (Tab tb : Tab.values()) {
			boolean act = query.length() == 0 && tb == tab, hot = inside(4, y, 24, 18);
			float a = Anim.soft("rail." + tb.name(), act ? 1f : hot ? 0.45f : 0f);
			if (a > 0.01f) Glass.roundFill(g, 4, y, 24, 18, 5, Glass.argb(Math.round(255 * 0.13f * a), 255, 255, 255));
			if (act) Glass.roundFill(g, 4, y + 4, 2, 10, 1, Glass.ACCENT);
			Icons.draw(g, tb.icon, 12, y + 5, act ? Glass.INK : hot ? Glass.INK : Glass.INK2);
			if (hot) tooltip = tb.label;
			final Tab target = tb;
			hits.add(new Hit(4, y, 24, 18, () -> { tab = target; query.setLength(0); scrollTarget = 0; Anim.snap("scroll", 0); rebinding = null; popId = null; supportLoaded = false; }));
			y += 20;
		}
		boolean hot = inside(4, H - 26, 24, 18);
		if (hot) { Glass.roundFill(g, 4, H - 26, 24, 18, 5, 0x20FFFFFF); tooltip = "Panel appearance"; }
		Icons.draw(g, "glass", 12, H - 21, popId != null && popId.equals(Features.APPEARANCE.id) ? Glass.ACCENT : Glass.INK2);
		hits.add(new Hit(4, H - 26, 24, 18, () -> { popId = Features.APPEARANCE.id; popX = RAIL + 4; popY = H - 96; }));
	}

	private void drawHeader(Gfx g, Minecraft mc) {
		String title = query.length() > 0 ? "Results" : tab.label;
		Glass.text(g, title, RAIL + 10, 9, Glass.TITLE, Glass.INK);
		int sw = 138, sx = W - 8 - sw, sy = 8;
		float f = Anim.soft("search", searchFocus ? 1f : 0f);
		Glass.card(g, sx, sy, sw, 16, 5, 0.35f + 0.4f * f);
		if (f > 0.02f) Glass.roundOutline(g, sx, sy, sw, 16, 5, Glass.alpha(Glass.ACCENT, 0.6f * f));
		Icons.draw(g, "search", sx + 5, sy + 4, Glass.INK3);
		String shown = query.length() == 0 ? "Search" : query.toString();
		boolean caret = searchFocus && (System.currentTimeMillis() / 500) % 2 == 0;
		String fitted = Glass.fit(g, shown, 1f, sw - 30);
		int textX = sx + 17 + (query.length() == 0 ? 3 : 0);
		g.text(fitted, textX, sy + 4, query.length() == 0 ? Glass.INK3 : Glass.INK);
		if (caret) { int cx = query.length() == 0 ? sx + 17 : textX + g.textWidth(fitted) + 1; g.fill(cx, sy + 3, cx + 1, sy + 13, Glass.INK); }
		if (query.length() > 0) {
			Icons.draw(g, "close", sx + sw - 12, sy + 4, Glass.INK2);
			hits.add(new Hit(sx + sw - 14, sy, 14, 16, () -> { query.setLength(0); scrollTarget = 0; }));
		}
		hits.add(new Hit(sx, sy, sw, 16, () -> searchFocus = true));
	}

	private List<Item> items(Minecraft mc) {
		List<Item> out = new ArrayList<>();
		if (query.length() == 0 && tab == Tab.MODULES) {
			Config cfg = Config.get();
			List<Row> all = rows(Tab.MODULES, mc);
			Set<String> favs = new LinkedHashSet<>(cfg.favourites);
			List<Row> favRows = new ArrayList<>();
			for (String id : cfg.favourites) for (Row r : all) if (id.equals(r.id)) favRows.add(r);
			if (!favRows.isEmpty()) {
				out.add(new Head("fav", "Favourites", "star", String.valueOf(favRows.size()), true));
				for (Row r : favRows) out.add(new Line(r));
			}
			for (Feature.Group grp : ORDER) {
				int total = 0, on = 0;
				List<Row> inGroup = new ArrayList<>();
				for (Feature f : Features.ALL) {
					if (f.group != grp) continue;
					total++;
					if (f.on() && (f.lock == null || f.lock.apply(mc) == null)) on++;
					if (favs.contains(f.id)) continue;
					for (Row r : all) if (f.id.equals(r.id)) inGroup.add(r);
				}
				boolean isOpen = open.contains(grp.name());
				out.add(new Head(grp.name(), grp.label, "chevron", on + "/" + total, isOpen));
				if (isOpen) for (Row r : inGroup) out.add(new Line(r));
			}
		} else {
			for (Row r : visibleRows(mc)) out.add(new Line(r));
		}
		return out;
	}

	private int itemH(Item it) { return it instanceof Head ? 18 : ((Line) it).row.h + 3; }

	private void drawList(Gfx g, Minecraft mc) {
		List<Item> items = items(mc);
		int total = 0;
		for (Item it : items) total += itemH(it);
		int viewH = viewBottom() - viewTop();
		float maxScroll = Math.max(0, total - viewH);
		scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
		float sy = Anim.spring("scroll", scrollTarget);
		int x = RAIL + 8, w = W - RAIL - 16 - (maxScroll > 0 ? 4 : 0);
		g.clip(RAIL + 1, viewTop(), W - 2, viewBottom());
		int y = viewTop() - Math.round(sy);
		if (items.isEmpty()) Glass.text(g, "No matches. Try a module name, a key, or a setting.", x + 4, y + 8, 1f, Glass.INK3);
		for (Item it : items) {
			int ih = itemH(it);
			if (y + ih >= viewTop() && y <= viewBottom()) {
				if (it instanceof Head h) drawHead(g, h, x, y, w);
				else drawRow(g, ((Line) it).row, x, y, w);
			}
			y += ih;
		}
		g.unclip();
		if (maxScroll > 0) {   // scroll thumb
			int th = Math.max(14, Math.round(viewH * (viewH / (float) total))), ty = viewTop() + Math.round((viewH - th) * (sy / maxScroll));
			Glass.roundFill(g, W - 7, ty, 2, th, 1, 0x40FFFFFF);
		}
	}

	private void drawHead(Gfx g, Head h, int x, int y, int w) {
		boolean hot = inside(x, y, w, 16);
		float rot = Anim.soft("hd." + h.key, h.open ? 1f : 0f);
		Icons.draw(g, h.icon.equals("chevron") ? (rot > 0.5f ? "chevron_d" : "chevron_r") : h.icon, x + 4, y + 4, h.icon.equals("star") ? Glass.WARN : hot ? Glass.INK : Glass.INK3);
		String label = h.label.toUpperCase(Locale.ROOT);
		g.text(label, x + 16, y + 4, hot ? Glass.INK : Glass.INK2);
		Glass.text(g, h.count, x + w - 4 - Glass.width(g, h.count, Glass.LABEL), y + 5.5f, Glass.LABEL, Glass.INK3);
		g.fill(x + 16 + g.textWidth(label) + 6, y + 8, x + w - 8 - Glass.width(g, h.count, Glass.LABEL) , y + 9, 0x12FFFFFF);
		if (!h.key.equals("fav")) addHit(x, y, w, 16, () -> { if (!open.remove(h.key)) open.add(h.key); });
	}

	private void drawRow(Gfx g, Row r, int x, int y, int w) {
		int h = r.h;
		boolean enabled = r.reason == null && r.act != null;
		boolean hot = enabled && inside(x, y, w, h) && popId == null;
		if (r.painter == null && r.act == null && r.id == null && r.icon == null && r.badge.isEmpty()) {   // a quiet note: no card
			int ny = y + 4;
			for (String line : Glass.wrap(g, r.title, Glass.LABEL, w - 12, 3)) { Glass.text(g, line, x + 6, ny, Glass.LABEL, Glass.INK3); ny += 8; }
			return;
		}
		float lift = Anim.soft("row." + (r.id != null ? r.id : r.title), hot ? 1f : 0f);
		Glass.card(g, x, y, w, h, 5, lift);
		if (r.painter != null) { r.painter.paint(g, x, y, w, h); return; }
		boolean on = r.active && r.reason == null;
		int dy = Math.max(0, (h - 24) / 2);
		String icon = r.icon != null ? r.icon : "grid";
		Icons.draw(g, icon, x + 8, y + 8 + dy, r.reason != null ? Glass.INK3 : on || r.badge.length() > 3 || r.act != null && !isSwitch(r) ? Glass.INK : Glass.INK3);
		int right = x + w - 8;
		if (isSwitch(r)) {
			float t = Anim.spring("tg." + (r.id != null ? r.id : r.title), on ? 1f : 0f);
			Glass.toggle(g, right - 18, y + (h - 10) / 2, t, enabled);
			right -= 24;
		} else if (r.reason != null) {
			Icons.draw(g, "lock", right - 8, y + 7, Glass.INK3);
			right -= 14;
		} else if (!r.badge.isEmpty() && !r.badge.equals("-")) {
			int bw = Glass.width(g, r.badge, Glass.LABEL) + 10;
			boolean accent = on || r.badge.equals("ACTIVE") || r.badge.equals("OK");
			Glass.roundOutline(g, right - bw, y + (h - 11) / 2, bw, 11, 5, accent ? Glass.alpha(Glass.ACCENT, 0.7f) : hot ? 0x60FFFFFF : 0x2CFFFFFF);
			Glass.text(g, r.badge, right - bw + 5, y + (h - 11) / 2 + 3f, Glass.LABEL, accent ? Glass.INK : Glass.INK2);
			right -= bw + 6;
		}
		int tx = x + 22;
		if (r.swatch != 0) { Glass.roundFill(g, x + 3, y + 5, 2, h - 10, 1, 0xFF000000 | r.swatch); }
		int max = right - tx - 2;
		Glass.text(g, Glass.fit(g, r.title, 1f, max), tx, y + 4 + dy, 1f, r.reason != null ? Glass.INK2 : on || r.act != null ? Glass.INK : Glass.INK2);
		String sub = r.reason != null ? r.reason : r.sub;
		Glass.text(g, Glass.fit(g, sub, Glass.LABEL, max), tx, y + 15 + dy, Glass.LABEL, r.reason != null ? Glass.WARN : Glass.INK3);
		if (Config.get().favourites.contains(r.id)) Icons.draw(g, "star", right - 10, y + 7, Glass.WARN);
		rowHits.add(new RowHit(x, Math.max(y, viewTop()), w, Math.min(y + h, viewBottom()) - Math.max(y, viewTop()), r));
		if (enabled) addHit(x, y, w, h, () -> { r.act.run(); corpusAt = 0; });
	}

	private static boolean isSwitch(Row r) { return r.badge.equals("ON") || r.badge.equals("OFF") || r.badge.equals("LOCKED"); }

	private void drawFooter(Gfx g) {
		int y = H - 14;
		boolean showToast = System.currentTimeMillis() - toastAt < 2200;
		String left = showToast ? toast : query.length() > 0 ? "Results from every tab" : tab == Tab.MODULES ? "Right-click a row for its settings" : "Esc closes";
		Glass.text(g, Glass.fit(g, left, Glass.LABEL, (W - RAIL - 120)), RAIL + 10, y + 1, Glass.LABEL, showToast ? ok() : Glass.INK3);
		String right = "Theme: " + Glass.theme().id;
		Glass.text(g, right, W - 10 - Glass.width(g, right, Glass.LABEL), y + 1, Glass.LABEL, Glass.INK3);
	}

	private void drawTooltip(Gfx g, String t) {
		int tw = g.textWidth(t) + 10;
		int x = Math.min(W - tw - 4, mx + 8), y = Math.max(4, my - 4);
		Glass.roundFill(g, x, y, tw, 14, 4, Glass.solid() ? 0xF0111318 : 0xD0101216);
		Glass.roundOutline(g, x, y, tw, 14, 4, 0x38FFFFFF);
		g.text(t, x + 5, y + 3, Glass.INK);
	}

	// ------------------------------------------------------------------ popover
	private void drawPopover(Gfx g, Minecraft mc) {
		Feature f = Features.byId(popId);
		if (f == null) { popId = null; return; }
		int rowsH = 0;
		for (Feature.Opt o : f.opts) rowsH += o.slider() ? 22 : 18;
		int note = Features.APPEARANCE == f ? 20 : 0;
		popH = 26 + rowsH + note + 22;
		popX = Math.max(RAIL + 4, Math.min(W - popW - 4, popX));
		popY = Math.max(30, Math.min(H - popH - 4, popY));
		float k = Anim.soft("pop", 1f);
		Glass.shadow(g, popX, popY, popW, popH, 7, 1.6f);
		Glass.roundFill(g, popX, popY, popW, popH, 7, Glass.solid() ? 0xFA1D2028 : 0xF2171A21);
		Glass.roundFill(g, popX, popY, popW, popH, 7, Glass.argb(Math.round(255 * 0.10f), 255, 255, 255));
		Glass.roundOutline(g, popX, popY, popW, popH, 7, 0x44FFFFFF);
		g.fill(popX + 7, popY + 1, popX + popW - 7, popY + 2, 0x30FFFFFF);
		// header
		Icons.draw(g, f.icon, popX + 9, popY + 9, Glass.INK);
		g.text(Glass.fit(g, f.name, 1f, popW - 50), popX + 22, popY + 8, Glass.INK);
		if (f != Features.APPEARANCE) {
			boolean fav = Config.get().favourites.contains(f.id);
			boolean hs = mx >= popX + popW - 22 && mx < popX + popW - 6 && my >= popY + 4 && my < popY + 20;
			Icons.draw(g, "star", popX + popW - 18, popY + 9, fav ? Glass.WARN : hs ? Glass.INK : Glass.INK3);
			popHits.add(new Hit(popX + popW - 22, popY + 4, 16, 16, () -> { ModuleSearch.toggle(Config.get().favourites, f.id); Config.save(); say(fav ? "Removed from favourites" : "Pinned to the top"); }));
		}
		g.fill(popX + 8, popY + 22, popX + popW - 8, popY + 23, 0x14FFFFFF);
		int y = popY + 26;
		for (Feature.Opt o : f.opts) {
			float v = Features.optGet(f, o);
			if (o.slider()) {
				String val = o.step() < 1 ? String.format(Locale.ROOT, "%.1f", v) + o.unit() : Math.round(v) + o.unit();
				Glass.text(g, o.label(), popX + 10, y + 2, Glass.LABEL * 1.34f, Glass.INK2);
				Glass.text(g, val, popX + popW - 10 - Glass.width(g, val, Glass.LABEL * 1.34f), y + 2, Glass.LABEL * 1.34f, Glass.INK);
				int tx = popX + 10, tw = popW - 20, ty = y + 12;
				boolean hot = dragging != null && dragging.o == o || mx >= tx - 2 && mx < tx + tw + 2 && my >= ty - 3 && my < ty + 10;
				Glass.slider(g, tx, ty, tw, (v - o.min()) / (o.max() - o.min()), hot);
				SliderHit sh = new SliderHit(tx, ty - 3, tw, 13, f, o);
				sliderHits.add(sh);
				y += 22;
			} else {
				boolean on = v >= 0.5f;
				boolean hot = mx >= popX + 4 && mx < popX + popW - 4 && my >= y && my < y + 18;
				if (hot) Glass.roundFill(g, popX + 4, y, popW - 8, 18, 4, 0x12FFFFFF);
				Glass.text(g, o.label(), popX + 10, y + 5, Glass.LABEL * 1.34f, Glass.INK2);
				Glass.toggle(g, popX + popW - 28, y + 4, Anim.spring("pt." + f.id + o.key(), on ? 1f : 0f), true);
				popHits.add(new Hit(popX + 4, y, popW - 8, 18, () -> { Features.optSet(f, o, on ? 0 : 1); Config.save(); }));
				y += 18;
			}
		}
		if (note > 0) {
			Glass.text(g, Glass.solid() && !Config.get().solidPanels ? "Solid because your OS asks for reduced transparency." : "Glass blurs the world behind the panel (GPU cost).", popX + 10, y + 5, Glass.LABEL, Glass.INK3);
			y += note;
		}
		g.fill(popX + 8, y + 2, popX + popW - 8, y + 3, 0x14FFFFFF);
		boolean hr = mx >= popX + 4 && mx < popX + 70 && my >= y + 4 && my < y + 20;
		Icons.draw(g, "reset", popX + 10, y + 9, hr ? Glass.INK : Glass.INK3);
		Glass.text(g, "Reset", popX + 22, y + 9, Glass.LABEL * 1.34f, hr ? Glass.INK : Glass.INK2);
		popHits.add(new Hit(popX + 4, y + 4, 66, 16, () -> { Features.optReset(f); say("Reset " + f.name); }));
		if (f.hud != null) {
			Glass.text(g, "Drag it in the HUD editor", popX + popW - 10 - Glass.width(g, "Drag it in the HUD editor", Glass.LABEL), y + 10, Glass.LABEL, Glass.INK3);
		}
	}

	// ------------------------------------------------------------------ input
	private void sliderTo(SliderHit h, double mouseLocalX) {
		float t = (float) Math.max(0, Math.min(1, (mouseLocalX - h.x) / (double) h.w));
		Features.optSet(h.f, h.o, h.o.min() + t * (h.o.max() - h.o.min()));
	}

	private void local(double mouseX, double mouseY) {
		mx = (int) Math.round((mouseX - ox) / s);
		my = (int) Math.round((mouseY - oy) / s);
	}

	public boolean click(double mouseX, double mouseY, int button) {
		local(mouseX, mouseY);
		if (popId != null) {
			if (mx >= popX && mx < popX + popW && my >= popY && my < popY + popH) {
				if (button == 0) {
					for (SliderHit h : sliderHits) if (mx >= h.x - 2 && mx < h.x + h.w + 2 && my >= h.y && my < h.y + h.h) { dragging = h; sliderTo(h, mx); return true; }
					for (int i = popHits.size() - 1; i >= 0; i--) { Hit h = popHits.get(i); if (mx >= h.x && mx < h.x + h.w && my >= h.y && my < h.y + h.h) { h.r.run(); return true; } }
				}
				return true;
			}
			popId = null;   // a click outside closes the popover and is swallowed
			Anim.snap("pop", 0f);
			return true;
		}
		if (button == 1) {
			for (RowHit rh : rowHits) {
				if (rh.row.id != null && Features.byId(rh.row.id) != null && mx >= rh.x && mx < rh.x + rh.w && my >= rh.y && my < rh.y + rh.h) {
					popId = rh.row.id; popX = mx + 4; popY = my - 4; Anim.snap("pop", 0f);
					return true;
				}
			}
			return true;
		}
		if (button != 0) return true;
		corpusAt = 0;
		searchFocus = false;
		for (int i = hits.size() - 1; i >= 0; i--) {
			Hit h = hits.get(i);
			if (mx >= h.x && mx < h.x + h.w && my >= h.y && my < h.y + h.h) { h.r.run(); return true; }
		}
		return true;
	}

	public boolean drag(double mouseX, double mouseY) {
		if (dragging == null) return false;
		local(mouseX, mouseY);
		sliderTo(dragging, mx);
		return true;
	}

	public void release() {
		if (dragging != null) Config.save();
		dragging = null;
	}

	public void scroll(double dy) { scrollTarget = Math.max(0, scrollTarget - (float) dy * 28f); }

	/** @return true if the panel consumed the key (otherwise the screen may close itself). */
	public boolean key(int code, int panelKeyCode, Object event) {
		if (rebinding != null) {
			if (code != 256) { Nav.rebind(Minecraft.getInstance(), rebinding, event); say("Bound to " + Nav.keyName(rebinding)); }
			rebinding = null;
			return true;
		}
		if (code == 256 && popId != null) { popId = null; return true; }
		if (code == 256) {
			if (query.length() > 0) { query.setLength(0); return true; }
			return false;
		}
		if (code == panelKeyCode && !searchFocus) return false;
		if (code == 259 && query.length() > 0) { query.setLength(query.length() - 1); scrollTarget = 0; return true; }
		return searchFocus;
	}

	public void type(int cp) {
		if (rebinding != null || popId != null) return;
		searchFocus = true;
		if (cp >= 32 && cp != 127 && query.length() < 40) { query.appendCodePoint(cp); scrollTarget = 0; }
	}
}
