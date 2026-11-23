package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.world.item.ItemStack;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Read-only HUD modules (nothing here changes gameplay). Same ids and config keys on every Minecraft line. */
public final class ExtraModules {
	private ExtraModules() {}

	static List<HudModule> create() {
		return List.of(new Ping(), new Clock(), new Memory(), new Direction(), new ServerIp(), new Playtime(), new ItemCounter(), new Crosshair());
	}

	private abstract static class Line extends HudModule {
		abstract String text(Minecraft mc, boolean preview);
		public int width(Minecraft mc) { return 18 + minWidth(); }
		int minWidth() { return 62; }
		public int height(Minecraft mc) { return 14; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			String t = text(mc, preview);
			panel(g, Math.max(width(mc), g.textWidth(t) + 12), height(mc));
			g.text(t, 6, 3, TEXT);
		}
	}

	public static final class Ping extends Line {
		public String id() { return "ping"; }
		public String title() { return "Ping"; }
		@Override public int defaultX() { return 70; }
		String text(Minecraft mc, boolean preview) {
			if (preview) return "38 ms";
			var c = mc.getConnection();
			if (c == null || mc.player == null) return "- ms";
			var i = c.getPlayerInfo(mc.player.getUUID());
			return (i == null || mc.getSingleplayerServer() != null) ? "local" : i.getLatency() + " ms";
		}
	}

	public static final class Clock extends Line {
		public String id() { return "clock"; }
		public String title() { return "Clock"; }
		@Override public int defaultX() { return 130; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) { return LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")); }
	}

	public static final class Memory extends Line {
		public String id() { return "memory"; }
		public String title() { return "Memory"; }
		@Override public int defaultX() { return 190; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			Runtime r = Runtime.getRuntime();
			return ((r.totalMemory() - r.freeMemory()) >> 20) + " / " + (r.maxMemory() >> 20) + " MB";
		}
		@Override int minWidth() { return 80; }
	}

	public static final class Direction extends Line {
		private static final String[] D = {"S", "SW", "W", "NW", "N", "NE", "E", "SE"};
		public String id() { return "direction"; }
		public String title() { return "Direction"; }
		@Override public int defaultY() { return 84; }
		@Override public int defaultX() { return 130; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			if (preview || mc.player == null) return "N  180°";
			float yaw = ((mc.player.getYRot() % 360) + 360) % 360;
			return D[Math.round(yaw / 45f) % 8] + "  " + Math.round(yaw) + "°";
		}
	}

	public static final class ServerIp extends Line {
		public String id() { return "server_ip"; }
		public String title() { return "Server IP"; }
		@Override public int defaultY() { return 100; }
		@Override public int defaultX() { return 130; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			if (preview) return "play.example.net";
			ServerData d = mc.getCurrentServer();
			return d != null ? d.ip : (mc.getSingleplayerServer() != null ? "singleplayer" : "-");
		}
		@Override int minWidth() { return 100; }
	}

	public static final class Playtime extends Line {
		public String id() { return "playtime"; }
		public String title() { return "Playtime"; }
		@Override public int defaultY() { return 116; }
		@Override public int defaultX() { return 130; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			long m = Config.get().playtimeMs / 60000;
			return "Played " + m / 60 + "h " + m % 60 + "m";
		}
		@Override int minWidth() { return 80; }
	}

	public static final class ItemCounter extends Line {
		public String id() { return "item_counter"; }
		public String title() { return "Item counter"; }
		@Override public int defaultY() { return 132; }
		@Override public int defaultX() { return 130; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			if (preview || mc.player == null) return "Arrows x 64";
			ItemStack held = mc.player.getMainHandItem();
			if (held.isEmpty()) return "Hand empty";
			int n = 0;
			var inv = mc.player.getInventory();
			for (int i = 0; i < inv.getContainerSize(); i++) {
				ItemStack s = inv.getItem(i);
				if (ItemStack.isSameItem(s, held)) n += s.getCount();
			}
			return held.getHoverName().getString() + " x " + n;
		}
		@Override int minWidth() { return 100; }
	}

	/** Extra crosshair drawn at the screen centre (vanilla's stays; this adds a coloured cross). */
	public static final class Crosshair extends HudModule {
		public String id() { return "crosshair"; }
		public String title() { return "Custom crosshair"; }
		public int width(Minecraft mc) { return 13; }
		public int height(Minecraft mc) { return 13; }
		@Override public boolean centered() { return true; }
		@Override public boolean enabledByDefault() { return false; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			int c = Config.get().crosshairColor;
			g.fill(6, 0, 7, 5, c); g.fill(6, 8, 7, 13, c);
			g.fill(0, 6, 5, 7, c); g.fill(8, 6, 13, 7, c);
		}
	}
}
