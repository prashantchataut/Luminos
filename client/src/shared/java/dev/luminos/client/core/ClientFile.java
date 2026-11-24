package dev.luminos.client.core;

import java.util.List;
import java.util.Map;

/** Reads the settings the launcher's Client and Settings pages write (luminos-client-settings.json). Unknown keys are ignored, bad values fall back to defaults. */
public final class ClientFile {
	public String theme = "clean"; public boolean classicClient, lowFire = true, lowShield = true, compliance;
	public String keystrokes = "A"; public String font = "default"; public String fontPair = "inter-monocraft";
	public boolean fogOverworld, fogNether = true, fogEnd;
	public Crosshair crosshair = new Crosshair();
	public java.util.Map<String, String> hudFonts = new java.util.LinkedHashMap<>();
	public static final class Crosshair { public String shape = "dot-ring"; public int thickness = 2, gap = 3, length = 6, outline = 1, color = 0xFFFFFF; public double opacity = 1.0; public boolean spread; }

	public static ClientFile parse(String json) {
		ClientFile f = new ClientFile(); Map<String, Object> o;
		try { o = MiniJson.obj(MiniJson.parse(json)); } catch (RuntimeException e) { return f; }
		f.theme = Theme.byId(MiniJson.str(o.get("theme"), "clean")).id;
		f.classicClient = MiniJson.bool(o.get("classicClient"), false); f.lowFire = MiniJson.bool(o.get("lowFire"), true); f.lowShield = MiniJson.bool(o.get("lowShield"), true); f.compliance = MiniJson.bool(o.get("compliance"), false);
		String k = MiniJson.str(o.get("keystrokes"), "A"); f.keystrokes = k.equals("B") ? "B" : "A";
		f.font = MiniJson.str(o.get("font"), "default"); f.fontPair = MiniJson.str(o.get("fontPair"), "inter-monocraft");
		f.fogOverworld = MiniJson.bool(o.get("fogOverworld"), false); f.fogNether = MiniJson.bool(o.get("fogNether"), true); f.fogEnd = MiniJson.bool(o.get("fogEnd"), false);
		Map<String, Object> c = MiniJson.obj(o.get("crosshair")); Crosshair x = f.crosshair;
		x.shape = MiniJson.str(c.get("shape"), x.shape); x.thickness = clamp((int) MiniJson.num(c.get("thickness"), x.thickness), 1, 8); x.gap = clamp((int) MiniJson.num(c.get("gap"), x.gap), 0, 16);
		x.length = clamp((int) MiniJson.num(c.get("length"), x.length), 1, 24); x.outline = clamp((int) MiniJson.num(c.get("outline"), x.outline), 0, 3); double op = MiniJson.num(c.get("opacity"), 1.0); if (op > 1.0) op /= 100.0; x.opacity = Math.max(0.1, Math.min(1.0, op));
		x.spread = MiniJson.bool(c.get("spread"), false); Object col = c.get("color"); if (col instanceof String s && s.matches("#[0-9a-fA-F]{6}")) x.color = Integer.parseInt(s.substring(1), 16);
		for (Map.Entry<String, Object> e : MiniJson.obj(o.get("hudFonts")).entrySet()) if (e.getValue() instanceof String s) f.hudFonts.put(e.getKey(), s);
		return f;
	}
	private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }
	/** Fog distance multiplier for a dimension id; 1.0 leaves vanilla fog, 0 turns it off. */
	public double fogFor(String dimension) { String d = Waypoint.normalizeDimension(dimension); boolean off = switch (d) { case "minecraft:overworld" -> fogOverworld; case "minecraft:the_nether" -> fogNether; case "minecraft:the_end" -> fogEnd; default -> false; }; return off ? 0.0 : 1.0; }
	public static List<String> knownKeys() { return List.of("theme", "classicClient", "lowFire", "lowShield", "compliance", "keystrokes", "font", "fontPair", "fogOverworld", "fogNether", "fogEnd", "crosshair", "hudFonts"); }
}
