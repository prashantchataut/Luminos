import { useEffect, useRef, useState } from "react";
import { bootstrap, call, Inst, isTauri } from "./api";
import { Icon, SkinThumb } from "./kit";
import { THEMES, allThemes } from "./themes";
import { loadSkins, ORIGINALS, srcOf } from "./skinio";
import Skins from "./screens/Skins";
import Locker from "./screens/Locker";
import { set, useSettings } from "./store";
import Home from "./screens/Home";
import Instances from "./screens/Instances";
import Library from "./screens/Library";
import Servers from "./screens/Servers";
import ClientPage from "./screens/Client";
import Settings from "./screens/Settings";
import Onboarding from "./screens/Onboarding";

const TABS: [string, string, string][] = [["home", "Home", "home"], ["instances", "Instances", "layers"], ["library", "Library", "puzzle"], ["skins", "Skins", "shirt"], ["locker", "Locker", "wings"], ["servers", "Servers", "globe"], ["client", "Client", "sliders"]];
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
  const s = useSettings();
  const t0 = useRef(performance.now());
  useEffect(() => {
    bootstrap().then((b: any) => { setBoot(b); (window as any).__bootMs = performance.now() - t0.current; if (!b.setupDone && !route.startsWith("onboarding")) go("onboarding/1"); }).catch(() => setBoot({ version: "0.9.0", setupDone: true, account: {}, instances: [] }));
    if (isTauri) call("app_ready").catch(() => {});
  }, []);
  if (!boot) return <div className="h-full" style={{ background: "var(--bg)" }} />;
  if (route.startsWith("onboarding")) return <Onboarding step={Number(route.split("/")[1]) || step} setStep={(n) => { setStep(n); go("onboarding/" + n); }} done={(name) => { setBoot({ ...boot, setupDone: true, account: { ...boot.account, username: name } }); go("home"); }} />;
  const page = route.split("/")[0];
  const nav = (r: string) => go(r);
  const activeSkin = (() => { const st = loadSkins(); return [...ORIGINALS, ...st.mine].find((x) => x.id === st.active) || ORIGINALS[0]; })();
  return (
    <div className="h-full relative overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="relative h-full flex">
        <nav className="w-[60px] shrink-0 flex flex-col items-center py-3 gap-1" aria-label="Main" style={{ borderRight: "1px solid var(--color-line)", background: "var(--surface)" }}>
          <img src="/luminos.png" alt="Luminos" className="h-7 w-7 rounded-lg mb-3" />
          {TABS.map(([id, label, ic]) => (
            <button key={id} title={label} aria-label={label} aria-current={page === id} onClick={() => nav(id)} className="ibtn !w-10 !h-10 relative" >
              <Icon n={ic} s={18} />{page === id && <span className="absolute -left-[10px] top-2.5 h-5 w-[3px] rounded-r bg-[var(--color-accent)]" />}
            </button>
          ))}
          <div className="flex-1" />
          <button title="Settings" aria-label="Settings" aria-current={page === "settings"} onClick={() => nav("settings")} className="ibtn !w-10 !h-10" ><Icon n="gear" s={18} /></button>
        </nav>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-[44px] shrink-0 flex items-center gap-3 px-5">
            <div className="t3 font-semibold capitalize">{page === "client" ? "Client" : page}</div>
            <div className="flex-1" />
            <span className="badge ok"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />Engine ready</span>
            <div className="seg" role="group" aria-label="Theme">{THEMES.map((t) => <button key={t.id} aria-pressed={s.theme === t.id} onClick={() => set("theme", t.id)}>{t.name}</button>)}{allThemes().filter((t) => t.id.startsWith("custom-")).map((t) => <button key={t.id} aria-pressed={s.theme === t.id} onClick={() => set("theme", t.id)}>{t.name}</button>)}</div>
            <button className="flex items-center gap-2 h-8 pl-1 pr-3 rounded-lg panel lift" style={{ borderRadius: 10 }} onClick={() => nav("skins")} aria-label="Account and skin">
              <span className="w-6 h-6 rounded-md overflow-hidden grid place-items-center "><SkinThumb src={srcOf(activeSkin)} scale={3} bust className="!w-6 !h-6" /></span>
              <span className="t2 font-medium">{boot.account.username || "Player"}</span><span className="badge">{boot.account.kind || "Offline"}</span>
            </button>
          </header>
          <main className="flex-1 min-h-0 overflow-y-auto px-5 pb-5" key={page}>
            <div className="rise">
              {page === "home" && <Home boot={boot} go={nav} />}
              {page === "instances" && <Instances boot={boot} go={nav} />}
              {page === "library" && <Library boot={boot} />}
              {(page === "skins" || page === "cosmetics") && <Skins boot={boot} />}
              {page === "locker" && <Locker boot={boot} />}
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
