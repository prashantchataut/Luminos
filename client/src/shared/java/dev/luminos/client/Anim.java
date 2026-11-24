package dev.luminos.client;

import java.util.HashMap;
import java.util.Map;

/**
 * Critically-underdamped springs keyed by name (liquid-glass "Motion: spring-based, with inertia").
 * Call {@link #frame()} once per rendered screen, then {@link #spring} for any number of values.
 * With Config.reduceMotion every spring snaps to its target.
 */
public final class Anim {
	private Anim() {}

	private static final Map<String, float[]> STATE = new HashMap<>();
	private static long last = System.nanoTime();
	private static float dt = 0.016f;

	public static void frame() {
		long now = System.nanoTime();
		dt = Math.min(0.05f, Math.max(0.001f, (now - last) / 1e9f));
		last = now;
	}

	/** Spring toward {@code target}; stiffness 300, damping 26: one soft overshoot, settles in about 300 ms. */
	public static float spring(String key, float target) {
		if (Config.get().reduceMotion) return target;
		float[] s = STATE.computeIfAbsent(key, k -> new float[]{target, 0});
		int steps = 3;
		float h = dt / steps;
		for (int i = 0; i < steps; i++) {
			float a = (target - s[0]) * 300f - s[1] * 26f;
			s[1] += a * h;
			s[0] += s[1] * h;
		}
		if (Math.abs(target - s[0]) < 0.001f && Math.abs(s[1]) < 0.01f) { s[0] = target; s[1] = 0; }
		return s[0];
	}

	/** Same spring, but never overshoots (for alpha, which must stay in 0..1). */
	public static float soft(String key, float target) {
		return Math.max(0f, Math.min(1f, spring(key, target)));
	}

	/** Jump a spring to a value without animating (first frame of a screen). */
	public static void snap(String key, float v) { STATE.put(key, new float[]{v, 0}); }

	public static void forget(String prefix) { STATE.keySet().removeIf(k -> k.startsWith(prefix)); }
}
