package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Small JSON reader so the pure core can read the launcher's config files without Gson. Returns Map, List, String, Double, Boolean or null. */
public final class MiniJson {
	private final String s; private int i;
	private MiniJson(String s) { this.s = s; }
	public static Object parse(String text) {
		MiniJson p = new MiniJson(text); p.ws(); Object v = p.value(); p.ws();
		if (p.i != text.length()) throw new IllegalArgumentException("trailing data at " + p.i);
		return v;
	}
	private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
	private Object value() {
		if (i >= s.length()) throw new IllegalArgumentException("unexpected end");
		char c = s.charAt(i);
		if (c == '{') { i++; Map<String, Object> m = new LinkedHashMap<>(); ws(); if (s.charAt(i) == '}') { i++; return m; }
			while (true) { ws(); String k = str(); ws(); expect(':'); ws(); m.put(k, value()); ws(); if (s.charAt(i) == ',') { i++; continue; } expect('}'); return m; } }
		if (c == '[') { i++; List<Object> l = new ArrayList<>(); ws(); if (s.charAt(i) == ']') { i++; return l; }
			while (true) { ws(); l.add(value()); ws(); if (s.charAt(i) == ',') { i++; continue; } expect(']'); return l; } }
		if (c == '"') return str();
		if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
		if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
		if (s.startsWith("null", i)) { i += 4; return null; }
		int st = i; while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
		if (st == i) throw new IllegalArgumentException("bad value at " + i);
		return Double.parseDouble(s.substring(st, i));
	}
	private void expect(char c) { if (i >= s.length() || s.charAt(i) != c) throw new IllegalArgumentException("expected " + c + " at " + i); i++; }
	private String str() {
		expect('"'); StringBuilder b = new StringBuilder();
		while (s.charAt(i) != '"') { char c = s.charAt(i++);
			if (c == '\\') { char e = s.charAt(i++); switch (e) { case 'n' -> b.append('\n'); case 't' -> b.append('\t'); case 'r' -> b.append('\r'); case 'u' -> { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; } default -> b.append(e); } }
			else b.append(c); }
		i++; return b.toString();
	}
	@SuppressWarnings("unchecked") public static Map<String, Object> obj(Object o) { return o instanceof Map ? (Map<String, Object>) o : Map.of(); }
	public static String str(Object o, String d) { return o instanceof String x ? x : d; }
	public static double num(Object o, double d) { return o instanceof Double x ? x : d; }
	public static boolean bool(Object o, boolean d) { return o instanceof Boolean x ? x : d; }
}
