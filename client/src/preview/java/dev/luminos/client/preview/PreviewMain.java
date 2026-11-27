package dev.luminos.client.preview;

import dev.luminos.client.Feature;
import dev.luminos.client.Features;
import dev.luminos.client.Gfx;
import dev.luminos.client.ModPanelView;
import net.minecraft.core.Holder;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.item.ItemStack;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

/**
 * Offscreen renderer for docs/design/rounds/ingame-*.png. It runs the REAL layout and paint code (TitleScene, ModPanelView) through a
 * Java2D implementation of {@link Gfx}: same coordinates, same colours, same cover-fit math. Text uses Minecraft's own ascii.png bitmap
 * font (taken from the game jar on the classpath, never written to the repo) with vanilla advances and the 1/4-brightness drop shadow.
 * Not a screenshot of the running game: GUI scale 2, no GPU. It exists so the layout is looked at before it ships.
 */
public final class PreviewMain {
	static final int SCALE = 2;

	public static void main(String[] args) throws Exception {
		System.setProperty("java.awt.headless", "true");
		File out = new File(args.length > 0 ? args[0] : "build/preview");
		out.mkdirs();
		System.setProperty("luminos.config.dir", Files.createTempDirectory("luminos-preview").toString());
		net.minecraft.SharedConstants.tryDetectVersion();
		net.minecraft.server.Bootstrap.bootStrap();
		int w = 1280 / SCALE, h = 720 / SCALE;

		// a believable, quiet state: a handful of modules on
		for (Feature f : Features.ALL) {
			String n = f.name.toLowerCase();
			f.set.accept(n.contains("keystroke") || n.contains("cps") || n.contains("fps") || n.contains("coordinates") || n.contains("fullbright") || n.contains("zoom") || n.contains("armor") || n.contains("toggle") || n.contains("time"));
		}

		// 1. the v4.4 startup screen, "SINGLEPLAYER" hovered (two passes: hover easing and hit areas settle)
		dev.luminos.client.MainMenuView menu = new dev.luminos.client.MainMenuView(id -> {});
		J2D g = new J2D(w, h);
		for (int i = 0; i < 6; i++) { g = new J2D(w, h); menu.render(g, w / 2, h / 2 + 20, 0, "PlayerOne", 144, "1.21.11", "Sodium + Native Engine Active"); }
		g.save(new File(out, "ingame-mainmenu-4.4.png"));

		// 2. Right Ctrl panel over the menu: grid only, then grid + inline settings drawer
		for (int variant = 0; variant < 2; variant++) {
			J2D p = new J2D(w, h);
			menu.render(p, -1, -1, 0, "PlayerOne", 144, "1.21.11", "Sodium + Native Engine Active");
			ModPanelView v = new ModPanelView(() -> {}, () -> {}, () -> {});
			if (variant == 1) v.openSettings("keystrokes");
			int mx = variant == 0 ? w / 2 - 40 : -1, my = variant == 0 ? h / 2 - 20 : -1;
			v.render(p, mx, my);
			v.render(p, mx, my);   // second pass: hit areas and hover are settled
			p.save(new File(out, variant == 0 ? "ingame-quickpanel-grid-4.4.png" : "ingame-quickpanel-4.4.png"));
		}
		System.out.println("rendered into " + out.getAbsolutePath());
	}



	// ------------------------------------------------------------------ the Gfx
	public static final class J2D implements Gfx {
		final int w, h;
		final BufferedImage img;
		final Graphics2D g;
		static BufferedImage font;
		static final int[] adv = new int[256];
		static final Map<String, BufferedImage> glyphs = new HashMap<>();
		static final Map<String, BufferedImage> tex = new HashMap<>();

		public J2D(int w, int h) throws Exception {
			this.w = w; this.h = h;
			img = new BufferedImage(w * SCALE, h * SCALE, BufferedImage.TYPE_INT_ARGB);
			g = img.createGraphics();
			g.scale(SCALE, SCALE);
			g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
			g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
			if (font == null) loadFont();
		}

		static void loadFont() throws Exception {
			try (InputStream in = PreviewMain.class.getResourceAsStream("/assets/minecraft/textures/font/ascii.png")) {
				if (in == null) throw new IllegalStateException("ascii.png not on the classpath (the Minecraft jar is needed to render text)");
				font = ImageIO.read(in);
			}
			for (int c = 0; c < 256; c++) {
				int cx = (c % 16) * 8, cy = (c / 16) * 8, right = -1;
				for (int x = 0; x < 8; x++) for (int y = 0; y < 8; y++) if ((font.getRGB(cx + x, cy + y) >>> 24) > 0) right = Math.max(right, x);
				adv[c] = c == ' ' ? 4 : right < 0 ? 0 : right + 2;   // visible width + 1 spacing, as the game's bitmap provider does
			}
		}

