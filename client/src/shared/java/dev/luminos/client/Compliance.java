package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;

/** Per-server compliance mode: advantage-capable modules switch off on servers that ban them. No cheat modules exist. */
public final class Compliance {
	private Compliance() {}

	public static boolean restricted(Minecraft mc) {
		String mode = Config.get().complianceMode;
		if ("always".equals(mode)) return true;
		if (!"auto".equals(mode)) return false;
		ServerData d = mc.getCurrentServer();
		if (d == null || d.ip == null) return false;
		String ip = d.ip.toLowerCase(java.util.Locale.ROOT);
		for (String s : Config.get().complianceServers) if (ip.equals(s) || ip.endsWith("." + s)) return true;
		return false;
	}

	public static String label() {
		return switch (Config.get().complianceMode) { case "always" -> "Always"; case "off" -> "Off"; default -> "Auto"; };
	}

	public static void cycle() {
		Config c = Config.get();
		c.complianceMode = switch (c.complianceMode) { case "auto" -> "always"; case "always" -> "off"; default -> "auto"; };
		Config.save();
	}
}
