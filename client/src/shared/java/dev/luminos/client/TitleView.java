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
	private int ix, iy, iw = 176, ih = 22, pitch = 26;

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
		long now = System.currentTimeMillis();
		if (!Nav.windowActive(mc)) { if (frozen < 0) frozen = now; } else frozen = -1;
		long t = (frozen >= 0 ? frozen : now) - born;
		TitleArt.draw(g, t);
		int w = g.width(), h = g.height();
		ix = Math.max(24, w / 11);
		iy = Math.max(70, h / 2 - 8);
		float fade = Math.min(1f, (now - born) / 350f);
		// logo
		g.push(ix, Math.max(14, iy - 62), 3f);
		g.text("Luminos", 0, 0, 0xFFE8EEFF);
		g.pop();
		g.fill(ix, iy - 28, ix + 46, iy - 26, 0xFF4F8CFF);
		g.text(splash, ix, iy - 20, 0xFFFFD866);
		for (int i = 0; i < items.size(); i++) {
			int y = iy + i * pitch;
			boolean hot = mx >= ix && mx < ix + iw && my >= y && my < y + ih;
			if (hot) focus = i;
			boolean f = focus == i;
			g.fill(ix, y, ix + iw, y + ih, f ? 0xDD2C4F9C : 0xAA080D28);
			g.fill(ix, y, ix + 2, y + ih, f ? 0xFF9CC2FF : 0xFF2B4488);
			g.outline(ix, y, iw, ih, f ? 0xFF6F9CFF : 0x44FFFFFF);
			g.text(items.get(i).label, ix + 12, y + 7, f ? 0xFFFFFFFF : 0xFFC8D4F5);
		}
		String inst = System.getenv("LUMINOS_INSTANCE") != null ? System.getenv("LUMINOS_INSTANCE") : "Default";
		String info = inst + "  -  Minecraft " + Nav.version(mc);
		g.text(info, ix, iy + items.size() * pitch + 6, 0xFF9DB0E8);
		g.text("Right Ctrl: quick panel in game", ix, iy + items.size() * pitch + 18, 0xFF6F86C8);
		String use = "Use vanilla title screen";
		int uw = g.textWidth(use);
		boolean uh = mx >= 8 && mx < 8 + uw && my >= h - 16 && my < h - 4;
		g.text(use, 8, h - 14, uh ? 0xFFFFFFFF : 0xFF6F86C8);
		String v = "Luminos Client " + LuminosClient.VERSION;
		g.text(v, w - g.textWidth(v) - 8, h - 14, 0xFF6F86C8);
		if (fade < 1f) g.fill(0, 0, w, h, ((int) ((1f - fade) * 255) << 24) | 0x040716);
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
