import { useState, useSyncExternalStore } from "react";
import { Modal } from "./ui";
import { Icon } from "./Icon";
import { Pills } from "./ui";
import { authlibArg, ELY_API, validYggdrasil } from "../authlib";
import { call } from "../api";

type Kind = "OFFLINE" | "ELY.BY" | "MICROSOFT";
export type Acct = { id: string; kind: Kind; name: string; server?: string };
type AState = { list: Acct[]; active: string };
const KEY = "luminos.accounts.v1";
let state: AState | null = null;
const subs = new Set<() => void>();
function read(seed?: string): AState {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* first run */ }
  if (!state) { const n = seed || "Player"; state = { list: [{ id: "off-" + n, kind: "OFFLINE", name: n }], active: "off-" + n }; }
  return state;
}
function write(n: AState) { state = n; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ } subs.forEach((f) => f()); }
export function useAccounts(seed?: string) {
  read(seed);
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
  const s = state!;
  return { ...s, current: s.list.find((a) => a.id === s.active) || s.list[0] };
}

type Tab = "list" | "offline" | "ely" | "authlib" | "ms";
export default function AccountModal({ onClose }: { onClose: () => void }) {
  const a = useAccounts();
  const [tab, setTab] = useState<Tab>("list"), [name, setName] = useState(""), [server, setServer] = useState("");
  const valid = /^[A-Za-z0-9_]{3,16}$/.test(name.trim());
  const srvErr = server ? validYggdrasil(server) : null;
  const add = (acc: Acct) => { write({ list: [...a.list.filter((x) => x.id !== acc.id), acc], active: acc.id }); void call("create_account", { name: acc.name, kind: acc.kind }); setTab("list"); setName(""); };
  return (
    <Modal title="Accounts" onClose={onClose} w={540}>
      <div className="mb-5"><Pills value={tab} onChange={setTab} items={[{ id: "list", label: "Switch" }, { id: "offline", label: "Offline UUID" }, { id: "ely", label: "Ely.by" }, { id: "authlib", label: "Authlib-Injector" }, { id: "ms", label: "Microsoft" }]} /></div>
      {tab === "list" && (
        <div className="space-y-2">
          {a.list.map((x) => (
            <button key={x.id} onClick={() => write({ ...a, active: x.id })} className="w-full h-[56px] px-4 rounded-[10px] flex items-center gap-3 text-left t" style={{ background: a.active === x.id ? "var(--accent)" : "var(--surface)", color: a.active === x.id ? "var(--accent-fg)" : "var(--fg)" }}>
              <Icon n="profile" s={18} />
              <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-semibold">{x.name}</span><span className="block text-[11.5px] truncate opacity-70">{x.kind === "OFFLINE" ? "Offline account" : x.kind === "ELY.BY" ? `Ely.by · ${x.server || ELY_API}` : "Microsoft"}</span></span>
              {a.active === x.id && <Icon n="check" s={16} />}
            </button>
          ))}
        </div>
      )}
      {(tab === "offline" || tab === "ely" || tab === "authlib") && (
        <div className="space-y-4">
          <p className="m-0 text-[13px] leading-relaxed mute">
            {tab === "offline" ? "An offline account has a name and no sign-in. It works in single player, LAN and offline-mode servers. It cannot join online-mode servers." : tab === "ely" ? "Ely.by accounts launch through authlib-injector so your Ely.by skin shows on servers that use it. Passwords are never typed here." : "Point the game at any Yggdrasil-compatible auth server. Luminos adds the authlib-injector agent for you."}
          </p>
          <input className="field !pl-3.5" placeholder={tab === "offline" ? "Player name (3–16 letters, numbers, _)" : "Username"} aria-label="Player name" value={name} onChange={(e) => setName(e.target.value)} />
          {tab !== "offline" && <input className="field !pl-3.5 num" placeholder={ELY_API} aria-label="Auth server URL" value={server} onChange={(e) => setServer(e.target.value)} />}
          {srvErr && <div className="text-[12px]" style={{ color: "var(--bad)" }}>{srvErr}</div>}
          {tab !== "offline" && <code className="block text-[11px] break-all rounded-[8px] p-3 select-text" style={{ background: "var(--surface)" }}>{authlibArg(server.trim() || ELY_API)}</code>}
          {tab !== "offline" && <div className="text-[11.5px] mute leading-snug">Sign-in needs an OAuth application registered by the project owner. Until then the account is added by name only. Unverified in a real launch.</div>}
          <div className="flex justify-end"><button className="btn-primary" disabled={!valid || !!srvErr} style={{ opacity: valid && !srvErr ? 1 : 0.45 }} onClick={() => add(tab === "offline" ? { id: "off-" + name.trim(), kind: "OFFLINE", name: name.trim() } : { id: "ely-" + name.trim(), kind: "ELY.BY", name: name.trim(), server: server.trim() || undefined })}>Add account</button></div>
        </div>
      )}
      {tab === "ms" && (
        <div className="rounded-[10px] p-4 text-[13px] leading-relaxed" style={{ background: "var(--surface)" }}>
          <div className="font-semibold mb-1">Microsoft sign-in is not live yet</div>
          <div className="mute">It uses the device-code flow and needs the owner’s Azure application id (docs/MICROSOFT_AUTH.md). Until that exists, nothing here can start a sign-in.</div>
        </div>
      )}
    </Modal>
  );
}
