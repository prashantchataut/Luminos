import { useEffect, useRef, useState } from "react";
import { Badge, Chip, Icon, LRow, Slider, Switch } from "../kit";
import { PRESETS } from "../data/launcher";
import { set, useSettings } from "../store";

/* ---- crosshair model: also the file format the client reads (luminos-client.json -> "crosshair") ---- */
export type Cross = { name: string; shape: "cross" | "dot" | "circle" | "T" | "X"; thickness: number; gap: number; length: number; outline: number; color: string; opacity: number; dot?: boolean; ring?: boolean; spread: boolean };
export const CROSS_PRESETS: Record<string, Cross> = {
  "cross-gap": { name: "Gap Cross", shape: "cross", thickness: 2, gap: 3, length: 6, outline: 1, color: "var(--color-accent)", opacity: 1, spread: true },
  "dot-ring": { name: "Dot + Ring", shape: "dot", thickness: 2, gap: 0, length: 0, outline: 1, color: "#ffffff", opacity: 1, ring: true, spread: false },
  "tiny-dot": { name: "Tiny Dot", shape: "dot", thickness: 3, gap: 0, length: 0, outline: 1, color: "var(--color-ok)", opacity: 1, spread: false },
  "tactical-t": { name: "Tactical T", shape: "T", thickness: 2, gap: 3, length: 7, outline: 1, color: "var(--color-warn)", opacity: 1, spread: true },
  "x-sharp": { name: "X Sharp", shape: "X", thickness: 2, gap: 2, length: 5, outline: 1, color: "var(--color-bad)", opacity: 1, spread: false },
  "open-circle": { name: "Open Circle", shape: "circle", thickness: 1, gap: 0, length: 7, outline: 1, color: "#ffffff", opacity: .9, spread: true },
  "plus-dot": { name: "Plus Dot", shape: "cross", thickness: 2, gap: 4, length: 5, outline: 1, color: "#b6f06a", opacity: 1, dot: true, spread: true },
  "wide-hair": { name: "Wide Hairline", shape: "cross", thickness: 1, gap: 5, length: 7, outline: 0, color: "#ffffff", opacity: .85, spread: true },
};
const hexA = (h: string, a: number) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export function drawCross(g: CanvasRenderingContext2D, c: Cross, cx: number, cy: number, px: number, spread = 0) {
  const gap = c.gap + spread, col = hexA(c.color, c.opacity), out = hexA("var(--inset)", Math.min(1, c.opacity));
  const rect = (x: number, y: number, w: number, h: number) => { if (c.outline) { g.fillStyle = out; g.fillRect((x - c.outline) * px, (y - c.outline) * px, (w + 2 * c.outline) * px, (h + 2 * c.outline) * px); } g.fillStyle = col; g.fillRect(x * px, y * px, w * px, h * px); };
  const t = c.thickness, h = t / 2;
  const arms = (dirs: string) => { if (dirs.includes("u")) rect(cx - h, cy - gap - c.length, t, c.length); if (dirs.includes("d")) rect(cx - h, cy + gap, t, c.length); if (dirs.includes("l")) rect(cx - gap - c.length, cy - h, c.length, t); if (dirs.includes("r")) rect(cx + gap, cy - h, c.length, t); };
  const ring = (r: number, w: number) => { if (c.outline) { g.strokeStyle = out; g.lineWidth = (w + 2 * c.outline) * px; g.beginPath(); g.arc(cx * px, cy * px, r * px, 0, 7); g.stroke(); } g.strokeStyle = col; g.lineWidth = w * px; g.beginPath(); g.arc(cx * px, cy * px, r * px, 0, 7); g.stroke(); };
  if (c.shape === "cross") arms("udlr"); else if (c.shape === "T") arms("dlr");
  else if (c.shape === "dot") rect(cx - h, cy - h, t, t);
  else if (c.shape === "circle") ring(c.length + spread, t);
  else if (c.shape === "X") for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (let i = 0; i < c.length; i++) rect(cx + (sx > 0 ? gap + i : -(gap + i) - t), cy + (sy > 0 ? gap + i : -(gap + i) - t), t, t);
  if (c.dot && c.shape !== "dot") rect(cx - h, cy - h, t, t);
  if (c.ring) ring(5 + spread, 1);
}
function Cross({ c, size = 96, spread = 0, bg = "/covers/26.3.jpg" }: { c: Cross; size?: number; spread?: number; bg?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, g = cv.getContext("2d")!, px = size < 100 ? 3 : 4, n = size / px; cv.width = size; cv.height = size;
    const im = new Image(); im.src = bg; const paint = () => { g.clearRect(0, 0, size, size); if (im.complete && im.naturalWidth) g.drawImage(im, im.naturalWidth * .3, im.naturalHeight * .25, im.naturalHeight * .5, im.naturalHeight * .5, 0, 0, size, size); drawCross(g, c, n / 2, n / 2, px, spread); };
    paint(); im.onload = paint;
  }, [c, size, spread, bg]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated" }} className="rounded-lg" />;
}

