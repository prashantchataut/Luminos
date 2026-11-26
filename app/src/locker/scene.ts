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
  /** Raised voxels come from the cape texture itself: pixels brighter than the median stand 0.5 units proud of the cloth. */
  private buildRelief(c: HTMLCanvasElement) {
    const s = c.width / 64, ox = 2 * s * 0.5 * 2, oy = ox, w = 10 * s, h = 16 * s, px = 10 / w; // outer face = (1,1) 10x16 at 1x
    const d = c.getContext("2d")!.getImageData(Math.round(s), Math.round(s), w, h).data, ls: number[] = [];
    for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i], d[i + 1], d[i + 2]));
    const med = [...ls].sort((a, b) => a - b)[Math.floor(ls.length / 2)];
    const idx = ls.map((l, i) => (l > med + 6 ? i : -1)).filter((i) => i >= 0);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(px, px, 0.6), new THREE.MeshLambertMaterial({ color: 0xffffff }), idx.length);
    const m = new THREE.Matrix4();
    idx.forEach((i, n) => { const x = i % w, y = Math.floor(i / w); m.setPosition(-5 + (x + 0.5) * px, 8 - (y + 0.5) * px, 0.5 + 0.3); mesh.setMatrixAt(n, m); mesh.setColorAt(n, new THREE.Color(`rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})`)); });
    void ox; void oy;
    const g = new THREE.Group(); g.add(mesh); this.relief = g;
    (this.v.playerObject as any).cape?.add(g);
  }
}
