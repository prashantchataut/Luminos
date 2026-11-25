import * as THREE from "three";
import { PlayerObject, SkinViewer } from "skinview3d";
import { applyEmote, applyMove, EMOTE_SECONDS, EmoteId, Move, petPose, PetKind, Rig } from "./pets";
import type { Equipped } from "./catalog";
import { buildWings } from "./wings";

const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
const glow = (c: number, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o });
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; }
function cone(r: number, h: number, seg: number, m: THREE.Material, x = 0, y = 0, z = 0) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); c.position.set(x, y, z); return c; }
function ball(r: number, m: THREE.Material, x = 0, y = 0, z = 0) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); s.position.set(x, y, z); return s; }
const C = { navy: 0x14213d, mid: 0x26407a, off: 0xeef1f7, gold: 0xe0b83c, rust: 0xb4532a, ink: 0x1f2430, blue: 0x7ba8ff, ember: 0xc2452a, dark: 0x7a2a1a, leaf: 0x3f8f6b, cream: 0xf3ead6 };

export type Builder = () => THREE.Object3D & { userData: { attach: "head" | "player" | "world"; flap?: THREE.Object3D[] } };
function g(attach: "head" | "player" | "world", flap?: THREE.Object3D[]) { const o = new THREE.Group(); o.userData = { attach, flap }; return o as any; }