const QOL: [string, string, string, string, boolean?][] = [
  ["lowFire", "Low fire", "flame", "Shrinks the fire overlay so it stops covering the screen."],
  ["lowShield", "Low shield", "shield", "Lowers the shield in your hand so you can see past it."],
  ["compactTotem", "Compact totem", "star", "Shrinks the totem pop animation."],
  ["noPumpkin", "Remove pumpkin overlay", "eye", "Hides the pumpkin face when you wear one.", true],
  ["noFrost", "Remove powder-snow frost", "eye", "Hides the blue frost border.", true],
  ["noNausea", "Remove nausea wobble", "eye", "Stops the screen warping with Nausea.", true],
  ["noSpyglass", "Remove spyglass vignette", "eye", "Clear edges while zoomed with the spyglass.", true],
  ["noFlash", "Remove explosion flash", "bolt", "Hides the white flash on nearby explosions."],
  ["noRipple", "Remove rain ripples", "cloud", "Drops the splash particles on the ground in rain."],
  ["clearWater", "Crystal-clear water", "eye", "Removes underwater fog and tint.", true],
  ["clearLava", "Crystal-clear lava", "eye", "Lets you see through lava. Server may flag.", true],
  ["tameParticles", "Particle taming", "cpu", "Caps particle counts from big fights."],
];
const FLAGGED = new Set(QOL.filter((q) => q[4]).map((q) => q[0]));
const loadCfg = () => { try { return JSON.parse(localStorage.getItem("luminos.client.v1") || "{}"); } catch { return {}; } };

