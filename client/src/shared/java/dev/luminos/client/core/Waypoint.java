package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** A saved position with a label, colour and dimension. Persisted as one string per waypoint inside the client config. */
public record Waypoint(String name, int x, int y, int z, String dimension, int rgb) {
	public static final int[] PALETTE = {0x4F8CFF, 0x5BE3A0, 0xFFC857, 0xFF7A90, 0xC792FF, 0x56D6E6};

	public Waypoint {
		name = clean(name);
		if (name.isEmpty()) name = "Waypoint";
		dimension = normalizeDimension(dimension);
		rgb &= 0xFFFFFF;
	}

	private static String clean(String s) {
		StringBuilder b = new StringBuilder();
		for (char c : s.strip().toCharArray()) if (c != '|' && c != '\n' && c != '\r' && c >= 32) b.append(c);
		return b.length() > 24 ? b.substring(0, 24) : b.toString();
	}

	/** Accepts {@code minecraft:the_nether} or the {@code ResourceKey[minecraft:dimension / minecraft:the_nether]} text of a dimension key. */
	public static String normalizeDimension(String d) {
		if (d == null || d.isBlank()) return "minecraft:overworld";
		String s = d.strip();
		int slash = s.lastIndexOf(" / ");
		if (slash >= 0) s = s.substring(slash + 3);
		if (s.endsWith("]")) s = s.substring(0, s.length() - 1);
		return s.contains(":") ? s : "minecraft:" + s;
	}

	public static String dimensionLabel(String dim) {
		return switch (normalizeDimension(dim)) {
			case "minecraft:overworld" -> "Overworld";
			case "minecraft:the_nether" -> "Nether";
			case "minecraft:the_end" -> "End";
			default -> normalizeDimension(dim).substring(normalizeDimension(dim).indexOf(':') + 1);
		};
	}

	public double distance(double px, double py, double pz) {
		double dx = x + 0.5 - px, dy = y - py, dz = z + 0.5 - pz;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	/** Only waypoints in {@code dim}, nearest first. */
	public static List<Waypoint> nearest(List<Waypoint> all, String dim, double px, double py, double pz) {
		String d = normalizeDimension(dim);
		List<Waypoint> out = new ArrayList<>();
		for (Waypoint w : all) if (w.dimension().equals(d)) out.add(w);
		out.sort(Comparator.comparingDouble(w -> w.distance(px, py, pz)));
		return out;
	}

	public static String distanceLabel(double blocks) {
		return blocks < 1000 ? Math.round(blocks) + " m" : String.format(java.util.Locale.ROOT, "%.1f km", blocks / 1000.0);
	}

	public String encode() {
		return name + "|" + x + "|" + y + "|" + z + "|" + dimension + "|" + String.format("%06x", rgb);
	}

	/** @return null if the string is not a waypoint (a corrupt config line must never crash the client) */
	public static Waypoint decode(String s) {
		if (s == null) return null;
		String[] p = s.split("\\|", -1);
		if (p.length != 6) return null;
		try {
			return new Waypoint(p[0], Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), p[4], Integer.parseInt(p[5], 16));
		} catch (NumberFormatException e) {
			return null;
		}
	}
}
