import { useEffect, useState } from "react";
import { bootstrap, Inst, isTauri } from "./api";
import { Icon, Sky } from "./ui";
import Home from "./screens/Home";
import Instances from "./screens/Instances";
import Mods from "./screens/Mods";
import Skins from "./screens/Skins";
import Servers from "./screens/Servers";
import Client from "./screens/Client";
import Settings from "./screens/Settings";
import Onboarding from "./screens/Onboarding";

const TABS: [string, string, string][] = [["home", "Home", "home"], ["instances", "Instances", "layers"], ["mods", "Mods", "puzzle"], ["skins", "Skins", "shirt"], ["servers", "Servers", "globe"], ["client", "Client", "sliders"]];
function useHash() {
  const [h, setH] = useState(location.hash.slice(2) || "home");
  useEffect(() => { const f = () => setH(location.hash.slice(2) || "home"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return [h, (r: string) => { location.hash = "/" + r; }] as const;
}
function Win() {
  if (!isTauri) return null;
  const act = async (a: "minimize" | "toggleMaximize" | "close") => { const { getCurrentWindow } = await import("@tauri-apps/api/window"); (getCurrentWindow() as any)[a](); };
  return <div className="flex h-full">{[["minimize", "min"], ["toggleMaximize", "max"], ["close", "x"]].map(([a, i]) => <button key={a} onClick={() => act(a as any)} className="w-11 grid place-items-center text-mute hover:text-fg hover:bg-white/10 transition-colors" aria-label={a} style={a === "close" ? undefined : undefined}><Icon n={i} s={14} /></button>)}</div>;
}
export default function App() {
  const [route, nav] = useHash();
  const [boot, setBoot] = useState<any>(null); const [insts, setInsts] = useState<Inst[]>([]); const [sel, setSel] = useState(""); const [beta, setBeta] = useState(false);
  const q = new URLSearchParams(location.search);
  useEffect(() => { bootstrap().then((b) => { setBoot(b); setInsts(b.instances); setSel(b.instances[0]?.id || ""); setBeta(!!b.settings?.allow_beta_mods); if (!b.setupDone && !route.startsWith("onboarding")) nav("onboarding/1"); }); }, []);
  if (!boot) return <div className="h-full grid place-items-center"><div className="skeleton h-3 w-40 rounded-full" /></div>;
  const [page, sub] = route.split("/");
  if (page === "onboarding") return <Onboarding step={Number(sub) || 1} setStep={(n) => nav("onboarding/" + n)} done={() => nav("home")} />;
  const cur = insts.find((i) => i.id === sel) || insts[0];
  const body = { home: <Home insts={insts} sel={sel} setSel={setSel} nav={nav} demo={q.get("demo") || undefined} />, instances: <Instances insts={insts} setSel={setSel} nav={nav} />, mods: <Mods mc={cur?.mc || "26.3"} allowBeta={beta} />, skins: <Skins />, servers: <Servers account={boot.account} />, client: <Client mc={cur?.mc || "26.3"} />, settings: <Settings settings={boot.settings} beta={beta} setBeta={setBeta} /> }[page] || null;
  return (
    <div className="h-full flex flex-col relative bg-ink-1">
      <div data-tauri-drag-region className="h-10 shrink-0 flex items-center justify-between pl-4 border-b border-line/60 bg-ink-0/60 z-20">
        <div data-tauri-drag-region className="flex items-center gap-2 text-[12.5px] text-mute"><img src="/luminos.png" className="h-4 w-4 rounded" alt="" />Luminos <span className="num opacity-60">{boot.version}</span></div><Win />
      </div>
      <header className="h-16 shrink-0 flex items-center gap-2 px-8 relative z-10 border-b border-line/60" style={{ background: "linear-gradient(180deg, rgba(10,20,51,.85), rgba(5,10,31,.9))" }}>
        <nav className="flex gap-1" aria-label="Main">{TABS.map(([r, l, ic]) => <button key={r} onClick={() => nav(r)} className="relative h-10 px-4 rounded-full flex items-center gap-2 text-[14px] font-medium transition-colors" style={{ color: page === r ? "#fff" : "var(--color-mute)", background: page === r ? "rgba(143,180,255,.14)" : "transparent", transitionDuration: "var(--dur-fast)" }}><Icon n={ic} s={16} />{l}{page === r && <span className="absolute left-1/2 -bottom-[13px] h-[2px] w-6 -translate-x-1/2 rounded-full bg-accent" style={{ boxShadow: "0 0 12px var(--color-accent)" }} />}</button>)}</nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => nav("settings")} className="h-10 w-10 grid place-items-center rounded-full text-mute hover:text-fg hover:bg-white/10 transition-colors" aria-label="Settings" style={{ color: page === "settings" ? "#fff" : undefined }}><Icon n="gear" s={18} /></button>
          <button onClick={() => nav("skins")} className="h-10 pl-1.5 pr-4 rounded-full flex items-center gap-2.5 hair bg-ink-2/60 hover:bg-ink-3/60 transition-colors"><span className="h-7 w-7 rounded-md" style={{ backgroundImage: "url(/skins/luminos-pilot.png)", backgroundSize: "224px 224px", backgroundPosition: "-28px -28px", imageRendering: "pixelated" }} /><span className="text-[13.5px] font-medium">{boot.account?.username || "Player"}</span><span className="text-[11px] text-mute">{boot.account?.kind || "Offline"}</span></button>
        </div>
      </header>
      <main key={page} className="flex-1 min-h-0 relative">{page === "home" ? null : <div className="absolute inset-0 -z-0 opacity-[.28] pointer-events-none"><Sky animate={false} tone={TABS.findIndex((t) => t[0] === page) + 1} /></div>}<div className="relative h-full">{body}</div></main>
    </div>
  );
}
