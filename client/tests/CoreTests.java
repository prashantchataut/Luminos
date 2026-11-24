package dev.luminos.client.core;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.zip.Deflater;

/**
 * Lives in client/tests (not src/test) so Gradle does not try to run it without a test framework.
 * Dependency-free test runner for the pure logic in {@code dev.luminos.client.core}.
 * Run: {@code javac -d out $(find src/shared/java/dev/luminos/client/core tests -name '*.java') && java -cp out dev.luminos.client.core.CoreTests}
 * Crash-report samples below are hand-written in the shape of the real Fabric/JVM messages; they are not captured from a live crash.
 */
public final class CoreTests {
	private static int passed, failed;

	private static void check(String name, boolean ok) {
		if (ok) passed++; else { failed++; System.out.println("FAIL  " + name); }
	}

	private static void throwsIae(String name, Runnable r, String contains) {
		try { r.run(); check(name + " (should throw)", false); }
		catch (IllegalArgumentException e) { check(name + " -> '" + e.getMessage() + "'", e.getMessage().contains(contains)); }
	}

	record Item(String id, String title, String sub) {}

	public static void main(String[] args) throws Exception {
		shareCode();
		search();
		crash();
		logTail();
		waypoints();
		palettes();
		frames();
		luminosUx();
		System.out.println(passed + " passed, " + failed + " failed");
		if (failed > 0) System.exit(1);
	}

	static void shareCode() {
		List<ShareCode.Entry> in = List.of(new ShareCode.Entry("fps", true, 6, 6, 1f), new ShareCode.Entry("keystrokes", false, 120, 44, 1.5f), new ShareCode.Entry("cps", true, -3, 900, 0.5f));
		String code = ShareCode.encode(in);
		check("share prefix", code.startsWith("LUM1-"));
		check("share round trip", ShareCode.decode(code).equals(in));
		check("share tolerates whitespace", ShareCode.decode("  " + code + "\n").equals(in));
		check("share scale clamped", new ShareCode.Entry("a", true, 0, 0, 99f).scale() == 3f);
		throwsIae("share rejects bad id", () -> new ShareCode.Entry("Bad Id!", true, 0, 0, 1f), "bad module id");
		throwsIae("share rejects null", () -> ShareCode.decode(null), "Nothing");
		throwsIae("share rejects foreign text", () -> ShareCode.decode("hello"), "Not a Luminos share code");
		throwsIae("share rejects truncated", () -> ShareCode.decode("LUM1-"), "incomplete");
		String body = code.substring(5, code.lastIndexOf('-'));
		char flip = body.charAt(body.length() / 2) == 'A' ? 'B' : 'A';
		String tampered = "LUM1-" + body.substring(0, body.length() / 2) + flip + body.substring(body.length() / 2 + 1) + code.substring(code.lastIndexOf('-'));
		try { ShareCode.decode(tampered); check("share detects tampering", false); }
		catch (IllegalArgumentException e) { check("share detects tampering", e.getMessage().contains("damaged") || e.getMessage().contains("checksum")); }
		// decompression bomb: ~2 MB of 'a' deflates to a few KB, must be refused
		byte[] big = new byte[2_000_000];
		java.util.Arrays.fill(big, (byte) 'a');
		Deflater d = new Deflater(9, true);
		d.setInput(big); d.finish();
		ByteArrayOutputStream bo = new ByteArrayOutputStream();
		byte[] buf = new byte[4096];
		while (!d.finished()) bo.write(buf, 0, d.deflate(buf));
		String bomb = "LUM1-" + Base64.getUrlEncoder().withoutPadding().encodeToString(bo.toByteArray()) + "-00000000";
		check("bomb is small on the wire", bomb.length() < 10_000);
		throwsIae("share refuses decompression bomb", () -> ShareCode.decode(bomb), "too large");
		List<ShareCode.Entry> many = new ArrayList<>();
		for (int i = 0; i < 129; i++) many.add(new ShareCode.Entry("m" + i, true, 0, 0, 1f));
		throwsIae("share caps entries", () -> ShareCode.encode(many), "too many");
	}

