import type { ReactElement } from "react";
import { P } from "./ui";

// Navigation / chrome glyphs that the shared set lacked (same 24px, 1.6 stroke family).
Object.assign(P, {
  hud: "M4 5h16v14H4zM4 10h8M12 10v9M16 14h4",
  keyboard: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10",
  bell: "M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4",
  back: "M15 5l-7 7 7 7", fwd: "M9 5l7 7-7 7",
  roller: "M6 4h11v5H6zM17 6.5h2v5h-7v3M11 14.5h2V20h-2z",
  history: "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2",
  server: "M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01",
  profile: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 20c1-4 4-6 8-6s7 2 8 6",
  verify: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5L16 9.5",
  link2: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.700l1-1",
  key: "M8 15a4 4 0 1 1 3.500-6H21v3h-3v3h-3v-3h-3.500A4 4 0 0 1 8 15z",
  eyeoff: "M3 3l18 18M10.600 6.100A9 9 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.200 3.800M6.300 7.400A17 17 0 0 0 2 12s4 7 10 7a9 9 0 0 0 3.700-.8",
  unlock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.800-1",
  sparkles: "M12 3l1.800 4.700L18.500 9.500 13.800 11.300 12 16l-1.800-4.700L5.500 9.500l4.700-1.800zM19 15l.8 2.200L22 18l-2.200.8L19 21l-.8-2.200L16 18l2.200-.8z",
});

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const F = { fill: "currentColor", fillOpacity: 0.16, stroke: "none" } as const;

