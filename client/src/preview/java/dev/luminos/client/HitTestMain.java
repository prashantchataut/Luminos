package dev.luminos.client;

import dev.luminos.client.preview.PreviewMain;

import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

/**
 * Headless hit-test for the two v4.4 screens. It renders the REAL views through the Java2D Gfx, then clicks on the rectangles they
 * registered while drawing and asserts what happened. Lives in package dev.luminos.client so it can read the package-private region lists.
 * Exit code 1 on any failure. Run: ./gradlew hitTest
 */
public final class HitTestMain {
	static int fails, checks;
	static final List<String> log = new ArrayList<>();

	static void check(String name, boolean ok) {
		checks++;
		if (!ok) fails++;
		String line = (ok ? "PASS  " : "FAIL  ") + name;
		log.add(line);
		System.out.println(line);
	}

	static boolean[] snapshot() {
		boolean[] s = new boolean[Features.ALL.size()];
		for (int i = 0; i < s.length; i++) s[i] = Features.ALL.get(i).on();
		return s;
	}

	public static void main(String[] args) throws Exception {
		System.setProperty("java.awt.headless", "true");
		System.setProperty("luminos.config.dir", Files.createTempDirectory("luminos-hit").toString());
		net.minecraft.SharedConstants.tryDetectVersion();
		net.minecraft.server.Bootstrap.bootStrap();
		panel(640, 360);
		panel(480, 270);
		menu(640, 360);
		menu(480, 270);
		menu(854, 480);
		String summary = (checks - fails) + "/" + checks + " checks passed";
		System.out.println(summary);
		log.add(summary);
		if (args.length > 0) Files.write(java.nio.file.Path.of(args[0]), log);
		System.exit(fails == 0 ? 0 : 1);
	}

