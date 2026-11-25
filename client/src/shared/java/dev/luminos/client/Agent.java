package dev.luminos.client;

import dev.luminos.client.core.AgentWire;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.ModContainer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.server.packs.repository.PackRepository;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** The Luminos agent: connects to the launcher on loopback (only when started with -Dluminos.agent=host:port and a token) and applies what
 *  is genuinely applicable while the game runs: Luminos modules, resource packs, and pausing. It does NOT unload third-party mods (docs/LIVE_SWAP.md).
 *  Every progress line is sent at the moment that step really happens. */
public final class Agent {
	private Agent() {}

	private static volatile PrintWriter out;
	private static boolean pausedByUs;
	/** Pack reloads in flight: {op, ticksWaited, sawOverlay}. Touched only on the client thread. */
	private static final List<long[]> reloads = new ArrayList<>();
	private static boolean started;

	public static void start() {
		String addr = System.getProperty("luminos.agent"), token = System.getProperty("luminos.agent.token");
		if (addr == null || token == null || started) return;
		started = true;
		ClientTickEvents.END_CLIENT_TICK.register(Agent::tick);
		Thread t = new Thread(() -> run(addr, token), "luminos-agent");
		t.setDaemon(true);
		t.start();
	}

	private static void run(String addr, String token) {
		int i = addr.lastIndexOf(':');
		String host = addr.substring(0, i);
		int port = Integer.parseInt(addr.substring(i + 1));
		if (!host.equals("127.0.0.1") && !host.equals("localhost")) { LuminosClient.LOGGER.warn("[agent] refusing non-loopback launcher address"); return; }
		try (Socket s = new Socket()) {
			s.connect(new InetSocketAddress(host, port), 3000);
			PrintWriter w = new PrintWriter(new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true);
			out = w;
			send(AgentWire.auth(token));
			Minecraft.getInstance().execute(Agent::sendHello);
			LuminosClient.LOGGER.info("[luminos] agent connected to the launcher");
			BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
			for (String line; (line = r.readLine()) != null; ) {
				AgentWire.Cmd c = AgentWire.parse(line);
				if (c.type().isEmpty()) continue;
				send(AgentWire.progress(c.op(), "received", 0, c.type()));
				Minecraft.getInstance().execute(() -> handle(c));
			}
		} catch (IOException e) {
			LuminosClient.LOGGER.info("[luminos] agent link closed: {}", e.toString());
		} finally {
			out = null;
		}
	}

	private static synchronized void send(String line) { PrintWriter w = out; if (w != null) w.println(line); }

	private static String world(Minecraft mc) {
		return mc.level == null ? "menus" : mc.getSingleplayerServer() != null ? "singleplayer" : "multiplayer";
	}

	private static void sendHello() {
		Minecraft mc = Minecraft.getInstance();
		StringBuilder b = new StringBuilder("{\"t\":\"hello\",\"protocol\":" + AgentWire.PROTOCOL + ",\"mc\":" + AgentWire.esc(Nav.version(mc)) + ",\"world\":" + AgentWire.esc(world(mc)) + ",\"server\":" + AgentWire.esc(mc.getCurrentServer() == null ? "" : mc.getCurrentServer().ip) + ",\"mods\":[");
		boolean first = true;
		for (ModContainer m : FabricLoader.getInstance().getAllMods()) {
			if (m.getContainingMod().isPresent()) continue;
			b.append(first ? "" : ",").append("{\"id\":").append(AgentWire.esc(m.getMetadata().getId())).append(",\"version\":").append(AgentWire.esc(m.getMetadata().getVersion().getFriendlyString())).append('}');
			first = false;
		}
		b.append("],\"modules\":[");
		first = true;
		for (HudModule m : Modules.ALL) {
			b.append(first ? "" : ",").append("{\"id\":").append(AgentWire.esc(m.id())).append(",\"enabled\":").append(Config.get().of(m).enabled).append('}');
			first = false;
		}
		b.append("],\"packs\":[");
		PackRepository repo = mc.getResourcePackRepository();
		first = true;
		for (String id : repo.getAvailableIds()) {
			b.append(first ? "" : ",").append("{\"id\":").append(AgentWire.esc(id)).append(",\"enabled\":").append(repo.getSelectedIds().contains(id)).append('}');
			first = false;
		}
		send(b.append("]}").toString());
	}

