import { memo, useCallback, useEffect, useRef, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { Modal } from "../components/ui";
import { LaunchProgressPanel } from "../components/LaunchProgress";
import { MODULES } from "../data/modules";
import { useClient, writeGameConfigNow } from "../state/client";
import { PresetSelect, VersionSelect, WindowModeToggle } from "../components/LaunchSelectors";
import { APP_VERSION } from "../components/UpdateBanner";
import { markIdle, markPreparing, notify, stopGame, useGame } from "../state/game";
import { isTauri, safeInvoke } from "../lib/tauri-bridge";
import type { Boot } from "../App";

/** What is really on this PC: worlds from saves/ (level.dat + icon.png) and servers from servers.dat. */
type World = { name: string; folder: string; path: string; last_played: number; game_mode: string; hardcore: boolean; version?: string | null; icon?: string | null; source: string; source_dir: string; instance_id?: string | null };
type Server = { name: string; ip: string; icon?: string | null; source: string };
type Local = { worlds: World[]; servers: Server[]; minecraft_dir?: string | null; minecraft_dir_exists?: boolean };
type Target = { label: string; quick?: string; worldPath?: string; instanceId?: string | null };

const EMPTY: Local = { worlds: [], servers: [] };
/** Screenshot-only sample data. It is reachable only with ?demo=1 in a plain browser, never inside the desktop app. */
const DEMO: Local = {
  worlds: [{ name: "Sample world (demo)", folder: "sample", path: "", last_played: 0, game_mode: "Survival", hardcore: false, source: "demo", source_dir: "" }],
  servers: [{ name: "Sample server (demo)", ip: "play.example.net", source: "demo" }],
};
const demoMode = () => !isTauri() && typeof location !== "undefined" && location.search.includes("demo=1");

function ago(ms: number) {
  if (!ms) return "Never played";
  const d = Date.now() - ms, m = Math.round(d / 60000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  const days = Math.round(m / 1440);
  return days < 30 ? `${days} day${days === 1 ? "" : "s"} ago` : new Date(ms).toLocaleDateString();
}
// A procedural voxel-biome tile for worlds that have no icon.png yet. Deterministic per name.
function biome(seed: string) {
  let h = 7; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `linear-gradient(180deg, hsl(${hue} 55% 38%) 0 46%, hsl(${(hue + 30) % 360} 40% 24%) 46% 100%), repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 12px, transparent 12px 24px)`;
}

const QCard = memo(function QCard({ title, sub, tag, icon, seed, onPlay }: { title: string; sub: string; tag: string; icon?: string | null; seed: string; onPlay: () => void }) {
  return (
    <button onClick={onPlay} aria-label={`Play ${title}`} className="group card h-[184px] rounded-[14px] overflow-hidden flex flex-col justify-between text-left">
      <div className="relative h-[124px] w-full overflow-hidden" style={icon ? undefined : { background: biome(seed), backgroundBlendMode: "multiply" }}>
        {icon && <img src={icon} alt="" decoding="async" className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />}
        <span className="absolute top-3 right-3 h-6 px-2.5 rounded-full text-[11px] font-medium grid place-items-center" style={{ background: "rgba(11,13,18,.72)", color: "#E2E8F0" }}>{tag}</span>
      </div>
      <div className="h-[60px] px-5 flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="text-[14px] font-semibold truncate">{title}</div><div className="text-[12px] truncate mute">{sub}</div></div>
        <span className="grid place-items-center h-[34px] px-3 gap-1.5 rounded-[8px] shrink-0 t text-[12px] font-semibold flex-row group-hover:!bg-[var(--accent)] group-hover:!text-[var(--accent-fg)]" style={{ background: "var(--surface-2)" }}><Icon n="play" s={11} fill />Play</span>
      </div>
    </button>
  );
});

/** The red button shown while Minecraft is starting or running. Kills the game and restores Launch Game at once. */
export function StopGameButton({ compact = false }: { compact?: boolean }) {
  const g = useGame();
  if (g.status === "idle") return null;
  const running = g.status === "running";
  return (
    <button onClick={() => void stopGame()} aria-label={running ? "Quit Game: close Minecraft now" : "Cancel launch"}
      className={`${compact ? "h-9 px-4 text-[12.5px] w-full justify-center" : "h-[46px] px-6 text-[14px]"} rounded-[10px] bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold flex items-center gap-2 t press`}>
      <span aria-hidden className="block w-[10px] h-[10px] rounded-[2px] bg-white" />{running ? "Quit Game" : "Cancel"}
    </button>
  );
}

export default function Home({ boot, go }: { boot: Boot; go: (r: string) => void }) {
  const c = useClient(), g = useGame();
  const [host, setHost] = useState(false), [addOpen, setAddOpen] = useState(false), [toast, setToast] = useState("");
  const [local, setLocal] = useState<Local>(EMPTY), [scanned, setScanned] = useState(false), [scanning, setScanning] = useState(false);
  const [sName, setSName] = useState(""), [sIp, setSIp] = useState(""), [sErr, setSErr] = useState("");

  const refresh = useCallback(async () => {
    setScanning(true);
    if (demoMode()) { setLocal(DEMO); setScanned(true); setScanning(false); return; }
    const r = await safeInvoke<Local | null>("scan_local_worlds_and_servers", {}, null, 8000);
    setLocal(r ?? EMPTY); setScanned(true); setScanning(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (g.status === "idle") void refresh(); }, [g.status === "idle"]); // a session may have created worlds
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 4200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (g.message) setToast(g.message); }, [g.msgSeq]);

  const launch = async (t?: Target) => {
    if (g.status !== "idle") return;
    if (!isTauri()) { setToast("Launching runs in the desktop app."); return; }
    markPreparing();
    await writeGameConfigNow(); // the game starts with exactly the modules and keys shown in the launcher
    // The instance must be Fabric AND the exact Minecraft version selected in the launch bar; otherwise one is created for it.
    const want = c.prefs.gameVersion;
    let id = t?.instanceId ?? boot.instances.find((i) => i.loader === "Fabric" && i.mc === want)?.id;
    if (!id) {
      setToast(`Setting up Luminos for Minecraft ${want}…`);
      const made = await safeInvoke<{ instance?: { id: string } } | null>("create_instance", { name: `Luminos ${want}`, mc: want, withPreset: true }, null, 180000);
      id = made?.instance?.id;
      if (!id) { markIdle(); setToast("Could not create a Luminos instance. Check your connection and try again."); return; }
    }
    const r = await safeInvoke<unknown>("launch_instance", { id, quick: t?.quick ?? null, worldPath: t?.worldPath ?? null, mcVersion: t?.instanceId ? null : want, enginePreset: c.prefs.enginePreset, windowMode: c.prefs.windowMode }, "__failed__", 20000);
    if (r === "__failed__") { markIdle(); notify("Minecraft did not start. If it is already running, use Stop Game first."); return; }
    setToast(t ? `Starting ${t.label}…` : "Starting Minecraft…");
  };
  const playWorld = (w: World) => void launch({ label: w.name, quick: `world:${w.folder}`, instanceId: w.instance_id ?? undefined, worldPath: w.instance_id ? undefined : w.path });
  const playServer = (s: Server) => void launch({ label: s.name, quick: s.ip });
  const addServer = async () => {
    setSErr("");
    if (!sIp.trim()) { setSErr("Enter a server address, for example play.example.net."); return; }
    if (!isTauri()) { setSErr("Saving a server writes servers.dat, which the desktop app does it."); return; }
    const r = await safeInvoke<boolean | "__failed__">("add_saved_server", { name: sName, ip: sIp }, "__failed__");
    if (r === "__failed__") { setSErr("Could not save it. Launch Minecraft once so its folder exists, then try again."); return; }
    setAddOpen(false); setSName(""); setSIp(""); setToast(r ? "Server saved to servers.dat." : "That server is already in your list."); void refresh();
  };
  const browse = async () => { const r = await safeInvoke<string | "__failed__">("open_minecraft_folder", {}, "__failed__"); if (r === "__failed__") setToast(isTauri() ? "The .minecraft folder does not exist yet. Launch Minecraft once and it will be created." : "Opening folders works in the desktop app."); };

  const running = g.status === "running", preparing = g.status === "preparing";
  const cards = local.worlds.length + local.servers.length;
  return (
    <Page>
      <div className="space-y-8">
        <section className="relative min-h-[300px] rounded-[16px] flex items-end justify-start px-9 py-8" style={{ background: "var(--surface)" }}>
          <div aria-hidden className="absolute inset-0 rounded-[16px] overflow-hidden">{/* only the art is clipped, so the pickers can open over the page */}
            <img src="/art/hero-blue-hour.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-right" decoding="async" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(11,13,18,0.95) 0%, rgba(11,13,18,0.65) 48%, rgba(11,13,18,0) 82%)" }} />
          </div>
          <div className="relative max-w-[840px] space-y-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase" style={{ color: "#8FA2FF" }}><span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: "#34D399" }} />Luminos Client v{APP_VERSION} · MC {c.prefs.gameVersion} · {c.prefs.enginePreset}</span>
            <h1 className="m-0 !mt-2 text-[32px] font-bold leading-tight text-white">Luminos Client <span style={{ color: "#8FA2FF" }}>{APP_VERSION.split(".").slice(0, 2).join(".")}</span></h1>
            {!preparing && <p className="m-0 !mt-2 max-w-[560px] text-[13.5px] leading-relaxed" style={{ color: "#94A3B8" }}>{MODULES.length} built-in PvP and survival modules, with the performance stack and the Luminos Asset Verifier already inside. Press Right Ctrl in game for the quick panel.</p>}
            <div className="pt-2 flex items-center gap-3 flex-wrap">
              {g.status === "idle" && (
                <button onClick={() => void launch()} className="h-[46px] px-8 rounded-[10px] text-white text-[14px] font-semibold flex items-center gap-2.5 t press" style={{ background: "#2B4BFF", boxShadow: "0 4px 20px rgba(43,75,255,0.35)" }}>
                  <span aria-hidden>▶</span>LAUNCH LUMINOS
                </button>
              )}
              {preparing && <LaunchProgressPanel />}
              {running && (
                <>
                  <span role="status" className="h-[46px] px-5 rounded-[10px] text-[14px] font-semibold flex items-center gap-2.5 text-white" style={{ background: "#16A34A" }}>
                    <span aria-hidden className="w-2 h-2 rounded-full bg-white" />In-Game (Luminos {boot.version}){g.pid ? ` • PID ${g.pid}` : ""}
                  </span>
                  <StopGameButton />
                </>
              )}
              {g.status === "idle" && <VersionSelect up={false} />}
              {g.status === "idle" && <PresetSelect up={false} />}
              {g.status === "idle" && <button onClick={() => setHost(true)} className="h-[46px] px-4 rounded-[10px] text-[13px] font-medium t hover:!text-white" style={{ background: "rgba(22,27,38,.9)", color: "#94A3B8" }}>Host World</button>}
            </div>
            {g.status === "idle" && <div className="pt-1"><WindowModeToggle /></div>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-[16px] font-semibold">Quickplay</h2>
            <div className="flex items-center gap-4">
              <button onClick={() => void refresh()} aria-label="Refresh worlds and servers" className="h-8 px-3 rounded-[8px] text-[12.5px] flex items-center gap-1.5 t hover:bg-[var(--surface)]" style={{ color: "var(--mute)" }}>
                <span aria-hidden className={scanning ? "inline-block animate-spin" : "inline-block"}>↻</span>Refresh
              </button>
              <button onClick={() => setAddOpen(true)} className="h-8 px-3 rounded-[8px] text-[12.5px] font-medium t hover:bg-[var(--surface)]" style={{ color: "var(--accent-text)" }}>+ Add Server</button>
            </div>
          </div>
          {scanned && cards === 0 ? (
            <div className="card rounded-[14px] p-8 flex items-center justify-between gap-8" data-testid="quickplay-empty">
              <div className="max-w-[560px] space-y-2">
                <h3 className="m-0 text-[16px] font-semibold">No Local Worlds or Saved Servers Yet</h3>
                <p className="m-0 text-[13px] leading-relaxed mute">Worlds created in Singleplayer (.minecraft/saves) and servers added in Multiplayer (.minecraft/servers.dat) will appear here automatically for one-click Quickplay.</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                <button onClick={() => void launch()} disabled={g.status !== "idle"} className="h-[42px] px-5 rounded-[10px] text-white text-[13px] font-semibold flex items-center gap-2 t press" style={{ background: "#2B4BFF" }}><Icon n="play" s={12} fill />Launch Minecraft</button>
                <button onClick={() => setAddOpen(true)} className="h-[42px] px-4 rounded-[10px] text-[13px] font-medium t press card">+ Add Server</button>
                <button onClick={() => void browse()} className="h-[42px] px-4 rounded-[10px] text-[13px] font-medium t press card">Browse .minecraft Folder</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {local.worlds.slice(0, 6).map((w) => <QCard key={w.path || w.folder} title={w.name} sub={`${w.game_mode}${w.hardcore ? " • Hardcore" : ""} • ${ago(w.last_played)}`} tag="Singleplayer" icon={w.icon} seed={w.name} onPlay={() => playWorld(w)} />)}
              {local.servers.slice(0, 6).map((s) => <QCard key={s.ip} title={s.name} sub={s.ip} tag="Multiplayer" icon={s.icon} seed={s.ip} onPlay={() => playServer(s)} />)}
            </div>
          )}
        </section>
      </div>
      {toast && <div role="status" className="pop fixed bottom-6 left-1/2 -translate-x-1/2 min-h-10 py-2 px-5 rounded-full text-[13px] flex items-center z-50 max-w-[80vw]" style={{ background: "var(--side)", boxShadow: "0 8px 30px rgba(0,0,0,.5)" }}>{toast}</div>}
      {host && (
        <Modal title="Host World" onClose={() => setHost(false)} w={440}>
          <p className="m-0 mb-4 text-[13px] leading-relaxed mute">Open one of your worlds to friends on your network. Online invite codes need the Luminos relay, which is not live yet.</p>
          {local.worlds.length === 0 ? <p className="m-0 text-[13px] mute">You have no worlds yet. Create one in Singleplayer first.</p> : (
            <div className="space-y-2">{local.worlds.slice(0, 8).map((w) => <button key={w.path || w.folder} className="w-full h-[52px] px-4 rounded-[10px] flex items-center justify-between text-left card" onClick={() => { setHost(false); playWorld(w); }}><span><span className="block text-[13.5px] font-medium">{w.name}</span><span className="block text-[11.5px] mute">{w.game_mode} • {ago(w.last_played)}</span></span><Icon n="play" s={13} fill /></button>)}</div>
          )}
        </Modal>
      )}
      {addOpen && (
        <Modal title="Add Server" onClose={() => setAddOpen(false)} w={440}>
          <p className="m-0 mb-4 text-[13px] leading-relaxed mute">Saved to your real servers.dat, so it also shows in Minecraft's Multiplayer list.</p>
          <div className="space-y-3">
            <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Name (optional)" aria-label="Server name" className="w-full h-[42px] px-4 rounded-[10px] text-[13px] outline-none" style={{ background: "var(--surface-2)", color: "var(--fg)" }} />
            <input value={sIp} onChange={(e) => setSIp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addServer()} placeholder="Address, e.g. play.example.net" aria-label="Server address" autoFocus className="w-full h-[42px] px-4 rounded-[10px] text-[13px] outline-none" style={{ background: "var(--surface-2)", color: "var(--fg)" }} />
            {sErr && <div role="alert" className="text-[12.5px]" style={{ color: "var(--bad)" }}>{sErr}</div>}
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setAddOpen(false)} className="h-[40px] px-4 rounded-[10px] text-[13px] card t">Cancel</button>
              <button onClick={() => void addServer()} className="h-[40px] px-5 rounded-[10px] text-[13px] font-semibold text-white t press" style={{ background: "#2B4BFF" }}>Save Server</button>
            </div>
          </div>
        </Modal>
      )}
    </Page>
  );
}