export default function ClientPage() {
  const s = useSettings();
  const [cfg, setCfg] = useState<Record<string, any>>(() => ({ lowFireOffset: 40, fogMult: 100, noFlash: true, tameParticles: true, ...loadCfg() }));
  const [cross, setCross] = useState<Cross>(() => ({ ...(CROSS_PRESETS[s.crosshair] || CROSS_PRESETS["dot-ring"]) }));
  const [spread, setSpread] = useState(0);
  const [customPng, setCustomPng] = useState<string | null>(null);
  const put = (k: string, v: any) => setCfg((c) => { const n = { ...c, [k]: v }; localStorage.setItem("luminos.client.v1", JSON.stringify(n)); return n; });
  const pick = (id: string) => { set("crosshair", id); setCross({ ...CROSS_PRESETS[id] }); setCustomPng(null); };
  const edit = (p: Partial<Cross>) => setCross((c) => ({ ...c, ...p }));
  const attack = () => { setSpread(5); setTimeout(() => setSpread(0), 260); };
  const comp = s.compliance;
  const on = (k: string) => !!cfg[k] && !(comp && FLAGGED.has(k));
  return (
    <div className="max-w-[1180px] grid gap-3" style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)" }}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {(["pvp", "survival"] as const).map((id) => { const P = PRESETS[id]; const active = Object.entries(P.set).every(([k, v]) => (s as any)[k] === v); return (
            <div key={id} className="panel p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "color-mix(in srgb, var(--color-accent) 16%, transparent)" }}><Icon n={P.icon} s={15} /></span><span className="t3 font-semibold flex-1">{P.name}</span>{active && <Badge tone="ok"><Icon n="check" s={10} />Active</Badge>}</div>
              <p className="t1 mute m-0" style={{ minHeight: 30 }}>{P.line}</p>
              <button className="btn btn-primary" onClick={() => { Object.entries(P.set).forEach(([k, v]) => set(k as any, v as any)); setCross({ ...CROSS_PRESETS[P.set.crosshair] }); }}>Apply preset</button>
            </div>); })}
        </div>

        <div className="panel p-3">
          <div className="flex items-center justify-between mb-2"><div className="eyebrow">Crosshair</div><div className="flex gap-1.5 items-center"><button className="btn !h-6" onClick={attack}><Icon n="target" s={11} />Preview attack</button><label className="btn !h-6 cursor-pointer"><Icon n="upload" s={11} />Import PNG<input className="sr-only" type="file" accept="image/png" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setCustomPng(String(r.result)); r.readAsDataURL(f); }} /></label></div></div>
          <div className="grid grid-cols-8 gap-1.5 mb-3">{Object.entries(CROSS_PRESETS).map(([id, c]) => <button key={id} onClick={() => pick(id)} aria-label={`Crosshair preset ${c.name}`} aria-pressed={s.crosshair === id} title={c.name} className="lift rounded-lg p-0.5" style={{ border: `1px solid ${s.crosshair === id ? "var(--color-accent)" : "var(--color-line)"}` }}><Cross c={c} size={64} /></button>)}</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "140px 1fr" }}>
            <div className="relative">{customPng ? <div className="rounded-lg overflow-hidden relative" style={{ width: 140, height: 140, background: "url(/covers/26.3.jpg) 40% 30%/cover" }}><img src={customPng} alt="Imported crosshair" className="skin-px absolute" style={{ left: 40, top: 40, width: 60, height: 60 }} /></div> : <Cross c={cross} size={140} spread={spread} />}<div className="t1 mute mt-1 text-center truncate">{customPng ? "Imported PNG (15×15 best)" : cross.name}</div></div>
            <div className="flex flex-col gap-0.5">
              <div className="lrow justify-between"><span className="t2">Shape</span><div className="flex gap-1">{(["cross", "dot", "circle", "T", "X"] as const).map((sh) => <Chip key={sh} on={cross.shape === sh} onClick={() => edit({ shape: sh })}>{sh}</Chip>)}</div></div>
              {([["thickness", "Thickness", 1, 5], ["gap", "Gap", 0, 10], ["length", "Length", 1, 14], ["outline", "Outline", 0, 2]] as const).map(([k, l, a, b]) => <div key={k} className="lrow justify-between"><span className="t2">{l}</span><Slider label={l} value={cross[k]} min={a} max={b} onChange={(v) => edit({ [k]: v } as any)} /></div>)}
              <div className="lrow justify-between"><span className="t2">Opacity</span><Slider label="Opacity" value={Math.round(cross.opacity * 100)} min={20} max={100} fmt={(v) => v + "%"} onChange={(v) => edit({ opacity: v / 100 })} /></div>
              <div className="lrow justify-between"><span className="t2">Colour</span><div className="flex items-center gap-1.5">{["#ffffff", "var(--color-accent)", "var(--color-ok)", "var(--color-warn)", "var(--color-bad)", "#b6f06a"].map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => edit({ color: c })} className="w-5 h-5 rounded-md" style={{ background: c, outline: cross.color === c ? "2px solid #fff" : "1px solid color-mix(in srgb, var(--color-fg) 25%, transparent)", outlineOffset: 1 }} />)}</div></div>
              <div className="lrow justify-between"><span className="t2">Spread on attack</span><Switch label="Dynamic spread on attack" on={cross.spread} onChange={(v) => edit({ spread: v })} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="panel p-3">
          <div className="eyebrow mb-2">Keystrokes layout</div>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((k) => (
              <button key={k} onClick={() => set("keystrokes", k)} aria-pressed={s.keystrokes === k} className="lift text-left rounded-lg p-1" style={{ border: `1px solid ${s.keystrokes === k ? "var(--color-accent)" : "var(--color-line)"}` }}>
                <div className="relative rounded-md overflow-hidden" style={{ aspectRatio: "16/9", background: "url(/covers/26.3.jpg) center/cover" }}>
                  {k === "A" ? <div className="absolute left-2 top-2 flex flex-col gap-[5px] items-start"><div className="grid grid-cols-3 gap-[3px]">{["", "W", "", "A", "S", "D"].map((c, i) => <span key={i} className="w-3.5 h-3.5 grid place-items-center rounded-[3px] text-[7px] font-bold" style={{ background: c ? "color-mix(in srgb, var(--inset) 60%, transparent)" : "transparent", color: "#fff" }}>{c}</span>)}</div><div className="flex gap-[3px]"><span className="w-[23px] h-3 rounded-[3px] bg-[color-mix(in srgb, var(--inset) 60%, transparent)]" /><span className="w-[23px] h-3 rounded-[3px] bg-[color-mix(in srgb, var(--inset) 60%, transparent)]" /></div><span className="px-1.5 text-[7px] font-bold rounded-[3px] bg-[color-mix(in srgb, var(--inset) 60%, transparent)]">7 | 3 CPS</span><span className="px-1.5 text-[7px] font-bold rounded-[3px] bg-[color-mix(in srgb, var(--inset) 60%, transparent)]">240 FPS</span></div>
                    : <><div className="absolute left-1/2 -translate-x-1/2 bottom-[26px] grid grid-cols-3 gap-[3px]">{["", "W", "", "A", "S", "D"].map((c, i) => <span key={i} className="w-3.5 h-3.5 grid place-items-center rounded-[3px] text-[7px] font-bold" style={{ background: c ? "color-mix(in srgb, var(--inset) 60%, transparent)" : "transparent" }}>{c}</span>)}</div><div className="absolute left-1/2 -translate-x-1/2 bottom-1.5 flex gap-px">{Array.from({ length: 9 }).map((_, i) => <span key={i} className="w-3 h-3 rounded-[2px] bg-[color-mix(in srgb, var(--inset) 55%, transparent)] border border-white/20" />)}</div><div className="absolute right-3 bottom-1.5 flex flex-col gap-[3px] items-end"><span className="px-1.5 text-[7px] font-bold rounded-[3px] bg-[color-mix(in srgb, var(--inset) 60%, transparent)]">7 | 3 CPS</span><span className="px-1.5 text-[7px] font-bold rounded-[3px] bg-[color-mix(in srgb, var(--inset) 60%, transparent)]">240 FPS</span></div></>}
                </div>
                <div className="px-1 pt-1 flex items-center gap-1.5"><span className="t2 font-semibold whitespace-nowrap">Preset {k}</span>{k === "A" && <Badge>Default</Badge>}<span className="t1 mute truncate">{k === "A" ? "Top-left stack" : "Above hotbar"}</span></div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-2.5">
          <div className="flex items-center justify-between mb-1"><div className="eyebrow">Quality of life · built in</div><div className="flex items-center gap-2"><span className="t1 mute">Compliance mode</span><Switch label="Compliance mode" on={comp} onChange={(v) => set("compliance", v)} /></div></div>
          {comp && <div className="t1 mb-1 px-1" style={{ color: "var(--color-warn)" }}>Compliance on: options servers may flag are switched off and locked.</div>}
          <div className="overflow-y-auto" style={{ maxHeight: 392 }}>
            {QOL.map(([k, name, ic, desc, flagged]) => (
              <LRow key={k} icon={ic === "flame" ? "bolt" : ic} name={name} desc={comp && flagged ? "Disabled by compliance mode" : desc}>
                {k === "lowFire" && on(k) && <Slider label="Low fire offset" value={cfg.lowFireOffset} min={0} max={100} fmt={(v) => v + "%"} onChange={(v) => put("lowFireOffset", v)} />}
                <Switch label={name} on={on(k)} onChange={(v) => !(comp && flagged) && put(k, v)} />
              </LRow>
            ))}
            {(["Overworld", "Nether", "End"] as const).map((d) => { const key = "fog" + d; return <LRow key={d} icon="cloud" name={`Fog: ${d}`} desc="Turns the distance fog off in this dimension."><Switch label={`Fog ${d}`} on={!(s as any)[key]} onChange={(v) => set(key as any, !v)} /></LRow>; })}
            <LRow icon="gauge" name="Fog distance" desc="Multiplies how far fog starts."><Slider label="Fog distance multiplier" value={cfg.fogMult} min={50} max={300} step={10} fmt={(v) => (v / 100).toFixed(1) + "×"} onChange={(v) => put("fogMult", v)} /></LRow>
          </div>
        </div>
        <div className="t1 mute px-1 flex items-start gap-1.5"><Icon n="warn" s={12} className="shrink-0 mt-0.5" />These are written to luminos-client.json. The in-game reader for this file is not in the shipped client yet (UNVERIFIED in game), so changes here are saved but not yet applied.</div>
      </div>
    </div>
  );
}
