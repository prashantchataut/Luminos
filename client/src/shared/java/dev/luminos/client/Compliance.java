package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;

/**
 * Per-server compliance profile: modules a server's rules may treat as an advantage (fullbright, zoom, target HUD, coordinates)
 * switch off on listed servers, with a one-line reason shown in the panel. No cheat modules exist.
 */
public final class Compliance {
	private Compliance() {}

	public static boolean restricted(Minecraft mc) {
		String mode = Config.get().complianceMode;
		if ("always".equals(mode)) return true;
		if (!"auto".equals(mode)) return false;
		return host(mc) != null;
	}

	/** The listed server we are connected to, or null. */
	public static String host(Minecraft mc) {
		ServerData d = mc.getCurrentServer();
		if (d == null || d.ip == null) return null;
		String ip = d.ip.toLowerCase(java.util.Locale.ROOT);
		for (String s : Config.get().complianceServers) if (ip.equals(s) || ip.endsWith("." + s)) return s;
		return null;
	}

	/** One line: which server, which module, what happens. Null when nothing is restricted. */
	public static String reason(Minecraft mc, String module) {
		if (!restricted(mc)) return null;
		String h = host(mc);
		return h != null ? h + " can flag " + module + ": off on this server" : "Compliance mode is Always: " + module + " is off";
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
