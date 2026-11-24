package dev.luminos.client.core;

import java.util.List;
import java.util.Set;

/**
 * HUD presets. Minimal is the default and follows Lunar's own advice (a quiet HUD with space around it): FPS, CPS, ping, armor and
 * potions, nothing else. Everything else stays available in the panel but off.
 */
public final class HudPresets {
	private HudPresets() {}

	public static final List<String> NAMES = List.of("minimal", "competitive", "full");

	private static final Set<String> MINIMAL = Set.of("fps", "cps", "ping", "armor_hud", "potions");
	private static final Set<String> COMPETITIVE = Set.of("fps", "cps", "ping", "armor_hud", "potions", "keystrokes", "target_hud", "health", "hunger", "sprint_status");
	private static final Set<String> FULL = Set.of("fps", "cps", "ping", "armor_hud", "potions", "keystrokes", "target_hud", "health", "hunger", "coords", "direction",
			"clock", "memory", "sprint_status", "waypoints");

	public static Set<String> enabled(String name) {
		return switch (name == null ? "minimal" : name) {
			case "competitive" -> COMPETITIVE;
			case "full" -> FULL;
			default -> MINIMAL;
		};
	}

	public static String label(String name) {
		return switch (name == null ? "minimal" : name) {
			case "competitive" -> "Competitive";
			case "full" -> "Full";
			case "custom" -> "Custom";
			default -> "Minimal";
		};
	}
}
