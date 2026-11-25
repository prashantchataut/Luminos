// Luminos P2P signalling: introduces a host and up to 7 guests so their browsers can open a WebRTC data channel. It never sees game traffic.
// One Durable Object per room code. No accounts, no storage; a room disappears when its host leaves. Messages are small JSON; sockets are rate limited.
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
export default {
  async fetch(req, env) {
    const u = new URL(req.url); const m = u.pathname.match(/^\/room\/([A-Z0-9]+)$/);
    if (u.pathname === "/health") return new Response("ok");
    if (!m || !CODE.test(m[1])) return new Response("not found", { status: 404 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  },
};
export class Room {
  constructor() { this.peers = new Map(); this.next = 1; this.host = null; }
  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected a websocket", { status: 426 });
    const role = new URL(req.url).searchParams.get("role");
    if (role === "host" && this.host) return new Response("room taken", { status: 409 });
    if (role !== "host" && !this.host) return new Response("no such room", { status: 404 });
    if (this.peers.size >= 8) return new Response("room full", { status: 429 });
    const [client, server] = Object.values(new WebSocketPair()); server.accept();
    const id = this.next++; this.peers.set(id, server); if (role === "host") this.host = id;
    let count = 0, t0 = Date.now();
    server.send(JSON.stringify({ t: "welcome", id, host: this.host }));
    if (role !== "host") this.peers.get(this.host)?.send(JSON.stringify({ t: "peer", id }));
    server.addEventListener("message", (e) => {
      if (Date.now() - t0 > 1000) { t0 = Date.now(); count = 0; }
      if (++count > 40 || typeof e.data !== "string" || e.data.length > 65536) return server.close(1008, "rate limit");
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t !== "signal") return;
      const to = this.peers.get(m.to);
      // A guest may only talk to the host, and the host to guests: no guest-to-guest relaying.
      if (to && (id === this.host || m.to === this.host)) to.send(JSON.stringify({ t: "signal", from: id, data: m.data }));
    });
    server.addEventListener("close", () => {
      this.peers.delete(id);
      for (const p of this.peers.values()) p.send(JSON.stringify({ t: "left", id }));
      if (id === this.host) { this.host = null; for (const p of this.peers.values()) p.close(1001, "host left"); this.peers.clear(); }
    });
    return new Response(null, { status: 101, webSocket: client });
  }
}
