package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.List;

/** Keeps the last ten deaths with the hits that led to them, and turns one into a timeline and a damage graph. */
public final class DeathRecap {
	public record Hit(long atMs, String source, float damage) {}
	public record Death(long atMs, String cause, int x, int y, int z, String dimension, List<Hit> hits, List<String> inventory) {
		public float total() { float t = 0; for (Hit h : hits) t += h.damage(); return t; }
		/** Hits from the last {@code windowMs} before death, oldest first. */
		public List<Hit> timeline(long windowMs) { List<Hit> o = new ArrayList<>(); for (Hit h : hits) if (atMs - h.atMs() <= windowMs) o.add(h); o.sort((a, b) -> Long.compare(a.atMs(), b.atMs())); return o; }
		/** Damage per bucket, newest bucket last: the bars of the graph. */
		public float[] graph(long windowMs, int buckets) { float[] g = new float[buckets]; for (Hit h : timeline(windowMs)) { int b = (int) Math.min(buckets - 1, (h.atMs() - (atMs - windowMs)) * buckets / Math.max(1, windowMs)); g[Math.max(0, b)] += h.damage(); } return g; }
		public String summary() { return cause + " after " + String.format("%.1f", total()) + " damage in " + hits.size() + " hits"; }
	}
	public static final int KEEP = 10;
	private final List<Hit> recent = new ArrayList<>(); private final List<Death> deaths = new ArrayList<>();
	public void hit(long atMs, String source, float damage) { recent.add(new Hit(atMs, source, damage)); recent.removeIf(h -> atMs - h.atMs() > 15_000); }
	public Death died(long atMs, String cause, int x, int y, int z, String dimension, List<String> inventory) {
		Death d = new Death(atMs, cause, x, y, z, Waypoint.normalizeDimension(dimension), List.copyOf(recent), List.copyOf(inventory)); deaths.add(0, d); while (deaths.size() > KEEP) deaths.remove(deaths.size() - 1); recent.clear(); return d;
	}
	public List<Death> deaths() { return List.copyOf(deaths); }
	/** The waypoint a death leaves behind. */
	public static Waypoint marker(Death d) { return new Waypoint("Death", d.x(), d.y(), d.z(), d.dimension(), 0xFF7A90); }
}
