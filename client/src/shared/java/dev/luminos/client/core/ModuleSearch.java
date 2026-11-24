package dev.luminos.client.core;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Function;

/** Ranked search, favourites-first ordering and manual reordering for the quick panel. Pure logic. */
public final class ModuleSearch {
	private ModuleSearch() {}

	/**
	 * 0 means no match. Every whitespace-separated token must match somewhere.
	 * Exact title 1000, title prefix 800, word prefix 600, title substring 400, subtitle substring 200, in-order letters of the title 100.
	 */
	public static int score(String query, String title, String sub) {
		String q = query == null ? "" : query.strip().toLowerCase(Locale.ROOT);
		if (q.isEmpty()) return 1;
		String t = title.toLowerCase(Locale.ROOT), s = sub == null ? "" : sub.toLowerCase(Locale.ROOT);
		int total = 0;
		for (String tok : q.split("\\s+")) {
			int best = 0;
			if (t.equals(tok)) best = 1000;
			else if (t.startsWith(tok)) best = 800;
			else if (wordPrefix(t, tok)) best = 600;
			else if (t.contains(tok)) best = 400;
			else if (s.contains(tok)) best = 200;
			else if (tok.length() >= 3 && subsequence(tok, t)) best = 100;
			if (best == 0) return 0;
			total += best;
		}
		return total;
	}

	private static boolean wordPrefix(String text, String tok) {
		for (int i = 1; i < text.length(); i++) {
			char p = text.charAt(i - 1);
			if (!Character.isLetterOrDigit(p) && text.startsWith(tok, i)) return true;
		}
		return false;
	}

	private static boolean subsequence(String needle, String hay) {
		int i = 0;
		for (int j = 0; j < hay.length() && i < needle.length(); j++) if (hay.charAt(j) == needle.charAt(i)) i++;
		return i == needle.length();
	}

	/**
	 * Empty query: favourites first, otherwise original order. With a query: matches only, best score first,
	 * a favourite wins a tie (+50), original order breaks the rest.
	 */
	public static <T> List<T> rank(String query, List<T> items, Function<T, String> id, Function<T, String> title, Function<T, String> sub, Set<String> favourites) {
		record Scored<X>(X item, int score, int index) {}
		List<Scored<T>> list = new ArrayList<>();
		for (int i = 0; i < items.size(); i++) {
			T it = items.get(i);
			int sc = score(query, title.apply(it), sub.apply(it));
			if (sc == 0) continue;
			if (favourites.contains(id.apply(it))) sc += 50;
			list.add(new Scored<>(it, sc, i));
		}
		boolean empty = query == null || query.isBlank();
		list.sort(empty
			? Comparator.<Scored<T>, Boolean>comparing(x -> !favourites.contains(id.apply(x.item))).thenComparingInt(Scored::index)
			: Comparator.<Scored<T>>comparingInt(x -> -x.score).thenComparingInt(Scored::index));
		List<T> out = new ArrayList<>(list.size());
		for (Scored<T> s : list) out.add(s.item);
		return out;
	}

	/** Toggle membership; returns true if the id is now a favourite. */
	public static boolean toggle(Collection<String> favourites, String id) {
		if (favourites.remove(id)) return false;
		favourites.add(id);
		return true;
	}

	/** Apply a saved order: listed ids first in that order, everything else after in its original order. Unknown ids are ignored. */
	public static <T> List<T> applyOrder(List<T> items, List<String> order, Function<T, String> id) {
		List<T> out = new ArrayList<>(items.size());
		List<T> rest = new ArrayList<>(items);
		for (String o : order) {
			for (int i = 0; i < rest.size(); i++) if (id.apply(rest.get(i)).equals(o)) { out.add(rest.remove(i)); break; }
		}
		out.addAll(rest);
		return out;
	}

	/** Move {@code id} by {@code delta} places in the effective order and return the new full order of ids. */
	public static <T> List<String> move(List<T> items, List<String> order, Function<T, String> id, String moving, int delta) {
		List<String> ids = new ArrayList<>();
		for (T t : applyOrder(items, order, id)) ids.add(id.apply(t));
		int from = ids.indexOf(moving);
		if (from < 0) return ids;
		int to = Math.max(0, Math.min(ids.size() - 1, from + delta));
		ids.add(to, ids.remove(from));
		return ids;
	}
}
