package dev.luminos.client.core;

/**
 * Frame-queue guard in the spirit of NVIDIA Reflex's low-latency mode. When the GPU is the bottleneck the CPU runs ahead and the
 * frames it has already queued make every input feel late. The guard estimates how much of each frame the CPU actually works
 * (busy) against how long the frame takes end to end (wall), and holds the CPU back by most of the difference before input is
 * sampled, never by more than {@code maxWaitMs}.
 *
 * The estimator is unit-tested. Its effect on real input latency has NOT been measured (no GPU in CI), so the module that
 * uses it ships off by default and is labelled experimental.
 */
public final class FramePacer {
	private final double maxWaitMs;
	private double wallEma, busyEma;
	private boolean primed;

	public FramePacer(double maxWaitMs) { this.maxWaitMs = maxWaitMs; }

	public void record(double wallMs, double busyMs) {
		if (wallMs <= 0 || wallMs > 250) return;   // a pause or a loading hitch is not a pacing signal
		busyMs = Math.min(busyMs, wallMs);
		if (!primed) { wallEma = wallMs; busyEma = busyMs; primed = true; return; }
		wallEma += (wallMs - wallEma) * 0.1;
		busyEma += (busyMs - busyEma) * 0.1;
	}

	/** Milliseconds to wait before sampling input this frame (0 when the CPU is the bottleneck). */
	public double waitMs() {
		if (!primed) return 0;
		double slack = wallEma - busyEma;
		if (slack < 1.0) return 0;   // under 1 ms of slack: nothing is queueing
		return Math.max(0, Math.min(maxWaitMs, slack * 0.8 - 0.3));
	}

	public double wallMs() { return wallEma; }

	public double busyMs() { return busyEma; }
}