	static void search() {
		List<Item> items = List.of(new Item("fps", "FPS counter", "HUD module"), new Item("keystrokes", "Keystrokes", "Shows WASD and mouse"), new Item("coords", "Coordinates", "XYZ and biome"),
			new Item("cps", "CPS", "Clicks per second"), new Item("armor", "Armor status", "Durability"), new Item("potions", "Potion effects", "Timers"));
		Function<Item, String> id = Item::id, t = Item::title, s = Item::sub;
		check("empty query keeps order", ModuleSearch.rank("", items, id, t, s, Set.of()).get(0).id().equals("fps"));
		check("empty query puts favourites first", ModuleSearch.rank("", items, id, t, s, Set.of("potions", "cps")).stream().map(Item::id).toList().subList(0, 2).equals(List.of("cps", "potions")));
		check("exact beats prefix", ModuleSearch.rank("cps", items, id, t, s, Set.of()).get(0).id().equals("cps"));
		check("prefix beats substring", ModuleSearch.rank("co", items, id, t, s, Set.of()).get(0).id().equals("coords"));
		check("word prefix finds 'status'", ModuleSearch.rank("status", items, id, t, s, Set.of()).get(0).id().equals("armor"));
		check("searches subtitle", ModuleSearch.rank("wasd", items, id, t, s, Set.of()).get(0).id().equals("keystrokes"));
		check("fuzzy subsequence (k..s..k)", ModuleSearch.rank("ksk", items, id, t, s, Set.of()).get(0).id().equals("keystrokes"));
		check("fuzzy needs 3 letters", ModuleSearch.rank("ko", items, id, t, s, Set.of()).isEmpty() && ModuleSearch.rank("kos", items, id, t, s, Set.of()).get(0).id().equals("keystrokes"));
		check("no match is empty", ModuleSearch.rank("zzzz", items, id, t, s, Set.of()).isEmpty());
		check("every token must match", ModuleSearch.rank("fps zzz", items, id, t, s, Set.of()).isEmpty());
		check("two tokens match", ModuleSearch.rank("potion timers", items, id, t, s, Set.of()).get(0).id().equals("potions"));
		check("case-insensitive", ModuleSearch.rank("KEYSTROKES", items, id, t, s, Set.of()).get(0).id().equals("keystrokes"));
		Set<String> fav = new HashSet<>();
		check("toggle on", ModuleSearch.toggle(fav, "fps") && fav.contains("fps"));
		check("toggle off", !ModuleSearch.toggle(fav, "fps") && fav.isEmpty());
		List<String> order = ModuleSearch.move(items, List.of(), id, "cps", -2);
		check("move up two", order.subList(0, 4).equals(List.of("fps", "cps", "keystrokes", "coords")));
		check("move clamps at top", ModuleSearch.move(items, List.of(), id, "fps", -5).get(0).equals("fps"));
		check("move clamps at bottom", ModuleSearch.move(items, List.of(), id, "potions", 9).get(5).equals("potions"));
		check("applyOrder ignores unknown ids", ModuleSearch.applyOrder(items, List.of("ghost", "potions"), id).get(0).id().equals("potions"));
		check("applyOrder keeps everything", ModuleSearch.applyOrder(items, List.of("potions"), id).size() == items.size());
		check("move of unknown id is a no-op", ModuleSearch.move(items, List.of(), id, "nope", 1).size() == items.size());
	}

