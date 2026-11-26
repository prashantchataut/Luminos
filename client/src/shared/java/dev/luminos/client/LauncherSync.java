package dev.luminos.client;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;

/**
 * Two-way mirror of module toggles, hotkeys and HUD layout with {@code <game dir>/config/luminos/config.json}, the file the launcher writes
 * before every launch. Applied when the client starts; rewritten (with in-game changes) every time the client saves.
 */
final class LauncherSync {
	private LauncherSync() {}

	/** GLFW code of the launcher's "Open Client Quick Panel" key, or -1 to use only the defaults (Right Ctrl / Right Shift). */
	static int openMenuKey = -1;

	/** HUD positions in the file are fractions of this reference canvas (the launcher's HUD Studio draws on the same 640x360). */
	static final float REF_W = 640f, REF_H = 360f;
	/** lastModified of the file as of our own last read or write; a different value means the launcher changed it. */
	private static long seen = -1L;
	private static int pollTicks;

	/** Called every client tick: about once a second, re-applies the file if the launcher rewrote it while the game runs. */
	static void poll() {
		if (++pollTicks < 20) return;
		pollTicks = 0;
		try {
			Path f = file();
			if (!Files.exists(f)) return;
			long m = Files.getLastModifiedTime(f).toMillis();
			if (m != seen) { LuminosClient.LOGGER.info("[luminos] config.json changed on disk, reloading live"); apply(); }
		} catch (Exception ignored) { /* retry next second */ }
	}

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
			seen = Files.getLastModifiedTime(f).toMillis();
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
			if (root.has("hud") && root.get("hud").isJsonObject()) {
				JsonObject hud = root.getAsJsonObject("hud");
				for (HudModule m : Modules.ALL) {
					if (!hud.has(m.id()) || !hud.get(m.id()).isJsonObject()) continue;
					JsonObject o = hud.getAsJsonObject(m.id());
					Config.ModuleCfg c = Config.get().of(m);
					if (o.has("nx") && o.has("ny")) {
						c.x = Math.round(Math.max(0f, Math.min(1f, o.get("nx").getAsFloat())) * REF_W);
						c.y = Math.round(Math.max(0f, Math.min(1f, o.get("ny").getAsFloat())) * REF_H);
					}
					if (o.has("scale") && o.get("scale").getAsFloat() > 0f) c.scale = o.get("scale").getAsFloat();
				}
			}
			if (root.has("cape") && root.get("cape").isJsonPrimitive()) Config.get().cosmeticCape = root.get("cape").getAsString();
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
				o.addProperty("nx", c.x / REF_W); o.addProperty("ny", c.y / REF_H); o.addProperty("enabled", c.enabled);
				hud.add(m.id(), o);
			}
			root.add("hud", hud);
			root.addProperty("cape", Config.get().cosmeticCape == null ? "" : Config.get().cosmeticCape);
			root.addProperty("version", 3);
			root.addProperty("writtenBy", "game");
			root.addProperty("clientVersion", LuminosClient.VERSION);
			Files.createDirectories(f.getParent());
			Path tmp = f.resolveSibling("config.json.tmp");
			Files.writeString(tmp, Config.gson().toJson(root));
			try { Files.move(tmp, f, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
			catch (AtomicMoveNotSupportedException e) { Files.move(tmp, f, StandardCopyOption.REPLACE_EXISTING); }
			seen = Files.getLastModifiedTime(f).toMillis();   // our own write is not a launcher change
		} catch (Exception e) {
			LuminosClient.LOGGER.warn("[luminos] could not write config/luminos/config.json", e);
		}
	}
}
