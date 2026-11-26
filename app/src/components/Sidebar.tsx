import { memo } from "react";
import { Icon } from "./Icon";
import Head from "./Head";
import { MODULES } from "../data/modules";
import LuminosLogo from "./LuminosLogo";
import { quitLauncher, useGame } from "../state/game";
import { StopGameButton } from "../screens/Home";

export const GROUPS: { label: string; items: { id: string; label: string; icon: string }[] }[] = [
  { label: "Play", items: [{ id: "home", label: "Home", icon: "home" }, { id: "hud", label: "Edit HUD", icon: "hud" }] },
  { label: "Client", items: [{ id: "mods", label: "Mods", icon: "sliders" }, { id: "keybinds", label: "Keybinds", icon: "keyboard" }, { id: "profiles", label: "Profiles", icon: "profile" }] },
  { label: "Personalization", items: [{ id: "cosmetics", label: "Cosmetics", icon: "shirt" }, { id: "themes", label: "Themes", icon: "palette" }, { id: "preferences", label: "Preferences", icon: "gear" }] },
];

export default memo(function Sidebar({ page, go, name, skin, version, onAccount }: { page: string; go: (r: string) => void; name: string; skin: string; version: string; onAccount: () => void }) {
  const g = useGame();
  return (
    <nav aria-label="Main" className="w-[228px] shrink-0 p-5 flex flex-col justify-between min-h-0" style={{ background: "var(--side)" }}>
      <div className="min-h-0 overflow-y-auto">
        <div className="px-3 pt-1 pb-6"><LuminosLogo size={32} /></div>
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <div className="eyebrow px-3.5 pb-1">{g.label}</div>
              {g.items.map((i) => (
                <button key={i.id} className="nav-row press" aria-current={page === i.id ? "page" : undefined} onClick={() => go(i.id)}>
                  <Icon n={i.icon} s={17} />{i.label}
                  {i.id === "mods" && <span className="ml-auto text-[11px] num opacity-70">{MODULES.length}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        {g.status !== "idle" && <StopGameButton compact />}
        <button onClick={onAccount} aria-label={`Account ${name}. Switch account`} className="p-2.5 rounded-[10px] flex items-center gap-3 text-left t card">
        <Head src={skin} size={32} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[13px] font-medium truncate">{name}</span>
          <span className="block text-[11px] truncate" style={{ color: "var(--mute)" }}>{g.status === "running" ? `Running${g.pid ? ` • PID ${g.pid}` : ""}` : g.status === "preparing" ? "Starting…" : `Fabric ${version} • Ready`}</span>
        </span>
      </button>
        <button onClick={() => dispatchEvent(new Event("luminos:update"))} className="w-full h-8 rounded-[8px] text-[12px] t hover:bg-[var(--surface)] flex items-center justify-center gap-2" style={{ color: "var(--mute)" }}><span aria-hidden>↻</span>Check for Updates / Auto-Update</button>
        <button onClick={() => void quitLauncher()} className="w-full h-8 rounded-[8px] text-[12px] t hover:bg-[var(--surface)]" style={{ color: "var(--mute)" }}>Quit Luminos</button>
      </div>
    </nav>
  );
});
