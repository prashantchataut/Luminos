package dev.luminos.client;

import java.util.ArrayList;
import java.util.List;

/**
 * Layout and painting of the Luminos title screen, written against {@link Gfx} only (no Minecraft widget types), so the exact same
 * code draws the in-game screen and the offscreen preview in docs/design/rounds. The screen supplies state (hover, username, fps).
 *
 * Design: the shader artwork covers the window (centre-cropped, never stretched) under a soft top-to-bottom scrim. Nothing sits
 * behind the menu: logo, wordmark and a floating button stack, centred. Chrome stays at the edges: account pill top left, two
 * small actions top right, one muted footer line.
 */
public final class TitleScene {
	private TitleScene() {}

	public enum Kind { PRIMARY, ACCENT, SECONDARY, DANGER, CHIP, LINK }

	/** One button: {@code id} is how the screen maps it to an action. */
	public record Btn(String id, String label, int x, int y, int w, int h, Kind kind) {
		public boolean contains(double mx, double my) { return mx >= x && mx < x + w && my >= y && my < y + h; }
	}

	public static final int BTN_W = 210, BTN_H = 24, GAP = 7, HALF_W = 102;
	public static final String BG = "textures/gui/title_bg.png", LOGO = "textures/gui/logo.png";
	public static final int BG_W = 1600, BG_H = 900;

	// palette (one accent: cobalt)
	static final int COBALT = 0xFF2B4BFF, COBALT_EDGE = 0xFF60A5FA, CRIMSON = 0xFFEF4444;
	static final int FILL = 0xE6141822, TEXT = 0xFFFFFFFF, MUTED = 0xFF8A94A6, FOOT = 0xFF64748B;

	/** The vertical anchor of the centre stack; kept inside the window so a short window never pushes the buttons off-screen. */
	public static int centerY(int h) {
		int top = 104 + 30;                    // logo + room above it for the chrome row
		int bottom = h - (99 + 30);            // last button row + room for the footer
		return Math.max(Math.min(h / 2, bottom), top);
	}

	public static List<Btn> layout(int w, int h) {
		List<Btn> l = new ArrayList<>();
		int cx = w / 2, cy = centerY(h), y0 = cy - 18, x0 = cx - BTN_W / 2;
		l.add(new Btn("single", "Singleplayer", x0, y0, BTN_W, BTN_H, Kind.PRIMARY));
		l.add(new Btn("multi", "Multiplayer", x0, y0 + 31, BTN_W, BTN_H, Kind.PRIMARY));
		l.add(new Btn("mods", "Luminos Mods & HUD", x0, y0 + 62, BTN_W, BTN_H, Kind.ACCENT));
		l.add(new Btn("options", "Options", x0, y0 + 93, HALF_W, BTN_H, Kind.SECONDARY));
		l.add(new Btn("quit", "Quit Game", cx + 3, y0 + 93, HALF_W, BTN_H, Kind.DANGER));
		int capes = 54, hud = 72;
		l.add(new Btn("capes", "Capes", w - 14 - capes, 12, capes, 22, Kind.CHIP));
		l.add(new Btn("hud", "HUD Studio", w - 14 - capes - 6 - hud, 12, hud, 22, Kind.CHIP));
		l.add(new Btn("vanilla", "Vanilla title screen", w / 2 - 55, y0 + 93 + BTN_H + 12, 110, 12, Kind.LINK));
		return l;
	}

	// ------------------------------------------------------------------ painting
	private static int lerp(int a, int b, float t) {
		t = Math.max(0f, Math.min(1f, t));
		int r = 0;
		for (int s = 24; s >= 0; s -= 8) r |= Math.round(((a >>> s) & 0xFF) * (1 - t) + ((b >>> s) & 0xFF) * t) << s;
		return r;
	}

	/** Artwork (cover-fit) and the scrim. Returns false when the artwork is missing so the caller can draw the vanilla panorama instead of a black screen. */
	public static boolean paintBackdrop(Gfx g, int w, int h) {
		boolean art = g.cover(BG, BG_W, BG_H, 0, 0, w, h);
		if (!art) g.fill(0, 0, w, h, 0xFF0B0E16);
		// vertical scrim 0x66 -> 0xCC of #080A0F, in 2 px strips
		for (int y = 0; y < h; y += 2) {
			float t = y / (float) Math.max(1, h - 1);
			g.fill(0, y, w, Math.min(h, y + 2), lerp(0x66080A0F, 0xCC080A0F, t));
		}
		return art;
	}

