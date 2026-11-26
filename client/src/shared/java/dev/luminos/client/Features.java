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
	public static final Feature APPEARANCE = new Feature("@appearance", "Panel appearance", "Theme colours, motion and density", "glass", Group.UTILITY,
			() -> true, v -> {}, List.of(
					Opt.toggle("@motion", "Reduce motion", false),
					Opt.toggle("@comfy", "Comfortable rows", false)), null, null);

	static {
		for (HudModule m : Modules.ALL) ALL.add(fromHud(m));
		ALL.add(extra("toggle_sprint", "Toggle sprint", "Tap forward once, keep sprinting", "sprint", Group.PVP, () -> Config.get().toggleSprint, v -> Config.get().toggleSprint = v, List.of(), null));
		ALL.add(extra("zoom", "Zoom", "Hold C to zoom", "zoom", Group.VISUALS, () -> Config.flag("zoom.on", true), v -> Config.setFlag("zoom.on", v),
				Nav.hasEngine() ? List.of(Opt.slider("factor", "Zoom level (scroll while zoomed)", 2, 12, 4, 0.5f, "x")) : List.of(Opt.slider("@fov", "Zoom FOV", 30, 110, 30, 5, "")), mc -> Compliance.reason(mc, "zoom")));
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
		if (Nav.hasEngine()) addEngineRows();
	}

	/** Rows for the native Mixin engine (Minecraft 1.21.x line only; the 26.x line has no Mixins yet, so it does not show them). */
	private static void addEngineRows() {
		eng("entity_cull", "Entity culling", "Skips entities and block entities that are too far away or roofed over", "layers", Group.PERFORMANCE, true,
				Opt.slider("distance", "Entity distance", 32, 256, 96, 16, " blocks"), Opt.slider("block_distance", "Block entity distance", 16, 128, 64, 16, " blocks"));
		eng("particle_budget", "Particle budget", "Caps particles per tick, lower while the frame rate is low", "layers", Group.PERFORMANCE, true,
				Opt.slider("max", "Particles per tick", 100, 2000, 600, 50, ""));
		eng("unfocused_fps", "Unfocused GPU saver", "Caps the frame rate while the window is not focused", "clock", Group.PERFORMANCE, true,
				Opt.slider("cap", "Frame cap", 5, 60, 15, 5, " FPS"));
		eng("clear_fog", "Clear fog", "Pushes fog out per dimension (water and lava fog stay)", "sun", Group.VISUALS, false,
				Opt.toggle("overworld", "Overworld", true), Opt.toggle("nether", "Nether", true), Opt.toggle("end", "End", true));
		eng("freelook", "Freelook", "Hold Left Alt to look around without turning", "zoom", Group.VISUALS, true);
		eng("low_fire", "Low fire", "Lowers the on-screen fire", "sun", Group.VISUALS, false, Opt.slider("drop", "Drop", 0, 60, 35, 5, "%"));
		eng("hurtcam_off", "No damage tilt", "Turns off the camera tilt when you are hit", "pointer", Group.VISUALS, false);
		eng("viewmodel", "Viewmodel", "Move and scale the item and hand in first person", "layers", Group.VISUALS, false,
				Opt.slider("x", "X", -0.5f, 0.5f, 0, 0.05f, ""), Opt.slider("y", "Y", -0.5f, 0.5f, 0, 0.05f, ""), Opt.slider("z", "Z", -0.5f, 0.5f, 0, 0.05f, ""),
				Opt.slider("scale", "Scale", 0.5f, 1.5f, 1, 0.05f, "x"));
		eng("anim17", "1.7 sword block", "Classic sword block pose while the use key is held", "pointer", Group.PVP, false);
		eng("low_shield", "Low shield", "Lowers the off-hand shield", "pointer", Group.PVP, false, Opt.slider("drop", "Drop", 0, 40, 18, 2, "%"));
		eng("time_lock", "Time changer", "Locks the sky to one time of day (only you see it)", "clock", Group.UTILITY, false,
				Opt.slider("time", "Time of day", 0, 24000, 6000, 500, " ticks"));
		eng("weather_lock", "Weather changer", "0 clear, 1 rain, 2 thunder (only you see it)", "sun", Group.UTILITY, false,
				Opt.slider("state", "Weather", 0, 2, 0, 1, ""));
	}

	private static void eng(String id, String name, String desc, String icon, Group g, boolean def, Opt... opts) {
		ALL.add(extra(id, name, desc, icon, g, () -> Config.flag(id + ".on", def), v -> Config.setFlag(id + ".on", v), List.of(opts), null));
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
			case "@comfy" -> c.comfortable ? 1 : 0;
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
			case "@comfy" -> c.comfortable = v >= 0.5f;
			default -> Config.setNum(f.id + "." + o.key(), v);
		}
	}

	public static void optReset(Feature f) {
		for (Opt o : f.opts) {
			switch (o.key()) {
				case "@scale", "@fov", "@glass", "@solid", "@motion", "@comfy" -> optSet(f, o, o.key().equals("@glass") ? 70 : o.def());
				default -> Config.get().opt.remove(f.id + "." + o.key());
			}
		}
		if (f.hud != null) { Config.ModuleCfg c = Config.get().of(f.hud); c.x = f.hud.defaultX(); c.y = f.hud.defaultY(); c.scale = 1f; }
		Config.save();
	}
}
