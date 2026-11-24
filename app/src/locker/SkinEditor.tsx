import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Modal } from "../kit";
import { layerMask, loadCanvas, mirrorPoint, toDataUrl } from "./skinfile";

type Tool = "brush" | "eraser" | "fill" | "picker";
type Layer = "base" | "overlay" | "both";
const SCALE = 8;

/** Pixel editor for a 64×64 skin. Brush, eraser, fill, picker, mirror, layers, undo/redo, and a reference image to sample from. */
export default function SkinEditor({ src, name: initial, slim: initialSlim, mine, onSave, onClose }: { src: string; name: string; slim: boolean; mine: boolean; onSave: (r: { name: string; slim: boolean; data: string; asNew: boolean }) => void; onClose: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null), work = useRef<HTMLCanvasElement | null>(null), refCv = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("brush"), [color, setColor] = useState("#4cc38a"), [size, setSize] = useState(1), [mirror, setMirror] = useState(false);
  const [layer, setLayer] = useState<Layer>("both"), [showOverlay, setShowOverlay] = useState(true), [name, setName] = useState(initial), [slim, setSlim] = useState(initialSlim);
  const [hist, setHist] = useState<ImageData[]>([]), [at, setAt] = useState(0), [ready, setReady] = useState(false), [hasRef, setHasRef] = useState(false), [, bump] = useState(0);
  const drawing = useRef(false), last = useRef<[number, number] | null>(null);
  const mask = useMemo(() => layerMask(slim), [slim]);

  const render = () => {
    const c = cv.current, w = work.current; if (!c || !w) return; const g = c.getContext("2d")!; g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 512, 512);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { g.fillStyle = (x + y) % 2 ? "#3a3c43" : "#2f3137"; g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE); }
    if (showOverlay) g.drawImage(w, 0, 0, 512, 512);
    else { const t = document.createElement("canvas"); t.width = 64; t.height = 64; const tg = t.getContext("2d")!; tg.drawImage(w, 0, 0); const id = tg.getImageData(0, 0, 64, 64); for (let i = 0; i < 4096; i++) if (mask[i] === 1) id.data[i * 4 + 3] = 0; tg.putImageData(id, 0, 0); g.drawImage(t, 0, 0, 512, 512); }
    if (layer !== "both") { g.fillStyle = "rgba(0,0,0,.55)"; for (let i = 0; i < 4096; i++) { const m = mask[i]; if ((layer === "base" && m === 1) || (layer === "overlay" && m === 0)) g.fillRect((i % 64) * SCALE, Math.floor(i / 64) * SCALE, SCALE, SCALE); } }
  };
  useEffect(() => { let alive = true; loadCanvas(src).then((c) => { if (!alive) return; work.current = c; const s = c.getContext("2d")!.getImageData(0, 0, 64, 64); setHist([s]); setAt(0); setReady(true); }).catch(() => { }); return () => { alive = false; }; }, [src]);
  useEffect(render, [ready, at, layer, showOverlay, slim, hist]);

  const snap = () => { const s = work.current!.getContext("2d")!.getImageData(0, 0, 64, 64); const h = [...hist.slice(0, at + 1), s].slice(-60); setHist(h); setAt(h.length - 1); };
  const restore = (i: number) => { work.current!.getContext("2d")!.putImageData(hist[i], 0, 0); setAt(i); };
  const allowed = (x: number, y: number) => x >= 0 && y >= 0 && x < 64 && y < 64 && (layer === "both" || mask[y * 64 + x] === 2 || (layer === "base" ? mask[y * 64 + x] === 0 : mask[y * 64 + x] === 1));
  const px = (x: number, y: number, erase: boolean) => {
    const g = work.current!.getContext("2d")!;
    const pts: [number, number][] = [[x, y]]; if (mirror) { const m = mirrorPoint(x, y, slim); if (m) pts.push(m); }
    for (const [ax, ay] of pts) for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) { const X = ax + dx, Y = ay + dy; if (!allowed(X, Y)) continue; if (erase) g.clearRect(X, Y, 1, 1); else { g.fillStyle = color; g.fillRect(X, Y, 1, 1); } }
  };
  const fill = (x: number, y: number) => {
    const g = work.current!.getContext("2d")!, id = g.getImageData(0, 0, 64, 64), d = id.data; const k = (X: number, Y: number) => (Y * 64 + X) * 4;
    const t = [d[k(x, y)], d[k(x, y) + 1], d[k(x, y) + 2], d[k(x, y) + 3]]; const n = parseInt(color.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255, 255];
    if (t.every((v, i) => v === c[i])) return; const seen = new Set<number>(), st: [number, number][] = [[x, y]];
    while (st.length) { const [X, Y] = st.pop()!; if (X < 0 || Y < 0 || X > 63 || Y > 63 || seen.has(Y * 64 + X) || !allowed(X, Y)) continue; const i = k(X, Y); if (d[i] !== t[0] || d[i + 1] !== t[1] || d[i + 2] !== t[2] || d[i + 3] !== t[3]) continue; seen.add(Y * 64 + X); d.set(c, i); st.push([X + 1, Y], [X - 1, Y], [X, Y + 1], [X, Y - 1]); }
    g.putImageData(id, 0, 0);
  };
  const cell = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left) / r.width) * 64), Math.floor(((e.clientY - r.top) / r.height) * 64)]; };
  const down = (e: React.PointerEvent) => {
    const [x, y] = cell(e); (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === "picker") { const d = work.current!.getContext("2d")!.getImageData(x, y, 1, 1).data; if (d[3]) setColor("#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")); return; }
    if (tool === "fill") { fill(x, y); snap(); render(); return; }
    drawing.current = true; last.current = [x, y]; px(x, y, tool === "eraser"); render();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return; const [x, y] = cell(e), [lx, ly] = last.current!; const n = Math.max(Math.abs(x - lx), Math.abs(y - ly), 1);
    for (let i = 1; i <= n; i++) px(Math.round(lx + ((x - lx) * i) / n), Math.round(ly + ((y - ly) * i) / n), tool === "eraser"); last.current = [x, y]; render();
  };
  const up = () => { if (drawing.current) { drawing.current = false; snap(); } };
  const swatches = useMemo(() => { if (!ready || !work.current) return []; const d = work.current.getContext("2d")!.getImageData(0, 0, 64, 64).data, cnt = new Map<string, number>(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) { const h = "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""); cnt.set(h, (cnt.get(h) || 0) + 1); } return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map((e) => e[0]); }, [ready]);
  const loadRef = (f?: File | null) => { if (!f) return; const im = new Image(); im.onload = () => { const c = refCv.current!, g = c.getContext("2d", { willReadFrequently: true })!; const s = Math.min(1, 200 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); g.drawImage(im, 0, 0, c.width, c.height); setHasRef(true); }; im.src = URL.createObjectURL(f); };
  const pickRef = (e: React.MouseEvent) => { const c = refCv.current!, r = c.getBoundingClientRect(), d = c.getContext("2d")!.getImageData(Math.floor(((e.clientX - r.left) / r.width) * c.width), Math.floor(((e.clientY - r.top) / r.height) * c.height), 1, 1).data; setColor("#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")); setTool("brush"); };
  useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); if (at > 0) restore(at - 1); } if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); if (at < hist.length - 1) restore(at + 1); } }; addEventListener("keydown", f); return () => removeEventListener("keydown", f); });

  const T = ({ id, icon, label }: { id: Tool; icon: string; label: string }) => <button className="ibtn !w-9 !h-9" aria-pressed={tool === id} title={label} aria-label={label} onClick={() => setTool(id)}><Icon n={icon} s={16} /></button>;
  return (
    <Modal title={mine ? "Edit skin" : "Edit a copy"} w={860} onClose={onClose}>
      <div className="flex gap-4">
        <div>
          <canvas ref={cv} width={512} height={512} className="skin-px block rounded-md" style={{ width: 512, height: 512, border: "1px solid var(--line)", touchAction: "none", cursor: tool === "picker" ? "crosshair" : "cell" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} aria-label="Skin canvas" />
          <div className="flex items-center gap-2 mt-2">
            <button className="btn" disabled={at <= 0} onClick={() => restore(at - 1)}><Icon n="undo" s={13} />Undo</button>
            <button className="btn" disabled={at >= hist.length - 1} onClick={() => restore(at + 1)}><Icon n="redo" s={13} />Redo</button>
            <span className="t1 mute num">{at} / {Math.max(0, hist.length - 1)} steps</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div><div className="eyebrow mb-1">Tools</div><div className="flex gap-1"><T id="brush" icon="brush" label="Brush" /><T id="eraser" icon="eraser" label="Eraser" /><T id="fill" icon="bucket" label="Fill" /><T id="picker" icon="pipette" label="Colour picker" /></div></div>
          <div className="flex items-center gap-2"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour" className="w-9 h-9 rounded-md border border-line bg-transparent p-0" /><span className="t2 num">{color}</span><label className="t1 mute ml-auto">Size <select className="field plain !w-14 !h-7 inline-block" value={size} onChange={(e) => setSize(+e.target.value)}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label></div>
          <div className="flex flex-wrap gap-1">{swatches.map((s) => <button key={s} aria-label={`Use ${s}`} onClick={() => setColor(s)} className="w-5 h-5 rounded-sm" style={{ background: s, border: `1px solid ${s === color ? "var(--fg)" : "var(--line)"}` }} />)}</div>
          <div className="flex items-center justify-between"><span className="t2">Mirror left and right</span><button role="switch" aria-checked={mirror} aria-label="Mirror" className="sw" onClick={() => setMirror(!mirror)} /></div>
          <div><div className="eyebrow mb-1">Layer</div><div className="flex gap-1">{(["both", "base", "overlay"] as Layer[]).map((l) => <button key={l} className="chip" data-on={layer === l} onClick={() => setLayer(l)}><span className="capitalize">{l === "both" ? "Both" : l}</span></button>)}</div></div>
          <div className="flex items-center justify-between"><span className="t2">Show overlay layer</span><button role="switch" aria-checked={showOverlay} aria-label="Show overlay layer" className="sw" onClick={() => setShowOverlay(!showOverlay)} /></div>
          <div><div className="eyebrow mb-1">Reference image</div>
            <label className="btn w-full cursor-pointer"><Icon n="upload" s={13} />Import reference<input type="file" accept="image/*" className="hidden" onChange={(e) => loadRef(e.target.files?.[0])} /></label>
            <canvas ref={refCv} onClick={pickRef} className="mt-2 rounded-md" style={{ display: hasRef ? "block" : "none", maxWidth: "100%", border: "1px solid var(--line)", cursor: "crosshair" }} aria-label="Reference image: click to pick a colour" />
            {hasRef && <div className="t1 mute mt-1">Click the image to pick a colour from it.</div>}</div>
          <div className="mt-auto flex flex-col gap-2">
            <input className="field plain" value={name} onChange={(e) => setName(e.target.value.slice(0, 32))} aria-label="Skin name" />
            <div className="flex items-center justify-between"><span className="t2">Slim arms (3 px)</span><button role="switch" aria-checked={slim} aria-label="Slim arms" className="sw" onClick={() => { setSlim(!slim); bump((n) => n + 1); }} /></div>
            <div className="flex gap-2">
              {mine && <button className="btn btn-primary flex-1" onClick={() => onSave({ name, slim, data: toDataUrl(work.current!), asNew: false })}>Save</button>}
              <button className={`btn flex-1 ${mine ? "" : "btn-primary"}`} onClick={() => onSave({ name: mine ? name + " copy" : name, slim, data: toDataUrl(work.current!), asNew: true })}>{mine ? "Save as new" : "Save as my skin"}</button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
