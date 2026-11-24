package dev.luminos.client;

/** Ordered-dither night sky, drawn with plain fills. Cheap: a few thousand rects at most; time freezes when the window is unfocused. */
public final class TitleArt {
	private TitleArt() {}

	private static final int[] BAND = {0xFF040716, 0xFF070D2A, 0xFF0B1642, 0xFF102364, 0xFF173188, 0xFF1F43A8};
	private static final int CELL = 3;

	public static void draw(Gfx g, long ms) {
		int w = g.width(), h = g.height();
		int horizon = (int) (h * 0.72f);
		int bh = Math.max(8, horizon / BAND.length);
		for (int i = 0; i < BAND.length; i++) {
			int y0 = i * bh, y1 = i == BAND.length - 1 ? h : (i + 1) * bh;
			g.fill(0, y0, w, y1, BAND[i]);
			if (i + 1 < BAND.length) {
				// two dithered rows across each band edge (Bayer 2x2 feel)
				for (int row = 0; row < 4; row++) {
					for (int cx = 0; cx * CELL < w; cx++) {
						boolean on = ((cx + row) & 1) == 0 ? row < 2 : row >= 2;
						if (on && ((cx * 7 + row * 3) % 5) != 0) g.fill(cx * CELL, y1 - 3 * CELL + row * CELL, cx * CELL + CELL, y1 - 2 * CELL + row * CELL, BAND[i + 1]);
					}
				}
			}
		}
		// stars
		long seed = 91;
		for (int i = 0; i < 70; i++) {
			seed = seed * 6364136223846793005L + 1442695040888963407L;
			int sx = (int) ((seed >>> 33) % w), sy = (int) (((seed >>> 13) & 0x7FFFFFFF) % Math.max(1, horizon - 20));
			boolean tw = ((ms / 700 + i) % 6) == 0;
			int c = tw ? 0xFFFFFFFF : (i % 3 == 0 ? 0xFFB9CCFF : 0xFF6F86C8);
			g.fill(sx, sy, sx + (i % 7 == 0 ? 2 : 1), sy + (i % 7 == 0 ? 2 : 1), c);
		}
		// moon (pixel disc + dithered halo)
		int mxp = (int) (w * 0.74f), myp = (int) (h * 0.26f), r = Math.max(10, h / 14);
		for (int dy = -r - 8; dy <= r + 8; dy += 2)
			for (int dx = -r - 8; dx <= r + 8; dx += 2) {
				int d2 = dx * dx + dy * dy;
				if (d2 <= r * r) g.fill(mxp + dx, myp + dy, mxp + dx + 2, myp + dy + 2, d2 < (r - 3) * (r - 3) ? 0xFFDCE8FF : 0xFFB7CBF5);
				else if (d2 <= (r + 8) * (r + 8) && (((dx / 2) + (dy / 2)) & 1) == 0) g.fill(mxp + dx, myp + dy, mxp + dx + 2, myp + dy + 2, 0xFF2A4BB0);
			}
		// mountains: two silhouette layers, 4 px columns
		for (int layer = 0; layer < 2; layer++) {
			int base = horizon + layer * (h / 18);
			for (int x = 0; x < w; x += 4) {
				double n = Math.sin(x * 0.011 + layer * 2.1) * 0.5 + Math.sin(x * 0.027 + layer) * 0.3 + Math.sin(x * 0.061) * 0.2;
				int top = base - (int) ((n + 1) * (h * (layer == 0 ? 0.075 : 0.05)));
				top = top / 4 * 4;
				g.fill(x, top, x + 4, h, layer == 0 ? 0xFF0B1A4A : 0xFF050B24);
			}
		}
		// horizon glow, dithered
		g.fill(0, horizon - 1, w, horizon, 0x663C6BE0);
	}
}
