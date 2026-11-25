import { useEffect, useRef, useState } from "react";
import { Modal } from "./ui";
import { Icon } from "./Icon";
import { loadCanvas, toDataUrl } from "../locker/skinfile";

type Tool = "brush" | "eraser" | "fill" | "picker";
const S = 7;

/** Small pixel editor for a 64×64 skin: brush, eraser, fill, picker, undo/redo. Plain 2D canvas, no WebGL. */
export default function SkinEditor({ src, name: initial, slim: initialSlim, mine, onSave, onClose }: { src: string; name: string; slim: boolean; mine: boolean; onSave: (r: { name: string; slim: boolean; data: string; asNew: boolean }) => void; onClose: () => void }) {
  const view = useRef<HTMLCanvasElement>(null), work = useRef<HTMLCanvasElement | null>(null);
  const undo = useRef<ImageData[]>([]), redo = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<Tool>("brush"), [color, setColor] = useState("#2B4BFF"), [size, setSize] = useState(1), [name, setName] = useState(initial), [slim, setSlim] = useState(initialSlim), [, bump] = useState(0);
  const draw = () => {
    const g = view.current!.getContext("2d")!; g.imageSmoothingEnabled = false; g.clearRect(0, 0, 64 * S, 64 * S);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { g.fillStyle = (x + y) % 2 ? "#1b202c" : "#161a24"; g.fillRect(x * S, y * S, S, S); }
    g.drawImage(work.current!, 0, 0, 64 * S, 64 * S);
  };
  useEffect(() => { let live = true; loadCanvas(src).then((c) => { if (!live) return; work.current = c; draw(); bump((n) => n + 1); }).catch(() => undefined); return () => { live = false; }; }, [src]);
  const snapshot = () => { const g = work.current!.getContext("2d")!; undo.current.push(g.getImageData(0, 0, 64, 64)); if (undo.current.length > 60) undo.current.shift(); redo.current = []; };
  const paint = (e: React.PointerEvent) => {
    const r = view.current!.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * 64), y = Math.floor(((e.clientY - r.top) / r.height) * 64);
    if (x < 0 || y < 0 || x > 63 || y > 63) return;
    const g = work.current!.getContext("2d")!;
    if (tool === "picker") { const d = g.getImageData(x, y, 1, 1).data; if (d[3]) setColor("#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()); setTool("brush"); return; }
    if (tool === "eraser") g.clearRect(x, y, size, size);
    else if (tool === "brush") { g.fillStyle = color; g.fillRect(x, y, size, size); }
    else {
      const img = g.getImageData(0, 0, 64, 64), d = img.data, i0 = (y * 64 + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
      const n = parseInt(color.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255, 255];
      if (t.every((v, i) => v === c[i])) return;
      const st = [[x, y]]; while (st.length) { const [px, py] = st.pop()!; if (px < 0 || py < 0 || px > 63 || py > 63) continue; const i = (py * 64 + px) * 4; if (d[i] !== t[0] || d[i + 1] !== t[1] || d[i + 2] !== t[2] || d[i + 3] !== t[3]) continue; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); }
      g.putImageData(img, 0, 0);
    }
    draw();
  };
  const step = (from: ImageData[], to: ImageData[]) => { const g = work.current!.getContext("2d")!, prev = from.pop(); if (!prev) return; to.push(g.getImageData(0, 0, 64, 64)); g.putImageData(prev, 0, 0); draw(); bump((n) => n + 1); };
  const tools: [Tool, string][] = [["brush", "Brush"], ["eraser", "Eraser"], ["fill", "Fill"], ["picker", "Picker"]];
  return (
    <Modal title="Pixel Skin Editor" onClose={onClose} w={640}>
      <div className="flex gap-5">
        <canvas ref={view} width={64 * S} height={64 * S} className="skin-px rounded-[10px] touch-none shrink-0" style={{ width: 64 * S, height: 64 * S, cursor: "crosshair" }} aria-label="Skin canvas"
          onPointerDown={(e) => { if (!work.current) return; if (tool !== "picker") snapshot(); e.currentTarget.setPointerCapture(e.pointerId); paint(e); }} onPointerMove={(e) => { if (e.buttons === 1 && (tool === "brush" || tool === "eraser")) paint(e); }} />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-2">{tools.map(([t, l]) => <button key={t} aria-pressed={tool === t} onClick={() => setTool(t)} className="h-9 rounded-[8px] text-[12.5px] font-medium t" style={{ background: tool === t ? "var(--accent)" : "var(--surface-2)", color: tool === t ? "var(--accent-fg)" : "var(--fg)" }}>{l}</button>)}</div>
          <div className="flex items-center justify-between"><span className="text-[12.5px]">Colour</span><input type="color" aria-label="Brush colour" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} /></div>
          <div className="flex items-center justify-between"><span className="text-[12.5px]">Brush size</span><div className="flex gap-1.5">{[1, 2, 3].map((n) => <button key={n} aria-pressed={size === n} onClick={() => setSize(n)} className="w-8 h-8 rounded-[7px] text-[12px] t" style={{ background: size === n ? "var(--accent)" : "var(--surface-2)", color: size === n ? "var(--accent-fg)" : "var(--fg)" }}>{n}</button>)}</div></div>
          <div className="flex items-center justify-between"><span className="text-[12.5px]">Slim arms</span><button role="switch" aria-checked={slim} aria-label="Slim arms" className="sw" onClick={() => setSlim(!slim)} /></div>
          <div className="flex gap-2"><button className="btn-quiet flex-1 !h-9" disabled={!undo.current.length} onClick={() => step(undo.current, redo.current)}><Icon n="reset" s={14} />Undo</button><button className="btn-quiet flex-1 !h-9" disabled={!redo.current.length} onClick={() => step(redo.current, undo.current)}>Redo</button></div>
          <input className="field !pl-3.5" aria-label="Skin name" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-2 pt-1">
            {mine && <button className="btn-primary" onClick={() => onSave({ name, slim, data: toDataUrl(work.current!), asNew: false })}>Save</button>}
            <button className={mine ? "btn-quiet" : "btn-primary"} onClick={() => onSave({ name: mine ? name + " copy" : name, slim, data: toDataUrl(work.current!), asNew: true })}>{mine ? "Save as new" : "Save as my skin"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
