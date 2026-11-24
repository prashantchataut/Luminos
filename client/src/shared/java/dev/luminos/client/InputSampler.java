package dev.luminos.client;

import dev.luminos.client.core.ClickStats;
import dev.luminos.client.core.FramePacer;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;

/**
 * Render-loop input sampling (the idea behind No Input Lag Tick Rate, written fresh, without mixins).
 *
 * Vanilla notes a click the moment it arrives (KeyMapping keeps a press count) but only acts on it at the next client tick,
 * 0-50 ms later, and its CPS counter samples the held state at 20 Hz, which merges fast clicks. Here, every rendered frame
 * we drain the press counts of attack and use and run the action right away (Minecraft.startAttack / startUseItem, made
 * accessible by an access widener), and count presses at press time.
 *
 * InputBooster-class tap latching: a tap of sprint or jump shorter than a tick (or a frame hitch) can be over before the tick
 * reads the key. A tap is latched for exactly one tick so it is not lost.
 *
 * Frame-queue guard (experimental, off by default): see {@link FramePacer}.
 *
 * Nothing runs while a screen is open, in a menu, or without a world: those clicks belong to the screen.
 */
public final class InputSampler {
	private InputSampler() {}

	private static final ClickStats STATS = new ClickStats();
	private static final long[] L = new long[64], R = new long[64];
	private static int li, ri;
	private static boolean wasL, wasR;
	private static final FramePacer PACER = new FramePacer(3);
	private static long lastFrame;
	private static final boolean[] tapPending = new boolean[2], tapLatched = new boolean[2];

	public static ClickStats stats() { return STATS; }

	private static int count(long[] a) {
		long now = System.currentTimeMillis();
		int n = 0;
		for (long t : a) if (t != 0 && now - t < 1000) n++;
		return n;
	}

	public static int left() { return count(L); }

	public static int right() { return count(R); }

	private static KeyMapping tapKey(Minecraft mc, int i) { return i == 0 ? mc.options.keySprint : mc.options.keyJump; }

	private static long fence;
	private static boolean guardBroken;

	/** End of every rendered frame (the last HUD layer): drop a GL fence so the next frame can tell whether the GPU kept up. */
	public static void frameEnd(Minecraft mc) {
		if (guardBroken || !Config.flag("frame_guard.on", false)) return;
		if (!Probes.glCurrent()) { guardBroken = true; LuminosClient.LOGGER.info("frame guard off: this renderer has no OpenGL context (Vulkan backend)"); return; }
		try {
			if (fence != 0) org.lwjgl.opengl.GL32.glDeleteSync(fence);
			fence = org.lwjgl.opengl.GL32.glFenceSync(org.lwjgl.opengl.GL32.GL_SYNC_GPU_COMMANDS_COMPLETE, 0);
		} catch (Throwable t) { guardBroken = true; fence = 0; LuminosClient.LOGGER.warn("frame guard unavailable on this GL context", t); }
	}

	/**
	 * Frame-queue guard: if the previous frame's GPU work is still running (the CPU is ahead, so frames are queueing and every
	 * input will be drawn late), wait for it, but never longer than frame_guard.max ms. Costs nothing when the CPU is the bottleneck.
	 */
	private static void guard() {
		if (guardBroken || fence == 0 || !Config.flag("frame_guard.on", false) || !Probes.glCurrent()) return;
		long t0 = System.nanoTime();
		try {
			long cap = (long) (Math.max(0.2f, Config.num("frame_guard.max", 2f)) * 1e6);
			org.lwjgl.opengl.GL32.glClientWaitSync(fence, org.lwjgl.opengl.GL32.GL_SYNC_FLUSH_COMMANDS_BIT, cap);
		} catch (Throwable t) { guardBroken = true; return; }
		double waited = (System.nanoTime() - t0) / 1e6;
		queued = queued * 0.9 + waited * 0.1;
	}

	private static double queued;

	/** Smoothed milliseconds per frame the guard had to wait: roughly how far ahead of the GPU the CPU was running. */
	public static double queueAheadMs() { return queued; }

	public static boolean guardAvailable() { return !guardBroken; }

	/** Start of every rendered frame (the first HUD layer). */
	public static void frame(Minecraft mc) {
		long now = System.nanoTime();
		if (lastFrame != 0 && mc.player != null && (now - lastFrame) < 1_000_000_000L) Probes.FRAMES.add((now - lastFrame) / 1e6);
		if (lastFrame != 0 && mc.player != null) PACER.record((now - lastFrame) / 1e6, Math.max(0, (now - lastFrame) / 1e6 - queued));
		lastFrame = now;
		boolean live = mc.player != null && Nav.screen(mc) == null && Nav.overlay(mc) == null;
		if (!live) return;
		boolean on = Config.flag("input_sampling.on", true);
		guard();
		long t = System.nanoTime(), ms = System.currentTimeMillis();
		STATS.onFrame(t);
		// attack
		if (on && Config.flag("input_sampling.attack", true)) {
			while (mc.options.keyAttack.consumeClick()) { L[li++ & 63] = ms; STATS.press(t); mc.startAttack(); }
			wasL = mc.options.keyAttack.isDown();
		} else {
			boolean d = mc.options.keyAttack.isDown();
			if (d && !wasL) { L[li++ & 63] = ms; STATS.press(t); }
			wasL = d;
		}
		// use
		if (on && Config.flag("input_sampling.use", true)) {
			while (mc.options.keyUse.consumeClick()) { R[ri++ & 63] = ms; mc.startUseItem(); }
			wasR = mc.options.keyUse.isDown();
		} else {
			boolean d = mc.options.keyUse.isDown();
			if (d && !wasR) R[ri++ & 63] = ms;
			wasR = d;
		}
		// tap latching
		if (on && Config.flag("input_sampling.taps", true) && !mc.options.toggleSprint().get()) {
			for (int i = 0; i < 2; i++) while (tapKey(mc, i).consumeClick()) tapPending[i] = true;
		}
	}

	/** Start of every client tick, before the player reads its keys. */
	public static void tick(Minecraft mc) {
		STATS.onTick(System.nanoTime());
		for (int i = 0; i < 2; i++) {
			KeyMapping k = tapKey(mc, i);
			if (tapLatched[i]) { tapLatched[i] = false; if (!tapPending[i]) k.setDown(false); }
			if (tapPending[i]) {
				tapPending[i] = false;
				if (!k.isDown() && mc.player != null && Nav.screen(mc) == null) { k.setDown(true); tapLatched[i] = true; }
			}
		}
	}
}
