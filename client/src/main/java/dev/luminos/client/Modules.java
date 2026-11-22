package dev.luminos.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/** Every built-in HUD module. */
public final class Modules {
	private Modules() {}

	public static final List<HudModule> ALL = List.of(
		new ArmorHud(), new Keystrokes(), new Cps(), new Fps(), new Coordinates(), new Potions(), new SprintStatus());

	// ---------------------------------------------------------------- Armor HUD
	public static final class ArmorHud extends HudModule {
		private static final EquipmentSlot[] SLOTS = {
			EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND};

		public String id() { return "armor_hud"; }
		public String title() { return "Armor HUD"; }
		public int width(Minecraft mc) { return 62; }
		public int height(Minecraft mc) { return 5 * 18 + 2; }
		public int defaultX() { return 6; }
		public int defaultY() { return 90; }

		public void render(GuiGraphics g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			for (int i = 0; i < SLOTS.length; i++) {
				ItemStack s = stack(mc, i, preview);
				int y = 2 + i * 18;
				if (s.isEmpty()) continue;
				g.renderItem(s, 6, y);
				g.renderItemDecorations(mc.font, s, 6, y);
				String label = null;
				int color = TEXT;
				if (s.isDamageableItem()) {
					label = Integer.toString(s.getMaxDamage() - s.getDamageValue());
					color = 0xFF000000 | s.getBarColor();
				} else if (s.getCount() > 1) {
					label = "x" + s.getCount();
				}
				if (label != null) g.drawString(mc.font, label, 28, y + 5, color, true);
			}
		}

		private static ItemStack stack(Minecraft mc, int i, boolean preview) {
			if (mc.player == null) {
				if (!preview) return ItemStack.EMPTY;
				ItemStack[] demo = {
					new ItemStack(Items.NETHERITE_HELMET), new ItemStack(Items.DIAMOND_CHESTPLATE),
					new ItemStack(Items.IRON_LEGGINGS), new ItemStack(Items.GOLDEN_BOOTS), new ItemStack(Items.DIAMOND_SWORD)};
				if (i < 4) demo[i].setDamageValue(30 * (i + 1));
				return demo[i];
			}
			return mc.player.getItemBySlot(SLOTS[i]);
		}
	}

	// ---------------------------------------------------------------- Keystrokes
	public static final class Keystrokes extends HudModule {
		public String id() { return "keystrokes"; }
		public String title() { return "Keystrokes"; }
		public int width(Minecraft mc) { return 72; }
		public int height(Minecraft mc) { return 68; }
		public int defaultX() { return 6; }
		public int defaultY() { return 160; }

