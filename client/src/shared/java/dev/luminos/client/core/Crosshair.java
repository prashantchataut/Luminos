package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.List;

/** Crosshair geometry as rectangles around (0,0): the renderer fills each one. Opacity is applied by the caller. */
public final class Crosshair {
	public record Rect(int x1, int y1, int x2, int y2, boolean outline) {}
	public static List<Rect> build(ClientFile.Crosshair c, float spreadPx) {
		List<Rect> r = new ArrayList<>(); int t = c.thickness, g = c.gap + Math.round(c.spread ? spreadPx : 0), l = c.length, h = t / 2; int o = c.outline;
		switch (c.shape) {
			case "dot" -> add(r, -h, -h, t - h, t - h, o);
			case "cross" -> { add(r, -h, -g - l, t - h, -g, o); add(r, -h, g, t - h, g + l, o); add(r, -g - l, -h, -g, t - h, o); add(r, g, -h, g + l, t - h, o); }
			case "plus" -> { add(r, -l, -h, l + t - h, t - h, o); add(r, -h, -l, t - h, l + t - h, o); }
			default -> { // dot-ring: a dot with four ticks at the ring radius
				add(r, -h, -h, t - h, t - h, o); int rad = g + l; add(r, -h, -rad, t - h, -rad + t, o); add(r, -h, rad - t, t - h, rad, o); add(r, -rad, -h, -rad + t, t - h, o); add(r, rad - t, -h, rad, t - h, o); }
		}
		return r;
	}
	private static void add(List<Rect> r, int x1, int y1, int x2, int y2, int outline) { if (outline > 0) r.add(new Rect(x1 - outline, y1 - outline, x2 + outline, y2 + outline, true)); r.add(new Rect(x1, y1, x2, y2, false)); }
}