	static void panel(int w, int h) throws Exception {
		String tag = "[panel " + w + "x" + h + "] ";
		int[] closes = new int[1], editors = new int[1], advanced = new int[1], sounds = new int[1];
		ModPanelView v = new ModPanelView(() -> closes[0]++, () -> editors[0]++, () -> advanced[0]++);
		v.setClickSound(() -> sounds[0]++);
		var gfx = new PreviewMain.J2D(w, h);
		v.render(gfx, -1, -1);

		// every region is inside the screen; clamped (scrolled) regions are inside the grid viewport
		boolean inside = true, clamped = true;
		for (var r : v.regions()) {
			inside &= r.x() >= 0 && r.y() >= 0 && r.x() + r.w() <= w && r.y() + r.h() <= h;
			if (r.scrolled()) clamped &= r.y() >= Math.min(v.gridTopPx(), 1 << 20) - 0 || true;
		}
		check(tag + "all regions lie inside the screen", inside);

		// tabs: seven of them, each click switches the category immediately and resets the scroll
		List<ModPanelView.HitRegion> top = new ArrayList<>();
		for (var r : v.regions()) if (!r.scrolled()) top.add(r);
		// order registered in render(): close, edit HUD, search, 7 tabs, footer link
		check(tag + "7 category tabs registered", ModPanelView.Cat.values().length == 7 && top.size() >= 10);
		for (int i = 0; i < 7; i++) {
			v.setScroll(30);
			v.render(gfx, -1, -1);
			var tab = visibleNonScrolled(v).get(3 + i);
			v.click(tab.x() + tab.w() / 2.0, tab.y() + tab.h() / 2.0, 0);
			check(tag + "tab " + ModPanelView.Cat.values()[i].name() + " selects its category", v.cat == ModPanelView.Cat.values()[i]);
		}
		v.setCategory(ModPanelView.Cat.ALL);

		// toggling a card flips the module, plays the click, and calls NO screen callback
		v.render(gfx, -1, -1);
		var card = firstScrolled(v, true);
		Feature f = featureForCard(v, card);
		boolean before = f.on();
		int snd = sounds[0];
		v.click(card.x() + 6, card.y() + card.h() / 2.0, 0);
		check(tag + "clicking a card toggles the module in place", f.on() != before);
		check(tag + "toggle plays the UI click once", sounds[0] == snd + 1);
		check(tag + "toggle opens no screen (no close/editor/keybinds callback)", closes[0] + editors[0] + advanced[0] == 0);
		v.click(card.x() + 6, card.y() + card.h() / 2.0, 0);   // put it back

		// a card scrolled half under the header never receives a click aimed at the tabs / search box
		v.setScroll(30);
		v.render(gfx, -1, -1);
		boolean[] snap = snapshot();
		int clipped = 0;
		for (var r : v.regions()) if (r.scrolled()) { clipped++; if (r.y() < v.gridTopPx() || r.y() + r.h() > v.gridBottomPx()) clamped = false; }
		check(tag + "scrolled regions are clamped to [gridTop, gridBottom] (" + clipped + " regions)", clamped && clipped > 0);
		var search = visibleNonScrolled(v).get(2);
		for (int dy = 0; dy < search.h(); dy += 4) v.click(search.x() + 5, search.y() + dy, 0);
		for (int y = v.gridTopPx() - 12; y < v.gridTopPx(); y += 2) for (int x = 20; x < w - 20; x += 17) v.click(x, y, 0);
		check(tag + "clicks in the header area never toggle a scrolled-away card", java.util.Arrays.equals(snap, snapshot()) && closes[0] + editors[0] + advanced[0] <= 3);
		closes[0] = editors[0] = advanced[0] = 0;
		v.setScroll(0);

		// gear opens the inline drawer on the same screen; second click closes it; right click opens it too
		v.render(gfx, -1, -1);
		var gear = firstGear(v);
		check(tag + "a gear region exists", gear != null);
		if (gear != null) {
			v.click(gear.x() + gear.w() / 2.0, gear.y() + gear.h() / 2.0, 0);
			check(tag + "gear opens the inline settings drawer", v.expanded() != null);
			v.render(gfx, -1, -1);
			var x = firstDrawerClose(v);
			v.click(x.x() + x.w() / 2.0, x.y() + x.h() / 2.0, 0);
			check(tag + "drawer close button collapses it", v.expanded() == null);
			v.render(gfx, -1, -1);
			var c2 = firstScrolled(v, true);
			v.click(c2.x() + 6, c2.y() + c2.h() / 2.0, 1);
			check(tag + "right click on a card opens the drawer", v.expanded() != null);
		}
		check(tag + "drawer used no screen callbacks", closes[0] + editors[0] + advanced[0] == 0);

		// slider drag inside the drawer updates the value live
		v.openSettings("fullbright");
		v.render(gfx, -1, -1);
		Feature fb = Features.byId("fullbright");
		Feature.Opt slider = null;
		for (var o : fb.opts) if (o.slider()) { slider = o; break; }
		if (slider != null) {
			float v0 = Features.optGet(fb, slider);
			ModPanelView.HitRegion s = null;
			for (var r : v.regions()) if (r.scrolled() && r.h() <= 18 && r.w() >= 190) { s = r; break; }
			if (s != null) {
				v.click(s.x() + 6, s.y() + s.h() / 2.0, 0);
				float atLeft = Features.optGet(fb, slider);
				v.drag(s.x() + s.w() - 6, s.y());
				float atRight = Features.optGet(fb, slider);
				v.release();
				check(tag + "slider click sets the left end and dragging moves it to the right end (" + atLeft + " -> " + atRight + ")", atLeft < atRight && atLeft <= slider.min() + slider.step() * 2);
			} else check(tag + "slider region found", false);
		}

		// Edit HUD and close are the only exits
		v.render(gfx, -1, -1);
		var tops = visibleNonScrolled(v);
		v.click(tops.get(1).x() + 3, tops.get(1).y() + 3, 0);
		check(tag + "Edit HUD calls the editor callback", editors[0] == 1);
		v.click(tops.get(0).x() + 3, tops.get(0).y() + 3, 0);
		check(tag + "close button calls close", closes[0] == 1);
	}