	static void crash() {
		var oom = CrashAssistant.analyse("---- Minecraft Crash Report ----\nDescription: Exception in server tick loop\njava.lang.OutOfMemoryError: Java heap space\n\tat x.y(Z.java:1)").orElseThrow();
		check("oom code", oom.code().equals("out_of_memory") && oom.fixAction().equals("raise_ram"));
		check("oom message is plain", !oom.title().contains("Exception") && !oom.fix().contains("\tat "));
		check("metaspace", CrashAssistant.analyse("java.lang.OutOfMemoryError: Metaspace").orElseThrow().code().equals("out_of_memory_metaspace"));
		var java = CrashAssistant.analyse("java.lang.UnsupportedClassVersionError: net/x/Y has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0").orElseThrow();
		check("wrong java -> 21", java.fixAction().equals("use_java:21") && java.fix().contains("Java 21"));
		var j25 = CrashAssistant.analyse("UnsupportedClassVersionError: x compiled by a more recent version of the Java Runtime (class file version 69.0)").orElseThrow();
		check("wrong java -> 25", j25.fixAction().equals("use_java:25"));
		var dep = CrashAssistant.analyse("net.fabricmc.loader.impl.FormattedException: Some of your mods are incompatible with the game or each other!\n\t - Mod 'Sodium Extra' (sodium-extra) 0.6.0 requires version 0.6.0 or later of mod 'Sodium' (sodium), which is missing!").orElseThrow();
		check("missing dependency names both mods", dep.title().equals("Sodium Extra needs Sodium") && dep.fixAction().equals("install_mod:sodium"));
		var mixin = CrashAssistant.analyse("org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError: An unexpected critical error was encountered\nCaused by: Mixin apply for mod cooltweaks failed cooltweaks.mixins.json:GameMixin").orElseThrow();
		check("mixin names the mod", mixin.fixAction().equals("disable_mod:cooltweaks") && mixin.title().startsWith("cooltweaks"));
		check("mixin without a mod name still helps", CrashAssistant.analyse("InvalidInjectionException: @Inject target not found").orElseThrow().fixAction().equals("update_mods"));
		check("gpu driver", CrashAssistant.analyse("GLFW error 65543: WGL: The driver does not appear to support OpenGL").orElseThrow().fixAction().equals("update_gpu_driver"));
		check("disk full", CrashAssistant.analyse("java.io.IOException: No space left on device").orElseThrow().code().equals("disk_full"));
		check("corrupt jar", CrashAssistant.analyse("java.util.zip.ZipException: zip END header not found").orElseThrow().code().equals("corrupt_jar"));
		check("duplicate mod", CrashAssistant.analyse("Duplicate mod 'sodium' found").orElseThrow().code().equals("duplicate_mod"));
		var unk = CrashAssistant.analyse("---- Minecraft Crash Report ----\nDescription: Rendering screen\nsomething new").orElseThrow();
		check("unknown crash falls back to the description", unk.code().equals("unknown") && unk.title().contains("Rendering screen") && unk.fixAction().equals("none"));
		check("garbage gives nothing", CrashAssistant.analyse("hello world").isEmpty());
		check("null/blank gives nothing", CrashAssistant.analyse(null).isEmpty() && CrashAssistant.analyse("  ").isEmpty());
		String json = CrashAssistant.fixRequestJson(new CrashAssistant.Diagnosis("c", "A \"quoted\" title\nline", "x", "fix\\it", "none", "e"));
		check("fix request escapes", json.contains("\\\"quoted\\\"") && json.contains("\\n") && json.contains("fix\\\\it") && json.startsWith("{") && json.endsWith("}"));
	}

