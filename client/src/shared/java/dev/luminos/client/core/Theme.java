package dev.luminos.client.core;

import java.util.Map;

/** The three client themes. Same tokens as app/src/themes/*.json: surfaces, text, accent only. A theme never touches layout, icons or motion. */
public enum Theme {
	CLEAN("clean", 0x141516, 0x1c1d1f, 0x26282b, 0x35383c, 0xf3f4f5, 0xa9aeb4, 0x3fb68b, 0x06110d),
	COBALT("cobalt", 0x090d19, 0x0f1527, 0x171f38, 0x242d4a, 0xe9eeff, 0xa4afd2, 0x7ba3ff, 0x07102a),
	LIGHT("light", 0xf1f2f4, 0xffffff, 0xe9ebee, 0xc5cad2, 0x14161a, 0x464c55, 0x1d4ed8, 0xffffff);
	public final String id; public final int bg, surface, surface2, line, fg, mute, accent, accentInk;
	Theme(String id, int bg, int surface, int surface2, int line, int fg, int mute, int accent, int accentInk) { this.id = id; this.bg = bg; this.surface = surface; this.surface2 = surface2; this.line = line; this.fg = fg; this.mute = mute; this.accent = accent; this.accentInk = accentInk; }
	public static Theme byId(String id) { for (Theme t : values()) if (t.id.equalsIgnoreCase(id)) return t; return "lunar".equalsIgnoreCase(id) ? COBALT : CLEAN; }
	public static double luminance(int rgb) { double[] c = { (rgb >> 16 & 255) / 255.0, (rgb >> 8 & 255) / 255.0, (rgb & 255) / 255.0 }; for (int k = 0; k < 3; k++) c[k] = c[k] <= 0.03928 ? c[k] / 12.92 : Math.pow((c[k] + 0.055) / 1.055, 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
	public static double ratio(int a, int b) { double x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
	/** Lowest text contrast in the theme: foreground and muted text on surface and raised surface. */
	public double minTextRatio() { return Math.min(Math.min(ratio(fg, surface), ratio(fg, surface2)), Math.min(ratio(mute, surface), Math.min(ratio(mute, surface2), ratio(accentInk, accent)))); }
	/** Panels are one solid fill with one border: ARGB. */
	public int panelFill() { return 0xFF000000 | surface; }
	public int panelBorder() { return 0xFF000000 | line; }
}
