package dev.luminos.client;

import dev.luminos.client.core.FpsDoctor;
import dev.luminos.client.core.FrameStats;
import dev.luminos.client.core.Waypoint;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Built-in HUD modules. Same ids and config keys on every Minecraft line, so one launcher UI edits them all. */
public final class Modules {
	private Modules() {}

	public static final List<HudModule> ALL = new ArrayList<>();

	static {
		ALL.add(new Fps());
		ALL.add(new Cps());
		ALL.add(new Ping());
		ALL.add(new ArmorHud());
		ALL.add(new Potions());
		ALL.add(new Keystrokes());
		ALL.add(new Health());
		ALL.add(new Hunger());
		ALL.add(new Coordinates());
		ALL.add(new TargetHud());
		ALL.add(new SprintStatus());
		ALL.add(new Crosshair());
		ALL.add(new Clock());
		ALL.add(new Memory());
		ALL.add(new Direction());
		ALL.add(new ServerIp());
		ALL.add(new Playtime());
		ALL.add(new ItemCounter());
		ALL.add(new WaypointsHud());
		ALL.add(new DebugLite());
		ALL.add(new InventoryHud());
		ALL.add(new PerfOverlay());
	}

	/** Right and bottom anchors: the host clamps an oversized x/y to the screen edge, so 9999 means "flush with that edge". */
	static final int EDGE = 9999;

	// ------------------------------------------------------------------ one-line stat plates
	private abstract static class Stat extends HudModule {
		abstract String value(Minecraft mc, boolean preview);
		String unit() { return ""; }
		int valueColor(Minecraft mc, boolean preview) { return ink(); }
		public int width(Minecraft mc) { return 10 + tw(value(mc, mc.player == null)) + (unit().isEmpty() ? 0 : 3 + Math.round(tw(unit()) * Glass.LABEL)); }
		public int height(Minecraft mc) { return 14; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			String v = value(mc, preview);
			panel(g, width(mc), height(mc));
			g.text(v, 5, 3, valueColor(mc, preview));
			if (!unit().isEmpty()) Glass.text(g, unit(), 5 + g.textWidth(v) + 3, 4.5f, Glass.LABEL, Glass.INK3);
		}
	}

	/** Icon + text plate for the secondary modules. */
	private abstract static class Line extends HudModule {
		abstract String text(Minecraft mc, boolean preview);
		public int width(Minecraft mc) { return 18 + tw(text(mc, mc.player == null)); }
		public int height(Minecraft mc) { return 14; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			String t = text(mc, preview);
			panel(g, width(mc), height(mc));
			Icons.draw(g, icon(), 4, 3, Glass.INK3);
			g.text(t, 14, 3, ink());
		}
	}

	public static final class Fps extends Stat {
		public String id() { return "fps"; }
		public String title() { return "FPS"; }
		@Override public String desc() { return "Frames per second"; }
		@Override public String icon() { return "bolt"; }
		@Override public boolean primary() { return true; }
		@Override public int defaultY() { return 6; }
		String value(Minecraft mc, boolean preview) { int f = preview ? 240 : this.<Integer>cached(mc::getFps); return String.valueOf(f); }
		@Override String unit() { return "FPS"; }
	}

	public static final class Cps extends Stat {
		public String id() { return "cps"; }
		public String title() { return "CPS"; }
		@Override public String desc() { return "Clicks per second, counted at press time"; }
		@Override public String icon() { return "cps"; }
		@Override public boolean primary() { return true; }
		@Override public int defaultY() { return 22; }
		@Override public List<Feature.Opt> opts() { return List.of(Feature.Opt.toggle("right", "Show right button", true)); }
		String value(Minecraft mc, boolean preview) {
			int l = preview ? 7 : InputSampler.left(), r = preview ? 3 : InputSampler.right();
			return opt("right", true) ? l + " | " + r : String.valueOf(l);
		}
		@Override String unit() { return "CPS"; }
	}

