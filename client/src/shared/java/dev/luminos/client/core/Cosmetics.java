package dev.luminos.client.core;

import java.util.*;

/** Reads luminos-cosmetics.json (written by the launcher's Locker) and decides what is drawn. One slot per category; pets and wings are separate slots, so both show. */
public final class Cosmetics {
	public static final List<String> CATS = List.of("pets", "wings", "hats", "masks", "bandanas", "cloaks", "back", "emotes");
	public final Map<String, String> equipped = new LinkedHashMap<>();
	public static Cosmetics parse(String json, boolean classicClient) {
		Cosmetics c = new Cosmetics(); Map<String, Object> eq;
		try { eq = MiniJson.obj(MiniJson.obj(MiniJson.parse(json)).get("equipped")); } catch (RuntimeException e) { return c; }
		for (String cat : CATS) { String id = MiniJson.str(eq.get(cat), ""); if (id.isEmpty()) continue;
			if (classicClient && (cat.equals("pets") || cat.equals("wings") || cat.equals("emotes"))) continue; // classic client: vanilla-clean look
			c.equipped.put(cat, id); }
		return c;
	}
	/** Wings hide back items; a cloak is hidden under wings as well. */
	public List<String> drawn() { List<String> out = new ArrayList<>(equipped.values()); if (equipped.containsKey("wings")) { out.remove(equipped.get("back")); out.remove(equipped.get("cloaks")); } return out; }

	/** Two nearby Luminos players who both play a synced emote within a window are paired (Hug). */
	public static final class EmoteSync {
		public record Play(String player, String emote, double x, double y, double z, long atMs) {}
		public static final double RANGE = 4.0; public static final long WINDOW_MS = 2000;
		public static Optional<String[]> pair(Play a, Play b) {
			if (a.player().equals(b.player()) || !a.emote().equals(b.emote()) || !a.emote().endsWith("hug")) return Optional.empty();
			double dx = a.x() - b.x(), dy = a.y() - b.y(), dz = a.z() - b.z();
			if (Math.sqrt(dx * dx + dy * dy + dz * dz) > RANGE || Math.abs(a.atMs() - b.atMs()) > WINDOW_MS) return Optional.empty();
			return Optional.of(new String[] { a.player(), b.player() });
		}
	}
}
