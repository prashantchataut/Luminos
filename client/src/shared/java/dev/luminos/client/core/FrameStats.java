package dev.luminos.client.core;

import java.util.Arrays;

/**
 * Fixed-size window of frame times for the performance overlay and the benchmark. No allocation per sample.
 * "1% low" uses the common definition: the average FPS of the slowest 1% of frames.
 */
public final class FrameStats {
	public record Summary(int frames, double avgFps, double low1Fps, double p99Ms) {}

	private final double[] ms;
	private int n, head;

	public FrameStats(int capacity) {
		if (capacity < 1) throw new IllegalArgumentException("capacity");
		ms = new double[capacity];
	}

	public void add(double frameMs) {
		if (!(frameMs > 0) || Double.isInfinite(frameMs)) return;
		ms[head] = frameMs;
		head = (head + 1) % ms.length;
		if (n < ms.length) n++;
	}

	/** Convenience for callers that hold nanoTime stamps. */
	public void addNanos(long previous, long now) { add((now - previous) / 1_000_000.0); }

	public int size() { return n; }

	public void clear() { n = 0; head = 0; }

	public Summary summary() {
		if (n == 0) return new Summary(0, 0, 0, 0);
		double[] w = Arrays.copyOf(ms, n);
		double sum = 0;
		for (double v : w) sum += v;
		Arrays.sort(w);
		int worst = Math.max(1, (int) Math.ceil(n * 0.01));
		double worstSum = 0;
		for (int i = n - worst; i < n; i++) worstSum += w[i];
		int p99 = Math.min(n - 1, (int) Math.ceil(n * 0.99) - 1);
		return new Summary(n, 1000.0 / (sum / n), 1000.0 / (worstSum / worst), w[p99]);
	}
}