	private static void handle(AgentWire.Cmd c) {
		Minecraft mc = Minecraft.getInstance();
		try {
			switch (c.type()) {
				case "snapshot" -> { sendHello(); send(AgentWire.done(c.op(), true, "")); }
				case "toggle_module" -> toggleModule(c);
				case "set_pack" -> setPack(mc, c);
				case "pause" -> pause(mc, c);
				default -> send(AgentWire.done(c.op(), false, "unknown command " + c.type()));
			}
		} catch (RuntimeException e) {
			LuminosClient.LOGGER.warn("[agent] command {} failed", c.type(), e);
			send(AgentWire.done(c.op(), false, String.valueOf(e.getMessage())));
		}
	}

	private static void toggleModule(AgentWire.Cmd c) {
		HudModule m = null;
		for (HudModule x : Modules.ALL) if (x.id().equals(c.id())) m = x;
		if (m == null) { send(AgentWire.done(c.op(), false, "no Luminos module named " + c.id())); return; }
		send(AgentWire.progress(c.op(), "applying", 40, m.title()));
		Config.get().of(m).enabled = c.on();   // the HUD reads this flag every frame, so the change is visible on the next frame
		Config.save();
		send(AgentWire.progress(c.op(), "applied", 100, m.title()));
		send(AgentWire.done(c.op(), true, m.title() + (c.on() ? " is on" : " is off")));
	}

	private static void setPack(Minecraft mc, AgentWire.Cmd c) {
		PackRepository repo = mc.getResourcePackRepository();
		if (!repo.getAvailableIds().contains(c.id())) { send(AgentWire.done(c.op(), false, "pack not found: " + c.id())); return; }
		List<String> sel = new ArrayList<>(repo.getSelectedIds());
		if (c.on() == sel.contains(c.id())) { send(AgentWire.done(c.op(), true, "already " + (c.on() ? "on" : "off"))); return; }
		if (c.on()) sel.add(c.id()); else sel.remove(c.id());
		send(AgentWire.progress(c.op(), "applying", 25, c.id()));
		repo.setSelected(sel);
		mc.options.updateResourcePacks(repo);   // saves options.txt and starts the vanilla resource reload when the list changed
		send(AgentWire.progress(c.op(), "reloading", 50, "resource reload started"));
		reloads.add(new long[] { c.op(), 0, 0 });
	}

	/** A reload is finished when its loading overlay has appeared and gone again (or never appeared within 3 s). */
	private static void tick(Minecraft mc) {
		for (var it = reloads.iterator(); it.hasNext(); ) {
			long[] r = it.next();
			r[1]++;
			if (Nav.overlay(mc) != null) r[2] = 1;
			if ((r[2] == 1 && Nav.overlay(mc) == null) || r[1] > 60) {
				send(AgentWire.progress(r[0], "applied", 100, "resources reloaded"));
				send(AgentWire.done(r[0], true, "resources reloaded"));
				it.remove();
			}
		}
	}

	private static void pause(Minecraft mc, AgentWire.Cmd c) {
		boolean ok;
		String why = "";
		if (c.on()) {
			if (mc.getSingleplayerServer() == null) { ok = false; why = mc.level == null ? "no world is open" : "a multiplayer server cannot be paused"; }
			else {
				if (Nav.screen(mc) == null) { mc.pauseGame(false); pausedByUs = true; }
				ok = mc.isPaused() || Nav.screen(mc) instanceof PauseScreen;
				if (!ok) why = "the game did not pause";
			}
		} else {
			if (pausedByUs && Nav.screen(mc) instanceof PauseScreen) Nav.open(mc, null);
			pausedByUs = false;
			ok = true;
		}
		send(AgentWire.state(c.on() && ok, world(mc), why));
		send(AgentWire.done(c.op(), ok, why));
	}
}
