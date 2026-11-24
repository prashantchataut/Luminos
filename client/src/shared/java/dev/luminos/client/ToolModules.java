package dev.luminos.client;

import dev.luminos.client.core.FrameStats;
import dev.luminos.client.core.Waypoint;
import net.minecraft.client.Minecraft;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Diagnostic and navigation HUD modules. Read-only: nothing here touches gameplay. */
public final class ToolModules {
	private ToolModules() {}

	/** Toggleable frame-time overlay. Off by default; samples only while it is drawn, so it costs nothing when hidden. */
	public static final class PerfOverlay extends HudModule {
		private final FrameStats stats = new FrameStats(600);
		private FrameStats.Summary cached = new FrameStats.Summary(0, 0, 0, 0);
		private long last, cachedAt;
		private double lastMs;

		public String id() { return "perf_overlay"; }
		public String title() { return "Performance overlay"; }
		@Override public boolean enabledByDefault() { return false; }
		@Override public int defaultX() { return 6; }
		@Override public int defaultY() { return 150; }
		public int width(Minecraft mc) { return 128; }
		public int height(Minecraft mc) { return 38; }

		public void render(Gfx g, Minecraft mc, boolean preview) {
			long now = System.nanoTime();
			if (!preview) {
				if (last != 0) {
					double ms = (now - last) / 1_000_000.0;
					if (ms < 1000) { stats.add(ms); lastMs = ms; }   // longer gaps mean the HUD was hidden or the game paused
				}
				last = now;
				if (now - cachedAt > 500_000_000L) { cached = stats.summary(); cachedAt = now; }   // sorting every frame would be the overhead we are measuring
			}
			double frame = preview ? 6.4 : lastMs, avg = preview ? 156 : cached.avgFps(), low = preview ? 118 : cached.low1Fps(), p99 = preview ? 9.1 : cached.p99Ms();
			Runtime rt = Runtime.getRuntime();
			long used = (rt.totalMemory() - rt.freeMemory()) >> 20, max = rt.maxMemory() >> 20;
			panel(g, width(mc), height(mc));
			g.text(String.format(Locale.ROOT, "Frame %.1f ms  %.0f fps", frame, avg), 6, 3, TEXT);
			g.text(String.format(Locale.ROOT, "1%% low %.0f fps  p99 %.1f ms", low, p99), 6, 14, DIM);
			g.text("Memory " + (preview ? 812 : used) + " / " + (preview ? 4096 : max) + " MB", 6, 25, DIM);
		}
	}

	/** Nearest three waypoints in the current dimension, with distance. */
	public static final class WaypointsHud extends HudModule {
		public String id() { return "waypoints"; }
		public String title() { return "Waypoints"; }
		@Override public boolean enabledByDefault() { return false; }
		@Override public int defaultX() { return 6; }
		@Override public int defaultY() { return 100; }
		public int width(Minecraft mc) { return 112; }
		public int height(Minecraft mc) { return 36; }

		public void render(Gfx g, Minecraft mc, boolean preview) {
			List<String> names = new ArrayList<>();
			List<Integer> colours = new ArrayList<>();
			List<String> dist = new ArrayList<>();
			if (preview || mc.player == null || mc.level == null) {
				names.addAll(List.of("Home", "Mine", "Village")); colours.addAll(List.of(0x4F8CFF, 0x5BE3A0, 0xFFC857)); dist.addAll(List.of("42 m", "310 m", "1.2 km"));
			} else {
				double px = mc.player.getX(), py = mc.player.getY(), pz = mc.player.getZ();
				List<Waypoint> near = Waypoint.nearest(WaypointStore.all(), WaypointStore.dimension(mc), px, py, pz);
				for (int i = 0; i < Math.min(3, near.size()); i++) {
					Waypoint w = near.get(i);
					names.add(w.name()); colours.add(w.rgb()); dist.add(Waypoint.distanceLabel(w.distance(px, py, pz)));
				}
			}
			int h = Math.max(14, 4 + names.size() * 11);
			panel(g, width(mc), h);
			if (names.isEmpty()) { g.text("No waypoints here", 6, 3, DIM); return; }
			for (int i = 0; i < names.size(); i++) {
				int y = 3 + i * 11;
				g.fill(6, y + 1, 9, y + 8, 0xFF000000 | colours.get(i));
				g.text(names.get(i), 13, y, TEXT);
				g.text(dist.get(i), width(mc) - 6 - g.textWidth(dist.get(i)), y, DIM);
			}
		}
	}
}
