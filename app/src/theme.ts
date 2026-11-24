/** Themes are token files (themes/*.css): colours only. Import/export is one JSON file of those colours. */
export const THEMES = [
  { id: "default", name: "Default", note: "Neutral grey" },
  { id: "lunar", name: "Lunar", note: "Blue-black night" },
  { id: "light", name: "Light", note: "Daytime" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"] | "custom";
export const TOKEN_KEYS = ["bg", "surface", "surface-2", "hover", "line", "line-strong", "fg", "mute", "accent", "accent-fg", "accent-soft", "ok", "warn", "bad"] as const;
export type Tokens = Record<(typeof TOKEN_KEYS)[number], string>;
export type ThemeFile = { luminosTheme: 1; name: string; tokens: Tokens };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function rgb(h: string): [number, number, number] {
  let s = h.slice(1); if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (h: string) => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

/** Text pairs every theme must pass at 4.5:1 (WCAG AA for normal text, so it holds at every size). */
export const PAIRS: [keyof Tokens, keyof Tokens][] = [["fg", "bg"], ["fg", "surface"], ["fg", "surface-2"], ["fg", "hover"], ["mute", "bg"], ["mute", "surface"], ["mute", "surface-2"], ["mute", "hover"], ["accent-fg", "accent"], ["accent", "surface"], ["fg", "accent-soft"], ["ok", "surface"], ["warn", "surface"], ["bad", "surface"]];

export function parseTheme(text: string): { ok: true; theme: ThemeFile } | { ok: false; error: string } {
  let j: any;
  try { j = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
  if (!j || j.luminosTheme !== 1 || typeof j.tokens !== "object") return { ok: false, error: "That file is not a Luminos theme (missing \"luminosTheme\": 1)." };
  const tokens = {} as Tokens;
  for (const k of TOKEN_KEYS) {
    const v = j.tokens[k];
    if (typeof v !== "string" || !HEX.test(v.trim())) return { ok: false, error: `Token "${k}" must be a hex colour such as #1a56c4.` };
    tokens[k] = v.trim().toLowerCase();
  }
  for (const [a, b] of PAIRS) { const c = contrast(tokens[a], tokens[b]); if (c < 4.5) return { ok: false, error: `${a} on ${b} is ${c.toFixed(2)}:1. Text needs 4.5:1.` }; }
  return { ok: true, theme: { luminosTheme: 1, name: String(j.name || "Custom").slice(0, 40), tokens } };
}
export function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement), t = {} as Tokens;
  for (const k of TOKEN_KEYS) t[k] = cs.getPropertyValue("--" + k).trim();
  return t;
}
export function exportTheme(name: string): string { return JSON.stringify({ luminosTheme: 1, name, tokens: readTokens() }, null, 2); }
export function applyTheme(id: ThemeId, custom?: ThemeFile | null) {
  const r = document.documentElement;
  for (const k of TOKEN_KEYS) r.style.removeProperty("--" + k);
  if (id === "custom" && custom) { r.setAttribute("data-theme", "default"); for (const k of TOKEN_KEYS) r.style.setProperty("--" + k, custom.tokens[k]); r.setAttribute("data-custom", "1"); r.style.colorScheme = luminance(custom.tokens.bg) > 0.4 ? "light" : "dark"; return; }
  r.removeAttribute("data-custom"); r.style.colorScheme = ""; r.setAttribute("data-theme", id === "custom" ? "default" : id);
}