		BufferedImage glyph(int c, int argb) {
			String key = c + ":" + argb;
			return glyphs.computeIfAbsent(key, k -> {
				BufferedImage o = new BufferedImage(8, 8, BufferedImage.TYPE_INT_ARGB);
				int cx = (c % 16) * 8, cy = (c / 16) * 8;
				for (int x = 0; x < 8; x++) for (int y = 0; y < 8; y++) {
					int a = font.getRGB(cx + x, cy + y) >>> 24;
					int ca = (argb >>> 24) * a / 255;
					if (a > 0) o.setRGB(x, y, (ca << 24) | (argb & 0xFFFFFF));
				}
				return o;
			});
		}

		static int shadow(int argb) { return (argb & 0xFF000000) | (((argb >> 16 & 0xFF) / 4) << 16) | (((argb >> 8 & 0xFF) / 4) << 8) | ((argb & 0xFF) / 4); }

		public void text(String s, int x, int y, int color) {
			if ((color >>> 24) == 0) color |= 0xFF000000;
			for (int pass = 0; pass < 2; pass++) {
				int cx = x + (pass == 0 ? 1 : 0);
				int col = pass == 0 ? shadow(color) : color;
				int px = cx;
				for (char ch : s.toCharArray()) {
					int c = ch < 256 ? ch : '?';
					if (c != ' ') g.drawImage(glyph(c, col), px, y + (pass == 0 ? 1 : 0), null);
					px += adv[c];
				}
			}
		}
		public int textWidth(String s) { int t = 0; for (char ch : s.toCharArray()) t += adv[ch < 256 ? ch : '?']; return Math.max(0, t - 1); }

		public void fill(int x0, int y0, int x1, int y1, int color) {
			g.setComposite(AlphaComposite.SrcOver);
			g.setColor(new Color(color, true));
			g.fillRect(x0, y0, x1 - x0, y1 - y0);
		}
		public void outline(int x, int y, int w, int h, int color) { fill(x, y, x + w, y + 1, color); fill(x, y + h - 1, x + w, y + h, color); fill(x, y + 1, x + 1, y + h - 1, color); fill(x + w - 1, y + 1, x + w, y + h - 1, color); }
		public void item(ItemStack stack, int x, int y) {}
		public void itemDecorations(ItemStack stack, int x, int y) {}
		public int width() { return w; }
		public int height() { return h; }
		public void push(float tx, float ty, float scale) { saved.push(g.getTransform()); g.translate(tx, ty); g.scale(scale, scale); }
		public void pop() { g.setTransform(saved.pop()); }
		final java.util.ArrayDeque<AffineTransform> saved = new java.util.ArrayDeque<>();
		public void effectIcon(Holder<MobEffect> effect, int x, int y, int size) {}
		public void blur(int level) {}
		public void clip(int x0, int y0, int x1, int y1) { g.setClip(x0, y0, x1 - x0, y1 - y0); }
		public void unclip() { g.setClip(null); }

		BufferedImage load(String path) {
			return tex.computeIfAbsent(path, p -> {
				try (InputStream in = PreviewMain.class.getResourceAsStream("/assets/luminos_client/" + p)) { return in == null ? null : ImageIO.read(in); }
				catch (Exception e) { return null; }
			});
		}
		public boolean cover(String texture, int texW, int texH, int x, int y, int w, int h) {
			BufferedImage t = load(texture);
			if (t == null) return false;
			float scale = Math.max(w / (float) texW, h / (float) texH);
			int rw = Math.min(texW, Math.round(w / scale)), rh = Math.min(texH, Math.round(h / scale));
			int u = (texW - rw) / 2, v = (texH - rh) / 2;
			g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);   // the texture has blur:true in its .mcmeta
			g.drawImage(t, x, y, x + w, y + h, u, v, u + rw, v + rh, null);
			g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
			return true;
		}
		public boolean texture(String texture, int x, int y, int w, int h, int texW, int texH) {
			BufferedImage t = load(texture);
			if (t == null) return false;
			g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
			g.drawImage(t, x, y, w, h, null);
			g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
			return true;
		}

		public void save(File f) throws Exception { g.dispose(); ImageIO.write(img, "png", f); }
	}
}
