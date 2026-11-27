package dev.luminos.client.preview;

import dev.luminos.client.Gfx;

/**
 * A composed stand-in for the 3D world behind the in-game overlays in the preview renders: sky, sun, hills, a grass-and-stone block grid,
 * trees, hotbar, hearts and crosshair, drawn with fills only. It is NOT a capture of a running game (there is no GPU here); it exists so the
 * panel and the HUD studio are judged against a busy, bright background instead of a flat colour.
 */
public final class WorldBackdrop {
	private WorldBackdrop() {}

	private static int mix(int a, int b, float t) {
		int r = 0;
		for (int s = 16; s >= 0; s -= 8) r |= Math.round(((a >> s) & 0xFF) * (1 - t) + ((b >> s) & 0xFF) * t) << s;
		return 0xFF000000 | r;
	}
	private static int noise(int x, int y) { int n = x * 374761393 + y * 668265263; n = (n ^ (n >>> 13)) * 1274126177; return (n ^ (n >>> 16)) & 0xFF; }

	public static void draw(Gfx g) {
		int w = g.width(), h = g.height(), horizon = (int) (h * 0.56f);
		for (int y = 0; y < horizon; y += 2) g.fill(0, y, w, y + 2, mix(0x5C9BE6, 0xBBDDF7, y / (float) horizon));
		g.fill((int) (w * 0.72f), 34, (int) (w * 0.72f) + 22, 56, 0xFFFFF3B0);                       // sun
		for (int i = 0; i < 4; i++) { int cx = (int) (w * (0.12f + i * 0.24f)), cy = 40 + (i % 2) * 26; for (int k = 0; k < 4; k++) g.fill(cx + k * 12, cy - (k % 2) * 6, cx + k * 12 + 26, cy + 10 - (k % 2) * 4, 0xE6FFFFFF); }
		for (int x = 0; x < w; x += 8) {                                                              // far hills
			int top = horizon - 14 - (int) (10 * Math.sin(x * 0.021) + 7 * Math.sin(x * 0.057 + 1));
			g.fill(x, top, x + 8, horizon + 2, mix(0x4F9A63, 0x3C7A4B, 0.4f));
		}
		int bs = 16;
		for (int y = horizon; y < h; y += bs) for (int x = 0; x < w; x += bs) {                       // near ground: 16 px blocks, lighter at the top
			int row = (y - horizon) / bs, n = noise(x / bs, y / bs);
			int base = row == 0 ? 0x5DAA3B : row < 3 ? 0x866043 : 0x7A7A7A;
			int shade = (n % 24) - 12, rgb = Math.max(0, Math.min(255, ((base >> 16) & 0xFF) + shade)) << 16 | Math.max(0, Math.min(255, ((base >> 8) & 0xFF) + shade)) << 8 | Math.max(0, Math.min(255, (base & 0xFF) + shade));
			g.fill(x, y, x + bs, y + bs, 0xFF000000 | rgb);
			g.fill(x, y, x + bs, y + 1, 0x22000000); g.fill(x, y, x + 1, y + bs, 0x22000000);
		}
		for (int t = 0; t < 3; t++) {                                                                  // blocky trees
			int tx = (int) (w * (0.18f + t * 0.31f)) / bs * bs, base = horizon;
			g.fill(tx + 4, base - 5 * bs / 2, tx + 12, base, 0xFF6B4A2B);
			g.fill(tx - 12, base - 4 * bs, tx + 28, base - 5 * bs / 2, 0xFF2F7D32);
			g.fill(tx - 4, base - 5 * bs, tx + 20, base - 4 * bs, 0xFF3A9140);
		}
		// vanilla HUD furniture: hotbar, hearts, crosshair
		int hw = 182, hx = (w - hw) / 2, hy = h - 22;
		g.fill(hx, hy, hx + hw, hy + 22, 0xB0000000);
		for (int i = 0; i < 9; i++) g.outline(hx + 1 + i * 20, hy + 1, 20, 20, i == 2 ? 0xFFFFFFFF : 0xFF3A3A3A);
		for (int i = 0; i < 10; i++) { int x = hx + i * 8; g.fill(x, hy - 10, x + 7, hy - 3, 0xFFE0342E); g.fill(x + 1, hy - 9, x + 3, hy - 7, 0xFFFF8A80); }
		int cx = w / 2, cy = h / 2 - 8;
		g.fill(cx - 5, cy, cx + 6, cy + 1, 0xFFFFFFFF); g.fill(cx, cy - 5, cx + 1, cy + 6, 0xFFFFFFFF);
	}
}
