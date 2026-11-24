package dev.luminos.client;

import dev.luminos.client.core.Waypoint;
import net.minecraft.client.Minecraft;

import java.util.ArrayList;
import java.util.List;

/** Waypoints live in {@link Config#waypoints} as encoded strings; this class parses them (cached) and edits them. */
public final class WaypointStore {
	private WaypointStore() {}

	private static List<Waypoint> cache = List.of();
	private static int cacheKey = Integer.MIN_VALUE;

	public static List<Waypoint> all() {
		List<String> raw = Config.get().waypoints;
		int key = raw.hashCode();
		if (key != cacheKey) {
			List<Waypoint> out = new ArrayList<>();
			for (String s : raw) { Waypoint w = Waypoint.decode(s); if (w != null) out.add(w); }   // corrupt lines are skipped, never fatal
			cache = out;
			cacheKey = key;
		}
		return cache;
	}

	/** {@code ResourceKey.toString()} is stable across Minecraft lines, unlike the accessor that returns its id. */
	public static String dimension(Minecraft mc) {
		return mc.level == null ? "minecraft:overworld" : Waypoint.normalizeDimension(mc.level.dimension().toString());
	}

	public static Waypoint addHere(Minecraft mc) {
		if (mc.player == null) return null;
		int n = all().size();
		Waypoint w = new Waypoint("Waypoint " + (n + 1), (int) Math.floor(mc.player.getX()), (int) Math.floor(mc.player.getY()), (int) Math.floor(mc.player.getZ()),
			dimension(mc), Waypoint.PALETTE[n % Waypoint.PALETTE.length]);
		Config.get().waypoints.add(w.encode());
		Config.save();
		return w;
	}

	public static void remove(Waypoint w) {
		Config.get().waypoints.remove(w.encode());
		Config.save();
	}
}
