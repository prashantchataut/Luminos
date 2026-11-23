package dev.luminos.client;

import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/** Named layouts/settings snapshots in config/luminos-profiles/*.json (copy the folder to export or import). */
public final class Profiles {
	private Profiles() {}

	public static Path dir() { return FabricLoader.getInstance().getConfigDir().resolve("luminos-profiles"); }

	public static List<String> list() {
		List<String> out = new ArrayList<>();
		out.add("default");
		try (Stream<Path> s = Files.exists(dir()) ? Files.list(dir()) : Stream.<Path>empty()) {
			s.map(p -> p.getFileName().toString()).filter(n -> n.endsWith(".json")).map(n -> n.substring(0, n.length() - 5)).sorted()
				.filter(n -> !n.equals("default")).forEach(out::add);
		} catch (IOException ignored) { }
		return out;
	}

	public static void save(String name) {
		try {
			Files.createDirectories(dir());
			Files.writeString(dir().resolve(name + ".json"), Config.gson().toJson(Config.get()));
		} catch (IOException e) { LuminosClient.LOGGER.warn("profile save failed", e); }
	}

	public static boolean load(String name) {
		try {
			Path f = dir().resolve(name + ".json");
			if (!Files.exists(f)) return false;
			Config n = Config.gson().fromJson(Files.readString(f), Config.class);
			if (n == null) return false;
			Config old = Config.get();
			if (n.modules == null) n.modules = new java.util.LinkedHashMap<>();
			save(old.activeProfile);                     // keep what the previous profile looked like
			n.customTitle = old.customTitle; n.complianceMode = old.complianceMode; n.complianceServers = old.complianceServers;
			n.cosmeticSkin = old.cosmeticSkin; n.cosmeticCape = old.cosmeticCape; n.playtimeMs = old.playtimeMs;
			n.activeProfile = name;
			Config.replace(n);
			Config.save();
			return true;
		} catch (Exception e) { LuminosClient.LOGGER.warn("profile load failed", e); return false; }
	}

	public static String create() {
		int i = 1;
		while (Files.exists(dir().resolve("profile-" + i + ".json"))) i++;
		String name = "profile-" + i;
		save(name);
		return name;
	}
}
