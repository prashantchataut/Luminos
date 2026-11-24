package dev.luminos.client;

import com.mojang.realmsclient.RealmsMainScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;

import java.util.ArrayList;
import java.util.List;

/** The Luminos title screen: dithered sky, logo, current instance and version, the client's own splash. */
public final class TitleView {
	private record Item(String label, Runnable act) {}

	private static final String[] SPLASHES = {"Dither happens.", "Right Ctrl opens the panel.", "No cheats, just a client.", "Sixteen pixels at a time.", "Rebind everything.", "Your layout follows you.", "Made of squares.", "Tab, then type to search."};
	private final Screen self;
	private final List<Item> items = new ArrayList<>();
	private int focus = -1;
	private final long born = System.currentTimeMillis();
	private long frozen = -1;
	private final String splash = SPLASHES[(int) ((System.currentTimeMillis() / 86400000L) % SPLASHES.length)];
	private int ix, iy, iw = 150, ih = 18, pitch = 21;

	public TitleView(Screen self, Minecraft mc) {
		this.self = self;
		items.add(new Item("Singleplayer", () -> Nav.open(mc, new SelectWorldScreen(self))));
		items.add(new Item("Multiplayer", () -> Nav.open(mc, new JoinMultiplayerScreen(self))));
		items.add(new Item("Realms", () -> Nav.open(mc, new RealmsMainScreen(self))));
		items.add(new Item("Options", () -> Nav.open(mc, new OptionsScreen(self, mc.options))));
		items.add(new Item("Cosmetics", () -> Nav.open(mc, new PanelScreen(Panel.Tab.COSMETICS, false, self))));
		items.add(new Item("Quit", mc::stop));
	}

	public void render(Gfx g, Minecraft mc, int mx, int my) {
		Anim.frame();
		long now = System.currentTimeMillis();
		if (!Nav.windowActive(mc)) { if (frozen < 0) frozen = now; } else frozen = -1;
		long t = (frozen >= 0 ? frozen : now) - born;
		TitleArt.draw(g, t);
		int w = g.width(), h = g.height();
		// a glass column holds the menu so it stays readable over the moving sky
		int colW = iw + 28, rows = items.size();
		ix = Math.max(26, w / 11);
		iy = Math.max(62, Math.min(h / 2 - 4, h - 40 - rows * pitch - 40));
		int colX = ix - 14, colY = iy - 52, colH = 52 + rows * pitch + 38;
		float fade = Math.max(0f, Math.min(1f, Anim.spring("title.in", 1f)));
		colX -= Math.round((1f - fade) * 16);
		Glass.surface(g, colX, colY, colW, colH, 9, 1f);
		int lx = colX + 14;
		Glass.text(g, "Luminos", lx, colY + 10, Glass.TITLE * 1.34f, Glass.INK);
		Glass.text(g, splash, lx, colY + 34, Glass.LABEL, Glass.INK3);
		for (int i = 0; i < rows; i++) {
			int y = iy + i * pitch;
			boolean hot = mx >= lx && mx < lx + iw && my >= y && my < y + ih;
			if (hot) focus = i;
			boolean f = focus == i;
			float k = Anim.soft("title." + i, f ? 1f : 0f);
			Glass.card(g, lx, y, iw, ih, 5, k);
			g.text(items.get(i).label, lx + 10, y + 5, f ? Glass.INK : Glass.INK2);
			Icons.draw(g, "chevron_r", lx + iw - 14 + Math.round(2 * k), y + 5, f ? Glass.INK : Glass.INK3);
		}
		String inst = System.getenv("LUMINOS_INSTANCE") != null ? System.getenv("LUMINOS_INSTANCE") : "Default";
		Glass.text(g, inst + "  -  Minecraft " + Nav.version(mc), lx, iy + rows * pitch + 4, Glass.LABEL, Glass.INK3);
		Glass.text(g, "Right Ctrl opens the quick panel in game", lx, iy + rows * pitch + 14, Glass.LABEL, Glass.INK3);
		String use = "Use vanilla title screen";
		boolean uh = mx >= 8 && mx < 8 + Glass.width(g, use, Glass.LABEL) && my >= h - 16 && my < h - 4;
		Glass.text(g, use, 8, h - 13, Glass.LABEL, uh ? Glass.INK : Glass.INK2);
		String v = "Luminos Client " + LuminosClient.VERSION;
		Glass.text(g, v, w - Glass.width(g, v, Glass.LABEL) - 8, h - 13, Glass.LABEL, Glass.INK2);
	}

	public boolean click(Minecraft mc, double mx, double my, int button) {
		if (button != 0) return false;
		int h = mc.getWindow().getGuiScaledHeight();
		if (mx >= 8 && mx < 8 + 120 && my >= h - 16 && my < h - 4) {
			Config.get().customTitle = false;
			Config.save();
			Nav.open(mc, new TitleScreen());
			return true;
		}
		for (int i = 0; i < items.size(); i++) {
			int y = iy + i * pitch;
			if (mx >= ix && mx < ix + iw && my >= y && my < y + ih) { items.get(i).act.run(); return true; }
		}
		return false;
	}

	public boolean key(int code) {
		if (code == 265) { focus = focus <= 0 ? items.size() - 1 : focus - 1; return true; }
		if (code == 264) { focus = (focus + 1) % items.size(); return true; }
		if ((code == 257 || code == 335) && focus >= 0) { items.get(focus).act.run(); return true; }
		return false;
	}
}
