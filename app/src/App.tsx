import { useEffect, useRef, useState } from "react";
import { bootstrap, call, Inst, isTauri } from "./api";
import { Icon, Sky, Slider, Switch, SkinThumb } from "./kit";
import { set, useSettings } from "./store";
import Home from "./screens/Home";
import Instances from "./screens/Instances";
import Library from "./screens/Library";
import Cosmetics from "./screens/Cosmetics";
import Servers from "./screens/Servers";
import ClientPage from "./screens/Client";
import Settings from "./screens/Settings";
import Onboarding from "./screens/Onboarding";

const TABS: [string, string, string][] = [["home", "Home", "home"], ["instances", "Instances", "layers"], ["library", "Library", "puzzle"], ["cosmetics", "Cosmetics", "shirt"], ["servers", "Servers", "globe"], ["client", "Client", "sliders"]];
function useHash() {
  const [h, setH] = useState(location.hash.slice(2) || "home");
  useEffect(() => { const f = () => setH(location.hash.slice(2) || "home"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return [h, (r: string) => { location.hash = "/" + r; }] as const;
}
export type Boot = { version: string; setupDone: boolean; account: any; instances: Inst[] };

function GlassPopover({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  useEffect(() => { const f = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-glasspop]")) onClose(); }; addEventListener("mousedown", f); return () => removeEventListener("mousedown", f); }, [onClose]);
  return (
    <div data-glasspop className="glass rise absolute right-0 top-9 w-[280px] p-3 z-40" style={{ borderRadius: 12 }}>
      <div className="eyebrow mb-2">Glass</div>
      <div className="flex items-center justify-between gap-3 min-h-[32px]"><span className="t2">Intensity</span><Slider label="Glass intensity" value={s.glass} min={0} max={100} onChange={(v) => set("glass", v)} fmt={(v) => `${v}%`} /></div>
      <div className="flex items-center justify-between min-h-[32px]"><span><span className="t2 block">Solid panels</span><span className="t1 mute">No blur. Best for low-end GPUs.</span></span><Switch label="Solid panels" on={s.solid} onChange={(v) => set("solid", v)} /></div>
      <div className="flex items-center justify-between min-h-[32px]"><span className="t2">Reduce motion</span><Switch label="Reduce motion" on={s.reduceMotion} onChange={(v) => set("reduceMotion", v)} /></div>
    </div>
  );
}

export default function App() {
  const [route, go] = useHash();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [step, setStep] = useState(1);
  const [pop, setPop] = useState(false);
  const s = useSettings();
  const t0 = useRef(performance.now());
  useEffect(() => {
    bootstrap().then((b: any) => { setBoot(b); (window as any).__bootMs = performance.now() - t0.current; if (!b.setupDone && !route.startsWith("onboarding")) go("onboarding/1"); }).catch(() => setBoot({ version: "0.9.0", setupDone: true, account: {}, instances: [] }));
    if (isTauri) call("app_ready").catch(() => {});
  }, []);
  if (!boot) return <div className="h-full" style={{ background: "#050a1f" }} />;
  if (route.startsWith("onboarding")) return <Onboarding step={Number(route.split("/")[1]) || step} setStep={(n) => { setStep(n); go("onboarding/" + n); }} done={(name) => { setBoot({ ...boot, setupDone: true, account: { ...boot.account, username: name } }); go("home"); }} />;
  const page = route.split("/")[0];
  const nav = (r: string) => go(r);
  return (
    <div className="h-full relative overflow-hidden">
      <div className="absolute inset-0"><Sky tone={2} animate={s.animatedSky && !s.reduceMotion} /></div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(2,4,13,.62), rgba(2,4,13,.5))" }} />
      <div className="relative h-full flex">
        <nav className="w-[60px] shrink-0 flex flex-col items-center py-3 gap-1" aria-label="Main" style={{ borderRight: "1px solid var(--color-line)", background: "rgba(2,4,13,.35)" }}>
          <img src="/luminos.png" alt="Luminos" className="h-7 w-7 rounded-lg mb-3" />
          {TABS.map(([id, label, ic]) => (
            <button key={id} title={label} aria-label={label} aria-current={page === id} onClick={() => nav(id)} className="ibtn !w-10 !h-10 relative" style={page === id ? { color: "#fff", background: "rgba(143,180,255,.16)", borderColor: "rgba(143,180,255,.4)" } : undefined}>
              <Icon n={ic} s={18} />{page === id && <span className="absolute -left-[10px] top-2.5 h-5 w-[3px] rounded-r bg-[var(--color-accent)]" />}
            </button>
          ))}
          <div className="flex-1" />
          <button title="Settings" aria-label="Settings" aria-current={page === "settings"} onClick={() => nav("settings")} className="ibtn !w-10 !h-10" style={page === "settings" ? { color: "#fff", background: "rgba(143,180,255,.16)", borderColor: "rgba(143,180,255,.4)" } : undefined}><Icon n="gear" s={18} /></button>
        </nav>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-[44px] shrink-0 flex items-center gap-3 px-5">
            <div className="t3 font-semibold capitalize">{page === "client" ? "Client" : page}</div>
            <div className="flex-1" />
            <span className="badge ok"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />Engine ready</span>
            <div className="relative" data-glasspop>
              <button className="btn" aria-label="Glass settings" onClick={() => setPop((p) => !p)}><Icon n="eye" s={14} />Glass {s.solid ? "off" : `${s.glass}%`}</button>
              {pop && <GlassPopover onClose={() => setPop(false)} />}
            </div>
            <button className="flex items-center gap-2 h-8 pl-1 pr-3 rounded-lg glass lift" style={{ borderRadius: 10 }} onClick={() => nav("cosmetics")} aria-label="Account and skin">
              <span className="w-6 h-6 rounded-md overflow-hidden grid place-items-center bg-ink-2"><SkinThumb src="/library/skins/vanguard.png" scale={3} bust className="!w-6 !h-6" /></span>
              <span className="t2 font-medium">{boot.account.username || "Player"}</span><span className="badge">{boot.account.kind || "Offline"}</span>
            </button>
          </header>
          <main className="flex-1 min-h-0 overflow-y-auto px-5 pb-5" key={page}>
            <div className="rise">
              {page === "home" && <Home boot={boot} go={nav} />}
              {page === "instances" && <Instances boot={boot} go={nav} />}
              {page === "library" && <Library boot={boot} />}
              {page === "cosmetics" && <Cosmetics boot={boot} />}
              {page === "servers" && <Servers />}
              {page === "client" && <ClientPage />}
              {page === "settings" && <Settings boot={boot} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
