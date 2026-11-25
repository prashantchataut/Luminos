package dev.luminos.client.core;

/** {@code java -cp out dev.luminos.client.core.AgentWireTests} */
public final class AgentWireTests {
	static int failed;
	static void check(String n, boolean ok) { if (!ok) { failed++; System.out.println("FAIL  " + n); } }
	public static void main(String[] a) {
		AgentWire.Cmd c = AgentWire.parse("{\"t\":\"toggle_module\",\"op\":7,\"id\":\"fps\",\"on\":false}");
		check("parse type", c.type().equals("toggle_module")); check("parse op", c.op() == 7); check("parse id", c.id().equals("fps")); check("parse on=false", !c.on());
		check("garbage is empty", AgentWire.parse("not json").type().isEmpty() && AgentWire.parse("[1]").type().isEmpty() && AgentWire.parse("").op() == 0);
		check("pack ids with quotes and slashes are escaped", AgentWire.esc("file/a\"b\\c\n").equals("\"file/a\\\"b\\\\c\\n\""));
		String p = AgentWire.progress(3, "reloading", 50, "x\"y");
		check("progress round-trips", MiniJson.str(MiniJson.obj(MiniJson.parse(p)).get("stage"), "").equals("reloading") && MiniJson.str(MiniJson.obj(MiniJson.parse(p)).get("detail"), "").equals("x\"y"));
		check("auth carries the protocol", MiniJson.num(MiniJson.obj(MiniJson.parse(AgentWire.auth("tok"))).get("protocol"), 0) == AgentWire.PROTOCOL);
		check("done flag", MiniJson.bool(MiniJson.obj(MiniJson.parse(AgentWire.done(1, false, "no"))).get("ok"), true) == false);
		System.out.println(failed == 0 ? "AgentWireTests: all passed" : "AgentWireTests: " + failed + " FAILED");
		if (failed > 0) System.exit(1);
	}
}
