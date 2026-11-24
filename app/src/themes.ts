import clean from "./themes/clean.json";
import lunar from "./themes/lunar.json";
import light from "./themes/light.json";
import { check } from "./themes/contrast.js";

export type ThemeFile = { luminosTheme: 1; id: string; name: string; base: "dark" | "light"; tokens: Record<string, string> };
export const THEMES: ThemeFile[] = [clean, lunar, light] as ThemeFile[];
export const DEFAULT_THEME = "clean";
const CUSTOM_KEY = "luminos.theme.custom";
const VARS: Record<string, string> = { bg: "--bg", surface: "--surface", surface2: "--surface-2", inset: "--inset", line: "--color-line", fg: "--color-fg", mute: "--color-mute", accent: "--color-accent", accentInk: "--accent-ink", ok: "--color-ok", warn: "--color-warn", bad: "--color-bad" };

export function customThemes(): ThemeFile[] { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); } catch { return []; } }
export const allThemes = () => [...THEMES, ...customThemes()];

/** A theme is tokens only. Layout, icons and motion are not reachable from here. */
export function applyTheme(id: string) {
  const t = allThemes().find((x) => x.id === id) || THEMES[0];
  const r = document.documentElement;
  for (const [k, v] of Object.entries(VARS)) r.style.setProperty(v, t.tokens[k]);
  r.style.colorScheme = t.base;
  r.dataset.theme = t.id;
}

/** Parse a shared theme file. Returns the theme or a plain-language reason it was refused. */
export function parseTheme(text: string): { ok: true; theme: ThemeFile } | { ok: false; why: string } {
  let j: any; try { j = JSON.parse(text); } catch { return { ok: false, why: "That file is not valid JSON." }; }
  if (!j || j.luminosTheme !== 1 || typeof j.name !== "string" || !j.tokens) return { ok: false, why: "That is not a Luminos theme file." };
  for (const k of Object.keys(VARS)) if (!/^#[0-9a-fA-F]{6}$/.test(j.tokens[k] || "")) return { ok: false, why: `Colour “${k}” is missing or not a #rrggbb value.` };
  const bad = check(j.tokens); if (bad.length) return { ok: false, why: "Text would be hard to read: " + bad[0] + "." };
  const id = "custom-" + j.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
  const tokens: Record<string, string> = {}; for (const k of Object.keys(VARS)) tokens[k] = j.tokens[k].toLowerCase();
  return { ok: true, theme: { luminosTheme: 1, id, name: j.name.slice(0, 24), base: j.base === "light" ? "light" : "dark", tokens } };
}
export function addCustomTheme(t: ThemeFile) { const n = [...customThemes().filter((x) => x.id !== t.id), t]; try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(n)); } catch { /* quota */ } }
export function exportTheme(id: string) {
  const t = allThemes().find((x) => x.id === id) || THEMES[0];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: "application/json" })); a.download = `luminos-theme-${t.id}.json`; a.click();
}
