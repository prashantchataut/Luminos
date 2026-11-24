package dev.luminos.client.core;

/**
 * "Why is my FPS low?" Reads a snapshot of the running client and returns exactly one concrete change, the one most likely
 * to help. Rules are ordered by how often they are the cause and how cheap the fix is; the first match wins.
 * Pure logic, no Minecraft types, tested in CoreTests.
 */
public final class FpsDoctor {
	private FpsDoctor() {}

	public record Snapshot(boolean sodium, boolean vulkanMod, int modCount, long usedMb, long maxMb, double avgFps, double p99Ms,
			int renderDistance, boolean vsync, boolean shaders, boolean software) {
		/** Same snapshot for a hardware GPU. */
		public Snapshot(boolean sodium, boolean vulkanMod, int modCount, long usedMb, long maxMb, double avgFps, double p99Ms, int renderDistance, boolean vsync, boolean shaders) {
			this(sodium, vulkanMod, modCount, usedMb, maxMb, avgFps, p99Ms, renderDistance, vsync, shaders, false);
		}
	}

	/** True when the GPU name is a CPU rasteriser (Mesa llvmpipe/softpipe/swrast/lavapipe, Microsoft Basic Render, SwiftShader). */
	public static boolean isSoftwareRenderer(String gpuName) {
		if (gpuName == null) return false;
		String n = gpuName.toLowerCase(java.util.Locale.ROOT);
		return n.contains("llvmpipe") || n.contains("softpipe") || n.contains("swrast") || n.contains("lavapipe") || n.contains("swiftshader") || n.contains("basic render") || n.contains("software");
	}

	/** {@code change} is one imperative sentence; {@code why} cites the number that triggered it. */
	public record Advice(String id, String title, String change, String why) {}

	public static Advice diagnose(Snapshot s) {
		double avgMs = s.avgFps() > 0 ? 1000.0 / s.avgFps() : 0;
		double heap = s.maxMb() > 0 ? s.usedMb() / (double) s.maxMb() : 0;
		if (s.software())
			return new Advice("software", "Software rendering", "Install or update your graphics driver; Minecraft is drawing on the CPU.", "The renderer is a CPU rasteriser, so every frame costs CPU time. No in-game setting fixes that.");
		if (s.maxMb() > 0 && s.maxMb() < 2048)
			return new Advice("ram", "Memory is the limit", "Raise the game's RAM to 4 GB in the launcher.", "Only " + s.maxMb() + " MB is allocated; Minecraft with mods wants 3 to 4 GB.");
		if (heap > 0.88)
			return new Advice("heap", "Memory is nearly full", "Raise the game's RAM by 1 GB, or lower render distance by 4.", "The heap is " + Math.round(heap * 100) + "% full, so the garbage collector runs constantly.");
		if (!s.sodium() && !s.vulkanMod())
			return new Advice("renderer", "Vanilla renderer", "Switch the renderer to Sodium (Performance tab).", "Neither Sodium nor VulkanMod is loaded; vanilla chunk rendering is the slowest option.");
		if (avgMs > 0 && s.p99Ms() > avgMs * 3 && s.p99Ms() > 20)
			return new Advice("stutter", "Stutter, not low FPS", s.usedMb() > s.maxMb() * 0.6 ? "Raise the game's RAM by 1 GB." : "Lower render distance by 2 chunks.",
					"Your slowest 1% of frames take " + Math.round(s.p99Ms()) + " ms against an average of " + Math.round(avgMs) + " ms.");
		if (s.renderDistance() > 16 && s.avgFps() < 90)
			return new Advice("distance", "Render distance", "Lower render distance to 12 chunks.", "Distance " + s.renderDistance() + " at " + Math.round(s.avgFps()) + " FPS: it is the biggest single cost.");
		if (s.modCount() > 150)
			return new Advice("mods", "Many mods", "Disable mods you do not use (Profiles tab).", s.modCount() + " mods are loaded; each adds start-up and per-frame work.");
		if (s.shaders() && s.avgFps() < 60)
			return new Advice("shaders", "Shader pack", "Pick a lighter shader pack, or turn shaders off.", "A shader pack is active and the average is " + Math.round(s.avgFps()) + " FPS.");
		if (s.vsync() && s.avgFps() > 0 && s.avgFps() <= 62)
			return new Advice("vsync", "V-Sync", "Turn V-Sync off if your monitor is above 60 Hz.", "FPS is pinned near 60, which is what V-Sync does on a 60 Hz display.");
		return new Advice("ok", "Nothing obvious", "Nothing to change right now.", "Average " + Math.round(s.avgFps()) + " FPS, p99 " + Math.round(s.p99Ms()) + " ms, heap " + Math.round(heap * 100) + "%.");
	}
}
