import { useState } from "react";
import { call, isTauri } from "../api";
import { Badge, Icon, Modal } from "../kit";
import { SkinRec, skinSrc } from "./catalog";

/** What each kind of server needs before other players see your skin. A client mod cannot change what other vanilla clients render. */
export default function Visibility({ skin, account }: { skin: SkinRec; account: { kind?: string; username?: string } }) {
  const [url, setUrl] = useState(""), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(false), [owner, setOwner] = useState(false), [copied, setCopied] = useState(false);
  const cmd = `/skin url ${url.trim() || "<link to your PNG>"} ${skin.model === "slim" ? "slim" : "classic"}`;
  const microsoft = (account.kind || "").toLowerCase().startsWith("micro");
  const apply = async () => {
    setBusy(true); setMsg(null);
    try {
      const data = skinSrc(skin); const blob = await (await fetch(data)).blob();
      const b64: string = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(blob); });
      await call("mojang_skin_apply", { pngB64: b64, slim: skin.model === "slim" });
      setMsg({ ok: true, t: "Your Mojang skin is now this one. Servers in online mode show it to everyone." });
    } catch (e: any) { setMsg({ ok: false, t: String(e?.message || e) }); } finally { setBusy(false); }
  };
  const copy = () => { navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => { }); };
  const Row = ({ who, need, tone, tag, children }: { who: string; need: string; tone: "ok" | "warn" | "bad" | "mute"; tag: string; children?: React.ReactNode }) => (
    <div className="py-2 border-b border-line last:border-0">
      <div className="flex items-center gap-2"><span className="t2 font-semibold flex-1">{who}</span><Badge tone={tone}>{tag}</Badge></div>
      <div className="t1 mute mt-0.5 leading-snug">{need}</div>{children}
    </div>
  );
  return (
    <section className="panel p-3" aria-label="Where others see this">
      <div className="flex items-center justify-between mb-1"><div className="eyebrow">Where others see this</div><button className="btn !h-6 !px-2" onClick={() => setOwner(true)}>For server owners</button></div>
      <Row who="Luminos users" tone="warn" tag="Not live yet" need="They need Luminos and the Luminos cosmetics service. The service is not running yet, so nobody sees this today." />
      <Row who="Online-mode servers" tone={microsoft ? "ok" : "mute"} tag={microsoft ? "Ready" : "Needs sign-in"} need="Apply the skin to your Mojang account. The server then sends it to everyone. Nobody needs anything installed.">
        <div className="mt-1.5 flex items-center gap-2">
          <button className="btn btn-primary" disabled={busy || !isTauri || !microsoft} onClick={apply}>{busy ? "Applying…" : "Apply to Mojang account"}</button>
          {!isTauri && <span className="t1 mute">Desktop app only.</span>}{isTauri && !microsoft && <span className="t1 mute">Sign in with Microsoft first. Offline accounts have no Mojang skin.</span>}
        </div>
        {msg && <div role="status" className="t1 mt-1.5" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</div>}
      </Row>
      <Row who="SkinsRestorer servers" tone="mute" tag="Needs a link" need="The server has SkinsRestorer. Put the PNG at a public link, then run the command in chat.">
        <div className="mt-1.5 flex flex-col gap-1.5">
          <input className="field plain" placeholder="https://example.com/my-skin.png" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Public link to your skin PNG" />
          <div className="flex items-center gap-2"><code className="flex-1 min-w-0 truncate t1 px-2 h-7 grid items-center rounded-md" style={{ background: "var(--bg)", border: "1px solid var(--line)", userSelect: "text" }}>{cmd}</code><button className="btn" onClick={copy}><Icon n={copied ? "check" : "copy"} s={13} />{copied ? "Copied" : "Copy"}</button></div>
        </div>
      </Row>
      <Row who="Everyone else" tone="bad" tag="Default skin" need="Other players will see your default skin. The server needs SkinsRestorer or skin-overrides." />
      {owner && (
        <Modal title="Skins on your server" w={560} onClose={() => setOwner(false)}>
          <div className="t2 flex flex-col gap-3 leading-snug" style={{ userSelect: "text" }}>
            <p className="m-0 mute">A client mod cannot change what another player's vanilla game draws. The server has to send the skin. There are four ways to do that.</p>
            <div><b>skin-overrides (recommended)</b><div className="mute t1">Install it on the server too. Its networking sends a player's change to everyone online, <i>even if they don't have the mod</i>. Fabric and Quilt, Minecraft 1.20.6 and later. modrinth.com/mod/skin-overrides</div></div>
            <div><b>SkinsRestorer</b><div className="mute t1">The standard fix for offline-mode servers. Spigot, Paper, Bungee, Velocity. Players run <code>/skin url &lt;link&gt; [classic|slim]</code> for a PNG link, or <code>/skin set &lt;name&gt;</code> to copy a premium player's skin. Plugin page: spigotmc.org, search "SkinsRestorer".</div></div>
            <div><b>Premium servers (online-mode=true)</b><div className="mute t1">Nothing to install. Players change their skin on their Mojang account and the server sends it.</div></div>
            <div><b>authlib-injector</b><div className="mute t1">If the server points authlib-injector at the Luminos skin service, textures come through the standard profile endpoint. See docs/COSMETICS_SERVICE.md.</div></div>
          </div>
        </Modal>
      )}
    </section>
  );
}
