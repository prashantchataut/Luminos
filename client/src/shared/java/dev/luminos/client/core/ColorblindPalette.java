package dev.luminos.client.core;

/**
 * Status colours for the HUD and panel. The red/green-deficiency sets take their hues from the Okabe-Ito palette (Okabe and Ito, 2008)
 * and lighten "ok" so that good and bad differ in lightness as well as hue; CoreTests asserts that, plus 4.5:1 text contrast.
 */
public enum ColorblindPalette {
	DEFAULT(0x5BE3A0, 0xFFC857, 0xFF7A90, 0x4F8CFF),
	DEUTERANOPIA(0x8FD3FF, 0xF0E442, 0xE69F00, 0x56B4E9),
	PROTANOPIA(0x8FD3FF, 0xF0E442, 0xE69F00, 0x56B4E9),
	TRITANOPIA(0x5BE3A0, 0xFFE0B0, 0xFF7A90, 0x9CD6C8),
	HIGH_CONTRAST(0xFFFFFF, 0xFFFF55, 0xFF9090, 0xA8C8FF);

	public final int ok, warn, danger, accent;

	ColorblindPalette(int ok, int warn, int danger, int accent) {
		this.ok = 0xFF000000 | ok;
		this.warn = 0xFF000000 | warn;
		this.danger = 0xFF000000 | danger;
		this.accent = 0xFF000000 | accent;
	}

	public static ColorblindPalette byName(String n) {
		for (ColorblindPalette p : values()) if (p.name().equalsIgnoreCase(n)) return p;
		return DEFAULT;
	}

	public static double luminance(int argb) {
		return 0.2126 * lin((argb >> 16) & 255) + 0.7152 * lin((argb >> 8) & 255) + 0.0722 * lin(argb & 255);
	}

	private static double lin(int c8) {
		double c = c8 / 255.0;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}

	/** WCAG 2.x contrast ratio, 1..21. */
	public static double contrast(int a, int b) {
		double l1 = luminance(a), l2 = luminance(b);
		return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
	}
}
