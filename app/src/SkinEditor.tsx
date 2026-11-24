import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./kit";
import { Stage } from "./cos3d";
import { layout, mask, mirrorMap, SkinEntry, srcOf, toData } from "./skinio";

type Tool = "brush" | "eraser" | "fill" | "pick";
const Z = 8;
export default function SkinEditor({ skin, onSave, onClose }: { skin: SkinEntry; onSave: (e: SkinEntry, asNew: boolean) => void; onClose: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null), grid = useRef<HTMLCanvasElement>(null), prev = useRef<HTMLCanvasElement>(null);
  const px = useRef<HTMLCanvasElement>(document.createElement("canvas")); const ref = useRef<HTMLImageElement | null>(null);
  const stage = useRef<Stage | null>(null); const undo = useRef<ImageData[]>([]); const redo = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<Tool>("brush"); const [color, setColor] = useState("#3fb68b"); const [size, setSize] = useState(1);
  const [mirror, setMirror] = useState(false); const [layer, setLayer] = useState<0 | 1>(0); const [showOuter, setShowOuter] = useState(true);
  const [slim, setSlim] = useState(skin.model === "slim"); const [name, setName] = useState(skin.origin === "mine" ? skin.name : skin.name + " copy");
  const [refOn, setRefOn] = useState(false); const [refA, setRefA] = useState(40); const [tick, setTick] = useState(0); const [loaded, setLoaded] = useState(false);
  const masks = useMemo(() => [mask(slim, 0), mask(slim, 1)], [slim]); const mir = useMemo(() => mirrorMap(slim), [slim]);
  const g = () => px.current.getContext("2d", { willReadFrequently: true })!;

  const draw = () => {
    const c = cv.current!.getContext("2d")!; c.imageSmoothingEnabled = false; c.clearRect(0, 0, 64 * Z, 64 * Z);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { c.fillStyle = (x + y) % 2 ? "#2b2d31" : "#25272b"; c.fillRect(x * Z, y * Z, Z, Z); }
    if (ref.current && refOn) { c.globalAlpha = refA / 100; c.drawImage(ref.current, 0, 0, 64 * Z, 64 * Z); c.globalAlpha = 1; }
    if (showOuter) c.drawImage(px.current, 0, 0, 64 * Z, 64 * Z);
    else { const t = document.createElement("canvas"); t.width = t.height = 64; const tg = t.getContext("2d")!; const d = g().getImageData(0, 0, 64, 64); for (let i = 0; i < 4096; i++) if (!masks[0][i] || masks[1][i]) d.data[i * 4 + 3] = masks[0][i] && !masks[1][i] ? d.data[i * 4 + 3] : (masks[0][i] ? d.data[i * 4 + 3] : 0); tg.putImageData(d, 0, 0); c.drawImage(t, 0, 0, 64 * Z, 64 * Z); }
    const gr = grid.current!.getContext("2d")!; gr.clearRect(0, 0, 64 * Z, 64 * Z); gr.lineWidth = 1;
    for (const f of layout(slim)) { if (f.layer !== layer) continue; gr.strokeStyle = "rgba(255,255,255,.35)"; gr.strokeRect(f.x * Z + .5, f.y * Z + .5, f.w * Z - 1, f.h * Z - 1); }
  };
  const push = () => { undo.current.push(g().getImageData(0, 0, 64, 64)); if (undo.current.length > 60) undo.current.shift(); redo.current = []; };
  const sync = () => { draw(); setTick((n) => n + 1); stage.current?.setSkin(toData(px.current), slim); };
  useEffect(() => { // load the skin once
    px.current.width = px.current.height = 64; const im = new Image(); im.onload = () => { g().drawImage(im, 0, 0); setLoaded(true); }; im.src = srcOf(skin);
    stage.current = new Stage(prev.current!, 300, 380); stage.current.state = "idle"; return () => stage.current?.dispose();
  }, []);
  useEffect(() => { if (loaded) sync(); }, [loaded, slim, showOuter, layer, refOn, refA]);

  const put = (x: number, y: number, erase: boolean) => {
    const set = (i: number) => { if (!masks[layer][i]) return; const X = i % 64, Y = (i / 64) | 0; const c = g(); if (erase) c.clearRect(X, Y, 1, 1); else { c.fillStyle = color; c.fillRect(X, Y, 1, 1); } };
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) { const X = x + dx, Y = y + dy; if (X > 63 || Y > 63) continue; const i = Y * 64 + X; set(i); if (mirror && mir[i] >= 0) set(mir[i]); }
  };
  const flood = (x: number, y: number) => {
    const c = g(), d = c.getImageData(0, 0, 64, 64), s = (y * 64 + x) * 4, t = [d.data[s], d.data[s + 1], d.data[s + 2], d.data[s + 3]]; const n = parseInt(color.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    if (t[0] === r && t[1] === gg && t[2] === b && t[3] === 255) return; const st = [y * 64 + x], seen = new Set<number>(); const same = (i: number) => d.data[i * 4] === t[0] && d.data[i * 4 + 1] === t[1] && d.data[i * 4 + 2] === t[2] && d.data[i * 4 + 3] === t[3];
    const faceOf = (i: number) => layout(slim).find((f) => f.layer === layer && (i % 64) >= f.x && (i % 64) < f.x + f.w && ((i / 64) | 0) >= f.y && ((i / 64) | 0) < f.y + f.h);
    const home = faceOf(y * 64 + x); if (!home) return;
    while (st.length) { const i = st.pop()!; if (seen.has(i)) continue; seen.add(i); const X = i % 64, Y = (i / 64) | 0; if (X < home.x || X >= home.x + home.w || Y < home.y || Y >= home.y + home.h || !same(i)) continue; d.data[i * 4] = r; d.data[i * 4 + 1] = gg; d.data[i * 4 + 2] = b; d.data[i * 4 + 3] = 255; if (mirror && mir[i] >= 0) { const j = mir[i]; d.data[j * 4] = r; d.data[j * 4 + 1] = gg; d.data[j * 4 + 2] = b; d.data[j * 4 + 3] = 255; } st.push(i + 1, i - 1, i + 64, i - 64); }
    c.putImageData(d, 0, 0);
  };
  const act = (e: React.PointerEvent, first: boolean) => {
    const r = cv.current!.getBoundingClientRect(); const x = Math.floor(((e.clientX - r.left) / r.width) * 64), y = Math.floor(((e.clientY - r.top) / r.height) * 64); if (x < 0 || y < 0 || x > 63 || y > 63) return;
    if (tool === "pick") { const d = g().getImageData(x, y, 1, 1).data; if (d[3]) setColor("#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")); setTool("brush"); return; }
    if (first) push(); if (tool === "fill") flood(x, y); else put(x, y, tool === "eraser"); draw();
  };
  const down = useRef(false);
  const doUndo = () => { const s = undo.current.pop(); if (!s) return; redo.current.push(g().getImageData(0, 0, 64, 64)); g().putImageData(s, 0, 0); sync(); };
  const doRedo = () => { const s = redo.current.pop(); if (!s) return; undo.current.push(g().getImageData(0, 0, 64, 64)); g().putImageData(s, 0, 0); sync(); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); } }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  const loadRef = (f?: File | null) => { if (!f) return; const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => { ref.current = im; setRefOn(true); }; im.src = u; };
  const save = (asNew: boolean) => onSave({ ...skin, id: asNew || skin.origin !== "mine" ? "mine-" + Date.now() : skin.id, name: name.trim() || "My skin", model: slim ? "slim" : "classic", data: toData(px.current), origin: "mine", file: undefined, from: skin.origin === "mine" ? skin.from : skin.name }, asNew);
  const T = ({ id, label, icon }: { id: Tool; label: string; icon: string }) => <button className="ibtn" aria-pressed={tool === id} aria-label={label} title={label} onClick={() => setTool(id)}><Icon n={icon} s={16} /></button>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }} role="dialog" aria-label="Skin editor">
      <div className="panel flex flex-col" style={{ width: 1000, maxWidth: "96vw", maxHeight: "96vh" }}>
        <div className="flex items-center gap-2 px-3 h-12 shrink-0" style={{ borderBottom: "1px solid var(--color-line)" }}>
          <Icon n="edit" s={16} /><input className="field plain !w-[220px]" value={name} onChange={(e) => setName(e.target.value)} aria-label="Skin name" />
          <div className="seg"><button aria-pressed={!slim} onClick={() => setSlim(false)}>Classic</button><button aria-pressed={slim} onClick={() => setSlim(true)}>Slim</button></div>
          <div className="flex-1" />
          <button className="btn" onClick={() => save(true)}>Save as new</button>
          <button className="btn btn-primary" onClick={() => save(false)}>{skin.origin === "mine" ? "Save" : "Save a copy"}</button>
          <button className="ibtn" aria-label="Close editor" onClick={onClose}><Icon n="x" s={16} /></button>
        </div>
        <div className="flex gap-4 p-3 overflow-auto min-h-0">
          <div className="flex flex-col gap-2 items-center shrink-0">
            <div className="flex flex-col gap-1">
              <T id="brush" label="Brush" icon="edit" /><T id="eraser" label="Eraser" icon="eraser" /><T id="fill" label="Fill" icon="bucket" /><T id="pick" label="Colour picker" icon="pipette" />
              <div style={{ height: 1, background: "var(--color-line)" }} />
              <button className="ibtn" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={doUndo}><Icon n="undo" s={16} /></button>
              <button className="ibtn" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={doRedo}><Icon n="redo" s={16} /></button>
              <button className="ibtn" aria-pressed={mirror} aria-label="Mirror left and right" title="Mirror left and right" onClick={() => setMirror(!mirror)}><Icon n="mirror" s={16} /></button>
            </div>
          </div>
          <div className="relative shrink-0" style={{ width: 64 * Z, height: 64 * Z, border: "1px solid var(--color-line)" }}>
            <canvas ref={cv} width={64 * Z} height={64 * Z} className="skin-px absolute inset-0" style={{ cursor: tool === "pick" ? "copy" : "crosshair", touchAction: "none" }} aria-label="Skin texture"
              onPointerDown={(e) => { down.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); act(e, true); }} onPointerMove={(e) => down.current && tool !== "fill" && tool !== "pick" && act(e, false)}
              onPointerUp={() => { if (down.current) { down.current = false; sync(); } }} />
            <canvas ref={grid} width={64 * Z} height={64 * Z} className="absolute inset-0 pointer-events-none" />
          </div>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <div className="panel p-2.5 flex flex-col gap-2">
              <div className="eyebrow">Colour</div>
              <div className="flex items-center gap-2"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour" style={{ width: 36, height: 28, background: "none", border: "1px solid var(--color-line)", borderRadius: 6 }} /><input className="field plain num" value={color} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && setColor(e.target.value)} aria-label="Hex colour" /></div>
              <div className="flex items-center justify-between"><span className="t2">Brush size</span><div className="seg">{[1, 2, 3].map((n) => <button key={n} aria-pressed={size === n} onClick={() => setSize(n)}>{n}</button>)}</div></div>
            </div>
            <div className="panel p-2.5 flex flex-col gap-2">
              <div className="eyebrow">Layer</div>
              <div className="seg self-start"><button aria-pressed={layer === 0} onClick={() => setLayer(0)}>Base</button><button aria-pressed={layer === 1} onClick={() => setLayer(1)}>Outer</button></div>
              <label className="flex items-center justify-between t2">Show outer layer<button role="switch" aria-checked={showOuter} aria-label="Show outer layer" className="sw" onClick={() => setShowOuter(!showOuter)} /></label>
              <div className="t1 mute">Painting only changes the layer you pick. Outlines show its faces.</div>
            </div>
            <div className="panel p-2.5 flex flex-col gap-2">
              <div className="eyebrow">Reference image</div>
              <label className="btn self-start cursor-pointer"><Icon n="upload" s={14} />Import image<input type="file" accept="image/*" hidden onChange={(e) => loadRef(e.target.files?.[0])} /></label>
              {ref.current && <div className="flex items-center gap-2"><button role="switch" aria-checked={refOn} aria-label="Show reference" className="sw" onClick={() => setRefOn(!refOn)} /><input type="range" className="rng" min={10} max={90} value={refA} onChange={(e) => setRefA(+e.target.value)} aria-label="Reference opacity" /></div>}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0"><canvas ref={prev} width={300} height={380} aria-label="3D preview" /><span className="t1 mute">Preview updates when you lift the pen. Drag to turn.</span></div>
        </div>
      </div>
    </div>
  );
}
