import { useEffect, useRef, useState } from "react";
import { bootstrap, call, Inst, isTauri } from "./api";
import { Icon, SkinThumb } from "./kit";
import { exportTheme, parseTheme, THEMES } from "./theme";
import { skinById, skinSrc, useLocker } from "./locker/catalog";
import { saveCustomTheme, set, useSettings } from "./store";
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

function ThemePopover({ onClose }: { onClose: () => void }) {
  const s = useSettings(); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => { const f = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-themepop]")) onClose(); }; addEventListener("mousedown", f); return () => removeEventListener("mousedown", f); }, [onClose]);
  const exp = () => { const cur = THEMES.find((x) => x.id === s.theme)?.name || "Custom"; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportTheme(cur)], { type: "application/json" })); a.download = `luminos-theme-${cur.toLowerCase()}.json`; a.click(); setMsg({ ok: true, t: "Saved the theme file." }); };
  const imp = async (f?: File | null) => { if (!f) return; const r = parseTheme(await f.text()); if ("error" in r) { setMsg({ ok: false, t: r.error }); return; } saveCustomTheme(r.theme); set("theme", "custom"); setMsg({ ok: true, t: `Applied “${r.theme.name}”.` }); };
  const sw = (id: string) => { const m: Record<string, string[]> = { default: ["#17181b", "#1f2024", "#4cc38a"], lunar: ["#080b15", "#0e1322", "#7ba8ff"], light: ["#e9ebef", "#ffffff", "#1a56c4"] }; return m[id]; };
  return (
    <div data-themepop role="dialog" aria-label="Theme" className="panel pop absolute right-0 top-9 w-[300px] p-3 z-40">
      <div className="eyebrow mb-2">Theme</div>
      <div className="flex flex-col gap-1.5">
        {THEMES.map((t) => <button key={t.id} aria-pressed={s.theme === t.id} onClick={() => set("theme", t.id)} className="lrow !min-h-[38px] text-left" style={{ background: s.theme === t.id ? "var(--accent-soft)" : undefined, borderColor: s.theme === t.id ? "var(--accent)" : "var(--line)" }}>
          <span className="flex h-5 w-12 rounded overflow-hidden" style={{ border: "1px solid var(--line-strong)" }}>{sw(t.id).map((c) => <i key={c} className="flex-1" style={{ background: c }} />)}</span>
          <span className="flex-1"><span className="t2 font-medium block">{t.name}</span><span className="t1 mute block">{t.note}</span></span>{s.theme === t.id && <Icon n="check" s={14} />}
        </button>)}
        {s.theme === "custom" && <div className="lrow !min-h-[32px]" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}><span className="t2 font-medium flex-1">Imported theme</span><Icon n="check" s={14} /></div>}
      </div>
      <div className="flex gap-1.5 mt-3"><button className="btn flex-1" onClick={exp}><Icon n="download" s={13} />Export</button><label className="btn flex-1 cursor-pointer"><Icon n="upload" s={13} />Import<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { imp(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
      <div className="t1 mute mt-2 leading-snug">A theme changes colours only. Text must reach 4.5:1 or the file is refused.</div>
      {msg && <div role="status" className="t1 mt-1.5" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</div>}
    </div>
  );
}

export default function App() {
  const [route, go] = useHash();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [step, setStep] = useState(1);
  const [pop, setPop] = useState(false);
  const s = useSettings(); const locker = useLocker();
  const t0 = useRef(performance.now());
  useEffect(() => {
    bootstrap().then((b: any) => { setBoot(b); (window as any).__bootMs = performance.now() - t0.current; if (!b.setupDone && !route.startsWith("onboarding")) go("onboarding/1"); }).catch(() => setBoot({ version: "0.9.0", setupDone: true, account: {}, instances: [] }));
    if (isTauri) call("app_ready").catch(() => {});
  }, []);
  if (!boot) return <div className="h-full" style={{ background: "var(--bg)" }} />;
  if (route.startsWith("onboarding")) return <Onboarding step={Number(route.split("/")[1]) || step} setStep={(n) => { setStep(n); go("onboarding/" + n); }} done={(name) => { setBoot({ ...boot, setupDone: true, account: { ...boot.account, username: name } }); go("home"); }} />;
  const page = route.split("/")[0];
  const nav = (r: string) => go(r);
  return (
    <div className="h-full relative overflow-hidden">
      <div className="relative h-full flex">
        <nav className="w-[60px] shrink-0 flex flex-col items-center py-3 gap-1" aria-label="Main" style={{ borderRight: "1px solid var(--line)", background: "var(--surface)" }}>
          <img src="/luminos.png" alt="Luminos" className="h-7 w-7 rounded-lg mb-3" />
          {TABS.map(([id, label, ic]) => (
            <button key={id} title={label} aria-label={label} aria-current={page === id} onClick={() => nav(id)} className="ibtn !w-10 !h-10 relative">
              <Icon n={ic} s={18} />{page === id && <span className="absolute -left-[10px] top-2.5 h-5 w-[3px] rounded-r bg-[var(--accent)]" />}
            </button>
          ))}
          <div className="flex-1" />
          <button title="Settings" aria-label="Settings" aria-current={page === "settings"} onClick={() => nav("settings")} className="ibtn !w-10 !h-10"><Icon n="gear" s={18} /></button>
        </nav>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-[44px] shrink-0 flex items-center gap-3 px-5">
            <div className="t3 font-semibold capitalize">{page === "client" ? "Client" : page}</div>
            <div className="flex-1" />
            <span className="badge ok"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />Engine ready</span>
            <div className="relative" data-themepop>
              <button className="btn" aria-label="Theme" onClick={() => setPop((p) => !p)}><Icon n="eye" s={14} />Theme</button>
              {pop && <ThemePopover onClose={() => setPop(false)} />}
            </div>
            <button className="flex items-center gap-2 h-8 pl-1 pr-3 rounded-md panel lift" onClick={() => nav("cosmetics")} aria-label="Account and skin">
              <span className="w-6 h-6 rounded-md overflow-hidden grid place-items-center "><SkinThumb src={skinSrc(skinById(locker.skin))} scale={3} bust className="!w-6 !h-6" /></span>
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
