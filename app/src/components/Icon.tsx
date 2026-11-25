import { memo } from "react";

/** One drawn vector set, 24px grid, round caps. Module glyphs and chrome glyphs share the same stroke so nothing looks pasted in. */
export const PATHS: Record<string, string> = {
  // chrome
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  hud: "M3 5h18v14H3zM3 9h18M8 13h3M8 16h6",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  profile: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c.8-3.5 4-5 8-5s7.2 1.5 8 5",
  shirt: "M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3c-.5 1.5-2 2-4 2s-3.5-.5-4-2z",
  palette: "M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2.5 1.5-2.5H17a4 4 0 004-4c0-5-4-9.5-9-9.5zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 00-2.2-1.300L14 3h-4l-.4 2.500a7 7 0 00-2.200 1.300l-2.300-1-2 3.400 2 1.500a7 7 0 000 2.600l-2 1.500 2 3.400 2.300-1a7 7 0 002.200 1.300L10 21h4l.4-2.500a7 7 0 002.200-1.300l2.300 1 2-3.400-2-1.500c.1-.4.100-.9.100-1.300z",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3",
  close: "M6 6l12 12M18 6L6 18",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  play: "M7 4.5v15l12-7.5z",
  chev: "M6 9l6 6 6-6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
  reset: "M4 12a8 8 0 102.5-5.8M4 4v4h4",
  wings: "M12 20V8M12 8C9 4 5 4 2 6c1 5 4 8 10 9M12 8c3-4 7-4 10-2-1 5-4 8-10 9",
  cloak: "M8 4h8l2 4v12H6V8zM6 8h12M12 8v12",
  emote: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 14c1 2 2.5 3 4 3s3-1 4-3M9 9.5h.01M15 9.5h.01",
  pet: "M12 20c-3 0-5-1.5-5-3.5S9.5 13 12 13s5 1.5 5 3.5S15 20 12 20zM6 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM10 8.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14 8.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  trash: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01",
  folder: "M3 6h6l2 2h10v11H3z",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  // client modules
  waypoints: "M12 21s-6-5.5-6-11a6 6 0 1112 0c0 5.5-6 11-6 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  minimap: "M3 4h18v16H3zM12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM12 4v2.5M12 17.5V20M3 12h2.5M18.5 12H21",
  fullbright: "M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  time: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  weather: "M7 15a4 4 0 010-8 5 5 0 019.5 1.5A3.5 3.5 0 0117 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3",
  coords: "M12 3v18M3 12h18M12 3l-2 2M12 3l2 2M21 12l-2-2M21 12l-2 2",
  zoom: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3M11 8v6M8 11h6",
  freelook: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  sprint: "M5 6l6 6-6 6M12 6l6 6-6 6",
  anim: "M20 4l-9 9M20 4h-5M20 4v5M9 13l-4 4 2 2 4-4M5 17l-2 2",
  blur: "M3 6c3-3 6 3 9 0s6 3 9 0M3 12c3-3 6 3 9 0s6 3 9 0M3 18c3-3 6 3 9 0s6 3 9 0",
  lowfire: "M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-9 0 4-4 6-4 12 0 4 3 8 7 8z",
  fog: "M7 13a4 4 0 010-8 5 5 0 019.5 1.5A3.5 3.5 0 0117 13zM3 17h14M7 21h14",
  block: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  hitbox: "M4 4h16v16H4zM8 8h8v8H8z",
  nametag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  hurtcam: "M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M9 12h6",
  damage: "M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z",
  itemphys: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
  cps: "M12 3a6 6 0 016 6v6a6 6 0 01-12 0V9a6 6 0 016-6zM12 3v7",
  fps: "M4 18a8 8 0 1116 0M12 18l4-6",
  ping: "M2 9a15 15 0 0120 0M5.5 12.5a10 10 0 0113 0M9 16a5 5 0 016 0M12 20h.01",
  potion: "M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M8 15h8",
  crosshair: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 2v6M12 16v6M2 12h6M16 12h6",
  scoreboard: "M3 4h18v16H3zM7 9h10M7 13h10M7 17h6",
  bossbar: "M3 9h18v6H3zM6 12h8",
  reach: "M3 17h18v-4H3zM7 17v-2M11 17v-3M15 17v-2M19 17v-3",
  tnt: "M14 8l3-3M17 5l2 2M11 21a7 7 0 100-14 7 7 0 000 14z",
  pack: "M3 5h8v6H3zM13 5h8v6h-8zM3 13h8v6H3zM13 13h8v6h-8z",
  chat: "M4 5h16v11H9l-5 4z",
  death: "M12 3a8 8 0 00-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 00-8-8zM9 12h.01M15 12h.01M10 20v-3M14 20v-3",
};

export const Icon = memo(function Icon({ n, s = 18, w = 1.75, className, fill }: { n: string; s?: number; w?: number; className?: string; fill?: boolean }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d={PATHS[n] || PATHS.info} />
    </svg>
  );
});
