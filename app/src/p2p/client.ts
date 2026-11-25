/** P2P hosting/joining over WebRTC data channels (host-star, as XMCL does). The webview's own RTCPeerConnection carries Minecraft's TCP bytes;
 *  the Rust bridge (`core/src/p2p.rs`) is the local socket on each side. STATUS: compiled and type-checked; the signalling Worker (`p2p-signal/`) and a
 *  two-machine run are UNVERIFIED (docs/P2P.md has the manual test). Wire frame on every data channel: [connId u32 BE][type u8: 0 data, 1 open, 2 close][payload]. */
import { engine } from "../engine";

export type Route = "direct" | "relay" | "unknown";
export type Session = { code: string; role: "host" | "guest"; port?: number; guests: number; route: Route; close: () => void };
type Hooks = { onChange: (s: Session) => void; onError: (m: string) => void };
const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };   // STUN only; TURN is added when the signalling server hands out credentials
const frame = (conn: number, type: number, payload: Uint8Array = new Uint8Array()) => { const b = new Uint8Array(5 + payload.length); new DataView(b.buffer).setUint32(0, conn); b[4] = type; b.set(payload, 5); return b; };
const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function routeOf(pc: RTCPeerConnection): Promise<Route> {
  const stats = await pc.getStats(); let pair: any;
  stats.forEach((r: any) => { if (r.type === "transport" && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId); });
  if (!pair) return "unknown";
  const l: any = stats.get(pair.localCandidateId), r: any = stats.get(pair.remoteCandidateId);
  return l?.candidateType === "relay" || r?.candidateType === "relay" ? "relay" : "direct";
}

function ws(signal: string, code: string, role: "host" | "guest"): WebSocket {
  const u = new URL(signal); u.protocol = u.protocol === "http:" ? "ws:" : "wss:"; u.pathname = `/room/${code}`; u.searchParams.set("role", role);
  return new WebSocket(u);
}

/** Host: share the world that is open to LAN on `lanPort`. */
export async function hostRoom(signal: string, lanPort: number, h: Hooks): Promise<Session> {
  const code = await engine.p2pRoomCode(); const sock = ws(signal, code, "host");
  const peers = new Map<number, { pc: RTCPeerConnection; dc?: RTCDataChannel; conns: Map<number, number> }>();   // guest id -> state; conns: guest conn id -> local conn id
  const s: Session = { code, role: "host", guests: 0, route: "unknown", close: () => { sock.close(); peers.forEach((p) => p.pc.close()); } };
  const un = await import("@tauri-apps/api/event");
  const off = await un.listen<{ conn: number; b64: string }>("p2p-data", (e) => { for (const p of peers.values()) for (const [g, l] of p.conns) if (l === e.payload.conn && p.dc?.readyState === "open") p.dc.send(frame(g, 0, unb64(e.payload.b64))); });
  const offc = await un.listen<{ conn: number }>("p2p-close", (e) => { for (const p of peers.values()) for (const [g, l] of p.conns) if (l === e.payload.conn) { p.dc?.send(frame(g, 2)); p.conns.delete(g); } });
  const prevClose = s.close; s.close = () => { off(); offc(); prevClose(); };
  sock.onmessage = async (m) => {
    const msg = JSON.parse(m.data);
    if (msg.t === "peer") {
      const pc = new RTCPeerConnection(ICE); const dc = pc.createDataChannel("mc", { ordered: true }); dc.binaryType = "arraybuffer";
      const st = { pc, dc, conns: new Map<number, number>() }; peers.set(msg.id, st);
      pc.onicecandidate = (e) => e.candidate && sock.send(JSON.stringify({ t: "signal", to: msg.id, data: { ice: e.candidate } }));
      dc.onopen = async () => { s.guests = peers.size; s.route = await routeOf(pc); h.onChange({ ...s }); };
      dc.onmessage = async (e) => { const b = new Uint8Array(e.data as ArrayBuffer); const conn = new DataView(b.buffer).getUint32(0), type = b[4];
        if (type === 1) { try { st.conns.set(conn, await engine.p2pHostDial(lanPort)); } catch (err) { h.onError(String(err)); dc.send(frame(conn, 2)); } }
        else if (type === 0) { const l = st.conns.get(conn); if (l !== undefined) engine.p2pWrite(l, b64(b.subarray(5))).catch(() => {}); }
        else if (type === 2) { const l = st.conns.get(conn); if (l !== undefined) { engine.p2pClose(l); st.conns.delete(conn); } } };
      await pc.setLocalDescription(await pc.createOffer()); sock.send(JSON.stringify({ t: "signal", to: msg.id, data: { sdp: pc.localDescription } }));
    } else if (msg.t === "signal") {
      const p = peers.get(msg.from); if (!p) return;
      if (msg.data.sdp) await p.pc.setRemoteDescription(msg.data.sdp); else if (msg.data.ice) await p.pc.addIceCandidate(msg.data.ice);
    } else if (msg.t === "left") { peers.get(msg.id)?.pc.close(); peers.delete(msg.id); s.guests = peers.size; h.onChange({ ...s }); }
  };
  sock.onerror = () => h.onError("Could not reach the signalling server. Check the address in Settings.");
  await new Promise<void>((res, rej) => { sock.onopen = () => res(); sock.addEventListener("error", () => rej(new Error("Could not reach the signalling server")), { once: true }); });
  h.onChange({ ...s }); return s;
}

