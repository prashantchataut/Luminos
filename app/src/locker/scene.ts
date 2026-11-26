import * as THREE from "three";
import { CrouchAnimation, HitAnimation, IdleAnimation, RunningAnimation, SkinViewer } from "skinview3d";

export type Env = "moonlit" | "nether" | "daylight" | "studio";
export type Pose = "idle" | "sprint" | "block" | "sneak" | "turntable";

/** Light rigs for the Showdown stage. `css` is the backdrop behind the transparent canvas. */
export const ENVS: Record<Env, { label: string; global: number; camera: number; globalColor: number; cameraColor: number; css: string }> = {
  moonlit: { label: "Moonlit Arena", global: 0.55, camera: 0.5, globalColor: 0x7f9bff, cameraColor: 0xb7c9ff, css: "linear-gradient(180deg,#070c24 0%,#0e1b4a 70%,#16296a 100%)" },
  nether: { label: "Nether Glow", global: 0.5, camera: 0.75, globalColor: 0xff7a3d, cameraColor: 0xff4d2e, css: "linear-gradient(180deg,#1a0605 0%,#4a0f08 65%,#8a2a0c 100%)" },
  daylight: { label: "Daylight Shader", global: 0.95, camera: 0.45, globalColor: 0xfff2d6, cameraColor: 0xffffff, css: "linear-gradient(180deg,#8fc3ee 0%,#cfe6f5 70%,#dfe9d0 100%)" },
  studio: { label: "Studio Rim Light", global: 0.4, camera: 0.9, globalColor: 0xffffff, cameraColor: 0xe2ecff, css: "radial-gradient(ellipse at 50% 30%,#232a3d 0%,#10131c 70%)" },
};

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** One skinview3d viewer with lighting presets, action poses and a voxel-relief layer for 3D capes. */
export class LockerScene {
  v: SkinViewer;
  paused = false; reduced = false;
  private relief: THREE.Group | null = null;
  private frames: HTMLCanvasElement[] = []; private frameTimer = 0; private frameMs = 0;
  private lastRender = 0;

  constructor(canvas: HTMLCanvasElement, w: number, h: number) {
    this.v = new SkinViewer({ canvas, width: w, height: h, renderPaused: false });
    this.v.zoom = 0.62; this.v.fov = 38; this.v.controls.enableZoom = false; this.v.controls.enablePan = false;
    this.v.playerObject.rotation.y = -0.5;
    this.setEnv("studio"); this.setPose("idle");
  }
  resize(w: number, h: number) { this.v.setSize(w, h); }
  dispose() { clearInterval(this.frameTimer); this.v.dispose(); }
  setSkin(src: string, slim: boolean) { return this.v.loadSkin(src, { model: slim ? "slim" : "default" }); }
  setEnv(e: Env) { const c = ENVS[e]; this.v.globalLight.intensity = c.global; this.v.cameraLight.intensity = c.camera; this.v.globalLight.color.setHex(c.globalColor); this.v.cameraLight.color.setHex(c.cameraColor); }
  setPose(p: Pose) {
    this.v.autoRotate = p === "turntable" && !this.reduced; this.v.autoRotateSpeed = 1.2;
    this.v.animation = p === "idle" ? new IdleAnimation() : p === "sprint" ? new RunningAnimation() : p === "block" ? new HitAnimation() : p === "sneak" ? new CrouchAnimation() : new IdleAnimation();
    if (this.reduced) this.v.animation = null;
  }

  /** Cape from one or more frames (animated capes cycle through `frames`). `relief` adds the extruded voxel layer. */
  async setCape(frameSrcs: string[] | null, relief: boolean, frameMs = 0) {
    clearInterval(this.frameTimer); this.clearRelief();
    if (!frameSrcs || !frameSrcs.length) { this.v.loadCape(null); return; }
    this.frames = await Promise.all(frameSrcs.map(async (s) => {
      const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s; });
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d")!.drawImage(im, 0, 0); return c;
    }));
    await this.v.loadCape(this.frames[0].toDataURL(), { backEquipment: "cape" });
    if (relief) this.buildRelief(this.frames[0]);
    if (this.frames.length > 1 && frameMs > 0 && !this.reduced) {
      let k = 0; this.frameMs = frameMs;
      this.frameTimer = window.setInterval(() => { if (this.paused) return; k = (k + 1) % this.frames.length; void this.v.loadCape(this.frames[k].toDataURL(), { backEquipment: "cape" }); }, frameMs);
    }
  }
  private clearRelief() { if (this.relief) { this.relief.parent?.remove(this.relief); this.relief.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.relief = null; } }
  private buildRelief(c: HTMLCanvasElement) {
    const g = makeRelief(c); this.relief = g;
    (this.v.playerObject as any).cape?.add(g);
  }
  /** Show the back of the player (cape side) at a 3/4 angle, or the front again. */
  faceBack(b: boolean) { this.v.playerObject.rotation.y = b ? Math.PI - 0.55 : -0.5; }
}

/**
 * 3D voxel relief for a cape texture of any 64n x 32n size. The outer face (1,1) 10x16 (at 1x) is sampled in 2x2 texel cells
 * (40x64 cells for a 512x256 cape). The frame ring and any cell clearly brighter than the cloth median are extruded
 * outwards (-z is the outside of the cape in skinview3d) up to 1.2 units, so the cloak has real depth from every angle.
 */
export function makeRelief(c: HTMLCanvasElement): THREE.Group {
  const k = c.width / 64, fw = 10 * k, fh = 16 * k, cell = Math.max(1, Math.round(k / 4)), gw = Math.floor(fw / cell), gh = Math.floor(fh / cell);
  const d = c.getContext("2d")!.getImageData(Math.round(k), Math.round(k), fw, fh).data, px = 10 / gw;
  const lumAt: number[] = [], col: number[][] = [];
  for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const i = ((cy * cell + y) * fw + cx * cell + x) * 4; if (d[i + 3] > 8) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
    n = n || 1; col.push([r / n, gg / n, b / n]); lumAt.push(lum(r / n, gg / n, b / n));
  }
  const med = [...lumAt].sort((a, b) => a - b)[Math.floor(lumAt.length / 2)], ring = Math.max(2, Math.round(4 / cell));
  const list: { x: number; y: number; h: number; c: number[] }[] = [];
  for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
    const i = cy * gw + cx, edge = Math.min(cx, gw - 1 - cx, cy, gh - 1 - cy), border = edge < ring;
    const h = border ? (edge === 0 ? 0.5 : 1.2) : lumAt[i] > med + 28 ? 0.8 : 0;
    if (h > 0) list.push({ x: cx, y: cy, h, c: col[i] });
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(px, px, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
  const m = new THREE.Matrix4(), sc = new THREE.Matrix4();
  list.forEach((v, n) => { sc.makeScale(1, 1, v.h); m.setPosition(5 - (v.x + 0.5) * px, 8 - (v.y + 0.5) * px, -v.h / 2); m.multiply(sc); mesh.setMatrixAt(n, m); mesh.setColorAt(n, new THREE.Color(`rgb(${Math.round(v.c[0])},${Math.round(v.c[1])},${Math.round(v.c[2])})`)); });
  const g = new THREE.Group(); g.position.set(0, 8, 0.5 - 0.5); g.add(mesh); mesh.position.y = -8; g.userData.voxels = list.length;
  return g;
}
