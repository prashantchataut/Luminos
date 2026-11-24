package dev.luminos.client.core;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Pattern;
import java.util.zip.CRC32;
import java.util.zip.DataFormatException;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

/**
 * HUD layout share codes: {@code LUM1-<base64url(deflate(payload))>-<crc32 hex>}.
 * Works offline, needs no account. Decoding is strict (size caps, id whitelist, CRC) because the string comes from a stranger.
 */
public final class ShareCode {
	public static final String PREFIX = "LUM1-";
	static final int MAX_ENTRIES = 128;
	static final int MAX_PAYLOAD = 16 * 1024;
	private static final Pattern ID = Pattern.compile("[a-z0-9_]{1,32}");

	/** One HUD module's saved state. */
	public record Entry(String id, boolean enabled, int x, int y, float scale) {
		public Entry {
			if (!ID.matcher(id).matches()) throw new IllegalArgumentException("bad module id: " + id);
			scale = Math.max(0.5f, Math.min(3f, scale));
		}
	}

	private ShareCode() {}

	public static String encode(List<Entry> entries) {
		if (entries.size() > MAX_ENTRIES) throw new IllegalArgumentException("too many modules");
		StringBuilder sb = new StringBuilder();
		for (Entry e : entries) {
			sb.append(e.id()).append('|').append(e.enabled() ? 1 : 0).append('|').append(e.x()).append('|').append(e.y()).append('|')
				.append(Float.toString(e.scale())).append('\n');
		}
		byte[] raw = sb.toString().getBytes(StandardCharsets.UTF_8);
		return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(deflate(raw)) + "-" + crcHex(raw);
	}

	/** @throws IllegalArgumentException with a message safe to show to the user */
	public static List<Entry> decode(String code) {
		if (code == null) throw new IllegalArgumentException("Nothing to import");
		String c = code.strip();
		if (!c.startsWith(PREFIX)) throw new IllegalArgumentException("Not a Luminos share code (should start with " + PREFIX + ")");
		int dash = c.lastIndexOf('-');
		if (dash <= PREFIX.length() - 1 || dash == c.length() - 1) throw new IllegalArgumentException("Share code is incomplete");
		String body = c.substring(PREFIX.length(), dash), crc = c.substring(dash + 1);
		byte[] packed;
		try {
			packed = Base64.getUrlDecoder().decode(body);
		} catch (IllegalArgumentException ex) {
			throw new IllegalArgumentException("Share code is damaged");
		}
		byte[] raw;
		try {
			raw = inflate(packed);
		} catch (DataFormatException ex) {
			throw new IllegalArgumentException("Share code is damaged");
		}
		if (!crcHex(raw).equalsIgnoreCase(crc)) throw new IllegalArgumentException("Share code failed its checksum: a character was changed");
		List<Entry> out = new ArrayList<>();
		for (String line : new String(raw, StandardCharsets.UTF_8).split("\n")) {
			if (line.isEmpty()) continue;
			String[] p = line.split("\\|", -1);
			if (p.length != 5) throw new IllegalArgumentException("Share code has an unreadable line");
			try {
				out.add(new Entry(p[0], p[1].equals("1"), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Float.parseFloat(p[4])));
			} catch (NumberFormatException ex) {
				throw new IllegalArgumentException("Share code has a bad number in '" + p[0] + "'");
			}
			if (out.size() > MAX_ENTRIES) throw new IllegalArgumentException("Share code lists too many modules");
		}
		return out;
	}

	private static String crcHex(byte[] b) {
		CRC32 c = new CRC32();
		c.update(b);
		return String.format("%08x", c.getValue());
	}

	private static byte[] deflate(byte[] in) {
		Deflater d = new Deflater(Deflater.BEST_COMPRESSION, true);
		d.setInput(in);
		d.finish();
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		byte[] buf = new byte[512];
		while (!d.finished()) out.write(buf, 0, d.deflate(buf));
		d.end();
		return out.toByteArray();
	}

	private static byte[] inflate(byte[] in) throws DataFormatException {
		Inflater inf = new Inflater(true);
		inf.setInput(in);
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		byte[] buf = new byte[512];
		try {
			while (!inf.finished()) {
				int n = inf.inflate(buf);
				if (n == 0 && (inf.needsInput() || inf.needsDictionary())) break;
				out.write(buf, 0, n);
				if (out.size() > MAX_PAYLOAD) throw new IllegalArgumentException("Share code is too large");
			}
		} finally {
			inf.end();
		}
		return out.toByteArray();
	}
}
