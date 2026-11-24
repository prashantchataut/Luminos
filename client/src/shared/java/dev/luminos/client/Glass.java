package dev.luminos.client;

/**
 * The Luminos material and type scale, applied to every panel (liquid-glass skill, Core Principles 1-5).
 *
 * Material: a translucent white tint (alpha 0.08-0.18 depending on glass intensity) over Minecraft's own gaussian
 * blur and a dark scrim, a hairline border and a 1 px inset highlight along the top edge. Solid panels
 * (Config.solidPanels, or the OS asking for reduced transparency) swap the tint for an opaque graphite fill
 * and switch the blur off.
 *
 * Type scale (GUI pixels, vanilla font is 8 px tall): label 0.75, body 1.0, section title 1.0 uppercase and dim,
 * panel title 1.5. Nothing else is larger.
 *
 * One accent colour. Everything else is neutral.
 */
public final class Glass {
	private Glass() {}

	public static final int ACCENT = 0xFF4FD1D9;   // one accent: a clear cyan (the earlier periwinkle read as lavender, which taste-skill bans)
	public static final int INK = 0xFFF2F4F8;     // primary text
	public static final int INK2 = 0xFFB9C0CC;    // secondary text / secondary HUD mods
	public static final int INK3 = 0xFF9BA4B4;    // labels
	public static final int OK = 0xFF7BE0A8;
	public static final int WARN = 0xFFFFC857;

	public static final float LABEL = 0.75f, BODY = 1f, TITLE = 1.5f;

	private static volatile boolean osReduced;

	/** Reads the OS "reduce transparency" switch once, off the render thread. Windows and macOS only; Linux has no single switch. */
	public static void probeOs() {
		Thread t = new Thread(() -> {
			try {
				String os = System.getProperty("os.name", "").toLowerCase(java.util.Locale.ROOT);
				String out = null;
				if (os.contains("win")) out = run("reg", "query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", "/v", "EnableTransparency");
				else if (os.contains("mac")) out = run("defaults", "read", "com.apple.universalaccess", "reduceTransparency");
				if (out != null) {
					String o = out.trim();
					osReduced = os.contains("win") ? o.endsWith("0x0") : o.endsWith("1");
				}
			} catch (Exception ignored) { /* no switch found: keep glass */ }
		}, "luminos-os-probe");
		t.setDaemon(true);
		t.start();
	}

	private static String run(String... cmd) throws Exception {
		Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
		String s = new String(p.getInputStream().readAllBytes());
		p.waitFor();
		return s;
	}

	public static boolean osReducedTransparency() { return osReduced; }

	public static boolean solid() { return Config.get().solidPanels || osReduced; }

	/** 0..1 */
	public static float intensity() { return Math.max(0, Math.min(100, Config.get().glassIntensity)) / 100f; }

	/** Vanilla blur radius to borrow while a glass panel is open (0 = no blur pass at all, which is the cheap path). */
	public static int blurLevel() { return solid() ? 0 : Math.round(intensity() * 8f); }

	// ---------------------------------------------------------------- colour helpers
	public static int argb(int a, int r, int g, int b) { return (Math.max(0, Math.min(255, a)) << 24) | (r << 16) | (g << 8) | b; }

	public static int alpha(int c, float mul) {
		int a = Math.round(((c >>> 24) & 0xFF) * mul);
		return (Math.max(0, Math.min(255, a)) << 24) | (c & 0xFFFFFF);
	}

	/** White tint used for glass surfaces: alpha 0.08 (clear) to 0.18 (flat). */
	public static int tint(float strength) {
		if (solid()) return 0xF21B1E26;
		return alpha(0xFFFFFFFF, (0.18f - 0.10f * intensity()) * strength);
	}

	/** Full-screen dim behind a panel. Darker when the glass is clearer so text keeps its contrast. */
	public static int scrim() {
		return solid() ? 0xB8070809 : alpha(0xFF050608, 0.34f + 0.16f * intensity());
	}

	// ---------------------------------------------------------------- shapes
	private static float inset(int r, int row) {
		float cy = r - (row + 0.5f);
		return r - (float) Math.sqrt(Math.max(0, r * (double) r - cy * cy));
	}

	/** Anti-aliased rounded rectangle from horizontal spans; the translucent middle is drawn once, so alpha never doubles up. */
	public static void roundFill(Gfx g, int x, int y, int w, int h, int r, int c) {
		r = Math.min(r, Math.min(w, h) / 2);
		if (((c >>> 24) & 0xFF) == 0) return;
		if (r <= 0) { g.fill(x, y, x + w, y + h, c); return; }
		g.fill(x, y + r, x + w, y + h - r, c);
		int rgb = c & 0xFFFFFF, a0 = c >>> 24;
		for (int i = 0; i < r; i++) {
			float in = inset(r, i);
			int fi = (int) Math.floor(in);
			float cover = 1f - (in - fi);
			int edge = (Math.round(a0 * cover) << 24) | rgb;
			int top = y + i, bot = y + h - 1 - i;
			g.fill(x + fi + 1, top, x + w - fi - 1, top + 1, c);
			g.fill(x + fi + 1, bot, x + w - fi - 1, bot + 1, c);
			g.fill(x + fi, top, x + fi + 1, top + 1, edge);
			g.fill(x + w - fi - 1, top, x + w - fi, top + 1, edge);
			g.fill(x + fi, bot, x + fi + 1, bot + 1, edge);
			g.fill(x + w - fi - 1, bot, x + w - fi, bot + 1, edge);
		}
	}