	public static final class Ping extends Stat {
		public String id() { return "ping"; }
		public String title() { return "Ping"; }
		@Override public String desc() { return "Server-reported latency, and measured round trip"; }
		@Override public String icon() { return "ping"; }
		@Override public boolean primary() { return true; }
		@Override public int defaultY() { return 38; }
		@Override public List<Feature.Opt> opts() { return List.of(Feature.Opt.toggle("measured", "Show measured round trip", true)); }
		String value(Minecraft mc, boolean preview) {
			if (preview) return opt("measured", true) ? "38 | 41" : "38";
			var c = mc.getConnection();
			if (c == null || mc.player == null) return "-";
			var i = c.getPlayerInfo(mc.player.getUUID());
			if (i == null || mc.getSingleplayerServer() != null) return "local";
			long m = Probes.measuredPing();
			return opt("measured", true) && m >= 0 ? i.getLatency() + " | " + m : String.valueOf(i.getLatency());
		}
		@Override String unit() { return "ms"; }
	}

	// ------------------------------------------------------------------ armor with durability
	public static final class ArmorHud extends HudModule {
		private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
		public String id() { return "armor_hud"; }
		public String title() { return "Armor HUD"; }
		@Override public String desc() { return "Worn armor with remaining durability"; }
		@Override public String icon() { return "armor"; }
		@Override public boolean primary() { return true; }
		@Override public List<Feature.Opt> opts() { return List.of(Feature.Opt.toggle("numbers", "Show durability numbers", true)); }
		@Override public int defaultX() { return EDGE; }
		@Override public int defaultY() { return 80; }
		public int width(Minecraft mc) { return opt("numbers", true) ? 52 : 26; }
		public int height(Minecraft mc) { return 4 * 18 + 4; }
		private static ItemStack[] armorSampleCache;