/** Guest: returns a loopback port. Add `localhost:<port>` as a server in Minecraft. */
export async function joinRoom(signal: string, code: string, h: Hooks): Promise<Session> {
  const sock = ws(signal, code.trim().toUpperCase(), "guest"); const port = await engine.p2pGuestListen();
  const pc = new RTCPeerConnection(ICE); let dc: RTCDataChannel | undefined; let hostId = 0;
  const s: Session = { code, role: "guest", port, guests: 0, route: "unknown", close: () => { sock.close(); pc.close(); } };
  const un = await import("@tauri-apps/api/event");
  const offs = [
    await un.listen<{ conn: number }>("p2p-open", (e) => dc?.readyState === "open" && dc.send(frame(e.payload.conn, 1))),
    await un.listen<{ conn: number; b64: string }>("p2p-data", (e) => dc?.readyState === "open" && dc.send(frame(e.payload.conn, 0, unb64(e.payload.b64)))),
    await un.listen<{ conn: number }>("p2p-close", (e) => dc?.readyState === "open" && dc.send(frame(e.payload.conn, 2))),
  ];
  const prevClose = s.close; s.close = () => { offs.forEach((o) => o()); prevClose(); };
  pc.onicecandidate = (e) => e.candidate && hostId && sock.send(JSON.stringify({ t: "signal", to: hostId, data: { ice: e.candidate } }));
  pc.ondatachannel = (e) => { dc = e.channel; dc.binaryType = "arraybuffer";
    dc.onopen = async () => { s.route = await routeOf(pc); h.onChange({ ...s }); };
    dc.onmessage = (m) => { const b = new Uint8Array(m.data as ArrayBuffer); const conn = new DataView(b.buffer).getUint32(0), type = b[4];
      if (type === 0) engine.p2pWrite(conn, b64(b.subarray(5))).catch(() => {}); else if (type === 2) engine.p2pClose(conn); }; };
  sock.onmessage = async (m) => {
    const msg = JSON.parse(m.data);
    if (msg.t === "welcome") hostId = msg.host;
    else if (msg.t === "signal") { hostId = msg.from;
      if (msg.data.sdp) { await pc.setRemoteDescription(msg.data.sdp); await pc.setLocalDescription(await pc.createAnswer()); sock.send(JSON.stringify({ t: "signal", to: hostId, data: { sdp: pc.localDescription } })); }
      else if (msg.data.ice) await pc.addIceCandidate(msg.data.ice); }
    else if (msg.t === "left" && msg.id === hostId) h.onError("The host closed the room.");
  };
  await new Promise<void>((res, rej) => { sock.onopen = () => res(); sock.onerror = () => rej(new Error("Could not reach the signalling server, or that room does not exist.")); });
  h.onChange({ ...s }); return s;
}