/** One drawn glyph per module. 48-unit grid, same 2.2 stroke; the soft fill marks the "live" part of each shape. */
const G: Record<string, ReactElement> = {
  fps: <><path d="M8 33a16 16 0 0 1 32 0" /><path d="M24 33l8-11" /><circle cx="24" cy="33" r="2.4" {...F} fillOpacity={0.9} /><path d="M12 38h24" /></>,
  cps: <><path {...F} d="M14 8l22 13-10 3 6 11-5 3-6-11-7 6z" /><path d="M14 8l22 13-10 3 6 11-5 3-6-11-7 6z" /></>,
  keystrokes: <><rect x="17" y="6" width="14" height="14" rx="3" {...F} /><rect x="17" y="6" width="14" height="14" rx="3" /><rect x="4" y="24" width="12" height="12" rx="3" /><rect x="18" y="24" width="12" height="12" rx="3" /><rect x="32" y="24" width="12" height="12" rx="3" /><path d="M14 41h20" /></>,
  ping: <><rect x="8" y="30" width="6" height="10" rx="2" {...F} /><rect x="8" y="30" width="6" height="10" rx="2" /><rect x="18" y="23" width="6" height="17" rx="2" /><rect x="28" y="16" width="6" height="24" rx="2" /><path d="M39 10l3 3-3 3" /></>,
  armor: <><path {...F} d="M24 6l14 5v11c0 9-6 15-14 19C16 37 10 31 10 22V11z" /><path d="M24 6l14 5v11c0 9-6 15-14 19C16 37 10 31 10 22V11z" /><path d="M24 14v20M16 20h16" /></>,
  potions: <><path {...F} d="M16 30l-5 7a4 4 0 0 0 3.500 6h19a4 4 0 0 0 3.500-6l-5-7z" /><path d="M19 6h10M21 6v11L11 37a4 4 0 0 0 3.500 6h19a4 4 0 0 0 3.500-6L27 17V6" /><path d="M16 30h16" /></>,
  chatting: <><path {...F} d="M7 9h34v22H23l-9 8v-8H7z" /><path d="M7 9h34v22H23l-9 8v-8H7z" /><path d="M15 17h18M15 23h11" /></>,
  overlay: <><rect x="6" y="6" width="24" height="24" rx="4" /><rect x="18" y="18" width="24" height="24" rx="4" {...F} /><rect x="18" y="18" width="24" height="24" rx="4" /></>,
  blockoverlay: <><path {...F} d="M24 6l15 8v18l-15 9-15-9V14z" /><path d="M24 6l15 8v18l-15 9-15-9V14zM9 14l15 9 15-9M24 23v18" /></>,
  polyblur: <><circle cx="24" cy="24" r="6" {...F} fillOpacity={0.9} /><circle cx="24" cy="24" r="12" /><circle cx="24" cy="24" r="18" strokeDasharray="3 5" /></>,
  lowfire: <><path {...F} d="M24 7c2 9 11 11 11 22a11 11 0 0 1-22 0c0-6 3-9 6-12 1 3 3 4 3 4 0-5-1-10 2-14z" /><path d="M24 7c2 9 11 11 11 22a11 11 0 0 1-22 0c0-6 3-9 6-12 1 3 3 4 3 4 0-5-1-10 2-14z" /><path d="M19 38h10" /></>,
  clearfog: <><path {...F} d="M14 34a8 8 0 0 1-1-16 11 11 0 0 1 21 3 6.500 6.500 0 0 1 0 13z" /><path d="M14 34a8 8 0 0 1-1-16 11 11 0 0 1 21 3 6.500 6.500 0 0 1 0 13z" /><path d="M8 40L40 8" /></>,
  crosshair: <><circle cx="24" cy="24" r="11" /><path d="M24 5v10M24 33v10M5 24h10M33 24h10" /><circle cx="24" cy="24" r="2" {...F} fillOpacity={0.9} /></>,
  deathrecap: <><path {...F} d="M24 6c-9 0-15 6-15 14 0 5 3 8 6 10v8h18v-8c3-2 6-5 6-10 0-8-6-14-15-14z" /><path d="M24 6c-9 0-15 6-15 14 0 5 3 8 6 10v8h18v-8c3-2 6-5 6-10 0-8-6-14-15-14z" /><circle cx="18" cy="22" r="3" /><circle cx="30" cy="22" r="3" /><path d="M21 34v4M27 34v4" /></>,
  motionblur: <><rect x="24" y="14" width="18" height="20" rx="4" {...F} /><rect x="24" y="14" width="18" height="20" rx="4" /><path d="M6 18h12M2 24h16M8 30h10" /></>,
  anim17: <><path {...F} d="M38 6l4 4L22 30l-6 2 2-6z" /><path d="M38 6l4 4L22 30l-6 2 2-6zM10 40l6-6M12 28l8 8" /></>,
  clicksampler: <><circle cx="22" cy="24" r="14" /><path d="M22 14v10l6 4" /><path {...F} d="M34 26l10 4-4 2 3 5-3 1-3-5-3 3z" /><path d="M34 26l10 4-4 2 3 5-3 1-3-5-3 3z" /></>,
  hotwire: <><path {...F} d="M27 5L11 27h12l-2 16 18-24H26z" /><path d="M27 5L11 27h12l-2 16 18-24H26z" /></>,
  sodium: <><path {...F} d="M24 5l16 9v20l-16 9-16-9V14z" /><path d="M24 5l16 9v20l-16 9-16-9V14zM8 14l16 9 16-9M24 23v20" /></>,
  lithium: <><ellipse cx="24" cy="24" rx="18" ry="7" /><ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(60 24 24)" /><ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(120 24 24)" /><circle cx="24" cy="24" r="3.500" {...F} fillOpacity={0.9} /></>,
  entityculling: <><path d="M4 24s8-13 20-13 20 13 20 13-8 13-20 13S4 24 4 24z" /><circle cx="24" cy="24" r="6" {...F} fillOpacity={0.5} /><path d="M8 40L40 8" /></>,
  ferrite: <><rect x="12" y="12" width="24" height="24" rx="4" {...F} /><rect x="12" y="12" width="24" height="24" rx="4" /><path d="M18 5v7M24 5v7M30 5v7M18 36v7M24 36v7M30 36v7M5 18h7M5 24h7M5 30h7M36 18h7M36 24h7M36 30h7" /></>,
  immediatelyfast: <><path d="M8 10l14 14L8 38" /><path d="M24 10l14 14-14 14" {...F} fillOpacity={0.9} /><path d="M24 10l14 14-14 14" /></>,
  modernfix: <><path {...F} d="M34 6a9 9 0 0 0-8 12L8 36a4 4 0 0 0 6 6l18-18a9 9 0 0 0 12-8l-6 3-5-5z" /><path d="M34 6a9 9 0 0 0-8 12L8 36a4 4 0 0 0 6 6l18-18a9 9 0 0 0 12-8l-6 3-5-5z" /></>,
  dynfps: <><path {...F} d="M30 6a18 18 0 1 0 12 24A14 14 0 0 1 30 6z" /><path d="M30 6a18 18 0 1 0 12 24A14 14 0 0 1 30 6z" /></>,
  iris: <><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="8" {...F} fillOpacity={0.5} /><circle cx="24" cy="24" r="8" /><path d="M24 2v5M24 41v5M2 24h5M41 24h5" /></>,
  sodiumextra: <><path {...F} d="M22 6l14 8v18l-14 8-14-8V14z" /><path d="M22 6l14 8v18l-14 8-14-8V14z" /><path d="M38 6v10M33 11h10" /></>,
  nvidium: <><rect x="4" y="12" width="40" height="22" rx="4" {...F} /><rect x="4" y="12" width="40" height="22" rx="4" /><circle cx="16" cy="23" r="5" /><circle cx="32" cy="23" r="5" /><path d="M10 40h28" /></>,
  zoomify: <><circle cx="20" cy="20" r="13" {...F} /><circle cx="20" cy="20" r="13" /><path d="M30 30l12 12M14 20h12M20 14v12" /></>,
  coordinates: <><path {...F} d="M24 5c-8 0-13 6-13 13 0 10 13 25 13 25s13-15 13-25c0-7-5-13-13-13z" /><path d="M24 5c-8 0-13 6-13 13 0 10 13 25 13 25s13-15 13-25c0-7-5-13-13-13z" /><circle cx="24" cy="18" r="5" /></>,
  sprint: <><circle cx="30" cy="9" r="4" {...F} fillOpacity={0.9} /><path d="M24 18l-6 8 8 4-2 12M24 18l8 6 7-2M18 26l-8 3" /></>,
  fullbright: <><circle cx="24" cy="24" r="8" {...F} fillOpacity={0.9} /><circle cx="24" cy="24" r="8" /><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" /></>,
};
export function ModIcon({ id, size = 44 }: { id: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" {...S} aria-hidden>{G[id] || G.hotwire}</svg>;
}
export const HAS_ICON = (id: string) => id in G;