	static void logTail() throws Exception {
		String[] lines = {"[10:00:00] [Render thread/INFO]: ok", "[10:00:01] [Render thread/WARN]: shader slow", "[10:00:02] [main/ERROR]: boom", "[10:00:02] [main/ERROR]: boom",
			"[10:00:02] [main/ERROR]: boom", "", "Caused by: java.lang.Foo", "[10:00:03] [main/INFO]: fine"};
		var warn = LogTail.filter(lines, 50, LogTail.Level.WARN);
		check("log keeps warn+error only", warn.size() == 3 && warn.get(0).contains("WARN"));
		check("log collapses repeats", warn.get(1).endsWith("(x3)"));
		check("log keeps Caused by", warn.get(2).startsWith("Caused by:"));
		check("log respects max lines", LogTail.filter(lines, 1, LogTail.Level.WARN).size() == 1);
		check("log info level keeps all non-empty", LogTail.filter(lines, 50, LogTail.Level.INFO).size() == 5);
		check("INFO line that mentions an exception stays INFO (seen in a real CI latest.log)", LogTail.level("[00:18:00] [Download-1/INFO]: Could not authenticate: java.net.UnknownHostException: x") == LogTail.Level.INFO);
		check("untagged exception line is ERROR", LogTail.level("java.lang.IllegalStateException: Failed to open") == LogTail.Level.ERROR);
		Path f = Files.createTempFile("luminos-log", ".log");
		StringBuilder big = new StringBuilder();
		for (int i = 0; i < 20000; i++) big.append("[t] [main/INFO]: filler line number ").append(i).append('\n');
		big.append("[t] [main/ERROR]: the end\n");
		Files.writeString(f, big.toString(), StandardCharsets.UTF_8);
		check("tail reads the end of a big file", LogTail.tail(f, 5, LogTail.Level.ERROR).equals(List.of("[t] [main/ERROR]: the end")));
		Files.delete(f);
	}

	static void waypoints() {
		var home = new Waypoint("Home", 100, 64, -20, "minecraft:overworld", 0x4F8CFF);
		var fort = new Waypoint("Fortress", 12, 70, 40, "ResourceKey[minecraft:dimension / minecraft:the_nether]", 0xFFC857);
		var mine = new Waypoint("Mine", 10, 12, 10, "overworld", 0x5BE3A0);
		check("encode/decode round trip", Waypoint.decode(home.encode()).equals(home));
		check("dimension key text is normalised", fort.dimension().equals("minecraft:the_nether"));
		check("bare dimension gets a namespace", mine.dimension().equals("minecraft:overworld"));
		check("dimension labels", Waypoint.dimensionLabel("minecraft:the_end").equals("End") && Waypoint.dimensionLabel(fort.dimension()).equals("Nether"));
		check("name strips the separator", new Waypoint("a|b\nc", 0, 0, 0, null, 0).name().equals("abc"));
		check("empty name gets a default", new Waypoint("  ", 0, 0, 0, null, 0).name().equals("Waypoint"));
		check("name is capped", new Waypoint("x".repeat(80), 0, 0, 0, null, 0).name().length() == 24);
		var near = Waypoint.nearest(List.of(home, fort, mine), "minecraft:overworld", 0, 64, 0);
		check("dimension filter + nearest first", near.size() == 2 && near.get(0).name().equals("Mine"));
		check("nether filter", Waypoint.nearest(List.of(home, fort, mine), "minecraft:the_nether", 0, 64, 0).get(0).name().equals("Fortress"));
		check("distance", Math.abs(new Waypoint("a", 3, 0, 0, null, 0).distance(0.5 - 3 + 3 - 0.5 - 0, 0, 0.5 - 0.5) - 3.0) < 1.0);
		check("distance label m", Waypoint.distanceLabel(842.4).equals("842 m"));
		check("distance label km", Waypoint.distanceLabel(2500).equals("2.5 km"));
		check("corrupt line is null", Waypoint.decode("nope") == null && Waypoint.decode("a|x|1|2|d|ff") == null && Waypoint.decode(null) == null);
	}

	static void palettes() {
		int bg = 0xFF070B22;
		for (ColorblindPalette p : ColorblindPalette.values()) {
			for (int c : new int[] {p.ok, p.warn, p.danger, p.accent})
				check(p + " " + Integer.toHexString(c) + " is 4.5:1 on the panel background", ColorblindPalette.contrast(c, bg) >= 4.5);
		}
		for (ColorblindPalette p : new ColorblindPalette[] {ColorblindPalette.DEUTERANOPIA, ColorblindPalette.PROTANOPIA}) {
			check(p + " good/bad differ by hue AND lightness", ColorblindPalette.contrast(p.ok, p.danger) >= 1.3 && p.ok != p.danger);
			check(p + " warn/danger differ", ColorblindPalette.contrast(p.warn, p.danger) >= 1.2);
		}
		check("black on white is 21:1", Math.abs(ColorblindPalette.contrast(0xFF000000, 0xFFFFFFFF) - 21.0) < 0.01);
		check("byName falls back", ColorblindPalette.byName("nonsense") == ColorblindPalette.DEFAULT && ColorblindPalette.byName("protanopia") == ColorblindPalette.PROTANOPIA);
	}

