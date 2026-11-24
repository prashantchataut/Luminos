package dev.luminos.client;

import dev.luminos.client.Feature.Group;
import dev.luminos.client.Feature.Opt;
import dev.luminos.client.core.HudPresets;
import net.minecraft.client.Minecraft;

import java.util.ArrayList;
import java.util.List;

/** Every row the quick panel can show, in one list: HUD modules plus the features that have no HUD (fullbright, input sampling, ...). */
public final class Features {
	private Features() {}

	public static final List<Feature> ALL = new ArrayList<>();
	/** Opens the appearance popover (glass intensity, solid panels, reduced motion). Not part of ALL. */
	public static final Feature APPEARANCE = new Feature("@appearance", "Panel appearance", "Glass intensity and accessibility", "glass", Group.UTILITY,
			() -> true, v -> {}, List.of(
					Opt.slider("@glass", "Glass intensity", 0, 100, 70, 5, "%"),
					Opt.toggle("@solid", "Solid panels", false),
					Opt.toggle("@motion", "Reduce motion", false)), null, null);

	static {
		for (HudModule m : Modules.ALL) ALL.add(fromHud(m));
		ALL.add(extra("toggle_sprint", "Toggle sprint", "Tap forward once, keep sprinting", "sprint", Group.PVP, () -> Config.get().toggleSprint, v -> Config.get().toggleSprint = v, List.of(), null));
		ALL.add(extra("zoom", "Zoom", "Hold C to zoom", "zoom", Group.VISUALS, () -> Config.flag("zoom.on", true), v -> Config.setFlag("zoom.on", v),
				List.of(Opt.slider("@fov", "Zoom FOV", 30, 110, 30, 5, "")), mc -> Compliance.reason(mc, "zoom")));
		ALL.add(extra("fullbright", "Fullbright", "Raises the gamma slider, not night vision", "sun", Group.VISUALS, () -> Config.flag("fullbright.on", true), v -> Config.setFlag("fullbright.on", v),
				List.of(Opt.slider("level", "Brightness", 0, 100, 100, 5, "%")), mc -> Compliance.reason(mc, "fullbright")));
		ALL.add(extra("shulker_tooltip", "Shulker box tooltip", "Hover a shulker, ender chest or bundle to see inside", "shulker", Group.UTILITY, () -> Config.flag("shulker_tooltip.on", true), v -> Config.setFlag("shulker_tooltip.on", v), List.of(), null));
		ALL.add(extra("custom_title", "Luminos title screen", "Off shows the vanilla one", "title", Group.UTILITY, () -> Config.get().customTitle, v -> Config.get().customTitle = v, List.of(), null));
		ALL.add(extra("input_sampling", "Render-loop input", "Clicks and taps act the frame they arrive, not at the next tick", "pointer", Group.PERFORMANCE, () -> Config.flag("input_sampling.on", true), v -> Config.setFlag("input_sampling.on", v),
				List.of(Opt.toggle("attack", "Attack (left click)", true), Opt.toggle("use", "Use (right click)", true), Opt.toggle("taps", "Latch sprint and jump taps", true)), null));
		ALL.add(extra("frame_guard", "Frame-queue guard", "Experimental: waits for the GPU so frames do not queue", "clock", Group.PERFORMANCE, () -> Config.flag("frame_guard.on", false), v -> Config.setFlag("frame_guard.on", v),
				List.of(Opt.slider("max", "Longest wait", 0.5f, 3f, 2f, 0.5f, "ms")), null));
		ALL.add(extra("hud_refresh", "HUD refresh cap", "HUD numbers update at a fixed rate, not every frame", "layers", Group.PERFORMANCE, () -> Config.flag("hud_refresh.on", true), v -> Config.setFlag("hud_refresh.on", v),
				List.of(Opt.slider("hz", "Updates per second", 10, 120, 30, 5, "Hz")), null));
	}

	private static Feature extra(String id, String name, String desc, String icon, Group g, java.util.function.BooleanSupplier get, java.util.function.Consumer<Boolean> set, List<Opt> opts, java.util.function.Function<Minecraft, String> lock) {
		return new Feature(id, name, desc, icon, g, get, set, opts, lock, null);
	}

	private static Feature fromHud(HudModule m) {
		List<Opt> opts = new ArrayList<>(m.opts());
		opts.add(Opt.slider("@scale", "Scale", 0.5f, 2f, 1f, 0.1f, "x"));
		opts.add(Opt.toggle("bg", "Glass plate", Config.get().showBackground));
		return new Feature(m.id(), m.title(), m.desc(), m.icon(), m.group(),
				() -> Config.get().of(m).enabled, v -> { Config.get().of(m).enabled = v; Config.get().hudPreset = "custom"; }, opts,
				m.complianceFlagged() ? mc -> Compliance.reason(mc, m.title()) : null, m);
	}

	public static Feature byId(String id) {
		if (APPEARANCE.id.equals(id)) return APPEARANCE;
		for (Feature f : ALL) if (f.id.equals(id)) return f;
		return null;
	}

	/** Turns the preset's modules on and the rest off, and puts them back at their default places. */
	public static void applyPreset(String name) {
		var on = HudPresets.enabled(name);
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			c.enabled = on.contains(m.id());
			c.x = m.defaultX();
			c.y = m.defaultY();
			c.scale = 1f;
		}
		Config.get().hudPreset = name;
		Config.save();
	}

	// ---------------------------------------------------------------- option store
	public static float optGet(Feature f, Opt o) {
		Config c = Config.get();
		return switch (o.key()) {
			case "@scale" -> c.of(f.hud).scale;
			case "@fov" -> c.zoomFov;
			case "@glass" -> c.glassIntensity;
			case "@solid" -> c.solidPanels ? 1 : 0;
			case "@motion" -> c.reduceMotion ? 1 : 0;
			default -> Config.num(f.id + "." + o.key(), o.def());
		};
	}

	public static void optSet(Feature f, Opt o, float v) {
		Config c = Config.get();
		v = Math.max(o.min(), Math.min(o.max(), Math.round(v / o.step()) * o.step()));
		switch (o.key()) {
			case "@scale" -> c.of(f.hud).scale = Math.round(v * 10) / 10f;
			case "@fov" -> c.zoomFov = Math.round(v);
			case "@glass" -> c.glassIntensity = Math.round(v);
			case "@solid" -> c.solidPanels = v >= 0.5f;
			case "@motion" -> c.reduceMotion = v >= 0.5f;
			default -> Config.setNum(f.id + "." + o.key(), v);
		}
	}

	public static void optReset(Feature f) {
		for (Opt o : f.opts) {
			switch (o.key()) {
				case "@scale", "@fov", "@glass", "@solid", "@motion" -> optSet(f, o, o.key().equals("@glass") ? 70 : o.def());
				default -> Config.get().opt.remove(f.id + "." + o.key());
			}
		}
		if (f.hud != null) { Config.ModuleCfg c = Config.get().of(f.hud); c.x = f.hud.defaultX(); c.y = f.hud.defaultY(); c.scale = 1f; }
		Config.save();
	}
}
