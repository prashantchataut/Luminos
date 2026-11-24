package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Compass bearing, distance to a waypoint, and finding coordinates in chat so they can be made clickable. */
public final class NavMath {
	/** Bearing in degrees clockwise from north (-z), 0..360. Minecraft yaw 0 faces south (+z). */
	public static double bearing(double fromX, double fromZ, double toX, double toZ) { double a = Math.toDegrees(Math.atan2(toX - fromX, -(toZ - fromZ))); return (a + 360) % 360; }
	public static String cardinal(double deg) { String[] n = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }; return n[(int) Math.round(((deg % 360) + 360) % 360 / 45.0) % 8]; }
	/** Yaw (Minecraft convention) to bearing from north. */
	public static double yawToBearing(double yaw) { return ((yaw + 180) % 360 + 360) % 360; }
	/** Signed turn in degrees (-180..180) from where you face to the target; positive is clockwise. */
	public static double turn(double yaw, double bearing) { double d = (bearing - yawToBearing(yaw) + 540) % 360 - 180; return d; }
	public static int distance(int x1, int z1, int x2, int z2) { return (int) Math.round(Math.hypot(x2 - x1, z2 - z1)); }

	public record Span(int start, int end, int x, int y, int z, boolean hasY) {}
	private static final Pattern COORDS = Pattern.compile("(?<![\\d.-])(-?\\d{1,7})(?:[ ,]+(-?\\d{1,3}))?[ ,]+(-?\\d{1,7})(?![\\d.])");
	/** Finds "x y z" and "x z" in a chat line. Needs at least two separated integers; a lone number or a decimal is ignored. */
	public static List<Span> findCoords(String text) {
		List<Span> out = new ArrayList<>(); Matcher m = COORDS.matcher(text);
		while (m.find()) { boolean y = m.group(2) != null; int x = Integer.parseInt(m.group(1)), z = Integer.parseInt(m.group(3)); out.add(new Span(m.start(), m.end(), x, y ? Integer.parseInt(m.group(2)) : 64, z, y)); }
		return out;
	}
	/** Chat share format other Luminos clients recognise: "name: x y z (dimension)". */
	public static String shareText(Waypoint w) { return w.name() + ": " + w.x() + " " + w.y() + " " + w.z() + " (" + Waypoint.dimensionLabel(w.dimension()) + ")"; }
}
