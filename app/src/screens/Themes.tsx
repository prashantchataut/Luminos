import { useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { PageHeader, Pills, Row, Switch } from "../components/ui";
import { contrast, parseTheme, readTokens, THEMES, type ThemeId } from "../theme";
import { loadCustomTheme, saveCustomTheme, set, useSettings } from "../store";
import { applyPreset, PRESETS, useClient, type Preset } from "../state/client";

// Preview palettes mirror themes/*.css (colours only), so a card shows exactly what the theme will look like.
const PREVIEW: Record<string, { bg: string; side: string; surface: string; accent: string; fg: string }> = {
  default: { bg: "#0b0d12", side: "#0f1218", surface: "#141821", accent: "#2b4bff", fg: "#e8ecf4" },
  neutral: { bg: "#0d0d0f", side: "#111114", surface: "#17171b", accent: "#3f5cff", fg: "#e8e8ee" },
  minecraft: { bg: "#111315", side: "#15181a", surface: "#1b1e21", accent: "#6cc24a", fg: "#e6ebe4" },
  light: { bg: "#f4f6fa", side: "#ebeef4", surface: "#ffffff", accent: "#2b4bff", fg: "#161a22" },
};
const SWATCHES = ["#2B4BFF", "#7C5CFF", "#00A3FF", "#12B886", "#F59F00", "#F0506E"];

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("");
}

function Preview({ id, name, note, active, onPick }: { id: string; name: string; note: string; active: boolean; onPick: () => void }) {
  const p = PREVIEW[id];
  return (
    <button onClick={onPick} aria-pressed={active} aria-label={`${name} theme`} className="text-left rounded-[14px] p-1.5 t press" style={{ background: "var(--surface)", boxShadow: active ? "0 0 0 2px var(--accent)" : "none" }}>
      <div className="h-[104px] rounded-[10px] overflow-hidden flex" style={{ background: p.bg }}>
        <div className="w-[34px] p-1.5 space-y-1" style={{ background: p.side }}><div className="h-1.5 rounded-full" style={{ background: p.accent }} />{[0, 1, 2, 3].map((i) => <div key={i} className="h-1 rounded-full" style={{ background: p.fg, opacity: 0.18 }} />)}</div>
        <div className="flex-1 p-2.5 space-y-2"><div className="h-2 w-1/2 rounded-full" style={{ background: p.fg, opacity: 0.8 }} /><div className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-md" style={{ background: p.surface }} />)}</div><div className="h-5 w-16 rounded-md" style={{ background: p.accent }} /></div>
      </div>
      <div className="px-2.5 py-2.5 flex items-center justify-between gap-2"><span className="min-w-0"><span className="block text-[13px] font-medium truncate">{name}</span><span className="block text-[11.5px] truncate mute">{note}</span></span>{active && <Icon n="check" s={15} w={2.4} className="text-[var(--accent-text)] shrink-0" />}</div>
    </button>
  );
}

export default function Themes() {
  const s = useSettings(), c = useClient();
  const [err, setErr] = useState<string | null>(null);
  const accent = (hex: string) => {
    const t = { ...readTokens() };
    t.accent = hex.toLowerCase(); t["accent-fg"] = contrast(hex, "#ffffff") >= 4.5 ? "#ffffff" : "#0b0d12"; t["accent-soft"] = mix(hex, t.bg, 0.28);
    const r = parseTheme(JSON.stringify({ luminosTheme: 1, name: "Custom", tokens: t }));
    if (r.ok === false) return setErr(r.error);
    setErr(null); saveCustomTheme(r.theme); set("theme", "custom");
  };
  const cur = s.theme === "custom" ? (loadCustomTheme()?.tokens.accent ?? "#2b4bff") : readTokens().accent || "#2b4bff";
  return (
    <Page>
      <PageHeader title="Themes" sub="Appearance and accent. Changes apply instantly." />
      <div className="grid grid-cols-4 gap-5 mb-8">
        {THEMES.map((t) => <Preview key={t.id} id={t.id} name={t.name} note={t.note} active={s.theme === t.id} onPick={() => { setErr(null); set("theme", t.id as ThemeId); }} />)}
      </div>
      <div className="space-y-3">
        <Row title="Accent Color" desc={err ?? "Buttons, toggles and selection."}>
          <div className="flex items-center gap-2">{SWATCHES.map((h) => <button key={h} aria-label={`Accent ${h}`} aria-pressed={cur.toLowerCase() === h.toLowerCase()} onClick={() => accent(h)} className="w-6 h-6 rounded-full t press" style={{ background: h, boxShadow: cur.toLowerCase() === h.toLowerCase() ? "0 0 0 2px var(--surface), 0 0 0 4px var(--fg)" : "none" }} />)}</div>
          <input type="color" aria-label="Custom accent" value={cur.length === 7 ? cur : "#2b4bff"} onChange={(e) => accent(e.target.value)} />
          <span className="mono text-[12px] h-[30px] px-3 rounded-full grid place-items-center uppercase" style={{ background: "var(--surface-2)" }}>{cur}</span>
        </Row>
        <Row title="Interface Animations" desc="Subtle fades and slides. Off removes all motion."><Switch on={!s.reduceMotion} onChange={(v) => set("reduceMotion", !v)} label="Interface animations" /></Row>
        <Row title="Gameplay Profile Preset" desc={PRESETS[c.prefs.preset].blurb}><Pills value={c.prefs.preset} onChange={applyPreset} items={(Object.keys(PRESETS) as Preset[]).map((p) => ({ id: p, label: p }))} /></Row>
      </div>
    </Page>
  );
}
