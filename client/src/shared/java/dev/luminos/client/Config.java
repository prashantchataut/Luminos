package dev.luminos.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** JSON config stored at {@code config/luminos-client.json}. */
public final class Config {
	public static final class ModuleCfg {
		public boolean enabled = true;
		public int x;
		public int y;
		public float scale = 1.0f;

		public ModuleCfg() {}

		public ModuleCfg(boolean enabled, int x, int y) {
			this.enabled = enabled;
			this.x = x;
			this.y = y;
		}
	}

	public Map<String, ModuleCfg> modules = new LinkedHashMap<>();
	public boolean toggleSprint = false;
	/** FOV while the zoom key is held (Minecraft's slider range is 30–110). */
	public int zoomFov = 30;
	public boolean showBackground = true;
	/** Snap dragged HUD modules to a 4 px grid, screen edges/centre and other modules. */
	public boolean snap = true;
	/** Replace the vanilla title screen with the Luminos one. Also off when LUMINOS_VANILLA_TITLE is set. */
	public boolean customTitle = true;
	/** off | auto | always. Restricted mode disables modules that could be an advantage (zoom). */
	public String complianceMode = "auto";
	public java.util.List<String> complianceServers = new java.util.ArrayList<>(java.util.List.of("hypixel.net", "mineplex.com", "cubecraft.net", "minemen.club"));
	public String activeProfile = "default";
	public String cosmeticSkin = "";
	public String cosmeticCape = "";
	public int crosshairColor = 0xFFF2F4F8;
	public long playtimeMs = 0;
	/** Module ids pinned to the top of the quick panel. */
	public java.util.List<String> favourites = new java.util.ArrayList<>();
	/** Saved panel order of module ids; unlisted modules follow in default order. */
	public java.util.List<String> moduleOrder = new java.util.ArrayList<>();
	/** Waypoints as {@code name|x|y|z|dimension|rrggbb}; see core.Waypoint. */
	public java.util.List<String> waypoints = new java.util.ArrayList<>();
	/** DEFAULT, DEUTERANOPIA, PROTANOPIA, TRITANOPIA or HIGH_CONTRAST; recolours status text in the quick panel. */
	public String colorblind = "DEFAULT";

	/** Liquid-glass material: 0 = flat and dark, 100 = clearest glass with the strongest blur. */
	public int glassIntensity = 70;
	/** Opaque panels: no blur, no translucency. For low-end GPUs and for anyone who finds glass hard to read. */
	public boolean solidPanels = false;
	/** Snap springs and fades instead of animating them. */
	public boolean reduceMotion = false;
	/** Row density: false = Compact (24 px rows, default), true = Comfortable (30 px). */
	public boolean comfortable = false;
	/** minimal | competitive | full | custom. Minimal is the default: FPS, CPS, ping, armor and potions only. */
	public String hudPreset = "minimal";
	/** Developer tools (startup profile card). Off for players. */
	public boolean devTools = false;
	/** Free-form numeric options, key = {@code moduleId.option}; booleans are stored as 0 or 1. */
	public Map<String, Float> opt = new LinkedHashMap<>();

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static Config instance = new Config();

	private static Path file() {
		return FabricLoader.getInstance().getConfigDir().resolve("luminos-client.json");
	}

	public static Gson gson() { return GSON; }

	public static void replace(Config c) { if (c != null) instance = c; }

	public static Config get() {
		return instance;
	}

	public static void load() {
		try {
			Path f = file();
			if (Files.exists(f)) {
				Config c = GSON.fromJson(Files.readString(f), Config.class);
				if (c != null) {
					if (c.modules == null) c.modules = new LinkedHashMap<>();
					instance = c;
				}
			}
		} catch (Exception e) {
			LuminosClient.LOGGER.warn("Could not read config, using defaults", e);
		}
	}

	public static void save() {
		try {
			Files.createDirectories(file().getParent());
			Files.writeString(file(), GSON.toJson(instance));
		} catch (IOException e) {
			LuminosClient.LOGGER.warn("Could not save config", e);
		}
	}

	public static boolean flag(String key, boolean def) {
		Float v = instance.opt == null ? null : instance.opt.get(key);
		return v == null ? def : v >= 0.5f;
	}

	public static float num(String key, float def) {
		Float v = instance.opt == null ? null : instance.opt.get(key);
		return v == null ? def : v;
	}

	public static void setNum(String key, float v) {
		if (instance.opt == null) instance.opt = new LinkedHashMap<>();
		instance.opt.put(key, v);
	}

	public static void setFlag(String key, boolean v) { setNum(key, v ? 1f : 0f); }

	public ModuleCfg of(HudModule m) {
		return modules.computeIfAbsent(m.id(), k -> new ModuleCfg(m.enabledByDefault(), m.defaultX(), m.defaultY()));
	}

	public void resetLayout() {
		modules.clear();
	}
}
