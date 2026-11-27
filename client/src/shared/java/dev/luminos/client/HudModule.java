package dev.luminos.client;

import net.minecraft.client.Minecraft;

import java.util.List;
import java.util.function.Supplier;

/**
 * A movable on-screen widget. Modules draw at (0,0); the host translates and scales them,
 * so a module only has to describe its own size and contents.
 *
 * Colour hierarchy (primary mods brighter, secondary darker): {@link #primary()} modules use the bright
 * ink, the rest the softer one. Plates are neutral translucent glass, never blue.
 */
public abstract class HudModule {
	protected static final int TEXT = Glass.INK;
	protected static final int DIM = Glass.INK3;
	protected static final int ACCENT = Glass.ACCENT;

	public abstract String id();

	public abstract String title();

	/** Width in unscaled GUI pixels. */
	public abstract int width(Minecraft mc);

	public abstract int height(Minecraft mc);

	/** @param preview true inside the editor or when no world is loaded: use sample data. */
	public abstract void render(Gfx g, Minecraft mc, boolean preview);

	// ---- panel metadata: one line, one icon, one group
	public String desc() { return ""; }

	public String icon() { return "grid"; }

	public Feature.Group group() { return Feature.Group.HUD; }

	/** Module-specific popover settings. Scale and background are added for every module by {@link Features}. */
	public List<Feature.Opt> opts() { return List.of(); }

	/** A server's rules may treat this HUD as an advantage (target health, coordinates): compliance mode hides it. */
	public boolean complianceFlagged() { return false; }

	public boolean primary() { return false; }

	public int defaultX() { return 6; }

	public int defaultY() { return 6; }

	/** Centred on screen; the configured x/y are ignored. */
	public boolean centered() { return false; }

	/** On only for the Minimal preset (FPS, CPS, ping, armor, potions); everything else is available but off. */
	public boolean enabledByDefault() { return dev.luminos.client.core.HudPresets.enabled("minimal").contains(id()); }

	protected int ink() { return primary() ? Glass.INK : Glass.INK2; }

	/** Headless preview/tests only: measures text without a running game. Null in the game, where the real font is used. */
	private static java.util.function.ToIntFunction<String> previewMeasure;
	public static void previewMeasure(java.util.function.ToIntFunction<String> f) { previewMeasure = f; }

	public static int textWidth(String s) { return tw(s); }

	protected static int tw(String s) { return previewMeasure != null ? previewMeasure.applyAsInt(s) : Minecraft.getInstance().font.width(s); }

	protected boolean opt(String key, boolean def) { return Config.flag(id() + "." + key, def); }

	protected float optNum(String key, float def) { return Config.num(id() + "." + key, def); }

	/** Neutral smoked-glass plate behind a module. Per-module switch {@code id.bg} (defaults to the global one). */
	protected void panel(Gfx g, int w, int h) {
		if (!Config.flag(id() + ".bg", Config.get().showBackground)) return;
		Glass.roundFill(g, 0, 0, w, h, 3, 0x57070809);
		Glass.roundOutline(g, 0, 0, w, h, 3, 0x22FFFFFF);
		g.fill(3, 1, w - 3, 2, 0x16FFFFFF);
	}

	// ---- data caching: the native form of "render HUD at a lower fixed rate" (Exordium's idea at the data level)
	private long cacheAt;
	private Object cache;

	/** Recomputes {@code f} at most {@code hudRefreshHz} times a second instead of every frame. */
	@SuppressWarnings("unchecked")
	protected <T> T cached(Supplier<T> f) {
		if (!Config.flag("hud_refresh.on", true)) return f.get();
		long now = System.nanoTime();
		long period = (long) (1e9 / Math.max(5f, Config.num("hud_refresh.hz", 30f)));
		if (cache == null || now - cacheAt >= period) { cache = f.get(); cacheAt = now; }
		return (T) cache;
	}
}
