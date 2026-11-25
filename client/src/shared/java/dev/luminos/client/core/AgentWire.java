package dev.luminos.client.core;

import java.util.Map;

/** Wire format of the launcher link (one JSON object per line). Pure Java so CI can test it without Minecraft.
 *  The launcher side is {@code launcher/crates/luminos-core/src/agent.rs}; protocol notes are in docs/LIVE_SWAP.md. */
public final class AgentWire {
	private AgentWire() {}
	public static final int PROTOCOL = 1;

	/** A command from the launcher. {@code op} is 0 when the line is malformed. */
	public record Cmd(String type, long op, String id, boolean on) {}

	public static Cmd parse(String line) {
		Map<String, Object> o;
		try { o = MiniJson.obj(MiniJson.parse(line)); } catch (RuntimeException e) { return new Cmd("", 0, "", false); }   // a bad line must never kill the reader thread
		String t = MiniJson.str(o.get("t"), "");
		if (t.isEmpty()) return new Cmd("", 0, "", false);
		return new Cmd(t, (long) MiniJson.num(o.get("op"), 0), MiniJson.str(o.get("id"), ""), MiniJson.bool(o.get("on"), false));
	}

	public static String esc(String s) {
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

	public static String auth(String token) { return "{\"t\":\"auth\",\"token\":" + esc(token) + ",\"protocol\":" + PROTOCOL + "}"; }
	public static String progress(long op, String stage, int pct, String detail) {
		return "{\"t\":\"progress\",\"op\":" + op + ",\"stage\":" + esc(stage) + ",\"pct\":" + pct + ",\"detail\":" + esc(detail) + "}";
	}
	public static String done(long op, boolean ok, String detail) { return "{\"t\":\"done\",\"op\":" + op + ",\"ok\":" + ok + ",\"detail\":" + esc(detail) + "}"; }
	public static String state(boolean paused, String world, String reason) {
		return "{\"t\":\"state\",\"paused\":" + paused + ",\"world\":" + esc(world) + ",\"reason\":" + esc(reason) + "}";
	}
}
