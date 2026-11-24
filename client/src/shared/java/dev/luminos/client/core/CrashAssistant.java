package dev.luminos.client.core;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a crash report or log into a plain-language cause and one concrete fix. Rules run in order; the first match wins.
 * {@code fixAction} is a machine-readable request the launcher can act on (see {@link #fixRequestJson}); the in-game panel only shows the text.
 */
public final class CrashAssistant {
	private CrashAssistant() {}

	public record Diagnosis(String code, String title, String cause, String fix, String fixAction, String evidence) {}

	private static final Pattern CLASS_VERSION = Pattern.compile("compiled by a more recent version of the Java Runtime \\(class file version (\\d+)\\.\\d+\\)");
	private static final Pattern MISSING_DEP = Pattern.compile("Mod '([^']+)' \\(([^)]+)\\)[^\\n]*?requires[^\\n]*?of mod '([^']+)' \\(([^)]+)\\), which is missing");
	private static final Pattern MIXIN_MOD = Pattern.compile("Mixin apply for mod ([A-Za-z0-9_.\\-]+) failed|\\[([A-Za-z0-9_.\\-]+)\\.mixins\\.json\\]");
	private static final Pattern DESCRIPTION = Pattern.compile("(?m)^Description: (.+)$");

	public static Optional<Diagnosis> analyse(String report) {
		if (report == null || report.isBlank()) return Optional.empty();

		if (report.contains("java.lang.OutOfMemoryError")) {
			if (report.contains("Java heap space") || report.contains("GC overhead limit"))
				return d("out_of_memory", "Minecraft ran out of memory", "The game needed more RAM than it was allowed to use.",
					"Give the instance more RAM (about 1 GB more), or lower the render distance.", "raise_ram", "OutOfMemoryError: Java heap space");
			if (report.contains("Metaspace"))
				return d("out_of_memory_metaspace", "Too many mods for the Java class area", "Java ran out of space for loaded mod code.",
					"Remove a few mods, or raise the Metaspace limit in the JVM arguments.", "raise_metaspace", "OutOfMemoryError: Metaspace");
			if (report.contains("unable to create native thread") || report.contains("unable to create new native thread"))
				return d("out_of_threads", "Your computer refused to start another thread", "Windows or the system ran out of resources, often because RAM is nearly full.",
					"Close other programs, then restart. If it repeats, lower the instance RAM.", "lower_ram", "unable to create native thread");
			return d("out_of_memory_native", "Minecraft ran out of memory", "A memory pool outside the normal heap ran out.",
				"Give the instance more RAM, or close other programs.", "raise_ram", "OutOfMemoryError");
		}

		Matcher cv = CLASS_VERSION.matcher(report);
		if (report.contains("UnsupportedClassVersionError") && cv.find()) {
			int java = Integer.parseInt(cv.group(1)) - 44;
			return d("wrong_java", "This needs a newer Java", "A mod or Minecraft needs Java " + java + " but the instance is using an older one.",
				"Switch the instance to Java " + java + ". The launcher can download it.", "use_java:" + java, "class file version " + cv.group(1));
		}

		Matcher dep = MISSING_DEP.matcher(report);
		if (dep.find()) {
			return d("missing_dependency", dep.group(1) + " needs " + dep.group(3), dep.group(1) + " cannot load because " + dep.group(3) + " is not installed (or is the wrong version).",
				"Install " + dep.group(3) + ", or turn " + dep.group(1) + " off.", "install_mod:" + dep.group(4), dep.group(2) + " requires " + dep.group(4));
		}
		if (report.toLowerCase(java.util.Locale.ROOT).contains("duplicate mod"))
			return d("duplicate_mod", "The same mod is installed twice", "Two jar files provide the same mod, so the loader stopped.",
				"Delete the older copy from the mods folder.", "dedupe_mods", "duplicate mod");

		if (report.contains("Mixin apply") || report.contains("MixinApplyError") || report.contains("InvalidInjectionException") || report.contains("MixinTransformerError")) {
			Matcher mm = MIXIN_MOD.matcher(report);
			String mod = null;
			if (mm.find()) mod = mm.group(1) != null ? mm.group(1) : mm.group(2);
			String who = mod == null ? "A mod" : mod;
			return d("mixin_conflict", who + " clashes with another mod or with this Minecraft version",
				who + " tried to change game code that another mod already changed, or that this version does not have.",
				mod == null ? "Update your mods. If you added one recently, remove it." : "Update " + mod + ", or remove it if it was added recently.",
				mod == null ? "update_mods" : "disable_mod:" + mod, "Mixin failure" + (mod == null ? "" : " in " + mod));
		}

		if (report.contains("GLFW error 65543") || report.contains("does not appear to support OpenGL") || report.contains("Pixel format not accelerated") || report.contains("GLFW error 65542"))
			return d("graphics_driver", "Your graphics driver is too old or not active", "Minecraft could not start OpenGL. This is almost always the driver, or Windows using the wrong GPU.",
				"Update your graphics driver. On laptops, set Java to use the dedicated GPU.", "update_gpu_driver", "GLFW/OpenGL initialisation failed");

		if (report.contains("No space left on device") || report.contains("not enough space on the disk"))
			return d("disk_full", "Your disk is full", "Minecraft could not write a file because there is no space left.",
				"Free some space, then start again.", "free_disk", "No space left on device");

		if (report.contains("ZipException") && (report.contains("zip END header not found") || report.contains("invalid LOC header") || report.contains("invalid CEN header")))
			return d("corrupt_jar", "A mod or game file is damaged", "A jar failed to open, usually from an interrupted download.",
				"Re-download the instance files or the mod that was added last.", "repair_instance", "ZipException");

		Matcher desc = DESCRIPTION.matcher(report);
		if (desc.find())
			return d("unknown", "Minecraft crashed while: " + desc.group(1).strip(), "Luminos does not recognise this crash yet.",
				"Remove the last mod you added. If it repeats, copy the log from the Support tab into a bug report.", "none", desc.group(1).strip());
		return Optional.empty();
	}

	private static Optional<Diagnosis> d(String code, String title, String cause, String fix, String action, String evidence) {
		return Optional.of(new Diagnosis(code, title, cause, fix, action, evidence));
	}

	/** JSON the launcher can pick up from the instance folder ({@code luminos-fix-request.json}). Hand-built so this class has no dependencies. */
	public static String fixRequestJson(Diagnosis d) {
		return "{\"code\":" + q(d.code()) + ",\"action\":" + q(d.fixAction()) + ",\"title\":" + q(d.title()) + ",\"fix\":" + q(d.fix()) + "}";
	}

	private static String q(String s) {
		StringBuilder b = new StringBuilder("\"");
		for (char c : s.toCharArray()) {
			switch (c) {
				case '"' -> b.append("\\\"");
				case '\\' -> b.append("\\\\");
				case '\n' -> b.append("\\n");
				case '\r' -> b.append("\\r");
				case '\t' -> b.append("\\t");
				default -> { if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c); }
			}
		}
		return b.append('"').toString();
	}
}
