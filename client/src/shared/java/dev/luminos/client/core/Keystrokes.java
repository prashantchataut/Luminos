package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.List;

/** Keystroke layouts as plain cell rectangles in a 3-unit grid. A: WASD with a space bar. B: WASD, space bar and two mouse buttons. */
public final class Keystrokes {
	public record Cell(String key, int col, int row, int w, int h) {}
	public static List<Cell> layout(String id) {
		List<Cell> c = new ArrayList<>(); c.add(new Cell("W", 1, 0, 1, 1)); c.add(new Cell("A", 0, 1, 1, 1)); c.add(new Cell("S", 1, 1, 1, 1)); c.add(new Cell("D", 2, 1, 1, 1));
		if ("B".equals(id)) { c.add(new Cell("LMB", 0, 2, 1, 1)); c.add(new Cell("RMB", 2, 2, 1, 1)); c.add(new Cell("SPACE", 0, 3, 3, 1)); } else c.add(new Cell("SPACE", 0, 2, 3, 1));
		return c;
	}
	public static int rows(String id) { return "B".equals(id) ? 4 : 3; }
}
