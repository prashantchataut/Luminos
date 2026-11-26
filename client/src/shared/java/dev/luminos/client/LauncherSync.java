package dev.luminos.client;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Two-way mirror of module toggles, hotkeys and HUD layout with {@code <game dir>/config/luminos/config.json}, the file the launcher writes
 * before every launch. Applied when the client starts; rewritten (with in-game changes) every time the client saves.
 */
final class LauncherSync {
	private LauncherSync() {}

	/** GLFW code of the launcher's "Open Client Quick Panel" key, or -1 to use only the defaults (Right Ctrl / Right Shift). */
	static int openMenuKey = -1;

	static Path file() { return FabricLoader.getInstance().getConfigDir().resolve("luminos").resolve("config.json"); }

	static int keyCode(String name) {
		if (name == null) return -1;
		String n = name.trim().toUpperCase();
		switch (n) {
			case "RCTRL": case "RIGHT CTRL": return GLFWKeys.RCTRL;
			case "RSHIFT": case "RIGHT SHIFT": return GLFWKeys.RSHIFT;
			case "LCTRL": return 341;
			case "LSHIFT": return 340;
			case "RALT": return 346;
			case "INSERT": return 260;
			default:
		}
		if (n.length() == 1 && Character.isLetterOrDigit(n.charAt(0))) return n.charAt(0);
		if (n.matches("F([1-9]|1[0-2])")) return 289 + Integer.parseInt(n.substring(1));
		return -1;
	}

	private static final class GLFWKeys {
		static final int RCTRL = Hotkeys.GLFW_KEY_RIGHT_CONTROL, RSHIFT = Hotkeys.GLFW_KEY_RIGHT_SHIFT;
	}

	static void apply() {
		try {
			Path f = file();
			if (!Files.exists(f)) return;
			JsonObject root = JsonParser.parseString(Files.readString(f)).getAsJsonObject();
			if (root.has("modules") && root.get("modules").isJsonObject()) {
				for (Map.Entry<String, JsonElement> e : root.getAsJsonObject("modules").entrySet()) {
					if (!e.getValue().isJsonPrimitive() || !e.getValue().getAsJsonPrimitive().isBoolean()) continue;
					boolean on = e.getValue().getAsBoolean();
					Config.setFlag(e.getKey() + ".on", on);
					for (HudModule m : Modules.ALL) if (m.id().equals(e.getKey())) Config.get().of(m).enabled = on;
					if (e.getKey().equals("togglesprint")) Config.get().toggleSprint = on;
				}
			}
			if (root.has("hotkeys") && root.get("hotkeys").isJsonObject()) {
				JsonObject h = root.getAsJsonObject("hotkeys");
				if (h.has("open_mod_menu")) openMenuKey = keyCode(h.get("open_mod_menu").getAsString());
			}
			LuminosClient.LOGGER.info("[luminos] applied launcher config from {}", f);
		} catch (Exception e) {
			LuminosClient.LOGGER.warn("[luminos] could not read config/luminos/config.json (ignored)", e);
		}
	}

	/** Writes the current state, keeping any keys the launcher added that the game does not know about. */
	static void write() {
		try {
			Path f = file();
			JsonObject root = new JsonObject();
			if (Files.exists(f)) {
				try { root = JsonParser.parseString(Files.readString(f)).getAsJsonObject(); } catch (Exception ignored) { root = new JsonObject(); }
			}
			JsonObject mods = root.has("modules") && root.get("modules").isJsonObject() ? root.getAsJsonObject("modules") : new JsonObject();
			for (HudModule m : Modules.ALL) mods.addProperty(m.id(), Config.get().of(m).enabled);
			if (Config.get().opt != null) for (Map.Entry<String, Float> e : Config.get().opt.entrySet()) {
				if (e.getKey().endsWith(".on")) mods.addProperty(e.getKey().substring(0, e.getKey().length() - 3), e.getValue() >= 0.5f);
			}
			mods.addProperty("togglesprint", Config.get().toggleSprint);
			root.add("modules", mods);
			JsonObject hud = new JsonObject();
			for (HudModule m : Modules.ALL) {
				Config.ModuleCfg c = Config.get().of(m);
				JsonObject o = new JsonObject();
				o.addProperty("x", c.x); o.addProperty("y", c.y); o.addProperty("scale", c.scale);
				hud.add(m.id(), o);
			}
			root.add("hud", hud);
			root.addProperty("writtenBy", "game");
			root.addProperty("clientVersion", LuminosClient.VERSION);
			Files.createDirectories(f.getParent());
			Files.writeString(f, Config.gson().toJson(root));
		} catch (Exception e) {
			LuminosClient.LOGGER.warn("[luminos] could not write config/luminos/config.json", e);
		}
	}
}
