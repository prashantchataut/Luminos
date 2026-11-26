package dev.luminos.client;

import net.fabricmc.loader.api.FabricLoader;
import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWImage;
import org.lwjgl.stb.STBImage;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.system.MemoryUtil;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.IntBuffer;

/**
 * Gives the game window the Luminos identity instead of the JVM's: title "Luminos Client &lt;mc version&gt;" and the
 * original dithered-moon icon at 16, 32 and 256 px (GLFW picks the closest size for the title bar, taskbar and Alt+Tab).
 *
 * Plain GLFW + STB calls on the render thread's current context, so it needs no Minecraft-version-specific names.
 * Minecraft rewrites the title when a world opens or closes, so {@link #tick} puts ours back every couple of seconds.
 */
public final class WindowBrand {
	private WindowBrand() {}

	private static final int[] SIZES = {16, 32, 256};
	private static String title;
	private static boolean iconSet;
	private static int ticks;

	/** The plain Minecraft version ("1.21.11"), not the launcher profile name ("fabric-loader-0.18.1-1.21.11"). */
	public static String mcVersion() {
		return FabricLoader.getInstance().getModContainer("minecraft")
			.map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("");
	}

	/** Called once the client has started, on the thread that owns the window. */
	public static void apply() {
		long win = GLFW.glfwGetCurrentContext();
		if (win == 0L) return;
		title = "Luminos Client " + mcVersion();
		GLFW.glfwSetWindowTitle(win, title);
		if (!iconSet) {
			iconSet = true;   // one attempt: a missing resource must never be retried every tick
			try { setIcons(win); }
			catch (Throwable t) { LuminosClient.LOGGER.warn("Could not set the Luminos window icon: {}", t.toString()); }
		}
	}

	/** Keeps the title ours after Minecraft renames the window (joining or leaving a world). */
	public static void tick() {
		if (title == null || ++ticks % 40 != 0) return;
		long win = GLFW.glfwGetCurrentContext();
		if (win != 0L) GLFW.glfwSetWindowTitle(win, title);
	}

	private static void setIcons(long win) throws Exception {
		GLFWImage.Buffer images = GLFWImage.malloc(SIZES.length);
		ByteBuffer[] pixels = new ByteBuffer[SIZES.length];
		int n = 0;
		try (MemoryStack stack = MemoryStack.stackPush()) {
			for (int size : SIZES) {
				byte[] png;
				try (InputStream in = WindowBrand.class.getResourceAsStream("/assets/luminos_client/icons/icon_" + size + "x" + size + ".png")) {
					if (in == null) continue;
					png = in.readAllBytes();
				}
				ByteBuffer raw = MemoryUtil.memAlloc(png.length).put(png).flip();
				IntBuffer w = stack.mallocInt(1), h = stack.mallocInt(1), c = stack.mallocInt(1);
				ByteBuffer px = STBImage.stbi_load_from_memory(raw, w, h, c, 4);
				MemoryUtil.memFree(raw);
				if (px == null) continue;
				pixels[n] = px;
				images.get(n).set(w.get(0), h.get(0), px);
				n++;
			}
			if (n > 0) {
				images.limit(n);
				GLFW.glfwSetWindowIcon(win, images);   // the OS copies the pixels during this call
			}
		} finally {
			for (ByteBuffer px : pixels) if (px != null) STBImage.stbi_image_free(px);
			images.free();
		}
	}
}
