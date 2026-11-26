import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { bootstrap, type Inst } from "./api";
import { safeInvoke } from "./lib/tauri-bridge";
import ErrorBoundary from "./lib/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import AccountModal, { useAccounts } from "./components/AccountModal";
import { skinById, skinSrc, useLocker } from "./locker/catalog";
import { useSettings } from "./store";
import { startGameWatch } from "./state/game";
import Home from "./screens/Home";
import Mods from "./screens/Mods";
import Keybinds from "./screens/Keybinds";
import Preferences from "./screens/Preferences";
import Themes from "./screens/Themes";
import Profiles from "./screens/Profiles";
import HudStudio from "./screens/HudStudio";

// The only screen that owns a WebGL context. Loaded on demand, unmounted (and its context released) on leaving.
const Cosmetics = lazy(() => import("./screens/Cosmetics"));

export type Boot = { version: string; setupDone: boolean; account: { username?: string }; instances: Inst[] };
const ROUTES = ["home", "hud", "mods", "keybinds", "profiles", "cosmetics", "themes", "preferences"] as const;

function useRoute() {
  const read = () => { const r = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0]; return r === "settings" ? "preferences" : (ROUTES as readonly string[]).includes(r) ? r : "home"; };
  const [r, setR] = useState(read);
  useEffect(() => { const f = () => setR(read()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return [r, useCallback((to: string) => { location.hash = "/" + to; }, [])] as const;
}

export default function App() {
  const [page, go] = useRoute();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [acct, setAcct] = useState(false);
  const locker = useLocker();
  const s = useSettings();
  const accounts = useAccounts(boot?.account?.username);

  useEffect(() => {
    bootstrap()
      .then((b: any) => { setBoot(b); if (!b.setupDone) setAcct(true); })
      .catch(() => setBoot({ version: "2.1.0", setupDone: true, account: {}, instances: [] }));
  }, []);
  useEffect(() => { if (boot) requestAnimationFrame(() => requestAnimationFrame(() => { void safeInvoke("app_ready", {}, null); })); }, [boot !== null]);
  useEffect(() => { void startGameWatch(); }, []);
  useEffect(() => { document.documentElement.classList.toggle("reduce", s.reduceMotion); }, [s.reduceMotion]);
  const closeAccount = useCallback(() => { setAcct(false); void safeInvoke("set_setting", { key: "setup_done", value: true }, null); }, []);

  if (!boot) return <div className="w-screen h-screen" style={{ background: "var(--bg)" }} />;
  const inst = boot.instances[0];
  const version = inst?.mc ?? "1.21.4";

  return (
    <div className="w-screen h-screen overflow-hidden flex select-none antialiased" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <Sidebar page={page} go={go} name={accounts.current.name} skin={skinSrc(skinById(locker.skin))} version={version} onAccount={() => setAcct(true)} />
      <main className="flex-1 min-w-0 min-h-0" key={page}>
        <div className="h-full min-h-0 screen">
          <ErrorBoundary label={page} resetKey={page}>
            <Suspense fallback={null}>
              {page === "home" && <Home boot={boot} go={go} />}
              {page === "hud" && <HudStudio />}
              {page === "mods" && <Mods />}
              {page === "keybinds" && <Keybinds />}
              {page === "profiles" && <Profiles go={go} />}
              {page === "cosmetics" && <Cosmetics />}
              {page === "themes" && <Themes />}
              {page === "preferences" && <Preferences />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      {acct && <AccountModal onClose={closeAccount} />}
    </div>
  );
}