	/** Logo, wordmark and subtitle above the buttons. */
	public static void paintBrand(Gfx g, int w, int h, String mcVersion) {
		int cx = w / 2, cy = centerY(h);
		if (!g.texture(LOGO, cx - 18, cy - 104, 36, 36, 64, 64)) Glass.roundFill(g, cx - 18, cy - 104, 36, 36, 18, COBALT);
		String word = "LUMINOS";
		int track = 3, ww = 0;
		for (char c : word.toCharArray()) ww += Glass.width(g, String.valueOf(c), 2f) + track;
		ww -= track;
		float x = cx - ww / 2f;
		for (char c : word.toCharArray()) {
			String s = String.valueOf(c);
			Glass.text(g, s, Math.round(x), cy - 62, 2f, TEXT);
			x += Glass.width(g, s, 2f) + track;
		}
		String sub = "CLIENT " + LuminosClient.VERSION + "  |  MINECRAFT " + mcVersion;
		Glass.text(g, sub, cx - Glass.width(g, sub, 1f) / 2f, cy - 40, 1f, MUTED);
	}

	/** Account pill (top left) and the footer. */
	public static void paintChrome(Gfx g, int w, int h, String user, int fps, String mcVersion) {
		String name = (user == null || user.isEmpty()) ? "Offline" : user;
		String live = fps + " FPS";
		int pw = 10 + 8 + Glass.width(g, name, 1f) + 10 + Glass.width(g, live, 1f) + 10;
		Glass.roundFill(g, 14, 12, pw, 22, 11, 0xB0141822);
		Glass.roundOutline(g, 14, 12, pw, 22, 11, 0x26FFFFFF);
		Glass.roundFill(g, 24, 20, 6, 6, 3, 0xFF22C55E);
		g.text(name, 36, 19, TEXT);
		g.text(live, 36 + Glass.width(g, name, 1f) + 10, 19, MUTED);

		String left = "Luminos Client " + LuminosClient.VERSION + "  |  Press [Right Ctrl] for Mod Menu";
		String right = "Minecraft " + mcVersion + " / Mojang AB";
		g.text(left, 14, h - 14, FOOT);
		g.text(right, w - 14 - Glass.width(g, right, 1f), h - 14, FOOT);
	}

	/** One button. {@code hot} is the 0..1 hover progress. */
	public static void paintButton(Gfx g, Btn b, float hot) {
		if (b.kind == Kind.LINK) {
			String s = b.label;
			g.text(s, b.x + (b.w - Glass.width(g, s, 1f)) / 2, b.y + 2, lerp(0xFF475569, 0xFFCBD5E1, hot));
			return;
		}
		int fill, edge;
		switch (b.kind) {
			case PRIMARY -> { fill = lerp(FILL, COBALT, hot); edge = lerp(0x33FFFFFF, COBALT_EDGE, hot); }
			case ACCENT -> { fill = lerp(FILL, COBALT, hot); edge = lerp(0x802B4BFF, COBALT_EDGE, hot); }
			case DANGER -> { fill = lerp(FILL, 0xFF3A1519, hot); edge = lerp(0x33FFFFFF, CRIMSON, hot); }
			case CHIP -> { fill = lerp(0xB0141822, 0xFF1E2433, hot); edge = lerp(0x26FFFFFF, 0x66FFFFFF, hot); }
			default -> { fill = lerp(FILL, 0xFF1E2433, hot); edge = lerp(0x33FFFFFF, 0x80FFFFFF, hot); }
		}
		int r = b.kind == Kind.CHIP ? b.h / 2 : 7;
		Glass.roundFill(g, b.x, b.y, b.w, b.h, r, fill);
		Glass.roundOutline(g, b.x, b.y, b.w, b.h, r, edge);
		int tw = Glass.width(g, b.label, 1f);
		g.text(b.label, b.x + (b.w - tw) / 2, b.y + (b.h - 8) / 2 + 1, TEXT);
	}
}
