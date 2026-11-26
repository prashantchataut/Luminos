import { memo } from "react";
import { Icon } from "./Icon";
import Head from "./Head";
import LuminosLogo from "./LuminosLogo";
import { quitLauncher, useGame } from "../state/game";
import { StopGameButton } from "../screens/Home";
import { APP_VERSION } from "./UpdateBanner";

/** Grouped the way a session goes: play, set the client up, make it yours. */
export const NAV_GROUPS: { title: string; items: { id: string; label: string; icon: string }[] }[] = [
  { title: "Play", items: [{ id: "home", label: "Home", icon: "home" }, { id: "hud", label: "Edit HUD", icon: "hud" }] },
  { title: "Client", items: [{ id: "mods", label: "Mods", icon: "sliders" }, { id: "keybinds", label: "Keybinds", icon: "keyboard" }] },
  { title: "Personalization", items: [{ id: "cosmetics", label: "Capes", icon: "shirt" }, { id: "themes", label: "Themes", icon: "palette" }, { id: "preferences", label: "Preferences", icon: "gear" }] },
];
export const NAV = NAV_GROUPS.flatMap((g) => g.items);
const KIND: Record<string, string> = { MICROSOFT: "Microsoft", "ELY.BY": "Ely.by", OFFLINE: "Offline" };

export default memo(function Sidebar({ page, go, name, skin, kind, onAccount }: { page: string; go: (r: string) => void; name: string; skin: string; kind: string; version?: string; onAccount: () => void }) {
  const g = useGame();
  const pct = Math.max(0, Math.min(100, Math.round(g.progress?.percent ?? g.fraction * 100)));
  const live = g.status === "running" ? { text: "In-Game", color: "#34D399" } : g.status === "preparing" ? { text: `Launching ${pct}%`, color: "#7C93FF" } : { text: "Ready", color: "#8A94A6" };
  return (
    <nav aria-label="Main" className="w-[224px] shrink-0 px-4 pt-5 pb-4 flex flex-col justify-between min-h-0" style={{ background: "#0F1218" }}>
      <div className="min-h-0 overflow-y-auto">
        <div className="px-2 pb-5"><LuminosLogo size={30} /></div>
        {NAV_GROUPS.map((grp) => (
          <div key={grp.title} className="mb-4">
            <div className="eyebrow px-3 pb-1.5">{grp.title}</div>
            <div className="space-y-1">
              {grp.items.map((i) => (
                <button key={i.id} className="nav-row press" aria-current={page === i.id ? "page" : undefined} onClick={() => go(i.id)}>
                  <Icon n={i.icon} s={16} />{i.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="rounded-[12px] p-2 space-y-2" style={{ background: "#141821" }}>
          <button onClick={onAccount} aria-label={`Account ${name}. Switch account`} className="w-full h-[44px] px-1.5 rounded-[9px] flex items-center gap-2.5 text-left t hover:bg-[#1B202C]">
            <Head src={skin} size={28} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[12.5px] font-medium truncate">{name}</span>
              <span className="block text-[11px] truncate" style={{ color: "var(--mute)" }}>{KIND[kind] ?? "Offline"} account</span>
            </span>
            <Icon n="chev" s={13} />
          </button>
          <div className="flex items-center gap-2 px-1.5 h-7 text-[11.5px] font-medium" aria-live="polite">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: live.color }} />
            <span className="flex-1 truncate" style={{ color: live.color }}>{live.text}</span>
            {g.status === "idle" && <button onClick={() => dispatchEvent(new Event("luminos:update"))} className="t hover:text-white" style={{ color: "var(--mute)" }} title="Check for a newer Luminos release" aria-label="Check for updates">v{APP_VERSION} · Update?</button>}
          </div>
          {g.status === "running" && <StopGameButton compact />}
        </div>
        <button onClick={() => void quitLauncher()} className="w-full h-9 rounded-[9px] text-[12.5px] font-medium t hover:bg-[#161B26]" style={{ color: "var(--mute)" }}>Quit Luminos</button>
      </div>
    </nav>
  );
});