const BUILD: Record<string, Builder> = {
  "hat-cap": () => { const o = g("head"); o.add(box(9.2, 2.4, 9.2, mat(C.navy), 0, 8.7, 0), box(9.2, 0.7, 4.2, mat(C.mid), 0, 7.9, 6.2), box(1.2, 1.2, 1.2, mat(C.off), 0, 10.2, 0)); return o; },
  "hat-crown": () => { const o = g("head"); o.add(box(9.2, 2, 9.2, mat(C.gold), 0, 8.8, 0)); for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]]) o.add(cone(1.1, 3, 4, mat(C.gold), x, 11.2, z)); o.add(ball(0.7, glow(C.blue), 0, 8.9, 4.7)); return o; },
  "hat-wizard": () => { const o = g("head"); const brim = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.6, 20), mat(C.navy)); brim.position.y = 8.3; o.add(brim, cone(4.4, 11, 14, mat(C.mid), 0, 14, 0), box(8.8, 1, 8.8, mat(C.gold), 0, 9, 0)); return o; },
  "mask-visor": () => { const o = g("head"); o.add(box(9, 3, 0.9, mat(C.ink), 0, 4.6, 4.4), box(7.4, 1.6, 0.4, glow(C.blue, 0.9), 0, 4.6, 4.9)); return o; },
  "mask-fox": () => { const o = g("head"); o.add(box(8.6, 4.4, 0.9, mat(C.off), 0, 3.2, 4.4), box(3, 2, 2.2, mat(C.off), 0, 2, 5.4), box(1, 0.9, 0.5, mat(C.ink), 0, 2.6, 6.6), cone(1.6, 3, 4, mat(C.rust), -3, 8.8, 3.6), cone(1.6, 3, 4, mat(C.rust), 3, 8.8, 3.6), box(1.1, 0.5, 0.3, mat(C.ink), -2, 4.4, 4.9), box(1.1, 0.5, 0.3, mat(C.ink), 2, 4.4, 4.9)); return o; },
  "band-neck": () => { const o = g("player"), m = mat(C.rust); o.add(box(8.8, 1.8, 0.7, m, 0, -0.2, 2.35), box(8.8, 1.8, 0.7, m, 0, -0.2, -2.35), box(0.7, 1.8, 4.6, m, 4.4, -0.2, 0), box(0.7, 1.8, 4.6, m, -4.4, -0.2, 0)); const d = box(3.2, 3.2, 0.6, m, 0, -2.2, 2.45); d.rotation.z = Math.PI / 4; o.add(d); return o; },
  "band-head": () => { const o = g("head"), m = mat(C.ink); o.add(box(8.8, 1.3, 0.7, m, 0, 6.3, 4.35), box(8.8, 1.3, 0.7, m, 0, 6.3, -4.35), box(0.7, 1.3, 8.8, m, 4.35, 6.3, 0), box(0.7, 1.3, 8.8, m, -4.35, 6.3, 0), box(1.6, 1.6, 1.2, m, 0, 6.3, -5.1), box(1, 3, 0.5, m, -0.8, 5, -5.3)); return o; },
  "back-pack": () => { const o = g("player"); o.add(box(7, 9.5, 3.2, mat(C.mid), 0, -5.5, -3.8), box(7.2, 2.6, 3.5, mat(C.navy), 0, -1.4, -3.8), box(5, 3, 1.1, mat(C.navy), 0, -7.5, -5.9), box(0.8, 9, 0.5, mat(C.off), -2.4, -5, -1.9), box(0.8, 9, 0.5, mat(C.off), 2.4, -5, -1.9)); return o; },
  "back-quiver": () => { const o = g("player"); const q = new THREE.Group(); q.rotation.z = 0.35; q.position.set(2.6, -5, -3.4); q.add(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.4, 10, 12), mat(C.rust))); for (const x of [-0.7, 0, 0.7]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), mat(C.cream)); a.position.set(x, 7, 0.3 * x); q.add(a); const t = cone(0.45, 1.2, 4, mat(C.ink), x, 9.9, 0.3 * x); q.add(t); } o.add(q, box(0.6, 9, 0.4, mat(C.ink), -2.2, -5, -2.1)); return o; },
  "wing-angel": () => buildWings("angel"),
  "wing-dragon": () => buildWings("dragon"),
  "wing-crystal": () => buildWings("crystal"),
  "wing-nebula": () => buildWings("nebula"),

  "pet-cube": () => { const o = g("world"); o.add(box(5, 5, 5, mat(C.off)), box(2.4, 2.4, 2.4, glow(C.blue)), box(0.9, 1.3, 0.3, glow(C.ink), -1, 0.4, 2.55), box(0.9, 1.3, 0.3, glow(C.ink), 1, 0.4, 2.55)); const shell = ball(4.6, glow(0x9fd0ff, 0.22)); shell.name = "helmet"; o.add(shell); return o; },
  "pet-dragon": () => { const o = g("world"), wl: THREE.Object3D[] = []; o.add(box(2.8, 2.4, 4.6, mat(C.ember)), box(2.4, 0.8, 4.2, mat(C.cream), 0, -1.1, 0)); const head = new THREE.Group(); head.position.set(0, 1, 2.9); head.add(box(2.2, 2, 2.2, mat(C.ember)), box(1.5, 1, 1.2, mat(C.dark), 0, -0.4, 1.6), cone(0.35, 1.1, 4, mat(C.cream), -0.8, 1.5, -0.3), cone(0.35, 1.1, 4, mat(C.cream), 0.8, 1.5, -0.3), box(0.4, 0.4, 0.2, glow(0xffe08a), -0.6, 0.4, 1.12), box(0.4, 0.4, 0.2, glow(0xffe08a), 0.6, 0.4, 1.12)); const hm = ball(2.4, glow(0x9fd0ff, 0.25)); hm.name = "helmet"; head.add(hm); o.add(head); for (let i = 0; i < 3; i++) o.add(box(1.8 - i * 0.4, 1.6 - i * 0.4, 2, mat(C.ember), 0, -0.2 - i * 0.2, -3.2 - i * 1.8)); for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 1.4, 1.2, -0.4); w.add(box(4.2, 0.25, 3, mat(C.dark), s * 2.1, 0, 0)); w.userData.side = s; wl.push(w); o.add(w); } o.userData.flap = wl; return o; },
  "pet-wisp": () => { const o = g("world"); o.add(ball(1.4, glow(0xbfe6ff)), ball(2.5, glow(0x7ba8ff, 0.22))); const b = ball(3, glow(0x9fd0ff, 0.2)); b.name = "helmet"; o.add(b); return o; },
};
function wings(side: (s: number) => THREE.Group) {
  const o = g("player"), fl: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 1.4, -2, -2.6); w.userData.side = s; w.add(side(s)); fl.push(w); o.add(w); }
  o.userData.flap = fl; return o;
}

const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
type Slot = { id: string | null; obj: THREE.Object3D | null; t0: number };
export type Mode = "studio" | "scene";

