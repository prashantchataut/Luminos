package dev.luminos.client.core;

import java.io.Serializable;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;

/** Launch-time mod policy: drop conflicting mods, cache parsed metadata, discover jars in parallel, and cache HUD text. */
public final class ModPolicy {
	/** Pairs that must not load together. The first id is kept, the second dropped. */
	public static final List<String[]> CONFLICTS = List.of(new String[] { "sodium", "vulkanmod" }, new String[] { "sodium", "optifine" }, new String[] { "iris", "vulkanmod" }, new String[] { "lithium", "canary" });
	/** Returns the ids to drop, with the reason, in a stable order. */
	public static Map<String, String> conflicts(Collection<String> loaded) {
		Set<String> have = new HashSet<>(loaded); Map<String, String> drop = new LinkedHashMap<>();
		for (String[] p : CONFLICTS) if (have.contains(p[0]) && have.contains(p[1])) drop.putIfAbsent(p[1], p[1] + " conflicts with " + p[0]);
		return drop;
	}

	public record Meta(String id, String version, long size, long mtime) implements Serializable {}
	/** Metadata cache keyed by file size + mtime: an unchanged jar is never opened again. */
	public static final class MetaCache {
		private final Map<String, Meta> map = new ConcurrentHashMap<>(); public final java.util.concurrent.atomic.AtomicInteger hits = new java.util.concurrent.atomic.AtomicInteger(), misses = new java.util.concurrent.atomic.AtomicInteger();
		public Meta get(String path, long size, long mtime, Function<String, Meta> parse) {
			Meta m = map.get(path); if (m != null && m.size() == size && m.mtime() == mtime) { hits.incrementAndGet(); return m; }
			misses.incrementAndGet(); Meta n = parse.apply(path); map.put(path, new Meta(n.id(), n.version(), size, mtime)); return map.get(path);
		}
		public String dump() { StringBuilder b = new StringBuilder(); map.forEach((k, v) -> b.append(k).append('\t').append(v.id()).append('\t').append(v.version()).append('\t').append(v.size()).append('\t').append(v.mtime()).append('\n')); return b.toString(); }
		public static MetaCache load(String text) { MetaCache c = new MetaCache(); for (String l : text.split("\n")) { String[] f = l.split("\t"); if (f.length == 5) try { c.map.put(f[0], new Meta(f[1], f[2], Long.parseLong(f[3]), Long.parseLong(f[4]))); } catch (NumberFormatException ignored) { } } return c; }
	}
	/** Runs {@code work} over every item on a small pool; results keep the input order. */
	public static <T, R> List<R> parallel(List<T> items, int threads, Function<T, R> work) {
		ExecutorService ex = Executors.newFixedThreadPool(Math.max(1, Math.min(threads, Math.max(1, items.size()))));
		try { List<Future<R>> fs = new ArrayList<>(); for (T t : items) fs.add(ex.submit(() -> work.apply(t))); List<R> out = new ArrayList<>(); for (Future<R> f : fs) out.add(f.get()); return out; }
		catch (InterruptedException | ExecutionException e) { throw new RuntimeException(e); } finally { ex.shutdown(); }
	}
	/** HUD pixel cache: a value is rebuilt only when its key changes or it is older than the max age. */
	public static final class HudCache<K, V> {
		private K key; private V value; private long at; private final long maxAgeMs; public int builds;
		public HudCache(long maxAgeMs) { this.maxAgeMs = maxAgeMs; }
		public V get(K k, long nowMs, Function<K, V> build) { if (value == null || !Objects.equals(k, key) || nowMs - at > maxAgeMs) { value = build.apply(k); key = k; at = nowMs; builds++; } return value; }
	}
}
