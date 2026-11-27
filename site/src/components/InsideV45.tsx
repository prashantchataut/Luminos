import { useState } from "react";

/**
 * "Inside Luminos v4.5": the real offscreen renders of the in-game screens (produced by the client's headless test suite from the same
 * layout code the game runs) next to what each one is. Honest caption: these are composed renders, not captures of a running game.
 */
const base = import.meta.env.BASE_URL;
const TABS = [
  { id: "startup", label: "In-Game Startup Screen", src: "renders/mc-startup-screen.png", note: "LuminosMainMenuScreen replaces the vanilla title screen. Seven actions, keyboard navigation, no blur pass.", callouts: ["setScreen Mixin swaps TitleScreen", "TitleScreen.init guard as fallback", "renderBackground is a no-op"] },
  { id: "panel", label: "Right-Ctrl Quick Mod Panel", src: "renders/mc-quick-panel.png", note: "Tabs, toggles and the settings drawer all work in place. Nothing in this panel opens another screen.", callouts: ["Raw key hook + per-frame poll", "One clipped hit-region list", "Inline drawer, real Scale slider"] },
  { id: "hud", label: "In-Game HUD Studio", src: "renders/mc-hud-studio.png", note: "Drag a widget and it snaps to the centre guide. This frame is a real drag through the editor's own code.", callouts: ["Magnetic centre and edge guides", "Per-widget scale and on/off", "Sample data when no world is loaded"] },
  { id: "home", label: "Launcher Home & Version Switcher", src: "renders/launcher-home.png", note: "Pick the Minecraft version (1.21.4 down to 1.19.4), the engine preset and the window mode right next to Launch. The choice is saved at once and used by the launch.", callouts: ["7 Fabric versions, one click", "Max FPS / Competitive PvP / Balanced", "Own title bar: minimize, maximize, close"] },
  { id: "capes", label: "3D Capes Studio", src: "renders/launcher-capes.png", note: "Your own character, lit so it reads clearly, beside the original 3D cape cards. Front and Back views.", callouts: ["skinview3d, studio lighting", "Original Luminos capes only", "Classic or Slim arms"] },
  { id: "mods", label: "Mod Matrix", src: "renders/launcher-mods.png", note: "42 client modules as cards with an in-place switch. The performance stack is built in and not listed as modules.", callouts: ["One switch per module", "Filter by category", "Shares config with the in-game panel"] },
] as const;

export default function InsideV45() {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const t = TABS[i];
  return (
    <section id="inside" className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="inside-h">
      <p className="text-xs uppercase tracking-widest" style={{ color: "#8FA2FF" }}>Inside Luminos v4.5 · Real In-Game Client &amp; Launcher Renders</p>
      <h2 id="inside-h" className="mt-2 text-3xl font-semibold text-white">Real in-game client &amp; launcher renders</h2>
      <p className="mt-3 max-w-2xl text-sm" style={{ color: "#94A3B8" }}>The three in-game screens are rendered at 1280×800 @2x by the client's headless test suite, using the same layout and hit-test code the game runs: composed renders with a drawn world backdrop, not screenshots of a running game. The launcher shots are captures of its real interface in a browser at the same size, not of the packaged Windows window.</p>
      <div role="tablist" aria-label="Client screens" className="mt-8 flex flex-wrap gap-2">
        {TABS.map((x, n) => (
          <button key={x.id} role="tab" aria-selected={n === i} onClick={() => setI(n)} className="h-10 px-4 rounded-lg text-sm font-medium transition-colors" style={n === i ? { background: "#2B4BFF", color: "#fff" } : { background: "#141821", color: "#94A3B8" }}>{x.label}</button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <button type="button" onClick={() => setZoom(true)} aria-label={`Zoom: ${t.label}`} className="block overflow-hidden rounded-2xl border border-white/10 cursor-zoom-in">
          <img src={base + t.src} alt={t.label} width={2560} height={1600} loading="lazy" className="w-full h-auto block" />
        </button>
        <div>
          <p className="text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>{t.note}</p>
          <ul className="mt-4 space-y-2 p-0 list-none">
            {t.callouts.map((c) => <li key={c} className="text-[13px] rounded-md px-3 py-2" style={{ background: "#141821", color: "#8FA2FF" }}>{c}</li>)}
          </ul>
        </div>
      </div>
      {zoom && (
        <div role="dialog" aria-label={t.label} onClick={() => setZoom(false)} onKeyDown={(e) => e.key === "Escape" && setZoom(false)} tabIndex={-1} className="fixed inset-0 z-50 grid place-items-center p-6 cursor-zoom-out" style={{ background: "rgba(5,6,10,.92)" }}>
          <img src={base + t.src} alt={t.label} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </section>
  );
}