	/** 1 px rounded outline (the hairline). */
	public static void roundOutline(Gfx g, int x, int y, int w, int h, int r, int c) {
		r = Math.min(r, Math.min(w, h) / 2);
		if (((c >>> 24) & 0xFF) == 0) return;
		if (r <= 0) { g.outline(x, y, w, h, c); return; }
		g.fill(x + r, y, x + w - r, y + 1, c);
		g.fill(x + r, y + h - 1, x + w - r, y + h, c);
		g.fill(x, y + r, x + 1, y + h - r, c);
		g.fill(x + w - 1, y + r, x + w, y + h - r, c);
		for (int i = 0; i < r; i++) {
			int s = (int) Math.floor(inset(r, i));
			int e = i == 0 ? r : (int) Math.ceil(inset(r, i - 1));
			if (e <= s) e = s + 1;
			int top = y + i, bot = y + h - 1 - i;
			g.fill(x + s, top, x + e, top + 1, c);
			g.fill(x + w - e, top, x + w - s, top + 1, c);
			g.fill(x + s, bot, x + e, bot + 1, c);
			g.fill(x + w - e, bot, x + w - s, bot + 1, c);
		}
	}

	/** Soft drop shadow: a few expanding low-alpha rounded rects. */
	public static void shadow(Gfx g, int x, int y, int w, int h, int r, float strength) {
		for (int i = 4; i >= 1; i--) roundFill(g, x - i, y - i + 3, w + 2 * i, h + 2 * i, r + i, argb(Math.round(7 * strength), 0, 0, 0));
	}

	/** The glass surface itself: shadow, tint, hairline, top highlight. */
	public static void surface(Gfx g, int x, int y, int w, int h, int r, float strength) {
		shadow(g, x, y, w, h, r, solid() ? 1.2f : 1f);
		roundFill(g, x, y, w, h, r, tint(strength));
		roundOutline(g, x, y, w, h, r, solid() ? 0x40FFFFFF : 0x38FFFFFF);
		g.fill(x + r, y + 1, x + w - r, y + 2, solid() ? 0x18FFFFFF : 0x30FFFFFF);   // inset top highlight
	}

	/** A raised row or button. {@code hot} brightens the border and fill (no hue change). */
	public static void card(Gfx g, int x, int y, int w, int h, int r, float hot) {
		int fill = solid() ? argb(Math.round(235 + 0), 0x24 + Math.round(12 * hot), 0x27 + Math.round(12 * hot), 0x30 + Math.round(12 * hot))
				: argb(Math.round(255 * (0.045f + 0.075f * hot)), 255, 255, 255);
		roundFill(g, x, y, w, h, r, fill);
		roundOutline(g, x, y, w, h, r, argb(Math.round(255 * (0.09f + 0.20f * hot)), 255, 255, 255));
	}

	// ---------------------------------------------------------------- text
	public static void text(Gfx g, String s, float x, float y, float scale, int color) {
		if (scale == 1f) { g.text(s, Math.round(x), Math.round(y), color); return; }
		g.push(x, y, scale);
		g.text(s, 0, 0, color);
		g.pop();
	}

	public static int width(Gfx g, String s, float scale) { return Math.round(g.textWidth(s) * scale); }

	public static String fit(Gfx g, String t, float scale, int max) {
		if (width(g, t, scale) <= max) return t;
		while (t.length() > 1 && width(g, t + "..", scale) > max) t = t.substring(0, t.length() - 1);
		return t + "..";
	}

	// ---------------------------------------------------------------- controls
	/** 18x10 switch. {@code t} is 0..1 and may overshoot slightly (spring). */
	public static void toggle(Gfx g, int x, int y, float t, boolean enabled) {
		float k = Math.max(0f, Math.min(1f, t));
		int off = argb(Math.round(255 * 0.16f), 255, 255, 255);
		int onc = alpha(ACCENT, 0.92f);
		int track = lerp(off, onc, k);
		if (!enabled) track = alpha(track, 0.5f);
		roundFill(g, x, y, 18, 10, 5, track);
		roundOutline(g, x, y, 18, 10, 5, argb(Math.round(255 * (0.18f + 0.12f * k)), 255, 255, 255));
		int kx = x + 1 + Math.round(8 * t);
		roundFill(g, kx, y + 1, 8, 8, 4, enabled ? 0xFFFFFFFF : 0xB0FFFFFF);
	}

	/** Slider track 0..1 with a round thumb; width w, 6 px tall hit zone is the caller's job. */
	public static void slider(Gfx g, int x, int y, int w, float t, boolean hot) {
		t = Math.max(0f, Math.min(1f, t));
		roundFill(g, x, y + 3, w, 3, 1, argb(46, 255, 255, 255));
		int fw = Math.round((w - 1) * t);
		if (fw > 0) roundFill(g, x, y + 3, fw + 1, 3, 1, alpha(ACCENT, 0.9f));
		int tx = x + Math.round((w - 7) * t);
		roundFill(g, tx, y + 1, 7, 7, 3, hot ? 0xFFFFFFFF : 0xF0E8ECF4);
	}

	public static int lerp(int a, int b, float t) {
		int aa = (int) (((a >>> 24) & 0xFF) + (((b >>> 24) & 0xFF) - ((a >>> 24) & 0xFF)) * t);
		int rr = (int) (((a >> 16) & 0xFF) + (((b >> 16) & 0xFF) - ((a >> 16) & 0xFF)) * t);
		int gg = (int) (((a >> 8) & 0xFF) + (((b >> 8) & 0xFF) - ((a >> 8) & 0xFF)) * t);
		int bb = (int) ((a & 0xFF) + ((b & 0xFF) - (a & 0xFF)) * t);
		return argb(aa, rr, gg, bb);
	}
}
