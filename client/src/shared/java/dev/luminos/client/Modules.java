package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.util.ArrayList;
import java.util.List;

/** Built-in HUD modules. Same ids and config keys on every Minecraft line, so one launcher UI edits them all. */
public final class Modules {
	private Modules() {}

	public static final List<HudModule> ALL = new ArrayList<>();

	static {
		ALL.add(new ArmorHud());
		ALL.add(new Keystrokes());
		ALL.add(new Cps());
		ALL.add(new Fps());
		ALL.add(new Coordinates());
		ALL.add(new Potions());
		ALL.add(new SprintStatus());
		ALL.addAll(ExtraModules.create());
	}

	public static final class ArmorHud extends HudModule {
		private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
		public String id() { return "armor_hud"; }
		public String title() { return "Armor HUD"; }
		public int width(Minecraft mc) { return 24; }
		public int height(Minecraft mc) { return 4 * 18 + 4; }
		@Override public int defaultY() { return 60; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			ItemStack[] sample = {new ItemStack(Items.IRON_HELMET), new ItemStack(Items.IRON_CHESTPLATE), new ItemStack(Items.IRON_LEGGINGS), new ItemStack(Items.IRON_BOOTS)};
			for (int i = 0; i < 4; i++) {
				ItemStack st = (mc.player == null || preview) ? sample[i] : mc.player.getItemBySlot(SLOTS[i]);
				if (st == null || st.isEmpty()) continue;
				g.item(st, 6, 2 + i * 18);
				g.itemDecorations(st, 6, 2 + i * 18);
			}
		}
	}

	public static final class Cps extends HudModule {
		private static final long[] LEFT = new long[64];
		private static final long[] RIGHT = new long[64];
		private static int li, ri;
		private static boolean wasL, wasR;
		/** Sampled once per client tick (the SDL-based 26.x input layer has no raw mouse hook we may chain onto). */
		public static void tick(Minecraft mc) {
			boolean l = mc.options.keyAttack.isDown();
			boolean r = mc.options.keyUse.isDown();
			long now = System.currentTimeMillis();
			if (l && !wasL) LEFT[li++ & 63] = now;
			if (r && !wasR) RIGHT[ri++ & 63] = now;
			wasL = l;
			wasR = r;
		}
		static int count(long[] a) {
			long now = System.currentTimeMillis();
			int n = 0;
			for (long t : a) if (t != 0 && now - t < 1000) n++;
			return n;
		}
		public static int left() { return count(LEFT); }
		public static int right() { return count(RIGHT); }
		public String id() { return "cps"; }
		public String title() { return "CPS"; }
		public int width(Minecraft mc) { return 62; }
		public int height(Minecraft mc) { return 14; }
		@Override public int defaultY() { return 24; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			g.text(preview ? "7 | 3 CPS" : left() + " | " + right() + " CPS", 6, 3, TEXT);
		}
	}

	public static final class Keystrokes extends HudModule {
		public String id() { return "keystrokes"; }
		public String title() { return "Keystrokes"; }
		public int width(Minecraft mc) { return 72; }
		public int height(Minecraft mc) { return 68; }
		@Override public int defaultX() { return 6; }
		@Override public int defaultY() { return 120; }
		private void key(Gfx g, int x, int y, int w, int h, String label, boolean on) {
			g.fill(x, y, x + w, y + h, on ? PANEL_ON : PANEL);
			g.outline(x, y, w, h, on ? ACCENT : 0x33FFFFFF);
			g.text(label, x + (w - g.textWidth(label)) / 2, y + (h - 8) / 2 + 1, on ? TEXT : DIM);
		}
		public void render(Gfx g, Minecraft mc, boolean preview) {
			var o = mc.options;
			boolean w = preview || o.keyUp.isDown(), a = !preview && o.keyLeft.isDown(), s = !preview && o.keyDown.isDown(), d = !preview && o.keyRight.isDown();
			key(g, 25, 0, 22, 22, "W", w);
			key(g, 0, 24, 22, 22, "A", a);
			key(g, 25, 24, 22, 22, "S", s);
			key(g, 50, 24, 22, 22, "D", d);
			key(g, 0, 48, 72, 18, "SPACE", !preview && o.keyJump.isDown());
		}
	}

	public static final class Fps extends HudModule {
		public String id() { return "fps"; }
		public String title() { return "FPS"; }
		public int width(Minecraft mc) { return 52; }
		public int height(Minecraft mc) { return 14; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			g.text((preview ? 240 : mc.getFps()) + " FPS", 6, 3, TEXT);
		}
	}

	public static final class Coordinates extends HudModule {
		public String id() { return "coords"; }
		public String title() { return "Coordinates"; }
		public int width(Minecraft mc) { return 104; }
		public int height(Minecraft mc) { return 36; }
		@Override public int defaultY() { return 42; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			double x = 128.4, y = 71, z = -310.9;
			String dir = "north";
			if (!preview && mc.player != null) {
				x = mc.player.getX(); y = mc.player.getY(); z = mc.player.getZ();
				dir = mc.player.getDirection().getName();
			}
			g.text(String.format("X %.1f  Y %.0f", x, y), 6, 3, TEXT);
			g.text(String.format("Z %.1f", z), 6, 14, TEXT);
			g.text(dir, 6, 25, DIM);
		}
	}

	public static final class Potions extends HudModule {
		private List<String> rows(Minecraft mc, boolean preview) {
			List<String> out = new ArrayList<>();
			if (preview || mc.player == null) {
				out.add("Speed II  1:42");
				out.add("Night Vision  6:10");
				return out;
			}
			for (MobEffectInstance e : mc.player.getActiveEffects()) {
				int secs = e.getDuration() / 20;
				out.add(e.getEffect().value().getDisplayName().getString() + " " + (e.getAmplifier() + 1) + "  " + secs / 60 + ":" + String.format("%02d", secs % 60));
			}
			return out;
		}
		public String id() { return "potions"; }
		public String title() { return "Potion effects"; }
		public int width(Minecraft mc) { return 120; }
		public int height(Minecraft mc) { return Math.max(1, rows(mc, mc.player == null).size()) * 11 + 5; }
		@Override public int defaultX() { return 200; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			List<String> r = rows(mc, preview);
			panel(g, width(mc), height(mc));
			for (int i = 0; i < r.size(); i++) g.text(r.get(i), 6, 3 + i * 11, TEXT);
			if (r.isEmpty()) g.text("no effects", 6, 3, DIM);
		}
	}

	public static final class SprintStatus extends HudModule {
		public String id() { return "sprint_status"; }
		public String title() { return "Sprint status"; }
		public int width(Minecraft mc) { return 92; }
		public int height(Minecraft mc) { return 14; }
		@Override public int defaultY() { return 200; }
		@Override public boolean enabledByDefault() { return false; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			boolean on = Config.get().toggleSprint;
			g.text(on ? "Toggle sprint: on" : "Sprint: hold", 6, 3, on ? ACCENT : DIM);
		}
	}
}
