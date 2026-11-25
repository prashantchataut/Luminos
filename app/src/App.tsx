import { useEffect, useRef, useState } from "react";
import { bootstrap, call, Inst, isTauri } from "./api";
import "./modicons";
import { Icon, SkinThumb } from "./kit";
import { skinById, skinSrc, useLocker } from "./locker/catalog";
import { useSettings } from "./store";
import Home from "./screens/Home";
import { InstancesPage } from "./screens/Shard";
import Cosmetics from "./screens/Cosmetics";
import Servers from "./screens/Servers";
import Settings from "./screens/Settings";
import Onboarding from "./screens/Onboarding";
import Mods from "./screens/Mods";
import HudStudio from "./screens/HudStudio";
import Themes from "./screens/Themes";
import { Changelog, Keybinds, Profiles } from "./screens/Misc";
import AccountSwitcher, { useAccounts } from "./screens/Accounts";

type Item = [id: string, label: string, icon: string];
const GROUPS: [string, Item[]][] = [
  ["Play & library", [["home", "Home", "home"], ["instances", "Instances", "layers"], ["servers", "Servers & P2P", "server"]]],
  ["Mods & options", [["mods", "Mods", "sliders"], ["hud", "Edit HUD", "hud"], ["profiles", "Profiles", "profile"], ["keybinds", "Keybinds", "keyboard"]]],
  ["Personalization", [["cosmetics", "Cosmetics", "shirt"], ["themes", "Themes", "roller"]]],
  ["System", [["changelog", "Changelog", "history"], ["settings", "Preferences", "gear"]]],
];
const TITLE: Record<string, string> = { home: "Home", instances: "Instances", servers: "Servers & P2P", mods: "Mods", hud: "HUD Design Studio", profiles: "Profiles", keybinds: "Keybinds", cosmetics: "Cosmetics", themes: "Themes", changelog: "Changelog", settings: "Preferences", library: "Instances", client: "Profiles", livepanel: "Profiles" };
const SEARCH: Record<string, string> = { mods: "Search mods…", instances: "Search instances…", servers: "Search servers…" };

