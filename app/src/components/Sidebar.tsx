import { memo } from "react";
import { Icon } from "./Icon";
import Head from "./Head";
import LuminosLogo from "./LuminosLogo";
import { quitLauncher, useGame } from "../state/game";
import { StopGameButton } from "../screens/Home";
import { LaunchProgressMini } from "./LaunchProgress";

/** One flat list, in the order a player uses it. No group headings, no counters. */
export const NAV: { id: string; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "mods", label: "Mods", icon: "sliders" },
  { id: "hud", label: "Edit HUD", icon: "hud" },
  { id: "cosmetics", label: "Capes", icon: "shirt" },
  { id: "keybinds", label: "Keybinds", icon: "keyboard" },
  { id: "themes", label: "Themes", icon: "palette" },
  { id: "preferences", label: "Preferences", icon: "gear" },
];

export default memo(function Sidebar({ page, go, name, skin, version, onAccount }: { page: string; go: (r: string) => void; name: string; skin: string; version: string; onAccount: () => void }) {
  const g = useGame();
  return (
    <nav aria-label="Main" className="w-[220px] shrink-0 px-4 pt-5 pb-4 flex flex-col justify-between min-h-0" style={{ background: "#0F1218" }}>
      <div className="min-h-0 overflow-y-auto">
        <div className="px-2 pb-6"><LuminosLogo size={30} /></div>
        <div className="space-y-1">
          {NAV.map((i) => (
            <button key={i.id} className="nav-row press" aria-current={page === i.id ? "page" : undefined} onClick={() => go(i.id)}>
              <Icon n={i.icon} s={16} />{i.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <LaunchProgressMini />
        {g.status !== "idle" && <StopGameButton compact />}
        <button onClick={onAccount} aria-label={`Account ${name}. Switch account`} className="w-full h-[48px] px-2.5 rounded-[10px] flex items-center gap-2.5 text-left t hover:bg-[#161B26]" style={{ background: "#141821" }}>
          <Head src={skin} size={28} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[12.5px] font-medium truncate">{name}</span>
            <span className="block text-[11px] truncate" style={{ color: "var(--mute)" }}>{g.status === "running" ? "In game" : g.status === "preparing" ? "Starting…" : "Ready"}</span>
          </span>
          <Icon n="chev" s={13} />
        </button>
        <button onClick={() => void quitLauncher()} className="w-full h-9 rounded-[9px] text-[12.5px] font-medium t hover:bg-[#161B26]" style={{ color: "var(--mute)" }}>Quit Luminos</button>
      </div>
    </nav>
  );
});
