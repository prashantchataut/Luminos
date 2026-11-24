package dev.luminos.client;

import dev.luminos.client.core.HudPresets;
import net.minecraft.client.Minecraft;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The HUD editor view (Badlion's pen-icon editor and Lunar's HUD layout, simplified). The world stays visible: no blur, a light
 * scrim and a dot grid. Drag a module to move it (snaps), scroll over it to scale, right-click to switch it on or off. A glass
 * toolbar holds Done, Snap, Preset and Reset. Version screens only forward events here.
 */
public final class HudEditor {
	private record Hit(int x, int y, int w, int h, Runnable r) {}

	private final Runnable close;
	private final List<Hit> hits = new ArrayList<>();
	private int mx, my;
	private String toast = "";
	private long toastAt;

	public HudEditor(Runnable close) {
		this.close = close;
		Anim.snap("ed.open", 0f);
	}

	public void render(Gfx g, Minecraft mc, int mouseX, int mouseY) {
		Anim.frame();
		mx = mouseX;
		my = mouseY;
		hits.clear();
		float k = Math.max(0f, Math.min(1f, Anim.spring("ed.open", 1f)));
		int w = g.width(), h = g.height();
		g.fill(0, 0, w, h, Glass.alpha(0x66050608, k));
		if (Config.get().snap) {   // dot grid every 16 px: a hint of the 4 px snap, quiet enough to ignore
			for (int x = 16; x < w; x += 16) for (int y = 16; y < h; y += 16) g.fill(x, y, x + 1, y + 1, Glass.alpha(0x30FFFFFF, k));
		}
		HudModule hover = Hud.at(mc, mx, my);
		HudModule drag = Hud.dragging();
		for (HudModule m : Modules.ALL) {
			Config.ModuleCfg c = Config.get().of(m);
			int[] b = Hud.bounds(mc, m, c);
			boolean flagged = m.complianceFlagged() && Compliance.restricted(mc);
			if (c.enabled) Hud.drawOne(g, mc, m, c, true);
			else {
				Glass.roundFill(g, b[0], b[1], b[2], b[3], 3, 0x14FFFFFF);
				Glass.roundOutline(g, b[0], b[1], b[2], b[3], 3, 0x30FFFFFF);
				Glass.text(g, m.title() + " (off)", b[0] + 4, b[1] + b[3] / 2f - 3, Glass.LABEL, Glass.INK3);
			}
			boolean sel = m == drag, hot = m == hover && drag == null;
			if (sel || hot) Glass.roundOutline(g, b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4, 4, sel ? Glass.alpha(Glass.ACCENT, 0.95f) : 0x88FFFFFF);
			if (sel) {
				String chip = m.title() + "   x " + c.x + "  y " + c.y + (c.scale != 1f ? String.format(Locale.ROOT, "   %.1fx", c.scale) : "");
				int cw = Glass.width(g, chip, Glass.LABEL) + 10, cx = Math.max(2, Math.min(w - cw - 2, b[0])), cy = b[1] - 16 < 2 ? b[1] + b[3] + 4 : b[1] - 16;
				Glass.roundFill(g, cx, cy, cw, 12, 5, 0xE0101216);
				Glass.roundOutline(g, cx, cy, cw, 12, 5, 0x40FFFFFF);
				Glass.text(g, chip, cx + 5, cy + 3, Glass.LABEL, Glass.INK);
			}
			if (flagged) Glass.text(g, "hidden on this server", b[0], b[1] + b[3] + 3, Glass.LABEL, Glass.WARN);
		}
		Hud.drawGuides(g);
		toolbar(g, mc, k);
	}

	private void toolbar(Gfx g, Minecraft mc, float k) {
		Config cfg = Config.get();
		String preset = HudPresets.label(cfg.hudPreset);
		String[] labels = {"Done", "Snap " + (cfg.snap ? "on" : "off"), "Preset: " + preset, "Reset"};
		String[] icons = {"check", "grid", "layers", "reset"};
		int pad = 8, gap = 4, bw = 0;
		int[] ws = new int[labels.length];
		for (int i = 0; i < labels.length; i++) { ws[i] = 22 + g.textWidth(labels[i]); bw += ws[i] + (i > 0 ? gap : 0); }
		int tw = bw + pad * 2, th = 26, tx = (g.width() - tw) / 2, ty = 8 - Math.round((1f - k) * 12);
		Glass.surface(g, tx, ty, tw, th, 8, 1.2f);
		int x = tx + pad;
		Runnable[] acts = {close, () -> { cfg.snap = !cfg.snap; Config.save(); },
			() -> { var n = HudPresets.NAMES; String next = n.get((n.indexOf(cfg.hudPreset) + 1) % n.size()); Features.applyPreset(next); say(HudPresets.label(next) + " preset applied"); },
			() -> { Features.applyPreset("minimal"); say("Reset to Minimal"); }};
		for (int i = 0; i < labels.length; i++) {
			boolean hot = mx >= x && mx < x + ws[i] && my >= ty + 4 && my < ty + th - 4;
			Glass.card(g, x, ty + 4, ws[i], th - 8, 5, i == 0 ? 0.9f : hot ? 0.6f : 0f);
			Icons.draw(g, icons[i], x + 6, ty + 9, hot || i == 0 ? Glass.INK : Glass.INK2);
			g.text(labels[i], x + 17, ty + 9, hot || i == 0 ? Glass.INK : Glass.INK2);
			hits.add(new Hit(x, ty + 4, ws[i], th - 8, acts[i]));
			x += ws[i] + gap;
		}
		boolean showToast = System.currentTimeMillis() - toastAt < 2000;
		String hint = showToast ? toast : "Drag to move  -  scroll to scale  -  right-click to switch on or off";
		Glass.text(g, hint, (g.width() - Glass.width(g, hint, Glass.LABEL)) / 2f, ty + th + 5, Glass.LABEL, showToast ? Glass.OK : Glass.alpha(Glass.INK, 0.8f));
	}

	private void say(String s) { toast = s; toastAt = System.currentTimeMillis(); }

	public boolean click(Minecraft mc, double x, double y, int button) {
		if (button == 0) for (Hit h : hits) if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.r.run(); return true; }
		return Hud.press(mc, x, y, button);
	}

	public boolean drag(Minecraft mc, double x, double y) { return Hud.drag(mc, x, y); }

	public void release() { Hud.release(); }

	public boolean scroll(Minecraft mc, double x, double y, double dy) { return Hud.scroll(mc, x, y, dy); }
}