export class LockerScene {
  v: SkinViewer;
  private slots: Record<string, Slot> = {};
  private leaving: { obj: THREE.Object3D; t0: number }[] = [];
  private pets = new THREE.Group();
  private mini: PlayerObject; private partner: PlayerObject;
  private deco = new THREE.Group(); private water: THREE.Mesh;
  private raf = 0; private t0 = performance.now(); private last = 0; paused = false; fps = 45;
  move: Move = "idle"; emote: { id: EmoteId; t0: number } | null = null; classic = false; reduced = false; mode: Mode = "studio";
  private trail: THREE.Vector3[] = [];
  private sword = new THREE.Group(); sway = true; transparent = false;
  private eq: Equipped | null = null;

  constructor(canvas: HTMLCanvasElement, w: number, h: number) {
    this.v = new SkinViewer({ canvas, width: w, height: h, fov: 38, zoom: 0.62 });
    this.v.controls.enableZoom = false; this.v.autoRotate = false; this.v.animation = null;
    // soft studio light: low ambient, warm key from the front-left, cool rim from behind
    this.v.globalLight.intensity = 0.62; this.v.cameraLight.intensity = 0.28;
    const key = new THREE.DirectionalLight(0xfff0dc, 1.15); key.position.set(-26, 34, 30); const rim = new THREE.DirectionalLight(0x7aa2ff, 0.9); rim.position.set(24, 16, -30);
    this.v.scene.add(key, rim);
    this.sword.add(box(0.7, 13, 0.25, mat(0xd8e2f2), 0, 7.5, 0), box(3.6, 0.8, 0.8, mat(0xe0b83c), 0, 0.8, 0), box(0.9, 2.6, 0.9, mat(0x4a2a1a), 0, -0.8, 0)); this.sword.visible = false;
    this.v.playerObject.skin.rightArm.add(this.sword); this.sword.position.set(0, -5.5, 1.2); this.sword.rotation.x = Math.PI / 2;
    { const r = this.v.camera.position.length(), yaw = (25 * Math.PI) / 180, pit = (10 * Math.PI) / 180; this.v.camera.position.set(r * Math.cos(pit) * Math.sin(yaw), r * Math.sin(pit), r * Math.cos(pit) * Math.cos(yaw)); this.v.controls.update(); }
    (window as any).__locker = this;
    this.v.playerWrapper.add(this.pets, this.deco);
    this.mini = new PlayerObject(); this.mini.visible = false; this.mini.scale.setScalar(0.35); this.pets.add(this.mini);
    this.partner = new PlayerObject(); this.partner.visible = false; this.partner.position.set(11, 0, 2); this.partner.rotation.y = -Math.PI / 2; this.v.playerWrapper.add(this.partner);
    this.water = new THREE.Mesh(new THREE.BoxGeometry(70, 26, 70), new THREE.MeshLambertMaterial({ color: 0x3b7fd0, transparent: true, opacity: 0.28 })); this.water.position.y = -11; this.water.visible = false; this.deco.add(this.water);
    this.setMode("studio");
    // ONE capped loop. skinview3d's own unthrottled draw loop is switched off; we render by hand at <= 45 fps,
    // and not at all while the window is hidden or a modal has paused the stage.
    this.v.renderPaused = true;
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden || this.paused || t - this.last < 1000 / this.fps - 1) return;
      this.last = t; this.frame(); this.v.render();
    };
    this.raf = requestAnimationFrame(loop);
  }
  resize(w: number, h: number) { this.v.setSize(w, h); }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.paused = true;
    const gl = this.v.renderer;
    this.v.dispose();
    try { gl.dispose(); gl.forceContextLoss(); } catch { /* already gone */ }
  }

  async setSkin(src: string, slim: boolean) {
    await this.v.loadSkin(src, { model: slim ? "slim" : "default" });
    const map = this.v.playerObject.skin.map;
    for (const p of [this.mini, this.partner]) { p.skin.modelType = slim ? "slim" : "default"; p.skin.map = map; }
  }
  setClassic(v: boolean) { this.classic = v; this.applyVisibility(); }
  private applyVisibility() {
    this.pets.visible = !this.classic; const w = this.slots.wings?.obj; if (w) w.visible = !this.classic;
  }
  setCape(src: string | null) { if (!src) { this.v.loadCape(null); return Promise.resolve(); } return this.v.loadCape(src, { backEquipment: "cape" }); }
  setMove(m: Move) { this.move = m; this.t0 = performance.now(); }
  playEmote(id: EmoteId | null) { this.emote = id && !this.classic ? { id, t0: performance.now() } : null; this.partner.visible = id === "hug" && !this.classic; }

  setMode(mode: Mode) {
    this.mode = mode;
    if (this.transparent) { this.v.background = null; return; }
    for (const c of [...this.deco.children]) if (c !== this.water) this.deco.remove(c);
    if (mode === "studio") { this.v.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue("--surface-2").trim() || "#28292f"); return; }
    // sunset over a grass block: a vertical gradient with two flat hill bands and a sun, drawn once
    const c = document.createElement("canvas"); c.width = 16; c.height = 256; const x = c.getContext("2d")!;
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#2a2f5e"); gr.addColorStop(0.45, "#a2486a"); gr.addColorStop(0.72, "#f08a4b"); gr.addColorStop(1, "#ffd08a");
    x.fillStyle = gr; x.fillRect(0, 0, 16, 256);
    const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; this.v.background = bg;
    const px = (draw: (g: CanvasRenderingContext2D) => void) => { const cv = document.createElement("canvas"); cv.width = 16; cv.height = 16; const g2 = cv.getContext("2d")!; draw(g2); const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
    let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const speckle = (g2: CanvasRenderingContext2D, base: [number, number, number], amp: number, y0 = 0, y1 = 16) => { for (let yy = y0; yy < y1; yy++) for (let xx = 0; xx < 16; xx++) { const k = (rnd() - 0.5) * amp; g2.fillStyle = `rgb(${base.map((v) => Math.max(0, Math.min(255, v + k))).join(",")})`; g2.fillRect(xx, yy, 1, 1); } };
    const top = px((g2) => speckle(g2, [96, 160, 60], 40));
    const dirt = px((g2) => { speckle(g2, [134, 96, 67], 36); speckle(g2, [96, 160, 60], 40, 0, 4); for (let xx = 0; xx < 16; xx++) if (rnd() < 0.45) { g2.fillStyle = "rgb(96,160,60)"; g2.fillRect(xx, 4, 1, 1 + Math.floor(rnd() * 2)); } });
    const bottom = px((g2) => speckle(g2, [134, 96, 67], 36));
    const block = new THREE.Mesh(new THREE.BoxGeometry(32, 16, 32), [dirt, dirt, top, bottom, dirt, dirt].map((t) => new THREE.MeshLambertMaterial({ map: t })));
    block.position.y = -24 - 8; this.deco.add(block);
    const sun = new THREE.DirectionalLight(0xffb070, 1.6); sun.position.set(30, 18, 24); this.deco.add(sun, new THREE.HemisphereLight(0xffd9b0, 0x4a3a5e, 0.7));
  }

  /** Swap what is worn. Entering items pop in with a short overshoot; leaving ones shrink out. */
  setEquipped(eq: Equipped) {
    this.eq = eq; const now = performance.now();
    const ids: [string, string | null][] = [["hats", eq.hats], ["masks", eq.masks], ["bandanas", eq.bandanas], ["back", eq.back], ["wings", eq.wings], ["pets", eq.pets]];
    for (const [cat, id] of ids) {
      const slot = (this.slots[cat] ||= { id: null, obj: null, t0: 0 });
      if (slot.id === id) continue;
      if (slot.obj) this.leaving.push({ obj: slot.obj, t0: now });
      slot.id = id; slot.obj = null; slot.t0 = now;
      if (!id || id === "pet-minime" || !BUILD[id]) continue;
      const o = BUILD[id](); o.scale.setScalar(0.001); slot.obj = o;
      const at = o.userData.attach;
      (at === "head" ? this.v.playerObject.skin.head : at === "player" ? this.v.playerObject : this.pets).add(o);
    }
    this.mini.visible = eq.pets === "pet-minime";
    this.applyVisibility();
  }

  private flash(root: THREE.Object3D, f: number) {
    root.traverse((o: any) => { const m = o.material; if (m && m.emissive) m.emissive.setRGB(f * 0.9, 0, 0); });
  }

  tick() { this.frame(); }
  /** finish pop-in animations at once (used for card snapshots) */
  settle() { for (const sl of Object.values(this.slots)) sl.t0 = -1e9; this.frame(); }
  private frame() {
    const now = performance.now(), t = this.reduced ? 0 : (now - this.t0) / 1000;
    const player = this.v.playerObject, rig = player.skin as unknown as Rig;
    let lift = 0, pitch = 0, yaw = 0, flash = 0;
    if (this.emote) {
      const et = (now - this.emote.t0) / 1000; { const r = applyEmote(rig, this.emote.id, this.reduced ? 0 : et); lift = r.lift; pitch = r.pitch; yaw = r.yaw + (this.emote.id === "hug" ? Math.PI / 2 : 0); }
    }
    this.sword.visible = this.emote?.id === "sword" && !this.classic;
    if (this.sway && !this.reduced) this.v.playerWrapper.rotation.y = Math.sin(now / 2600) * 0.38;
    {
    }
    if (!this.emote) { const r = applyMove(rig, this.move, t); lift = r.lift; pitch = r.pitch; flash = r.flash; }
    player.position.y = lift + (this.move === "swim" && !this.emote ? 2 : 0); player.rotation.x = pitch; player.rotation.y = yaw;
    this.flash(player, flash);
    this.water.visible = this.mode === "scene" && this.move === "swim";
    if (this.partner.visible) { const pr = this.partner.skin as unknown as Rig; applyEmote(pr, "hug", this.reduced ? 0 : (now - (this.emote?.t0 ?? now)) / 1000); this.partner.position.y = 0; }

    // items: scale animation, wing flap, pets
    const wf = { idle: [0.1, 1.6], walk: [0.14, 5], jump: [0.7, 12], swim: [0.2, 2.2], hurt: [0.3, 30] }[this.move];
    for (const [cat, slot] of Object.entries(this.slots)) {
      const o = slot.obj; if (!o) continue;
      const k = Math.min(1, (now - slot.t0) / 280); o.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      if (cat === "wings") { for (const w of (o.userData.flap || [])) w.rotation.y = w.userData.side * (0.35 + wf[0] * Math.sin(t * wf[1]) + 0.1); for (const c of (o.userData.chain || [])) c.rotation.z = c.userData.base + c.userData.side * Math.sin(t * wf[1] - c.userData.k * 1.6) * wf[0] * 0.55; }
      if (cat === "pets") {
        const pose = petPose(o.name === "" ? (slot.id!.slice(4) as PetKind) : "cube", this.move, t);
        o.position.set(pose.x, pose.y + lift * 0.3, pose.z); o.rotation.y = pose.ry; o.scale.multiplyScalar(pose.scale);
        o.getObjectByName("helmet")?.traverse((h) => (h.visible = pose.helmet)); this.flash(o, pose.flash);
        for (const w of (o.userData.flap || [])) w.rotation.z = w.userData.side * (0.5 + pose.flap * Math.sin(t * 14) * 0.9);
        if (slot.id === "pet-wisp") this.wispTrail(o);
      }
    }
    for (const l of [...this.leaving]) { const k = Math.min(1, (now - l.t0) / 180); l.obj.scale.setScalar(Math.max(0.001, 1 - k * k)); if (k >= 1) { l.obj.parent?.remove(l.obj); this.leaving.splice(this.leaving.indexOf(l), 1); } }
    if (this.mini.visible) {
      const r = applyMove(this.mini.skin as unknown as Rig, this.emote ? "idle" : this.move, t); const p = petPose("minime", this.move, t);
      this.mini.position.set(p.x, p.y + r.lift * 0.35, p.z); this.mini.rotation.x = r.pitch; this.mini.rotation.y = -0.4; this.mini.scale.setScalar(0.35 * easeOutBack(Math.min(1, (now - (this.slots.pets?.t0 || 0)) / 280)));
      this.flash(this.mini, r.flash);
    }
  }
  private wispTrail(o: THREE.Object3D) {
    const p = o.position.clone(); this.trail.unshift(p); this.trail.length = Math.min(this.trail.length, 6);
    const old = this.pets.children.filter((c) => c.name === "trail"); if (old.length < 5) for (let i = old.length; i < 5; i++) { const s = ball(0.9 - i * 0.12, glow(0x9fd0ff, 0.5 - i * 0.07)); s.name = "trail"; this.pets.add(s); }
    this.pets.children.filter((c) => c.name === "trail").forEach((s, i) => { const q = this.trail[Math.min(this.trail.length - 1, (i + 1) * 1)]; if (q) s.position.copy(q); s.visible = this.eq?.pets === "pet-wisp"; });
  }
}
