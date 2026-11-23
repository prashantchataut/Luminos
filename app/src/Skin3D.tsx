import { useState } from "react";

type Box = { w: number; h: number; d: number; u: number; v: number };
const S = 9; // screen px per skin texel

function Cuboid({ tex, texW = 64, texH = 64, b, x, y, z = 0, grow = 0, swing, origin = "50% 0", tilt }: { tex: string; texW?: number; texH?: number; b: Box; x: number; y: number; z?: number; grow?: number; swing?: string; origin?: string; tilt?: number }) {
  const W = (b.w + grow * 2) * S, H = (b.h + grow * 2) * S, D = (b.d + grow * 2) * S;
  const faces: { name: string; u: number; v: number; w: number; h: number; t: string }[] = [
    { name: "front", u: b.u + b.d, v: b.v + b.d, w: b.w, h: b.h, t: `translateZ(${D / 2}px)` },
    { name: "back", u: b.u + b.d * 2 + b.w, v: b.v + b.d, w: b.w, h: b.h, t: `rotateY(180deg) translateZ(${D / 2}px)` },
    { name: "right", u: b.u, v: b.v + b.d, w: b.d, h: b.h, t: `rotateY(-90deg) translateZ(${W / 2}px)` },
    { name: "left", u: b.u + b.d + b.w, v: b.v + b.d, w: b.d, h: b.h, t: `rotateY(90deg) translateZ(${W / 2}px)` },
    { name: "top", u: b.u + b.d, v: b.v, w: b.w, h: b.d, t: `rotateX(90deg) translateZ(${H / 2}px)` },
    { name: "bottom", u: b.u + b.d + b.w, v: b.v, w: b.w, h: b.d, t: `rotateX(-90deg) translateZ(${H / 2}px)` },
  ];
  return (
    <div className="part" style={{ left: x * S - grow * S, top: y * S - grow * S, width: W, height: H, transformOrigin: origin, transform: `translateZ(${z * S}px)${tilt ? ` rotateX(${tilt}deg)` : ""}`, animation: swing }}>
      {faces.map((f) => {
        const fw = f.name === "left" || f.name === "right" ? D : f.name === "top" || f.name === "bottom" ? W : W;
        const fh = f.name === "top" || f.name === "bottom" ? D : H;
        return <div key={f.name} className="face" style={{ width: fw, height: fh, left: "50%", top: "50%", marginLeft: -fw / 2, marginTop: -fh / 2, transform: f.t, backgroundImage: `url(${tex})`, backgroundSize: `${texW * S * ((f.w * S) / (f.name === "left" || f.name === "right" ? D : f.name === "top" || f.name === "bottom" ? W : W) || 1) * 0 + texW * S}px ${texH * S}px`, backgroundPosition: `-${f.u * S}px -${f.v * S}px` }} />;
      })}
    </div>
  );
}

/** A turntable made from CSS 3D boxes using the real 64x64 skin and 64x32 cape textures. Drag to rotate. */
export default function Skin3D({ skin, cape, slim = false, height = 420, walk = true }: { skin: string; cape?: string; slim?: boolean; height?: number; walk?: boolean }) {
  const [rot, setRot] = useState<number | null>(null);
  const aw = slim ? 3 : 4;
  const sc = height / (32 * S + 40);
  const swingA = walk ? "swing 2.4s ease-in-out infinite" : undefined;
  const swingB = walk ? "swing 2.4s ease-in-out infinite reverse" : undefined;
  return (
    <div className="scene relative grid place-items-center select-none touch-none" style={{ height }}
      onPointerDown={(e) => { (e.currentTarget as any).setPointerCapture(e.pointerId); setRot(rot ?? -30); (e.currentTarget as any)._x = e.clientX; }}
      onPointerMove={(e) => { const el: any = e.currentTarget; if (rot !== null && e.buttons) { setRot(rot + (e.clientX - el._x) * 0.8); el._x = e.clientX; } }}>
      <div style={{ width: 16 * S, height: 32 * S, transform: `scale(${sc})`, position: "relative", transformStyle: "preserve-3d" }}>
        <div className={`rig ${rot !== null ? "paused" : ""}`} style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: rot !== null ? `rotateX(-12deg) rotateY(${rot}deg)` : undefined, animationName: rot !== null ? "none" : undefined }}>
          <Cuboid tex={skin} b={{ w: 8, h: 8, d: 8, u: 0, v: 0 }} x={4} y={0} />
          <Cuboid tex={skin} b={{ w: 8, h: 8, d: 8, u: 32, v: 0 }} x={4} y={0} grow={0.5} />
          <Cuboid tex={skin} b={{ w: 8, h: 12, d: 4, u: 16, v: 16 }} x={4} y={8} />
          <Cuboid tex={skin} b={{ w: 8, h: 12, d: 4, u: 16, v: 32 }} x={4} y={8} grow={0.25} />
          <Cuboid tex={skin} b={{ w: aw, h: 12, d: 4, u: 40, v: 16 }} x={4 - aw} y={8} swing={swingA} />
          <Cuboid tex={skin} b={{ w: aw, h: 12, d: 4, u: 40, v: 32 }} x={4 - aw} y={8} grow={0.25} swing={swingA} />
          <Cuboid tex={skin} b={{ w: aw, h: 12, d: 4, u: 32, v: 48 }} x={12} y={8} swing={swingB} />
          <Cuboid tex={skin} b={{ w: aw, h: 12, d: 4, u: 48, v: 48 }} x={12} y={8} grow={0.25} swing={swingB} />
          <Cuboid tex={skin} b={{ w: 4, h: 12, d: 4, u: 0, v: 16 }} x={4} y={20} swing={swingB} />
          <Cuboid tex={skin} b={{ w: 4, h: 12, d: 4, u: 0, v: 32 }} x={4} y={20} grow={0.25} swing={swingB} />
          <Cuboid tex={skin} b={{ w: 4, h: 12, d: 4, u: 16, v: 48 }} x={8} y={20} swing={swingA} />
          <Cuboid tex={skin} b={{ w: 4, h: 12, d: 4, u: 0, v: 48 }} x={8} y={20} grow={0.25} swing={swingA} />
          {cape && (
            <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(180deg) translateZ(${-0.1 * S}px)` }}>
              <Cuboid tex={cape} texH={32} b={{ w: 10, h: 16, d: 1, u: 0, v: 0 }} x={3} y={8} z={3} tilt={5} />
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-44 h-4 rounded-[50%]" style={{ background: "radial-gradient(closest-side, rgba(143,180,255,.35), transparent)" }} />
    </div>
  );
}
