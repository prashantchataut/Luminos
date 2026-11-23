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

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static Config instance = new Config();

	private static Path file() {
		return FabricLoader.getInstance().getConfigDir().resolve("luminos-client.json");
	}

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

	public ModuleCfg of(HudModule m) {
		return modules.computeIfAbsent(m.id(), k -> new ModuleCfg(m.enabledByDefault(), m.defaultX(), m.defaultY()));
	}

	public void resetLayout() {
		modules.clear();
	}
}
