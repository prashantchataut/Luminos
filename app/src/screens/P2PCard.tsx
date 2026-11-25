/** Settings: host a world to friends, or join with a room code (no port forwarding). Skills: interaction-design [every state has text], accessibility [live region, labelled inputs].
 *  STATUS: UNVERIFIED end to end: needs the signalling Worker deployed (docs/P2P.md). With no address configured the card says so and the buttons stay off. */
import { useRef, useState } from "react";
import { Badge, LRow } from "../kit";
import { hostRoom, joinRoom, type Session } from "../p2p/client";
import { isTauri } from "../api";

const KEY = "luminos.p2p.signal";
export default function P2PCard() {
  const [url, setUrl] = useState(() => localStorage.getItem(KEY) || ""); const [lan, setLan] = useState(""); const [code, setCode] = useState("");
  const [s, setS] = useState<Session | null>(null); const [err, setErr] = useState(""); const cur = useRef<Session | null>(null);
  const ok = isTauri && /^https?:\/\//.test(url);
  const run = async (f: () => Promise<Session>) => { setErr(""); try { cur.current?.close(); const x = await f(); cur.current = x; setS(x); } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } };
  return <div>
    <div className="eyebrow mb-1.5 px-1">Play with friends (peer to peer)</div>
    <div className="panel p-1.5">
      <LRow icon="globe" name="Signalling server" desc={isTauri ? "Only used to introduce you and your friends. Game traffic goes straight between you, or through a relay when your networks block that." : "Available in the desktop app."}>
        <input aria-label="Signalling server address" className="inp" style={{ width: 230 }} placeholder="https://your-worker.workers.dev" value={url} onChange={(e) => { setUrl(e.target.value); localStorage.setItem(KEY, e.target.value); }} />
      </LRow>
      <LRow icon="upload" name="Host my world" desc="Open your world to LAN in Minecraft, then enter the port it shows."><input aria-label="LAN port" className="inp" style={{ width: 90 }} inputMode="numeric" placeholder="LAN port" value={lan} onChange={(e) => setLan(e.target.value.replace(/\D/g, ""))} /><button className="btn" disabled={!ok || !lan} onClick={() => run(() => hostRoom(url, Number(lan), { onChange: setS, onError: setErr }))}>Host</button></LRow>
      <LRow icon="download" name="Join a friend" desc="Enter their room code. Then add the address shown as a server in Minecraft."><input aria-label="Room code" className="inp" style={{ width: 110 }} maxLength={6} placeholder="ROOM CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><button className="btn" disabled={!ok || code.length !== 6} onClick={() => run(() => joinRoom(url, code, { onChange: setS, onError: setErr }))}>Join</button></LRow>
    </div>
    <div className="t1 mute mt-1.5 px-1" role="status" aria-live="polite">
      {err ? <span>{err}</span> : s?.role === "host" ? <><Badge tone="ok">Room {s.code}</Badge> {s.guests} friend{s.guests === 1 ? "" : "s"} connected{s.guests ? ` · ${s.route}` : ""}. Share the code.</>
        : s?.role === "guest" ? <><Badge tone="ok">Joined {s.code}</Badge> In Minecraft add the server <b className="num">localhost:{s.port}</b>{s.route !== "unknown" ? ` · ${s.route}` : ""}.</>
        : !ok ? (isTauri ? "Enter a signalling server address to turn this on." : "") : "Ready."}
    </div>
  </div>;
}