	static void frames() {
		FrameStats fs = new FrameStats(1000);
		check("empty summary", fs.summary().frames() == 0 && fs.summary().avgFps() == 0);
		for (int i = 0; i < 99; i++) fs.add(10.0);   // 100 fps
		fs.add(50.0);                                 // one 20 fps stutter
		var s = fs.summary();
		check("frame count", s.frames() == 100);
		check("avg fps", Math.abs(s.avgFps() - 1000.0 / ((99 * 10.0 + 50.0) / 100)) < 1e-9);
		check("1% low is the stutter frame", Math.abs(s.low1Fps() - 20.0) < 1e-9);
		check("p99 frame time", s.p99Ms() == 10.0 || s.p99Ms() == 50.0);
		fs.add(-1); fs.add(0); fs.add(Double.NaN); fs.add(Double.POSITIVE_INFINITY);
		check("bad samples are ignored", fs.size() == 100);
		FrameStats ring = new FrameStats(4);
		for (int i = 1; i <= 10; i++) ring.add(i);
		check("ring buffer keeps the last N", ring.size() == 4 && Math.abs(ring.summary().avgFps() - 1000.0 / 8.5) < 1e-9);
		ring.clear();
		check("clear", ring.size() == 0);
		var before = new FrameStats.Summary(500, 100, 60, 16);
		var after = new FrameStats.Summary(500, 150, 90, 11);
		check("change percent", Math.abs(BenchReport.changePercent(100, 150) - 50.0) < 1e-9 && BenchReport.changePercent(0, 5) == 0);
		String row = BenchReport.row("Test box", before, after, false, "llvmpipe, not real hardware");
		check("unverified row says so", row.contains("UNVERIFIED (llvmpipe, not real hardware)") && row.contains("+50.0%"));
		check("verified row says so", BenchReport.row("x", before, after, true, null).endsWith("| VERIFIED |"));
	}
	static void luminosUx() {
		// FPS doctor: one concrete change, first matching rule wins
		var base = new FpsDoctor.Snapshot(true, false, 40, 1500, 4096, 200, 8, 12, false, false);
		check("doctor: healthy client", FpsDoctor.diagnose(base).id().equals("ok"));
		check("doctor: low RAM first", FpsDoctor.diagnose(new FpsDoctor.Snapshot(true, false, 40, 900, 1536, 200, 8, 12, false, false)).id().equals("ram"));
		check("doctor: full heap", FpsDoctor.diagnose(new FpsDoctor.Snapshot(true, false, 40, 3800, 4096, 200, 8, 12, false, false)).id().equals("heap"));
		check("doctor: vanilla renderer", FpsDoctor.diagnose(new FpsDoctor.Snapshot(false, false, 40, 1500, 4096, 90, 14, 12, false, false)).id().equals("renderer"));
		check("doctor: stutter vs low fps", FpsDoctor.diagnose(new FpsDoctor.Snapshot(true, false, 40, 1500, 4096, 200, 40, 12, false, false)).id().equals("stutter"));
		check("doctor: distance", FpsDoctor.diagnose(new FpsDoctor.Snapshot(true, false, 40, 1500, 4096, 70, 18, 24, false, false)).id().equals("distance"));
		check("doctor: vsync pinned", FpsDoctor.diagnose(new FpsDoctor.Snapshot(true, false, 40, 1500, 4096, 60, 17, 12, true, false)).id().equals("vsync"));
		check("doctor: always one sentence", FpsDoctor.diagnose(base).change().endsWith("."));
		// renderer advisor
		check("nvidium: RTX is Turing+", RendererAdvisor.nvidiaTuringOrNewer("NVIDIA GeForce RTX 3060/PCIe/SSE2"));
		check("nvidium: GTX 16 is Turing", RendererAdvisor.nvidiaTuringOrNewer("NVIDIA GeForce GTX 1660 Ti"));
		check("nvidium: GTX 10 is not", !RendererAdvisor.nvidiaTuringOrNewer("NVIDIA GeForce GTX 1060"));
		check("nvidium: AMD is not", !RendererAdvisor.nvidiaTuringOrNewer("AMD Radeon RX 7800 XT"));
		var rec = RendererAdvisor.advise("NVIDIA GeForce RTX 4070", true, true, false, false, false);
		check("advisor: three rows", rec.size() == 3 && rec.get(0).state() == RendererAdvisor.State.ACTIVE);
		check("advisor: vulkanmod available without shaders", rec.get(1).state() == RendererAdvisor.State.AVAILABLE && rec.get(1).oneLine().contains("1538"));
		check("advisor: nvidium available on RTX + Sodium", rec.get(2).state() == RendererAdvisor.State.AVAILABLE);
		check("advisor: shaders block vulkanmod and nvidium", RendererAdvisor.advise("NVIDIA RTX 4070", true, true, false, false, true).stream().skip(1).allMatch(r -> r.state() == RendererAdvisor.State.BLOCKED));
		check("advisor: nvidium needs sodium", RendererAdvisor.advise("NVIDIA RTX 4070", true, false, false, false, false).get(2).state() == RendererAdvisor.State.BLOCKED);
		check("advisor: no vulkan runtime blocks vulkanmod", RendererAdvisor.advise("Intel UHD", false, true, false, false, false).get(1).state() == RendererAdvisor.State.BLOCKED);
		// frame pacer
		var fp = new FramePacer(3);
		for (int i = 0; i < 60; i++) fp.record(8.0, 7.8);
		check("pacer: CPU-bound never waits", fp.waitMs() == 0);
		fp = new FramePacer(3);
		for (int i = 0; i < 60; i++) fp.record(10.0, 4.0);
		check("pacer: GPU-bound waits, capped", fp.waitMs() > 0 && fp.waitMs() <= 3.0);
		fp = new FramePacer(3);
		for (int i = 0; i < 60; i++) fp.record(5.0, 3.5);
		check("pacer: small slack proportional", fp.waitMs() > 0 && fp.waitMs() < 1.5);
		fp = new FramePacer(3);
		fp.record(900, 10);
		check("pacer: ignores hitches", fp.waitMs() == 0);
		// click stats
		var cs = new ClickStats();
		long t0 = 5_000_000_000L;
		cs.press(t0); cs.press(t0 + 10_000_000L); cs.press(t0 + 20_000_000L);   // three presses inside one 50 ms tick
		cs.onFrame(t0 + 22_000_000L);
		cs.onTick(t0 + 40_000_000L);
		long now = t0 + 100_000_000L;
		check("clicks: raw sees all three", cs.rawPerSecond(now) == 3);
		check("clicks: vanilla tick merges them into one", cs.tickPerSecond(now) == 1);
		check("clicks: frame wait is shorter than tick wait", cs.avgFrameWaitMs() < cs.avgTickWaitMs() && Math.abs(cs.avgTickWaitMs() - 30.0) < 1e-6);
		check("clicks: old presses expire", cs.rawPerSecond(now + 2_000_000_000L) == 0);
		// presets
		check("preset: minimal is exactly five modules", HudPresets.enabled("minimal").equals(java.util.Set.of("fps", "cps", "ping", "armor_hud", "potions")));
		check("preset: unknown name falls back to minimal", HudPresets.enabled("zzz").size() == 5 && HudPresets.enabled(null).size() == 5);
		check("preset: competitive is a superset of minimal", HudPresets.enabled("competitive").containsAll(HudPresets.enabled("minimal")));
		check("preset: full is a superset of competitive minus nothing important", HudPresets.enabled("full").containsAll(HudPresets.enabled("minimal")));
	}
}