		/** Editor/title-screen sample. Built once; on 26.x item components are not bound until a world is loaded, so a failure means "draw nothing yet", never a crash. */
		private static ItemStack[] armorSample() {
			if (armorSampleCache != null) return armorSampleCache;
			try {
				armorSampleCache = new ItemStack[]{new ItemStack(Items.DIAMOND_HELMET), new ItemStack(Items.DIAMOND_CHESTPLATE), new ItemStack(Items.IRON_LEGGINGS), new ItemStack(Items.NETHERITE_BOOTS)};
				return armorSampleCache;
			} catch (RuntimeException notBoundYet) {
				return new ItemStack[]{ItemStack.EMPTY, ItemStack.EMPTY, ItemStack.EMPTY, ItemStack.EMPTY};
			}
		}

		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			boolean sampleMode = mc.player == null || preview;
			ItemStack[] sample = sampleMode ? armorSample() : null;
			int[] dmg = {40, 120, 61, 8};
			for (int i = 0; i < 4; i++) {
				ItemStack st = sampleMode ? sample[i] : mc.player.getItemBySlot(SLOTS[i]);
				if (st == null || st.isEmpty()) continue;
				if (preview || mc.player == null) st.setDamageValue(dmg[i]);
				int y = 2 + i * 18;
				g.item(st, 5, y);
				g.itemDecorations(st, 5, y);
				if (opt("numbers", true) && st.isDamageableItem()) {
					String left = String.valueOf(st.getMaxDamage() - st.getDamageValue());
					Glass.text(g, left, 25, y + 5, Glass.LABEL, Glass.INK2);
				}
			}
		}
	}

	// ------------------------------------------------------------------ potion effects as icons
	public static final class Potions extends HudModule {
		private record Eff(Holder<MobEffect> e, int amp, int ticks, boolean inf) {}
		private static final String[] ROMAN = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};

		private List<Eff> list(Minecraft mc, boolean preview) {
			List<Eff> out = new ArrayList<>();
			if (preview || mc.player == null) {
				out.add(new Eff(MobEffects.SPEED, 1, 20 * 102, false));
				out.add(new Eff(MobEffects.NIGHT_VISION, 0, 20 * 370, false));
				out.add(new Eff(MobEffects.REGENERATION, 0, 20 * 7, false));
				return out;
			}
			for (MobEffectInstance e : mc.player.getActiveEffects()) out.add(new Eff(e.getEffect(), e.getAmplifier(), e.getDuration(), e.isInfiniteDuration()));
			return out;
		}
		private static String time(Eff e) {
			if (e.inf) return "--";
			int s = Math.max(0, e.ticks / 20);
			return s / 60 + ":" + String.format(Locale.ROOT, "%02d", s % 60);
		}
		public String id() { return "potions"; }
		public String title() { return "Potion effects"; }
		@Override public String desc() { return "Effect icons with time left, not text lines"; }
		@Override public String icon() { return "potion"; }
		@Override public boolean primary() { return true; }
		@Override public List<Feature.Opt> opts() { return List.of(Feature.Opt.toggle("time", "Show time left", true), Feature.Opt.toggle("level", "Show level", true)); }
		@Override public int defaultX() { return EDGE; }
		@Override public int defaultY() { return 6; }
		public int width(Minecraft mc) { return opt("time", true) ? 50 : 24; }
		public int height(Minecraft mc) { return Math.max(1, list(mc, mc.player == null).size()) * 20 + 2; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			List<Eff> r = list(mc, preview);
			if (r.isEmpty()) return;
			for (int i = 0; i < r.size(); i++) {
				Eff e = r.get(i);
				int y = 2 + i * 20;
				g.push(0, y - 2, 1f);
				panel(g, width(mc), 18);
				g.effectIcon(e.e, 3, 0, 16);
				if (opt("level", true) && e.amp > 0) Glass.text(g, ROMAN[Math.min(e.amp, 9)], 3 + 16 - Math.round(tw(ROMAN[Math.min(e.amp, 9)]) * Glass.LABEL), 11, Glass.LABEL, 0xFFFFFFFF);
				if (opt("time", true)) {
					boolean low = !e.inf && e.ticks < 20 * 10;
					boolean blink = low && (System.currentTimeMillis() / 400) % 2 == 0;
					Glass.text(g, time(e), 23, 5.5f, Glass.LABEL, blink ? Glass.WARN : Glass.INK2);
				}
				g.pop();
			}
		}
	}

	// ------------------------------------------------------------------ keystrokes: neutral glass, not blue
	public static final class Keystrokes extends HudModule {
		public String id() { return "keystrokes"; }
		public String title() { return "Keystrokes"; }
		@Override public String desc() { return "WASD, jump and mouse buttons"; }
		@Override public String icon() { return "keys"; }
		@Override public List<Feature.Opt> opts() { return List.of(Feature.Opt.toggle("mouse", "Show mouse buttons", true), Feature.Opt.toggle("space", "Show space bar", true)); }
		@Override public int defaultX() { return 6; }
		@Override public int defaultY() { return EDGE; }
		public int width(Minecraft mc) { return 58; }
		public int height(Minecraft mc) { return 40 + (opt("space", true) ? 14 : 0) + (opt("mouse", true) ? 20 : 0); }
		private void key(Gfx g, String id, int x, int y, int w, int h, String label, boolean down) {
			float k = Anim.soft("key." + id, down ? 1f : 0f);
			int fill = Glass.lerp(0x59070809, 0xD9F2F4F8, k);
			Glass.roundFill(g, x, y, w, h, 3, fill);
			Glass.roundOutline(g, x, y, w, h, 3, Glass.lerp(0x28FFFFFF, 0x00FFFFFF, k));
			int ink = Glass.lerp(Glass.INK, 0xFF14161C, k);
			Glass.text(g, label, x + (w - g.textWidth(label)) / 2f, y + (h - 8) / 2f + 1, 1f, ink);
		}
		public void render(Gfx g, Minecraft mc, boolean preview) {
			var o = mc.options;
			boolean w = preview || o.keyUp.isDown(), a = !preview && o.keyLeft.isDown(), s = !preview && o.keyDown.isDown(), d = !preview && o.keyRight.isDown();
			Anim.frame();
			key(g, "w", 20, 0, 18, 18, "W", w);
			key(g, "a", 0, 20, 18, 18, "A", a);
			key(g, "s", 20, 20, 18, 18, "S", s);
			key(g, "d", 40, 20, 18, 18, "D", d);
			int y = 40;
			if (opt("space", true)) { key(g, "sp", 0, y, 58, 12, "", !preview && o.keyJump.isDown()); g.fill(22, y + 5, 36, y + 6, 0xAAF2F4F8); y += 14; }
			if (opt("mouse", true)) {
				key(g, "lmb", 0, y, 28, 18, preview ? "7" : String.valueOf(InputSampler.left()), !preview && o.keyAttack.isDown());
				key(g, "rmb", 30, y, 28, 18, preview ? "3" : String.valueOf(InputSampler.right()), !preview && o.keyUse.isDown());
			}
		}
	}

	// ------------------------------------------------------------------ vitals
	public static final class Health extends HudModule {
		public String id() { return "health"; }
		public String title() { return "Health"; }
		@Override public String desc() { return "HP, with absorption hearts added"; }
		@Override public String icon() { return "heart"; }
		@Override public int defaultY() { return 54; }
		@Override public boolean enabledByDefault() { return false; }
		private String hp(Minecraft mc, boolean preview) { return preview || mc.player == null ? "20" : String.valueOf(Math.round(mc.player.getHealth() * 10) / 10f).replace(".0", ""); }
		private String abs(Minecraft mc, boolean preview) {
			float a = preview || mc.player == null ? 4 : mc.player.getAbsorptionAmount();
			return a > 0 ? "+" + String.valueOf(Math.round(a * 10) / 10f).replace(".0", "") : "";
		}
		public int width(Minecraft mc) { String a = abs(mc, mc.player == null); return 18 + tw(hp(mc, mc.player == null)) + (a.isEmpty() ? 4 : 5 + tw(a)); }
		public int height(Minecraft mc) { return 14; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			Icons.draw(g, "heart", 4, 3, 0xFFFF7A8A);
			String h = hp(mc, preview), a = abs(mc, preview);
			g.text(h, 14, 3, Glass.INK);
			if (!a.isEmpty()) g.text(a, 14 + g.textWidth(h) + 4, 3, Glass.WARN);
		}
	}

	public static final class Hunger extends HudModule {
		public String id() { return "hunger"; }
		public String title() { return "Hunger"; }
		@Override public String desc() { return "Food level and saturation"; }
		@Override public String icon() { return "hunger"; }
		@Override public int defaultY() { return 70; }
		@Override public boolean enabledByDefault() { return false; }
		private String food(Minecraft mc, boolean preview) { return preview || mc.player == null ? "18" : String.valueOf(mc.player.getFoodData().getFoodLevel()); }
		private String sat(Minecraft mc, boolean preview) { return String.format(Locale.ROOT, "%.1f", preview || mc.player == null ? 5.4f : mc.player.getFoodData().getSaturationLevel()); }
		public int width(Minecraft mc) { return 18 + tw(food(mc, mc.player == null)) + 4 + Math.round(tw(sat(mc, mc.player == null)) * Glass.LABEL); }
		public int height(Minecraft mc) { return 14; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			Icons.draw(g, "hunger", 4, 3, 0xFFE0A15A);
			String f = food(mc, preview);
			g.text(f, 14, 3, Glass.INK);
			Glass.text(g, sat(mc, preview), 14 + g.textWidth(f) + 4, 4.5f, Glass.LABEL, Glass.INK3);
		}
	}

	// ------------------------------------------------------------------ target HUD
	public static final class TargetHud extends HudModule {
		private LivingEntity last;
		private long seen;
		public String id() { return "target_hud"; }
		public String title() { return "Target HUD"; }
		@Override public String desc() { return "Target health, distance, ping and armor"; }
		@Override public String icon() { return "target"; }
		@Override public Feature.Group group() { return Feature.Group.PVP; }
		@Override public boolean complianceFlagged() { return true; }
		@Override public int defaultX() { return EDGE; }
		@Override public int defaultY() { return 170; }
		@Override public boolean enabledByDefault() { return false; }
		public int width(Minecraft mc) { return 124; }
		public int height(Minecraft mc) { return 36; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			String name = "Steve";
			float hp = 17.5f, max = 20;
			double dist = 3.4;
			int armor = 14, ping = 38;
			if (!preview && mc.player != null) {
				Entity pick = mc.crosshairPickEntity;
				if (pick instanceof LivingEntity le && pick != mc.player) { last = le; seen = System.currentTimeMillis(); }
				if (last == null || last.isRemoved() || System.currentTimeMillis() - seen > 3000) return;
				name = last.getName().getString();
				hp = last.getHealth();
				max = last.getMaxHealth();
				dist = mc.player.distanceTo(last);
				armor = last.getArmorValue();
				ping = -1;
				if (last instanceof Player p && mc.getConnection() != null) { var i = mc.getConnection().getPlayerInfo(p.getUUID()); if (i != null) ping = i.getLatency(); }
			}
			panel(g, width(mc), height(mc));
			g.text(Glass.fit(g, name, 1f, 90), 6, 4, Glass.INK);
			float ratio = Math.max(0, Math.min(1, hp / Math.max(1, max)));
			float k = Anim.soft("target.hp", ratio);
			Glass.roundFill(g, 6, 15, 112, 4, 2, 0x30FFFFFF);
			int col = ratio > 0.5f ? Glass.OK : ratio > 0.25f ? Glass.WARN : 0xFFFF7A8A;
			if (k > 0.02f) Glass.roundFill(g, 6, 15, Math.max(3, Math.round(112 * k)), 4, 2, col);
			String line = String.format(Locale.ROOT, "%.1f HP  %.1f m  %d AR", hp, dist, armor) + (ping >= 0 ? "  " + ping + "ms" : "");
			Glass.text(g, line, 6, 23, Glass.LABEL, Glass.INK2);
		}
	}

	public static final class SprintStatus extends Line {
		public String id() { return "sprint_status"; }
		public String title() { return "Sprint status"; }
		@Override public String desc() { return "Shows when toggle sprint is holding for you"; }
		@Override public String icon() { return "sprint"; }
		@Override public Feature.Group group() { return Feature.Group.PVP; }
		@Override public int defaultY() { return 86; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) { return Config.get().toggleSprint ? "Sprint: toggled" : "Sprint: hold"; }
	}

	// ------------------------------------------------------------------ crosshair
	public static final class Crosshair extends HudModule {
		public String id() { return "crosshair"; }
		public String title() { return "Custom crosshair"; }
		@Override public String desc() { return "A thin cross with an adjustable gap"; }
		@Override public String icon() { return "crosshair"; }
		@Override public Feature.Group group() { return Feature.Group.VISUALS; }
		@Override public List<Feature.Opt> opts() { return List.of(Feature.Opt.slider("size", "Arm length", 2, 10, 4, 1, "px"), Feature.Opt.slider("gap", "Gap", 0, 6, 2, 1, "px")); }
		@Override public boolean centered() { return true; }
		@Override public boolean enabledByDefault() { return false; }
		public int width(Minecraft mc) { return 21; }
		public int height(Minecraft mc) { return 21; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			int c = Config.get().crosshairColor, s = Math.round(optNum("size", 4)), gap = Math.round(optNum("gap", 2));
			int m = 10;
			g.fill(m, m - gap - s, m + 1, m - gap, c);
			g.fill(m, m + 1 + gap, m + 1, m + 1 + gap + s, c);
			g.fill(m - gap - s, m, m - gap, m + 1, c);
			g.fill(m + 1 + gap, m, m + 1 + gap + s, m + 1, c);
		}
	}

	// ------------------------------------------------------------------ secondary (utility) lines
	public static final class Coordinates extends HudModule {
		public String id() { return "coords"; }
		public String title() { return "Coordinates"; }
		@Override public String desc() { return "XYZ and facing"; }
		@Override public String icon() { return "coords"; }
		@Override public boolean complianceFlagged() { return false; }
		@Override public int defaultY() { return 102; }
		@Override public boolean enabledByDefault() { return false; }
		private String t(Minecraft mc, boolean preview) {
			if (preview || mc.player == null) return "128  71  -311";
			return String.format(Locale.ROOT, "%.0f  %.0f  %.0f", mc.player.getX(), mc.player.getY(), mc.player.getZ());
		}
		public int width(Minecraft mc) { return 18 + tw(t(mc, mc.player == null)); }
		public int height(Minecraft mc) { return 14; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			Icons.draw(g, "coords", 4, 3, Glass.INK3);
			g.text(t(mc, preview), 14, 3, ink());
		}
	}

	public static final class Clock extends Line {
		public String id() { return "clock"; }
		public String title() { return "Clock"; }
		@Override public String desc() { return "Your local time"; }
		@Override public String icon() { return "clock"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public int defaultY() { return 118; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) { return LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")); }
	}

	public static final class Memory extends Line {
		public String id() { return "memory"; }
		public String title() { return "Memory"; }
		@Override public String desc() { return "Java heap in use"; }
		@Override public String icon() { return "memory"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public int defaultY() { return 134; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			return cached(() -> { Runtime r = Runtime.getRuntime(); return ((r.totalMemory() - r.freeMemory()) >> 20) + " / " + (r.maxMemory() >> 20) + " MB"; });
		}
	}

	public static final class Direction extends Line {
		private static final String[] D = {"S", "SW", "W", "NW", "N", "NE", "E", "SE"};
		public String id() { return "direction"; }
		public String title() { return "Direction"; }
		@Override public String desc() { return "Compass heading"; }
		@Override public String icon() { return "compass"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public int defaultY() { return 150; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			if (preview || mc.player == null) return "N  180";
			float yaw = ((mc.player.getYRot() % 360) + 360) % 360;
			return D[Math.round(yaw / 45f) % 8] + "  " + Math.round(yaw);
		}
	}

	public static final class ServerIp extends Line {
		public String id() { return "server_ip"; }
		public String title() { return "Server IP"; }
		@Override public String desc() { return "The server you are on"; }
		@Override public String icon() { return "server"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public int defaultY() { return 166; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			if (preview) return "play.example.net";
			ServerData d = mc.getCurrentServer();
			return d != null ? d.ip : (mc.getSingleplayerServer() != null ? "singleplayer" : "-");
		}
	}

	public static final class Playtime extends Line {
		public String id() { return "playtime"; }
		public String title() { return "Playtime"; }
		@Override public String desc() { return "Total time played with Luminos"; }
		@Override public String icon() { return "hourglass"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public int defaultY() { return 182; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) { long m = Config.get().playtimeMs / 60000; return m / 60 + "h " + m % 60 + "m"; }
	}

	public static final class ItemCounter extends Line {
		public String id() { return "item_counter"; }
		public String title() { return "Item counter"; }
		@Override public String desc() { return "How many of the held item you carry"; }
		@Override public String icon() { return "counter"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public int defaultY() { return 198; }
		@Override public boolean enabledByDefault() { return false; }
		String text(Minecraft mc, boolean preview) {
			if (preview || mc.player == null) return "Arrows x 64";
			ItemStack held = mc.player.getMainHandItem();
			if (held.isEmpty()) return "Hand empty";
			int n = 0;
			var inv = mc.player.getInventory();
			for (int i = 0; i < inv.getContainerSize(); i++) if (ItemStack.isSameItem(inv.getItem(i), held)) n += inv.getItem(i).getCount();
			return held.getHoverName().getString() + " x " + n;
		}
	}

	/** Nearest three waypoints in the current dimension, with distance. */
	public static final class WaypointsHud extends HudModule {
		public String id() { return "waypoints"; }
		public String title() { return "Waypoints"; }
		@Override public String desc() { return "Nearest three, with distance"; }
		@Override public String icon() { return "flag"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public boolean complianceFlagged() { return true; }
		@Override public boolean enabledByDefault() { return false; }
		@Override public int defaultX() { return EDGE; }
		@Override public int defaultY() { return 230; }
		public int width(Minecraft mc) { return 112; }
		public int height(Minecraft mc) { return 36; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			List<String> names = new ArrayList<>();
			List<Integer> colours = new ArrayList<>();
			List<String> dist = new ArrayList<>();
			if (preview || mc.player == null || mc.level == null) {
				names.addAll(List.of("Home", "Mine", "Village")); colours.addAll(List.of(0x8CB4FF, 0x7BE0A8, 0xFFC857)); dist.addAll(List.of("42 m", "310 m", "1.2 km"));
			} else {
				double px = mc.player.getX(), py = mc.player.getY(), pz = mc.player.getZ();
				List<Waypoint> near = Waypoint.nearest(WaypointStore.all(), WaypointStore.dimension(mc), px, py, pz);
				for (int i = 0; i < Math.min(3, near.size()); i++) { Waypoint w = near.get(i); names.add(w.name()); colours.add(w.rgb()); dist.add(Waypoint.distanceLabel(w.distance(px, py, pz))); }
			}
			int h = Math.max(14, 5 + names.size() * 11);
			panel(g, width(mc), h);
			if (names.isEmpty()) { g.text("No waypoints here", 6, 3, Glass.INK3); return; }
			for (int i = 0; i < names.size(); i++) {
				int y = 4 + i * 11;
				Glass.roundFill(g, 6, y + 1, 3, 7, 1, 0xFF000000 | colours.get(i));
				g.text(names.get(i), 13, y, Glass.INK);
				g.text(dist.get(i), width(mc) - 6 - g.textWidth(dist.get(i)), y, Glass.INK3);
			}
		}
	}

	/** A compact stand-in for the F3 screen: four lines that matter, no wall of text. Does not replace vanilla F3. */
	public static final class DebugLite extends HudModule {
		public String id() { return "debug_lite"; }
		public String title() { return "Debug lite"; }
		@Override public String desc() { return "Four lines of F3 that matter"; }
		@Override public String icon() { return "debug"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public boolean complianceFlagged() { return true; }
		@Override public int defaultY() { return 214; }
		@Override public boolean enabledByDefault() { return false; }
		private List<String> lines(Minecraft mc, boolean preview) {
			if (preview || mc.player == null || mc.level == null) return List.of("XYZ 128.4 / 71.0 / -310.9", "Facing north (-Z)", "Biome minecraft:plains  Light 15", "Frame 4.2 ms");
			BlockPos p = mc.player.blockPosition();
			String biome = mc.level.getBiome(p).getRegisteredName();
			return cached(() -> List.of(String.format(Locale.ROOT, "XYZ %.1f / %.1f / %.1f", mc.player.getX(), mc.player.getY(), mc.player.getZ()),
					"Facing " + mc.player.getDirection().getName(),
					"Biome " + biome + "  Light " + mc.level.getMaxLocalRawBrightness(p),
					String.format(Locale.ROOT, "Frame %.1f ms", mc.getFrameTimeNs() / 1e6)));
		}
		public int width(Minecraft mc) { int w = 0; for (String s : lines(mc, mc.player == null)) w = Math.max(w, tw(s)); return w + 12; }
		public int height(Minecraft mc) { return lines(mc, mc.player == null).size() * 11 + 5; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			List<String> l = lines(mc, preview);
			for (int i = 0; i < l.size(); i++) g.text(l.get(i), 6, 4 + i * 11, i == 0 ? Glass.INK : Glass.INK2);
		}
	}

	/** The 27 main inventory slots as a glass grid you can leave on the HUD. */
	public static final class InventoryHud extends HudModule {
		public String id() { return "inventory_hud"; }
		public String title() { return "Inventory HUD"; }
		@Override public String desc() { return "Your 27 storage slots, always visible"; }
		@Override public String icon() { return "inventory"; }
		@Override public Feature.Group group() { return Feature.Group.UTILITY; }
		@Override public int defaultX() { return EDGE; }
		@Override public int defaultY() { return EDGE; }
		@Override public boolean enabledByDefault() { return false; }
		public int width(Minecraft mc) { return 9 * 18 + 6; }
		public int height(Minecraft mc) { return 3 * 18 + 6; }
		private static ItemStack invSample(int i) {
			try { return i % 4 == 0 ? new ItemStack(Items.COBBLESTONE, 64) : i % 7 == 0 ? new ItemStack(Items.GOLDEN_APPLE, 3) : ItemStack.EMPTY; }
			catch (RuntimeException notBoundYet) { return ItemStack.EMPTY; }   // 26.x: components are bound only once a world is loaded
		}

		public void render(Gfx g, Minecraft mc, boolean preview) {
			panel(g, width(mc), height(mc));
			for (int i = 0; i < 27; i++) {
				int x = 3 + (i % 9) * 18, y = 3 + (i / 9) * 18;
				Glass.roundFill(g, x, y, 17, 17, 2, 0x18FFFFFF);
				ItemStack st = (preview || mc.player == null) ? invSample(i) : mc.player.getInventory().getItem(9 + i);
				if (st.isEmpty()) continue;
				g.item(st, x + 1, y + 1);
				g.itemDecorations(st, x + 1, y + 1);
			}
		}
	}

	/** Toggleable frame-time overlay with the one-line "why is my FPS low" suggestion. Samples only while drawn. */
	public static final class PerfOverlay extends HudModule {
		private final FrameStats stats = new FrameStats(600);
		private FrameStats.Summary cached = new FrameStats.Summary(0, 0, 0, 0);
		private long last, cachedAt;
		private double lastMs;
		public String id() { return "perf_overlay"; }
		public String title() { return "Performance overlay"; }
		@Override public String desc() { return "Frame time, 1% low and a fix for low FPS"; }
		@Override public String icon() { return "chart"; }
		@Override public Feature.Group group() { return Feature.Group.PERFORMANCE; }
		@Override public boolean enabledByDefault() { return false; }
		@Override public int defaultX() { return 6; }
		@Override public int defaultY() { return 274; }
		public int width(Minecraft mc) { return 150; }
		public int height(Minecraft mc) { return 49; }
		public void render(Gfx g, Minecraft mc, boolean preview) {
			long now = System.nanoTime();
			if (!preview) {
				if (last != 0) { double ms = (now - last) / 1_000_000.0; if (ms < 1000) { stats.add(ms); lastMs = ms; } }
				last = now;
				if (now - cachedAt > 500_000_000L) { cached = stats.summary(); cachedAt = now; }
			}
			double frame = preview ? 6.4 : lastMs, avg = preview ? 156 : cached.avgFps(), low = preview ? 118 : cached.low1Fps(), p99 = preview ? 9.1 : cached.p99Ms();
			panel(g, width(mc), height(mc));
			g.text(String.format(Locale.ROOT, "%.1f ms", frame), 6, 4, Glass.INK);
			Glass.text(g, String.format(Locale.ROOT, "avg %.0f   1%% low %.0f   p99 %.1f ms", avg, low, p99), 6, 15, Glass.LABEL, Glass.INK2);
			FpsDoctor.Advice a = preview ? new FpsDoctor.Advice("ok", "", "Nothing to change: the client is not CPU- or memory-bound.", "") : Probes.advice(mc, avg, p99);
			Glass.text(g, Glass.fit(g, a.change(), Glass.LABEL, (width(mc) - 12)), 6, 27, Glass.LABEL, "ok".equals(a.id()) ? Glass.INK3 : Glass.WARN);
			Glass.text(g, Glass.fit(g, a.why(), Glass.LABEL, (width(mc) - 12)), 6, 37, Glass.LABEL, Glass.INK3);
		}
	}
}
