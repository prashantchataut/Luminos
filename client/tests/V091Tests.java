package dev.luminos.client.core;

import java.util.*;

/** Tests for the v0.9.1 pure logic. Run next to CoreTests: {@code java -cp out dev.luminos.client.core.V091Tests}. */
public final class V091Tests {
	static int passed, failed;
	static void check(String n, boolean ok) { if (ok) passed++; else { failed++; System.out.println("FAIL  " + n); } }
	public static void main(String[] a) {
		// json + settings reader
		ClientFile f = ClientFile.parse("{\"theme\":\"lunar\",\"classicClient\":true,\"keystrokes\":\"B\",\"fogNether\":false,\"crosshair\":{\"shape\":\"cross\",\"thickness\":3,\"gap\":4,\"length\":99,\"color\":\"#ff8800\",\"opacity\":0.5},\"hudFonts\":{\"fps\":\"Monocraft\"}}");
		check("reader: theme", f.theme.equals("lunar")); check("reader: classic client", f.classicClient); check("reader: keystrokes B", f.keystrokes.equals("B"));
		check("reader: crosshair length is clamped", f.crosshair.length == 24); check("reader: colour parsed", f.crosshair.color == 0xFF8800); check("reader: per-HUD font", "Monocraft".equals(f.hudFonts.get("fps")));
		check("reader: nether fog off means 0", f.fogFor("minecraft:the_nether") == 1.0 && ClientFile.parse("{\"fogNether\":true}").fogFor("ResourceKey[minecraft:dimension / minecraft:the_nether]") == 0.0);
		check("reader: garbage gives defaults", ClientFile.parse("not json").theme.equals("clean") && ClientFile.parse("[1,2]").keystrokes.equals("A"));
		check("reader: unknown theme falls back to clean", ClientFile.parse("{\"theme\":\"neon\"}").theme.equals("clean"));
		// themes: contrast is a hard requirement at every text size
		for (Theme t : Theme.values()) check("theme " + t.id + ": text contrast >= 4.5", t.minTextRatio() >= 4.5);
		check("theme: default loads first", Theme.byId(null == null ? "" : "").id.equals("clean"));
		// cosmetics
		String lk = "{\"version\":1,\"equipped\":{\"pets\":\"pet-wisp\",\"wings\":\"wing-shard\",\"hats\":\"hat-top\",\"back\":\"back-pack\",\"cloaks\":\"cape-x\",\"emotes\":\"emote-hug\"}}";
		Cosmetics c = Cosmetics.parse(lk, false);
		check("cosmetics: pets and wings are both worn", c.equipped.containsKey("pets") && c.equipped.containsKey("wings"));
		check("cosmetics: wings hide back item and cloak", !c.drawn().contains("back-pack") && !c.drawn().contains("cape-x") && c.drawn().contains("hat-top"));
		Cosmetics cl = Cosmetics.parse(lk, true); check("cosmetics: classic client hides pets, wings, emotes", !cl.equipped.containsKey("pets") && !cl.equipped.containsKey("wings") && !cl.equipped.containsKey("emotes") && cl.equipped.containsKey("hats"));
		check("cosmetics: bad file is empty", Cosmetics.parse("{{", false).equipped.isEmpty());
		long t0 = 1000; Cosmetics.EmoteSync.Play a1 = new Cosmetics.EmoteSync.Play("A", "emote-hug", 0, 64, 0, t0); Cosmetics.EmoteSync.Play b1 = new Cosmetics.EmoteSync.Play("B", "emote-hug", 2, 64, 1, t0 + 500); Cosmetics.EmoteSync.Play far = new Cosmetics.EmoteSync.Play("C", "emote-hug", 20, 64, 0, t0); Cosmetics.EmoteSync.Play late = new Cosmetics.EmoteSync.Play("D", "emote-hug", 1, 64, 0, t0 + 5000); Cosmetics.EmoteSync.Play wave = new Cosmetics.EmoteSync.Play("E", "emote-wave", 1, 64, 0, t0);
		check("hug: two nearby players pair", Cosmetics.EmoteSync.pair(a1, b1).isPresent()); check("hug: too far", Cosmetics.EmoteSync.pair(a1, far).isEmpty()); check("hug: too late", Cosmetics.EmoteSync.pair(a1, late).isEmpty());
		check("hug: wave never pairs", Cosmetics.EmoteSync.pair(a1, wave).isEmpty() && Cosmetics.EmoteSync.pair(a1, a1).isEmpty());
		// death recap, markers, compass, chat coordinates
		DeathRecap r = new DeathRecap(); r.hit(1000, "zombie", 3); r.hit(2000, "zombie", 3); r.hit(2600, "fall", 6);
		DeathRecap.Death d = r.died(3000, "fell from a high place", 10, 70, -20, "minecraft:the_nether", List.of("diamond_sword", "bread"));
		check("recap: total damage", Math.abs(d.total() - 12f) < 1e-6); check("recap: timeline is oldest first", d.timeline(5000).get(0).source().equals("zombie") && d.timeline(5000).size() == 3);
		check("recap: window excludes old hits", d.timeline(1000).size() == 2); float[] g = d.graph(2000, 4); check("recap: graph sums to damage in window", Math.abs(g[0] + g[1] + g[2] + g[3] - 12f) < 1e-6);
		for (int i = 0; i < 14; i++) r.died(4000 + i, "x", 0, 0, 0, null, List.of()); check("recap: only the last ten deaths are kept", r.deaths().size() == DeathRecap.KEEP);
		Waypoint m = DeathRecap.marker(d); check("marker: position and dimension", m.x() == 10 && m.z() == -20 && m.dimension().equals("minecraft:the_nether") && m.name().equals("Death"));
		check("compass: east is 90", Math.abs(NavMath.bearing(0, 0, 10, 0) - 90) < 1e-6); check("compass: north is 0", Math.abs(NavMath.bearing(0, 0, 0, -10)) < 1e-6); check("compass: south is 180", Math.abs(NavMath.bearing(0, 0, 0, 10) - 180) < 1e-6);
		check("compass: cardinal", NavMath.cardinal(92).equals("E") && NavMath.cardinal(359).equals("N") && NavMath.cardinal(225).equals("SW"));
		check("compass: facing south (yaw 0) toward south target is no turn", Math.abs(NavMath.turn(0, 180)) < 1e-6); check("compass: turn right to west when facing south", NavMath.turn(0, 270) > 0);
		check("distance", NavMath.distance(0, 0, 3, 4) == 5);
		var s1 = NavMath.findCoords("meet at 120 64 -300 please"); check("chat: x y z found", s1.size() == 1 && s1.get(0).x() == 120 && s1.get(0).y() == 64 && s1.get(0).z() == -300 && s1.get(0).hasY());
		var s2 = NavMath.findCoords("base: -45, 800"); check("chat: x z found", s2.size() == 1 && s2.get(0).x() == -45 && s2.get(0).z() == 800 && !s2.get(0).hasY());
		check("chat: lone numbers and decimals ignored", NavMath.findCoords("I have 12 apples").isEmpty() && NavMath.findCoords("ping 1.5 2.5").isEmpty());
		check("chat: share text", NavMath.shareText(m).equals("Death: 10 70 -20 (Nether)"));
		// fonts, keystrokes, crosshair
		check("fonts: ttf magic accepted", FontPairs.looksLikeFont(new byte[] { 0, 1, 0, 0 }, 1000) && FontPairs.looksLikeFont("OTTO".getBytes(), 1000));
		check("fonts: png, empty and huge refused", !FontPairs.looksLikeFont(new byte[] { (byte) 0x89, 'P', 'N', 'G' }, 100) && !FontPairs.looksLikeFont(new byte[] { 0, 1, 0, 0 }, 0) && !FontPairs.looksLikeFont(new byte[] { 0, 1, 0, 0 }, 9L << 20));
		check("fonts: unknown pair falls back", FontPairs.byId("zzz").id().equals("inter-monocraft") && FontPairs.ALL.size() >= 3);
		check("keys: layout A has 5 cells, B has 7", Keystrokes.layout("A").size() == 5 && Keystrokes.layout("B").size() == 7 && Keystrokes.rows("B") == 4);
		var cr = new ClientFile.Crosshair(); cr.shape = "cross"; cr.outline = 0; check("crosshair: cross has four arms", Crosshair.build(cr, 0).size() == 4);
		cr.outline = 1; check("crosshair: outline doubles the rectangles", Crosshair.build(cr, 0).size() == 8); cr.spread = true; cr.outline = 0;
		check("crosshair: spread widens the gap", Crosshair.build(cr, 5).get(0).y1() < Crosshair.build(cr, 0).get(0).y1());
		// mod policy
		var drop = ModPolicy.conflicts(List.of("sodium", "vulkanmod", "lithium", "iris")); check("policy: vulkanmod dropped, sodium kept", drop.containsKey("vulkanmod") && !drop.containsKey("sodium") && drop.size() == 1);
		check("policy: no conflict, nothing dropped", ModPolicy.conflicts(List.of("sodium", "lithium")).isEmpty());
		var cache = new ModPolicy.MetaCache(); int[] parses = { 0 };
		for (int i = 0; i < 3; i++) cache.get("a.jar", 100, 5, p -> { parses[0]++; return new ModPolicy.Meta("a", "1", 0, 0); });
		cache.get("a.jar", 101, 5, p -> { parses[0]++; return new ModPolicy.Meta("a", "1", 0, 0); });
		check("cache: unchanged jar parsed once, changed jar re-parsed", parses[0] == 2 && cache.hits.get() == 2);
		var back = ModPolicy.MetaCache.load(cache.dump()); check("cache: survives a restart", back.get("a.jar", 101, 5, p -> { throw new IllegalStateException(); }).id().equals("a"));
		var par = ModPolicy.parallel(List.of(1, 2, 3, 4, 5, 6), 3, x -> x * x); check("discovery: parallel keeps order", par.equals(List.of(1, 4, 9, 16, 25, 36)));
		var hc = new ModPolicy.HudCache<Integer, String>(1000); for (int i = 0; i < 5; i++) hc.get(60, 100 + i, k -> "fps " + k); hc.get(61, 200, k -> "fps " + k); hc.get(61, 5000, k -> "fps " + k);
		check("hud cache: rebuilt only on change or age", hc.builds == 3);
		System.out.println("v0.9.1 core tests: " + passed + " passed, " + failed + " failed"); if (failed > 0) System.exit(1);
	}
}
