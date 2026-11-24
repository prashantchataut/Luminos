package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Renderer picker advice. Sodium is the baseline; VulkanMod only where a Vulkan runtime exists and no shader pack is wanted;
 * Nvidium only on Turing-or-newer NVIDIA and only with Sodium. The client never installs a renderer by itself: this only explains.
 * The 1538 vs 861 FPS figure is a community benchmark (1.21.11, 16 chunks) quoted from the brief, not something Luminos measured.
 */
public final class RendererAdvisor {
	private RendererAdvisor() {}

	public enum State { ACTIVE, RECOMMENDED, AVAILABLE, BLOCKED }

	public record Rec(String id, String name, State state, String oneLine) {}

	private static final Pattern TURING_PLUS = Pattern.compile("\\b(RTX|GTX\\s*16\\d\\d|TITAN\\s+RTX|QUADRO\\s+RTX)\\b", Pattern.CASE_INSENSITIVE);

	public static boolean nvidiaTuringOrNewer(String gpu) {
		if (gpu == null) return false;
		String g = gpu.toUpperCase(Locale.ROOT);
		return g.contains("NVIDIA") && TURING_PLUS.matcher(gpu).find();
	}

	public static List<Rec> advise(String gpu, boolean vulkanRuntime, boolean sodium, boolean vulkanMod, boolean nvidium, boolean shaders) {
		List<Rec> out = new ArrayList<>();
		out.add(new Rec("sodium", "Sodium", sodium ? State.ACTIVE : (vulkanMod ? State.AVAILABLE : State.RECOMMENDED),
				"The baseline: works with shader packs and nearly every mod."));
		State vk;
		String vkLine;
		if (vulkanMod) { vk = State.ACTIVE; vkLine = "Active. It replaces Sodium and cannot run shader packs."; }
		else if (shaders) { vk = State.BLOCKED; vkLine = "Blocked: a shader pack is in use and VulkanMod does not support them."; }
		else if (!vulkanRuntime) { vk = State.BLOCKED; vkLine = "Blocked: no Vulkan 1.2 runtime was found on this machine."; }
		else { vk = State.AVAILABLE; vkLine = "Community benchmarks show about 1.8x Sodium at 16 chunks (1538 vs 861 FPS); no shader packs."; }
		out.add(new Rec("vulkanmod", "VulkanMod", vk, vkLine));
		boolean turing = nvidiaTuringOrNewer(gpu);
		State nv;
		String nvLine;
		if (nvidium) { nv = State.ACTIVE; nvLine = "Active on top of Sodium."; }
		else if (!turing) { nv = State.BLOCKED; nvLine = "Blocked: needs a Turing-or-newer NVIDIA GPU (RTX, GTX 16 series)."; }
		else if (!sodium) { nv = State.BLOCKED; nvLine = "Blocked: Nvidium only runs on top of Sodium."; }
		else if (shaders) { nv = State.BLOCKED; nvLine = "Blocked: shader packs are not supported."; }
		else { nv = State.AVAILABLE; nvLine = "Mesh-shader chunks on your NVIDIA GPU; needs Sodium, no shader packs."; }
		out.add(new Rec("nvidium", "Nvidium", nv, nvLine));
		return out;
	}
}
