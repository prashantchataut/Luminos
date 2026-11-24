package dev.luminos.client.core;

/**
 * Click test numbers: how many presses the OS delivered per second (raw), how many of those vanilla's 20 TPS loop can see
 * (processed), and how long a press waits before it is acted on under each model.
 *
 * Vanilla acts on a press at the next tick boundary (0 to 50 ms later, 25 ms on average) and tick-sampled counters merge presses
 * that land inside one tick. Render-loop sampling acts at the next frame instead. Both waits are measured from real timestamps
 * fed in by the client; nothing here is simulated.
 */
public final class ClickStats {
	private static final int N = 128;
	private final long[] press = new long[N], tick = new long[N], frame = new long[N];
	private int head;

	public void press(long nowNs) {
		int i = head++ & (N - 1);
		press[i] = nowNs;
		tick[i] = 0;
		frame[i] = 0;
	}

	/** A client tick ran: every press waiting for one is now handled by vanilla's loop. */
	public void onTick(long nowNs) {
		for (int i = 0; i < N; i++) if (press[i] != 0 && tick[i] == 0) tick[i] = nowNs;
	}

	/** A frame is being rendered: every press waiting for one is now handled by render-loop sampling. */
	public void onFrame(long nowNs) {
		for (int i = 0; i < N; i++) if (press[i] != 0 && frame[i] == 0) frame[i] = nowNs;
	}

	public int rawPerSecond(long nowNs) {
		int n = 0;
		for (long p : press) if (p != 0 && nowNs - p < 1_000_000_000L) n++;
		return n;
	}

	/** Presses vanilla can distinguish: one per distinct tick, however many landed in it. */
	public int tickPerSecond(long nowNs) {
		long[] seen = new long[N];
		int n = 0;
		outer:
		for (int i = 0; i < N; i++) {
			if (press[i] == 0 || nowNs - press[i] >= 1_000_000_000L || tick[i] == 0) continue;
			for (int k = 0; k < n; k++) if (seen[k] == tick[i]) continue outer;
			seen[n++] = tick[i];
		}
		return n;
	}

	public double avgTickWaitMs() { return avg(tick); }

	public double avgFrameWaitMs() { return avg(frame); }

	private double avg(long[] handled) {
		double sum = 0;
		int n = 0;
		for (int i = 0; i < N; i++) if (press[i] != 0 && handled[i] != 0 && handled[i] >= press[i]) { sum += (handled[i] - press[i]) / 1e6; n++; }
		return n == 0 ? 0 : sum / n;
	}

	public int samples() {
		int n = 0;
		for (int i = 0; i < N; i++) if (press[i] != 0 && tick[i] != 0 && frame[i] != 0) n++;
		return n;
	}
}
