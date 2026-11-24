package dev.luminos.client.core;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Reads the end of a log file and keeps only warnings and errors, collapsing repeats. For the in-game session log viewer. */
public final class LogTail {
	private LogTail() {}

	public enum Level { INFO, WARN, ERROR }

	public static Level level(String line) {
		if (line.contains("/ERROR]") || line.contains("[ERROR]") || line.contains("] ERROR")) return Level.ERROR;
		if (line.contains("/WARN]") || line.contains("[WARN]") || line.contains("] WARN")) return Level.WARN;
		if (line.startsWith("Caused by:") || line.contains("Exception:")) return Level.ERROR;
		return Level.INFO;
	}

	/** Last {@code maxLines} lines at or above {@code min}; consecutive duplicates collapse to "line (x3)". Reads at most 256 KB from the end. */
	public static List<String> tail(Path file, int maxLines, Level min) throws IOException {
		byte[] data;
		try (RandomAccessFile f = new RandomAccessFile(file.toFile(), "r")) {
			long len = f.length(), start = Math.max(0, len - 256 * 1024);
			data = new byte[(int) (len - start)];
			f.seek(start);
			f.readFully(data);
		}
		return filter(new String(data, StandardCharsets.UTF_8).split("\\R"), maxLines, min);
	}

	public static List<String> filter(String[] lines, int maxLines, Level min) {
		List<String> out = new ArrayList<>();
		String last = null;
		int run = 0;
		for (String raw : lines) {
			String line = raw.strip();
			if (line.isEmpty() || level(line).compareTo(min) < 0) continue;
			if (line.equals(last)) { run++; out.set(out.size() - 1, line + " (x" + (run + 1) + ")"); continue; }
			last = line;
			run = 0;
			out.add(line);
		}
		return out.size() <= maxLines ? out : new ArrayList<>(out.subList(out.size() - maxLines, out.size()));
	}
}