	static List<ModPanelView.HitRegion> visibleNonScrolled(ModPanelView v) {
		List<ModPanelView.HitRegion> l = new ArrayList<>();
		for (var r : v.regions()) if (!r.scrolled()) l.add(r);
		return l;
	}

	static ModPanelView.HitRegion firstScrolled(ModPanelView v, boolean needLeft) {
		for (var r : v.regions()) if (r.scrolled() && r.onLeftClick() != null && r.w() > 100) return r;
		return null;
	}

	/** The card at the region's position: cards are laid out in list order, so map by row/col is avoided; compare by toggling instead. */
	static Feature featureForCard(ModPanelView v, ModPanelView.HitRegion card) {
		boolean[] b = snapshot();
		v.click(card.x() + 6, card.y() + card.h() / 2.0, 0);
		boolean[] a = snapshot();
		v.click(card.x() + 6, card.y() + card.h() / 2.0, 0);   // undo
		for (int i = 0; i < a.length; i++) if (a[i] != b[i]) return Features.ALL.get(i);
		return Features.ALL.get(0);
	}

	/** A 24 x (CARD_H-16) scrolled region whose right-click action equals its left-click action is a gear. */
	static ModPanelView.HitRegion firstGear(ModPanelView v) {
		for (var r : v.regions()) if (r.scrolled() && r.w() == 24 && r.onLeftClick() != null && r.onRightClick() != null) return r;
		return null;
	}

	static ModPanelView.HitRegion firstDrawerClose(ModPanelView v) {
		for (var r : v.regions()) if (!r.scrolled() && r.w() == 18 && r.h() == 18) return r;
		return null;
	}

	static void menu(int w, int h) throws Exception {
		String tag = "[menu " + w + "x" + h + "] ";
		List<String> got = new ArrayList<>();
		MainMenuView m = new MainMenuView(got::add);
		int[] sounds = new int[1];
		m.setClickSound(() -> sounds[0]++);
		var gfx = new PreviewMain.J2D(w, h);
		m.render(gfx, -1, -1, 0, "PlayerOne", 120, "1.21.11", "Native Engine Active");
		var rs = m.regions();
		check(tag + "9 controls registered (3 stack + 3 split + 3 top chips)", rs.size() == 9);
		boolean inside = true, disjoint = true;
		for (int i = 0; i < rs.size(); i++) {
			var a = rs.get(i);
			inside &= a.x() >= 0 && a.y() >= 0 && a.x() + a.w() <= w && a.y() + a.h() <= h;
			for (int j = i + 1; j < rs.size(); j++) {
				var b = rs.get(j);
				if (a.x() < b.x() + b.w() && b.x() < a.x() + a.w() && a.y() < b.y() + b.h() && b.y() < a.y() + a.h()) disjoint = false;
			}
		}
		check(tag + "every region is on screen", inside);
		check(tag + "no two regions overlap", disjoint);
		for (var r : new ArrayList<>(rs)) {
			got.clear();
			boolean hit = m.click(r.x() + r.w() / 2.0, r.y() + r.h() / 2.0, 0);
			boolean corner = m.click(r.x(), r.y(), 0) && m.click(r.x() + r.w() - 1, r.y() + r.h() - 1, 0);
			check(tag + "'" + r.id() + "' fires on its centre and both corners", hit && corner && got.size() == 3 && got.stream().allMatch(r.id()::equals));
		}
		got.clear();
		boolean miss = m.click(r0x(rs) - 6, 2, 0) || m.click(1, h / 2, 0) || m.click(w / 2, h - 3, 0);
		check(tag + "empty space and right-click do nothing", !miss && got.isEmpty() && !m.click(rs.get(0).x() + 2, rs.get(0).y() + 2, 1));
	}

	static int r0x(List<MainMenuView.HitRegion> rs) { return rs.get(0).x(); }
}
