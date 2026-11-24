package dev.luminos.client.core;

import dev.luminos.client.core.FrameStats.Summary;
import java.util.Locale;

/**
 * Formats a before/after benchmark pair as a row for docs/PERF.md. A row can only say VERIFIED when it came from the named hardware;
 * everything else must be passed as {@code verified=false} and says UNVERIFIED plus the reason.
 */
public final class BenchReport {
	private BenchReport() {}

	public static double changePercent(double before, double after) {
		return before <= 0 ? 0 : (after - before) / before * 100.0;
	}

	public static String header() {
		return "| Hardware | Avg FPS before | Avg FPS after | Change | 1% low before | 1% low after | Status |\n|---|---|---|---|---|---|---|";
	}

	public static String row(String hardware, Summary before, Summary after, boolean verified, String note) {
		String status = verified ? "VERIFIED" : "UNVERIFIED" + (note == null || note.isBlank() ? "" : " (" + note + ")");
		return String.format(Locale.ROOT, "| %s | %.1f | %.1f | %+.1f%% | %.1f | %.1f | %s |", hardware, before.avgFps(), after.avgFps(),
			changePercent(before.avgFps(), after.avgFps()), before.low1Fps(), after.low1Fps(), status);
	}
}