function useHash() {
  const [h, setH] = useState(location.hash.slice(2) || "home");
  useEffect(() => { const f = () => setH(location.hash.slice(2) || "home"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return [h, (r: string) => { location.hash = "/" + r; }] as const;
}
export type Boot = { version: string; setupDone: boolean; account: any; instances: Inst[] };

export default function App() {
  const [route, go] = useHash();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [step, setStep] = useState(1);
  const [q, setQ] = useState(""), [acct, setAcct] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const s = useSettings(); const locker = useLocker(); const accounts = useAccounts(boot?.account?.username);
  const t0 = useRef(performance.now());
  useEffect(() => {
    bootstrap().then((b: any) => { setBoot(b); (window as any).__bootMs = performance.now() - t0.current; if (!b.setupDone && !route.startsWith("onboarding")) go("onboarding/1"); }).catch(() => setBoot({ version: "0.9.0", setupDone: true, account: {}, instances: [] }));
    if (isTauri) call("app_ready").catch(() => {});
  }, []);
  useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); search.current?.focus(); } }; addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, []);
  useEffect(() => { setQ(""); }, [route.split("/")[0]]);
  if (!boot) return <div className="h-full" style={{ background: "var(--bg)" }} />;

  if (route.startsWith("onboarding")) return <Onboarding step={Number(route.split("/")[1]) || step} setStep={(n) => { setStep(n); go("onboarding/" + n); }} done={(name) => { setBoot({ ...boot, setupDone: true, account: { ...boot.account, username: name } }); go("home"); }} />;
  const page = route.split("/")[0];
  const nav = (r: string) => go(r);
  const active = accounts.list.find((a) => a.id === accounts.active) || accounts.list[0];
  const inst = boot.instances[0];
  const full = page === "hud";
  return (
    <div className="h-full flex" style={{ background: "var(--bg)" }}>
      <nav className="side w-[220px] shrink-0 flex flex-col" aria-label="Main">
        <div className="px-5 pt-5 pb-2 wordmark">LUMINOS</div>
        <div className="flex-1 overflow-y-auto pb-2">
          {GROUPS.map(([label, items]) => (
            <div key={label} className="nav-group">
              <div className="eyebrow nav-label">{label}</div>
              {items.map(([id, name, ic]) => (
                <button key={id} className="nav-row" aria-current={(page === id || (id === "instances" && page === "library") || (id === "profiles" && (page === "client" || page === "livepanel"))) ? "page" : undefined} onClick={() => nav(id)}><Icon n={ic} s={16} />{name}</button>
              ))}
            </div>
          ))}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1">
            <button className="flex-1 min-w-0 flex items-center gap-2.5 p-1.5 rounded-lg text-left hover:bg-[var(--surface-2)]" onClick={() => setAcct(true)} aria-label={`Account: ${active.name}. Switch account`}>
              <span className="w-9 h-9 rounded-lg overflow-hidden grid place-items-center shrink-0 panel-2"><SkinThumb src={skinSrc(skinById(locker.skin))} scale={3} bust className="!w-9 !h-9" /></span>
              <span className="min-w-0 flex-1 leading-tight"><span className="flex items-center gap-1.5"><span className="t2 font-semibold truncate">{active.name}</span></span><span className="t1 mute block truncate num">{active.kind.toLowerCase()} · {inst ? `${inst.loader} ${inst.mc}` : "no instance"}</span></span>
            </button>
            <button className="ibtn relative" aria-label="Notifications" onClick={() => nav("changelog")}><Icon n="bell" s={16} /><span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-text)" }} /></button>
          </div>
        </div>
      </nav>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="topbar">
          <button className="ibtn" aria-label="Back" onClick={() => history.back()}><Icon n="back" s={16} /></button>
          <button className="ibtn" aria-label="Forward" onClick={() => history.forward()}><Icon n="fwd" s={16} /></button>
          <h1 className="t4 font-bold m-0 ml-1">{TITLE[page] || "Home"}</h1>
          <div className="flex-1" />
          {SEARCH[page] && <div className="relative w-[280px]"><Icon n="search" s={14} className="absolute left-3 top-[10px] mute" /><input ref={search} className="field" placeholder={SEARCH[page]} aria-label={SEARCH[page]} value={q} onChange={(e) => setQ(e.target.value)} /><kbd className="absolute right-2 top-[8px] t1 mute px-1.5 rounded" style={{ background: "var(--surface-2)" }}>Ctrl K</kbd></div>}
        </header>
        <main className={`flex-1 min-h-0 ${full ? "overflow-hidden" : "overflow-y-auto"}`} key={page}>
          <div className={`rise ${full ? "h-full" : "pb-4"}`}>
            {page === "home" && <Home boot={boot} go={nav} />}
            {(page === "instances" || page === "library") && <InstancesPage boot={boot} go={nav} q={q} initial={page === "library" ? "Browse" : "Profiles"} />}
            {page === "cosmetics" && <Cosmetics boot={boot} q={q} setQ={setQ} />}
            {page === "servers" && <div className="px-6"><Servers /></div>}
            {page === "mods" && <Mods q={q} setQ={setQ} />}
            {page === "hud" && <HudStudio />}
            {(page === "profiles" || page === "client" || page === "livepanel") && <Profiles go={nav} />}
            {page === "keybinds" && <Keybinds />}
            {page === "themes" && <Themes q={q} />}
            {page === "changelog" && <Changelog />}
            {page === "settings" && <div className="px-6"><Settings boot={boot} /></div>}
          </div>
        </main>
      </div>
      {acct && <AccountSwitcher boot={boot} onClose={() => setAcct(false)} />}
    </div>
  );
}
