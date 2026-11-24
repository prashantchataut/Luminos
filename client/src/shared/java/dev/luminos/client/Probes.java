package dev.luminos.client;

import dev.luminos.client.core.FpsDoctor;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.network.protocol.ping.ServerboundPingRequestPacket;
import net.minecraft.util.Util;

import java.nio.file.Files;
import java.nio.file.Path;

/** Read-only facts about this machine and connection that the Performance tab and the ping module use. */
public final class Probes {
	private Probes() {}

	/** Every in-world frame time, fed by the input sampler; read by the FPS doctor and the performance overlay. */
	public static final dev.luminos.client.core.FrameStats FRAMES = new dev.luminos.client.core.FrameStats(600);

	private static String gpu;
	private static int pingTick;
	private static FpsDoctor.Advice advice;
	private static long adviceAt;

	public static boolean loaded(String id) { return FabricLoader.getInstance().isModLoaded(id); }

	/**
	 * True only when an OpenGL context is current on this thread. On 26.x Minecraft can run on its Vulkan backend, where a bare
	 * {@code glGetString} does not throw: LWJGL aborts the whole JVM ("No context is current"). Every direct GL call goes through this check.
	 */
	public static boolean glCurrent() {
		try {
			org.lwjgl.opengl.GL.getCapabilities();   // throws IllegalStateException when LWJGL has no GL capabilities for this thread
			return true;
		} catch (Throwable t) { return false; }
	}

	/** The GPU name, from Minecraft's own device object (works on the OpenGL and Vulkan backends); GL_RENDERER only when a GL context is current. */
	public static String gpu() {
		if (gpu == null) {
			String s = null;
			try {
				Object dev = Class.forName("com.mojang.blaze3d.systems.RenderSystem").getMethod("getDevice").invoke(null);
				if (dev != null) {
					for (String m : new String[]{"getRenderer", "getDeviceName"}) {
						try { Object r = dev.getClass().getMethod(m).invoke(dev); if (r != null && !r.toString().isBlank()) { s = r.toString(); break; } } catch (ReflectiveOperationException ignored) { /* try the next accessor */ }
					}
				}
			} catch (Throwable ignored) { /* API differs between Minecraft lines */ }
			if (s == null && glCurrent()) {
				try { s = org.lwjgl.opengl.GL11.glGetString(org.lwjgl.opengl.GL11.GL_RENDERER); } catch (Throwable ignored) { /* fall through */ }
			}
			gpu = s == null ? "unknown GPU" : s;
		}
		return gpu;
	}

	/** Looks for a Vulkan loader; this says a runtime exists, not that VulkanMod will like the driver. */
	public static boolean vulkanRuntime() {
		String os = System.getProperty("os.name", "").toLowerCase(java.util.Locale.ROOT);
		if (os.contains("win")) return Files.exists(Path.of(System.getenv().getOrDefault("SystemRoot", "C:\\Windows"), "System32", "vulkan-1.dll"));
		if (os.contains("mac")) return true;   // MoltenVK ships with the Vulkan SDK; VulkanMod bundles its own path on macOS
		for (String d : new String[]{"/usr/lib/x86_64-linux-gnu/libvulkan.so.1", "/usr/lib64/libvulkan.so.1", "/usr/lib/libvulkan.so.1"}) if (Files.exists(Path.of(d))) return true;
		return false;
	}

	/** Sends a ping request every two seconds on a real server and reads Minecraft's own pong log: a measured round trip. */
	public static void tick(Minecraft mc) {
		if (mc.player == null || mc.getConnection() == null || mc.getSingleplayerServer() != null) return;
		if (++pingTick % 40 == 0 && Config.flag("ping.measured", true)) {
			try { mc.getConnection().send(new ServerboundPingRequestPacket(Util.getMillis())); } catch (Throwable ignored) { /* server may not answer: show server-reported only */ }
		}
	}

	/** Last measured round trip in ms, or -1 when none has arrived. */
	public static long measuredPing() {
		try {
			var log = Minecraft.getInstance().getDebugOverlay().getPingLogger();
			return log.size() == 0 ? -1 : log.get(log.size() - 1);
		} catch (Throwable t) { return -1; }
	}

	public static FpsDoctor.Advice advice(Minecraft mc, double avgFps, double p99Ms) {
		long now = System.currentTimeMillis();
		if (advice != null && now - adviceAt < 1500) return advice;
		Runtime rt = Runtime.getRuntime();
		advice = FpsDoctor.diagnose(new FpsDoctor.Snapshot(loaded("sodium"), loaded("vulkanmod"), FabricLoader.getInstance().getAllMods().size(),
				(rt.totalMemory() - rt.freeMemory()) >> 20, rt.maxMemory() >> 20, avgFps, p99Ms, mc.options.renderDistance().get(), mc.options.enableVsync().get(), loaded("iris"), FpsDoctor.isSoftwareRenderer(gpu())));
		adviceAt = now;
		return advice;
	}
}
