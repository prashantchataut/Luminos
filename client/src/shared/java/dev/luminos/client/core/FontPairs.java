package dev.luminos.client.core;

import java.util.List;

/** Font pairing presets: one face for text, one for numbers and HUD. TTF import is validated by magic number and size before it is accepted. */
public final class FontPairs {
	public record Pair(String id, String name, String text, String numbers) {}
	public static final List<Pair> ALL = List.of(
		new Pair("inter-monocraft", "Inter + Monocraft", "Inter", "Monocraft"),
		new Pair("geometric-pixel", "Geometric + pixel", "Outfit", "Press Start 2P"),
		new Pair("serif-inter", "Serif + Inter", "Source Serif 4", "Inter"),
		new Pair("system", "System", "default", "default"));
	public static Pair byId(String id) { for (Pair p : ALL) if (p.id().equals(id)) return p; return ALL.get(0); }
	/** True for TrueType/OpenType files under 8 MB. Anything else is refused with a plain message by the caller. */
	public static boolean looksLikeFont(byte[] head, long size) {
		if (size <= 0 || size > 8L * 1024 * 1024 || head.length < 4) return false;
		int m = (head[0] & 255) << 24 | (head[1] & 255) << 16 | (head[2] & 255) << 8 | (head[3] & 255);
		return m == 0x00010000 || m == 0x4F54544F || m == 0x74727565; // TrueType, 'OTTO', 'true'
	}
}
