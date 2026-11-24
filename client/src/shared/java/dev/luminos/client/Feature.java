package dev.luminos.client;

import net.minecraft.client.Minecraft;

import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * One row in the quick panel: icon, name, one-line description, toggle. Anything beyond that lives in the right-click popover
 * ({@link #opts}). HUD modules and non-HUD features (fullbright, input sampling, ...) are presented the same way.
 */
public final class Feature {
	public enum Group {
		HUD("HUD"), PVP("PvP"), VISUALS("Visuals"), UTILITY("Utility"), PERFORMANCE("Performance");
		public final String label;
		Group(String l) { label = l; }
	}

	/** A setting shown in the popover: a toggle or a slider. {@code key} starting with '@' is a special store (see Panel.optGet). */
	public record Opt(String key, String label, boolean slider, float min, float max, float def, float step, String unit) {
		public static Opt toggle(String key, String label, boolean def) { return new Opt(key, label, false, 0, 1, def ? 1 : 0, 1, ""); }
		public static Opt slider(String key, String label, float min, float max, float def, float step, String unit) { return new Opt(key, label, true, min, max, def, step, unit); }
	}

	public final String id, name, desc, icon;
	public final Group group;
	public final BooleanSupplier get;
	public final Consumer<Boolean> set;
	public final List<Opt> opts;
	/** Non-null while the feature is locked (for example by compliance mode); the string is the one-line reason. */
	public final Function<Minecraft, String> lock;
	public final HudModule hud;

	public Feature(String id, String name, String desc, String icon, Group group, BooleanSupplier get, Consumer<Boolean> set, List<Opt> opts, Function<Minecraft, String> lock, HudModule hud) {
		this.id = id;
		this.name = name;
		this.desc = desc;
		this.icon = icon;
		this.group = group;
		this.get = get;
		this.set = set;
		this.opts = opts;
		this.lock = lock;
		this.hud = hud;
	}

	public boolean on() { return get.getAsBoolean(); }

	public void toggle() { set.accept(!on()); Config.save(); }
}
