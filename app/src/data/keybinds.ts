export type KeyCat = "ui" | "nav" | "toggle";
export type Bind = { id: string; name: string; hint: string; icon: string; cat: KeyCat; key: string; mode?: "Hold" | "Toggle" };
export const KEY_CATS: { id: KeyCat | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "ui", label: "Client UI" }, { id: "nav", label: "Navigation & Camera" }, { id: "toggle", label: "Module Toggles" },
];
export const BINDS: Bind[] = [
  { id: "menu", name: "Open Client Quick Panel / Mod Menu", hint: "Opens the in-game panel, also from the title screen. Right Shift works as a second shortcut.", icon: "sliders", cat: "ui", key: "RCTRL" },
  { id: "hud", name: "Open HUD Editor", hint: "Drag and resize HUD elements in game.", icon: "hud", cat: "ui", key: "H" },
  { id: "zoom", name: "Zoom", hint: "Look far away.", icon: "zoom", cat: "nav", key: "C", mode: "Hold" },
  { id: "freelook", name: "Freelook (360° Perspective)", hint: "Look around without turning.", icon: "freelook", cat: "nav", key: "Left Alt", mode: "Hold" },
  { id: "waypoint", name: "Create Quick Waypoint", hint: "Drop a waypoint where you stand.", icon: "waypoints", cat: "nav", key: "B" },
  { id: "minimap", name: "Toggle Minimap", hint: "Show or hide the corner map.", icon: "minimap", cat: "nav", key: "M" },
  { id: "fullbright", name: "Toggle Fullbright", hint: "Switch full brightness on or off.", icon: "fullbright", cat: "toggle", key: "G" },
  { id: "sprint", name: "ToggleSprint", hint: "Keep sprinting without holding.", icon: "sprint", cat: "toggle", key: "Left Ctrl", mode: "Toggle" },
  { id: "keystrokes", name: "Toggle Keystrokes", hint: "Show or hide the key display.", icon: "keyboard", cat: "toggle", key: "K" },
  { id: "coords", name: "Toggle Coordinates", hint: "Show or hide XYZ.", icon: "coords", cat: "toggle", key: "J" },
  { id: "weather", name: "Cycle Weather", hint: "Clear, rain, snow, thunder.", icon: "weather", cat: "toggle", key: "None" },
];
/** KeyboardEvent.code -> the name stored in the config. */
export function keyName(e: KeyboardEvent): string {
  const c = e.code;
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  const map: Record<string, string> = { ShiftRight: "RSHIFT", ShiftLeft: "Left Shift", ControlLeft: "Left Ctrl", ControlRight: "RCTRL", AltLeft: "Left Alt", AltRight: "Right Alt", Space: "Space", Tab: "Tab", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\" };
  return map[c] || (/^(F\d+|Arrow\w+|Page\w+|Home|End|Insert|Delete)$/.test(c) ? c.replace("Arrow", "") : c);
}
