package dev.luminos.client;

import java.lang.management.ManagementFactory;

/**
 * Start-up timeline, kept so start-up work can be measured instead of guessed. Marks: JVM start (from the runtime MXBean), this
 * mod's initialiser, the first title screen. The Performance tab shows it when developer tools are on, and it is written to
 * the log as a single line that scripts/startup-bench.sh parses.
 */
public final class StartupProbe {
	private StartupProbe() {}

	private static long init, title;

	public static long jvmStart() { return ManagementFactory.getRuntimeMXBean().getStartTime(); }

	public static void initialised() { init = System.currentTimeMillis(); }

	public static void titleReached() {
		if (title != 0) return;
		title = System.currentTimeMillis();
		LuminosClient.LOGGER.info("[luminos] startup jvm->init {} ms, init->title {} ms, total {} ms", init - jvmStart(), title - init, title - jvmStart());
	}

	public static String summary() {
		if (title == 0) return "Title screen not reached yet";
		return "JVM to mod init " + (init - jvmStart()) + " ms   init to title " + (title - init) + " ms   total " + (title - jvmStart()) + " ms";
	}
}