		public void render(GuiGraphics g, Minecraft mc, boolean preview) {
			var o = mc.options;
			key(g, mc, 25, 0, 22, 22, "W", o.keyUp.isDown() || (preview && mc.player == null));
			key(g, mc, 0, 25, 22, 22, "A", o.keyLeft.isDown());
			key(g, mc, 25, 25, 22, 22, "S", o.keyDown.isDown());
			key(g, mc, 50, 25, 22, 22, "D", o.keyRight.isDown());
			long w = mc.getWindow().getWindow();
			boolean l = GLFW.glfwGetMouseButton(w, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
			boolean r = GLFW.glfwGetMouseButton(w, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
			key(g, mc, 0, 50, 35, 18, "LMB " + Cps.left(), l);
			key(g, mc, 37, 50, 35, 18, "RMB " + Cps.right(), r);
		}

		private void key(GuiGraphics g, Minecraft mc, int x, int y, int w, int h, String label, boolean down) {
			g.fill(x, y, x + w, y + h, down ? PANEL_ON : PANEL);
			if (down) g.fill(x, y + h - 2, x + w, y + h, ACCENT);
			int tw = mc.font.width(label);
			g.drawString(mc.font, label, x + (w - tw) / 2, y + (h - 8) / 2, down ? 0xFFFFFFFF : TEXT, false);
		}
	}

	// ---------------------------------------------------------------- CPS
	public static final class Cps extends HudModule {
		private static final ArrayDeque<Long> LEFT = new ArrayDeque<>();
		private static final ArrayDeque<Long> RIGHT = new ArrayDeque<>();

		/** Called from the GLFW mouse-button hook installed by {@link LuminosClient}. */
		public static void click(int button) {
			long now = System.currentTimeMillis();
			if (button == GLFW.GLFW_MOUSE_BUTTON_LEFT) LEFT.addLast(now);
			if (button == GLFW.GLFW_MOUSE_BUTTON_RIGHT) RIGHT.addLast(now);
		}

		private static int count(ArrayDeque<Long> q) {
			long cutoff = System.currentTimeMillis() - 1000;
			while (!q.isEmpty() && q.peekFirst() < cutoff) q.pollFirst();
			return q.size();
		}

		public static int left() { return count(LEFT); }
		public static int right() { return count(RIGHT); }

		public String id() { return "cps"; }
		public String title() { return "CPS"; }
		public int width(Minecraft mc) { return 62; }
		public int height(Minecraft mc) { return 14; }
		public int defaultX() { return 6; }
		public int defaultY() { return 236; }
		public boolean enabledByDefault() { return false; }

		public void render(GuiGraphics g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			g.drawString(mc.font, left() + " | " + right() + " CPS", 6, 3, TEXT, true);
		}
	}

	// ---------------------------------------------------------------- FPS
	public static final class Fps extends HudModule {
		public String id() { return "fps"; }
		public String title() { return "FPS"; }
		public int width(Minecraft mc) { return 52; }
		public int height(Minecraft mc) { return 14; }
		public int defaultX() { return 6; }
		public int defaultY() { return 6; }

		public void render(GuiGraphics g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			g.drawString(mc.font, mc.getFps() + " FPS", 6, 3, TEXT, true);
		}
	}

	// ---------------------------------------------------------------- Coordinates
	public static final class Coordinates extends HudModule {
		public String id() { return "coords"; }
		public String title() { return "Coordinates"; }
		public int width(Minecraft mc) { return 104; }
		public int height(Minecraft mc) { return 36; }
		public int defaultX() { return 6; }
		public int defaultY() { return 24; }

		public void render(GuiGraphics g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			double x = 0, y = 64, z = 0;
			String dir = "north";
			if (mc.player != null) {
				x = mc.player.getX();
				y = mc.player.getY();
				z = mc.player.getZ();
				dir = mc.player.getDirection().getName();
			}
			g.drawString(mc.font, String.format("X %.1f", x), 6, 3, TEXT, true);
			g.drawString(mc.font, String.format("Y %.1f", y), 6, 13, TEXT, true);
			g.drawString(mc.font, String.format("Z %.1f", z), 6, 23, TEXT, true);
			g.drawString(mc.font, dir, 72, 13, DIM, true);
		}
	}

	// ---------------------------------------------------------------- Potion effects
	public static final class Potions extends HudModule {
		public String id() { return "potions"; }
		public String title() { return "Potion effects"; }
		public int width(Minecraft mc) { return 110; }
		public int height(Minecraft mc) { return Math.max(1, rows(mc, true).size()) * 11 + 5; }
		public int defaultX() { return 6; }
		public int defaultY() { return 260; }

		private List<String> rows(Minecraft mc, boolean preview) {
			List<String> out = new ArrayList<>();
			if (mc.player != null) {
				Collection<MobEffectInstance> fx = mc.player.getActiveEffects();
				for (MobEffectInstance e : fx) {
					int secs = e.getDuration() / 20;
					String name = e.getEffect().value().getDisplayName().getString();
					out.add(name + " " + (e.getAmplifier() + 1) + "  " + (e.isInfiniteDuration() ? "∞" : secs / 60 + ":" + String.format("%02d", secs % 60)));
				}
			} else if (preview) {
				out.add("Speed 2  1:32");
				out.add("Regeneration 1  0:41");
			}
			return out;
		}

		public void render(GuiGraphics g, Minecraft mc, boolean preview) {
			List<String> rows = rows(mc, preview);
			if (rows.isEmpty()) return;
			panel(g, width(mc), height(mc));
			for (int i = 0; i < rows.size(); i++) g.drawString(mc.font, rows.get(i), 6, 3 + i * 11, TEXT, true);
		}
	}

	// ---------------------------------------------------------------- Sprint status
	public static final class SprintStatus extends HudModule {
		public String id() { return "sprint_status"; }
		public String title() { return "Sprint status"; }
		public int width(Minecraft mc) { return 92; }
		public int height(Minecraft mc) { return 14; }
		public int defaultX() { return 6; }
		public int defaultY() { return 62; }
		public boolean enabledByDefault() { return false; }

		public void render(GuiGraphics g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			String s = Config.get().toggleSprint ? (LuminosClient.sprintLatched ? "Sprint: toggled" : "Sprint: ready") : "Sprint: vanilla";
			g.drawString(mc.font, s, 6, 3, TEXT, true);
		}
	}
}
