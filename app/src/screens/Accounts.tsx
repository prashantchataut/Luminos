import { useState, useSyncExternalStore } from "react";
import { Icon, Modal } from "../kit";
import { authlibArg, ELY_API, validYggdrasil } from "../authlib";
import type { Boot } from "../App";

type Kind = "OFFLINE" | "ELY.BY" | "MICROSOFT";
export type Acct = { id: string; kind: Kind; name: string; server?: string };
const KEY = "luminos.accounts.v1";
let state: { list: Acct[]; active: string } | null = null;
const subs = new Set<() => void>();
const read = (seed?: string) => { if (state) return state; try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* first run */ } if (!state) { const n = seed || "Mira"; state = { list: [{ id: "off-" + n, kind: "OFFLINE", name: n }], active: "off-" + n }; } return state; };
const write = (n: { list: Acct[]; active: string }) => { state = n; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ } subs.forEach((f) => f()); };
export function useAccounts(seed?: string) { read(seed); useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state); return state!; }

export default function AccountSwitcher({ boot, onClose }: { boot: Boot; onClose: () => void }) {
  const a = useAccounts(boot.account?.username);
  const [tab, setTab] = useState<"list" | "offline" | "ely" | "ms">("list"), [name, setName] = useState(""), [custom, setCustom] = useState(""), [err, setErr] = useState<string | null>(null);
  const add = (acc: Acct) => { write({ list: [...a.list.filter((x) => x.id !== acc.id), acc], active: acc.id }); setTab("list"); setName(""); };
  const valid = /^[A-Za-z0-9_]{3,16}$/.test(name.trim());
  const server = custom.trim() || ELY_API;
  return (
    <Modal onClose={onClose} title="Accounts" w={560}>
      <div className="flex items-center gap-2 mb-3 justify-end"><div className="seg" role="tablist">{([["list", "Switch"], ["offline", "Offline"], ["ely", "Ely.by"], ["ms", "Microsoft"]] as const).map(([k, l]) => <button key={k} role="tab" aria-pressed={tab === k} onClick={() => { setTab(k); setErr(null); }}>{l}</button>)}</div></div>
      {tab === "list" && <div className="grid gap-1">
        {a.list.map((x) => <button key={x.id} className="lrow !min-h-[48px] text-left" onClick={() => write({ ...a, active: x.id })} style={a.active === x.id ? { background: "var(--accent-soft)" } : undefined}>
          <Icon n="user" s={16} /><span className="flex-1 min-w-0"><span className="t2 font-semibold block">{x.name}</span><span className="t1 mute block truncate">{x.kind === "ELY.BY" ? `authlib-injector · ${x.server || ELY_API}` : x.kind === "OFFLINE" ? "Offline. Online-mode servers will refuse this account." : "Microsoft account"}</span></span><span className="badge">{x.kind}</span>{a.active === x.id && <Icon n="check" s={14} />}</button>)}
      </div>}
      {tab === "offline" && <div className="grid gap-3"><p className="t2 mute m-0 leading-snug">An offline account has a name and no sign-in. It works in single player, LAN and servers that run in offline mode. It cannot join online-mode servers, and Luminos does not try to get around that.</p>
        <input className="field plain" placeholder="Player name (3–16 letters, numbers, _)" aria-label="Player name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end"><button className="btn btn-primary" disabled={!valid} onClick={() => add({ id: "off-" + name.trim(), kind: "OFFLINE", name: name.trim() })}>Add offline account</button></div></div>}
      {tab === "ely" && <div className="grid gap-3"><p className="t2 mute m-0 leading-snug">Ely.by accounts launch through authlib-injector, so the game talks to the Ely.by auth server and your Ely.by skin and cape show on servers that use it. Passwords are never typed into Luminos: sign-in happens on ely.by in your browser (OAuth2).</p>
        <input className="field plain" placeholder="Ely.by username" aria-label="Ely.by username" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="grid gap-1"><span className="eyebrow">Auth server (Yggdrasil API)</span><input className="field plain num" placeholder={ELY_API} aria-label="Custom Yggdrasil server URL" value={custom} onChange={(e) => { setCustom(e.target.value); setErr(custom ? validYggdrasil(e.target.value) : null); }} />{err && <span role="alert" className="t1" style={{ color: "var(--bad)" }}>{err}</span>}</label>
        <div className="panel-2 p-3"><div className="eyebrow mb-1">Launch argument added</div><code className="t1 num break-all select-text">{authlibArg(server)}</code></div>
        <div className="t1 mute leading-snug">Browser sign-in needs an Ely.by OAuth application (a client id) registered by the project owner. It is not registered yet, so this adds the account by name and does not fetch a token. <b>Unverified in a real launch.</b></div>
        <div className="flex justify-end"><button className="btn btn-primary" disabled={!valid || !!(custom && validYggdrasil(custom))} onClick={() => add({ id: "ely-" + name.trim(), kind: "ELY.BY", name: name.trim(), server: custom.trim() || undefined })}>Add Ely.by account</button></div></div>}
      {tab === "ms" && <div className="grid gap-3"><p className="t2 mute m-0 leading-snug">Microsoft sign-in uses the device-code flow: Luminos shows a short code, you enter it at microsoft.com/link, and the token goes to your operating system’s secure store.</p>
        <div className="panel-2 p-3 t2 flex items-center gap-2"><span className="badge warn">Not live</span><span className="leading-snug">Needs the owner’s Azure application id (see docs/MICROSOFT_AUTH.md). Until that exists, this cannot start a sign-in.</span></div></div>}
      <div className="flex justify-end mt-4"><button className="btn" onClick={onClose}>Done</button></div>
    </Modal>
  );
}
