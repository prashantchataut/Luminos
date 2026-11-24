// WCAG 2.x contrast for theme tokens. Plain JS so node tools can import it without a TS runtime.
export const REQUIRED = [
  ["fg", "bg", 4.5], ["fg", "surface", 4.5], ["fg", "surface2", 4.5], ["fg", "inset", 4.5],
  ["mute", "bg", 4.5], ["mute", "surface", 4.5], ["mute", "surface2", 4.5], ["mute", "inset", 4.5],
  ["accent", "bg", 4.5], ["accent", "surface", 4.5], ["accentInk", "accent", 4.5],
  ["ok", "surface", 4.5], ["warn", "surface", 4.5], ["bad", "surface", 4.5],
  ["line", "surface", 1.3],
];
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function luminance(hex) { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); }
export function ratio(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** Returns a list of plain-language failures; empty means the theme passes at every text size. */
export function check(tokens) {
  const bad = [];
  for (const [f, b, min] of REQUIRED) { const r = ratio(tokens[f], tokens[b]); if (r < min) bad.push(`${f} on ${b} is ${r.toFixed(2)}:1, needs ${min}:1`); }
  return bad;
}
