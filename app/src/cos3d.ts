import * as THREE from "three";
import { IdleAnimation, PlayerAnimation, PlayerObject, SkinViewer } from "skinview3d";
import type { CatId, PetState } from "./data/cosmetics";
import { capeFile } from "./data/cosmetics";

type Mount = "head" | "body" | "root";
type Built = { group: THREE.Group; mount: Mount; tick?: (c: Ctx) => void };
export type Ctx = { t: number; dt: number; state: PetState; player: PlayerObject; group: THREE.Group };
const mat = (hex: number, o: { emissive?: number; opacity?: number } = {}) => new THREE.MeshLambertMaterial({ color: hex, emissive: o.emissive ?? 0, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1 });
function box(g: THREE.Object3D, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, o: { emissive?: number; opacity?: number } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o)); m.position.set(x, y, z); g.add(m); return m;
}
const grp = (parent?: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); return g; };
const flap = (t: number, s: number) => Math.sin(t * s);

/* ---------- builders. Head group: top of head is y = 8. Body group: top of body y = 0, back z = -2. ---------- */
const BUILD: Record<string, () => Built> = {
  "hat-beanie": () => { const g = grp(); box(g, 9, 3.2, 9, 0x2b4a8a, 0, 8.6, 0); box(g, 9.6, 1.6, 9.6, 0xe6e1d3, 0, 7.6, 0); box(g, 2, 2, 2, 0xe6e1d3, 0, 11, 0); return { group: g, mount: "head" }; },
  "hat-top": () => { const g = grp(); box(g, 12, .8, 12, 0x15161a, 0, 8.4, 0); box(g, 7, 7, 7, 0x15161a, 0, 12.2, 0); box(g, 7.2, 1.4, 7.2, 0xb5402a, 0, 9.6, 0); return { group: g, mount: "head" }; },
  "hat-halo": () => { const g = grp(); const r = new THREE.Mesh(new THREE.TorusGeometry(4.6, .55, 6, 20), mat(0xf2c94c, { emissive: 0x8a6a10 })); r.rotation.x = Math.PI / 2; r.position.y = 12; g.add(r); return { group: g, mount: "head", tick: (c) => { r.position.y = 12 + Math.sin(c.t * 2) * .5; } }; },
  "mask-half": () => { const g = grp(); box(g, 8.8, 3.4, .7, 0xf4f1e8, 0, 3.6, 4.4); box(g, 1.8, 1, .8, 0x15161a, -2, 4, 4.5); box(g, 1.8, 1, .8, 0x15161a, 2, 4, 4.5); box(g, 1.2, 2, .8, 0xf4f1e8, 0, 2.2, 4.5); return { group: g, mount: "head" }; },
  "mask-visor": () => { const g = grp(); box(g, 8.8, 2.2, .7, 0x5ad2ff, 0, 4.2, 4.4, { opacity: .6, emissive: 0x0a3a50 }); box(g, .6, 1.4, 8.4, 0x23262d, 4.6, 4.2, 0); box(g, .6, 1.4, 8.4, 0x23262d, -4.6, 4.2, 0); return { group: g, mount: "head" }; },
  "band-neck": () => { const g = grp(); box(g, 8.8, 1.8, 4.8, 0xb5402a, 0, -.7, 0); box(g, 2.4, 2.4, .6, 0xb5402a, 0, -3, 2.4).rotation.z = Math.PI / 4; box(g, 1.2, 1.2, 1.2, 0x8a2f1e, 0, -.7, -2.8); return { group: g, mount: "body" }; },
  "band-face": () => { const g = grp(); box(g, 8.8, 3.2, .7, 0x1f2a44, 0, 1.2, 4.35); for (const [x, y] of [[-2.5, 1.8], [0, .6], [2.5, 1.8]]) box(g, .8, .8, .8, 0xe8e3d4, x, y, 4.5); box(g, 8.8, 1.2, 8.8, 0x1f2a44, 0, 2.4, 0); box(g, 1.4, 1.4, 1.4, 0x1f2a44, 0, 2.4, -4.8); return { group: g, mount: "head" }; },
  "back-pack": () => { const g = grp(); box(g, 7, 9, 3.4, 0x6b4a2f, 0, -5.4, -3.7); box(g, 7.4, 3, 3.8, 0x84603f, 0, -2, -3.7); box(g, 6, 1.6, 1.6, 0xd8cdb4, 0, -10.6, -3.7); box(g, 1, 8, .4, 0x3d2b1c, -2.5, -5, -1.8); box(g, 1, 8, .4, 0x3d2b1c, 2.5, -5, -1.8); return { group: g, mount: "body" }; },
  "back-quiver": () => { const g = grp(); const q = grp(g, 1.5, -5, -3); q.rotation.z = -.35; box(q, 2.6, 9, 2.6, 0x5a3b24, 0, 0, 0); for (let i = 0; i < 4; i++) { box(q, .4, 4, .4, 0xd8cdb4, -.8 + (i % 2) * 1.6, 6, -.6 + (i >> 1) * 1.2); box(q, 1, 1, .3, 0xb5402a, -.8 + (i % 2) * 1.6, 8.2, -.6 + (i >> 1) * 1.2); } box(g, .8, 12, .4, 0x3d2b1c, -1, -5, -2.2).rotation.z = .45; return { group: g, mount: "body" }; },
  "wing-feather": () => wings((side) => { const w = grp(); for (let i = 0; i < 5; i++) { const f = grp(w); f.rotation.z = side * (.55 + i * .3); const len = 14 + (4 - i) * 2.5; box(f, 2.4, len, .5, i % 2 ? 0xf3efe4 : 0xdcd5c2, 0, len / 2, 0); } return w; }),
  "wing-shard": () => wings((side) => { const w = grp(); const L = [12, 10, 8, 6]; L.forEach((len, i) => { const f = grp(w); f.rotation.z = side * (.6 + i * .32); const m = box(f, 2, len * 1.5, .8, i % 2 ? 0x3ec7c0 : 0x2a8fa8, 0, len / 2, 0, { emissive: 0x0b3c44 }); m.rotation.y = .5; }); return w; }),
  "wing-mantle": () => wings((side) => { const w = grp(); box(w, 8, 14, .5, 0x1c2b57, side * 4, 6, 0); box(w, 5, 9, .6, 0x2d4690, side * 7.5, 3, 0); box(w, 10, 1, .7, 0xe6e1d3, side * 4, 12.8, 0); return w; }, .12),
  "pet-minime": () => ({ group: grp(), mount: "root" as Mount }), // drawn as a second player in Stage.frame, so it can copy the skin and the pose
  "pet-cube": () => { const g = grp(); const c = box(g, 4, 4, 4, 0x6fe3b5, 0, 0, 0, { emissive: 0x145a40 }); box(g, 2.2, 2.2, 2.2, 0xe9fff6, 0, 0, 0, { emissive: 0x7fd9b8 }); box(c, .9, .9, .2, 0x15161a, -1, .5, 2.05); box(c, .9, .9, .2, 0x15161a, 1, .5, 2.05);
    const shell = box(g, 6, 6, 6, 0xbfe9ff, 0, 0, 0, { opacity: .28 }); shell.visible = false;
    return { group: g, mount: "root", tick: (k) => { const s = k.state; const wk = s === "walk"; const baseY = 10 + Math.sin(k.t * (wk ? 6.2 : 3.1)) * 1.5; const jump = s === "jump" ? 6 * Math.abs(Math.sin(k.t * 3.2)) : 0;
      k.group.position.set(14, baseY + jump, wk ? -2 : 3); c.rotation.y = k.t * (Math.PI / 4); c.scale.setScalar(s === "jump" && jump < 1 ? .8 : 1); shell.visible = s === "swim";
      (c.material as THREE.MeshLambertMaterial).emissive.setHex(s === "hurt" && (k.t * 10) % 2 < 1 ? 0xff2a2a : 0x145a40); if (s === "hurt") k.group.position.x += Math.sin(k.t * 50) * .8; } }; },
  "pet-wyrmling": () => { const g = grp(); const body = box(g, 3, 2.6, 5, 0x3f9c6a); const head = grp(g, 0, 1.6, 3); box(head, 2.8, 2.4, 2.8, 0x4cb47c); box(head, .6, 1.6, .6, 0xe6e1d3, -1, 1.8, -.4); box(head, .6, 1.6, .6, 0xe6e1d3, 1, 1.8, -.4); box(head, .5, .5, .2, 0x15161a, -.8, .3, 1.45); box(head, .5, .5, .2, 0x15161a, .8, .3, 1.45);
    const snork = box(head, .4, 4, .4, 0xf2c94c, 1.1, 2, 1); snork.visible = false;
    const tail = grp(g, 0, -.4, -2.5); box(tail, 1.6, 1.4, 2.5, 0x3f9c6a, 0, 0, -1); box(tail, 1, 1, 2, 0x2f7d52, 0, 0, -3);
    const wl = grp(g, -1.6, 1.3, -.4), wr = grp(g, 1.6, 1.3, -.4); box(wl, 4, .3, 3, 0x2f7d52, -2, 0, 0); box(wr, 4, .3, 3, 0x2f7d52, 2, 0, 0);
    return { group: g, mount: "root", tick: (k) => { const s = k.state; k.group.position.set(-7.5, 12 + (s === "walk" ? Math.sin(k.t * 8) * .5 : 0), 0); if (s === "jump") k.group.position.y += 6 * Math.abs(Math.sin(k.t * 3.2)); body.rotation.x = s === "hurt" ? .5 : 0;
      tail.rotation.y = Math.sin(k.t * 5) * .5; const spread = s === "jump" ? 1.1 : s === "hurt" ? 0 : .12 + Math.max(0, Math.sin(k.t * 1.2)) * .06; wl.rotation.z = spread; wr.rotation.z = -spread; snork.visible = s === "swim"; head.rotation.x = s === "swim" ? -.3 : 0; if (s === "hurt") k.group.position.y -= Math.abs(Math.sin(k.t * 20)) * .6; } }; },
  "pet-wisp": () => { const g = grp(); const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), mat(0xbfe0ff, { emissive: 0x6fb0ff })); g.add(core);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), mat(0xbfe9ff, { opacity: .25 })); bubble.visible = false; g.add(bubble);
    const trail: THREE.Mesh[] = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1.1 - i * .12, 8, 6), mat(0x9ec8ff, { emissive: 0x4a88e0, opacity: .5 - i * .07 })); trail.push(m); }
    const hist: THREE.Vector3[] = [];
    return { group: g, mount: "root", tick: (k) => { const s = k.state; const R = s === "walk" ? 9 : 12, w = (s === "walk" ? 2.2 : 1.05); const a = k.t * w; const y = 12 + Math.sin(k.t * 1.7) * 3 + (s === "jump" ? 6 * Math.abs(Math.sin(k.t * 3.2)) : 0);
      k.group.position.set(Math.cos(a) * R, y, Math.sin(a) * R); hist.unshift(k.group.position.clone()); hist.length = Math.min(hist.length, 40);
      trail.forEach((m, i) => { if (!m.parent) k.group.parent?.add(m); const h = hist[Math.min(hist.length - 1, (i + 1) * 5)]; if (h) m.position.copy(h); m.visible = s !== "swim"; });
      bubble.visible = s === "swim"; (core.material as THREE.MeshLambertMaterial).emissive.setHex(s === "hurt" ? 0xffffff : 0x6fb0ff); core.scale.setScalar(s === "hurt" && (k.t * 12) % 2 < 1 ? 1.5 : 1); } }; },
};
function wings(make: (side: number) => THREE.Group, amp = .22): Built {
  const g = grp(); const L = make(-1), R = make(1); L.position.set(-2, -2, -2.6); R.position.set(2, -2, -2.6); g.add(L, R);
  L.rotation.z = 0; return { group: g, mount: "body", tick: (k) => { const f = (k.state === "walk" ? .18 : amp) * flap(k.t, k.state === "jump" ? 9 : 2.2); L.rotation.y = -.35 - f; R.rotation.y = .35 + f; } };
}

/* ---------- the stage ---------- */
type Slot = { id: string; cat: CatId; built: Built; appear: number; target: number };
class PreviewAnim extends PlayerAnimation {
  constructor(private stage: Stage) { super(); }
  protected animate(p: PlayerObject, _d: number) { this.stage.frame(p, this.progress); }
}
export class Stage {
  viewer: SkinViewer; slots = new Map<CatId, Slot>(); state: PetState = "idle"; emote: string | null = null; emoteT = 0; extras = new THREE.Group(); ghost: THREE.Object3D | null = null; mini: THREE.Object3D | null = null;
  scene: "studio" | "scene" = "studio"; last = 0; capeTimer = 0; reduce = false; floor = new THREE.Group();
  constructor(canvas: HTMLCanvasElement, w: number, h: number) {
    this.viewer = new SkinViewer({ canvas, width: w, height: h, zoom: 0.8, fov: 38 }); const v = this.viewer;
    v.autoRotate = false; v.controls.enableZoom = false; v.controls.enablePan = false; v.camera.position.set(22, 10, 62); v.animation = new PreviewAnim(this);
    v.scene.add(this.extras, this.floor); this.setScene("studio");
  }
  setScene(m: "studio" | "scene") {
    this.scene = m; this.floor.clear();
    if (m === "studio") { const d = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1, 40), mat(0x3a3d42)); d.position.y = -24.8; this.floor.add(d); return; }
    // grass block at sunset: procedural textures, no external art
    const tex = (top: boolean) => { const c = document.createElement("canvas"); c.width = c.height = 16; const g = c.getContext("2d")!; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1; const grass = top || y < 4 + (r > .6 ? 2 : 0); g.fillStyle = grass ? `hsl(${100 + r * 14},${48 + r * 10}%,${30 + r * 10}%)` : `hsl(${26 + r * 8},${34 + r * 8}%,${26 + r * 9}%)`; g.fillRect(x, y, 1, 1); } const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t; };
    const side = new THREE.MeshLambertMaterial({ map: tex(false) }), top = new THREE.MeshLambertMaterial({ map: tex(true) });
    const b = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), [side, side, top, side, side, side]); b.position.y = -40; this.floor.add(b);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(16, 28), new THREE.MeshBasicMaterial({ color: 0xffb36b })); sun.position.set(-34, -4, -70); this.floor.add(sun);
  }
  setSkin(src: string, slim: boolean) { return this.viewer.loadSkin(src, { model: slim ? "slim" : "default" }); }
  setCape(id: string | undefined) {
    clearInterval(this.capeTimer); const v = this.viewer; const c = id ? capeFile(id) : null; if (!c) { v.loadCape(null); return; }
    const im = new Image(); im.src = "/" + c.file; im.onload = () => { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 32; const g = cv.getContext("2d")!; let f = 0;
      const draw = () => { g.clearRect(0, 0, 64, 32); g.drawImage(im, 0, (f % c.frames) * 32, 64, 32, 0, 0, 64, 32); v.loadCape(cv); f++; }; draw(); if (c.animated && !this.reduce) this.capeTimer = window.setInterval(draw, Math.max(80, c.frameMs)); };
  }
  /** Equip changes animate: scale-in with overshoot, scale-out then removal. */
  setEquipped(eq: Partial<Record<CatId, string>>, classic = false) {
    const want = (cat: CatId) => (classic && (cat === "pets" || cat === "wings" || cat === "emotes") ? undefined : eq[cat]);
    for (const cat of ["pets", "wings", "hats", "masks", "bandanas", "back"] as CatId[]) {
      const id = want(cat), cur = this.slots.get(cat);
      if (cur && cur.id === id) { cur.target = 1; continue; }
      if (cur) { cur.target = 0; this.slots.set(("x" + cat + Math.random()) as CatId, cur); this.slots.delete(cat); }
      if (id && BUILD[id]) { const built = BUILD[id](); const s: Slot = { id, cat, built, appear: 0, target: 1 }; built.group.scale.setScalar(.001); this.mount(built); this.slots.set(cat, s); }
    }
    if (eq.cloaks === undefined || want("cloaks") === undefined) { /* cloak handled by setCape */ }
    this.emote = eq.emotes && !classic ? eq.emotes : this.emote;
  }
  private mount(b: Built) { const p = this.viewer.playerObject; (b.mount === "head" ? p.skin.head : b.mount === "body" ? p.skin.body : this.extras).add(b.group); }
  playEmote(id: string | null) { this.emote = id; this.emoteT = 0; if (!id) { this.drop(this.ghost); this.ghost = null; } }
  /** A second player that shares this one's skin texture. */
  private twin(p: PlayerObject) { const m = new PlayerObject(); m.skin.modelType = p.skin.modelType; m.skin.map = p.skin.map; m.cape.visible = false; (m.elytra as any).visible = false; return m; }
  private sync(m: PlayerObject, p: PlayerObject) { if (m.skin.map !== p.skin.map) m.skin.map = p.skin.map; if (m.skin.modelType !== p.skin.modelType) m.skin.modelType = p.skin.modelType; }
  private drop(o: THREE.Object3D | null) { o?.parent?.remove(o); }
  frame(p: PlayerObject, t: number) {
    const dt = Math.min(.05, t - this.last); this.last = t; const s = this.state; const sk = p.skin;
    // player pose
    const sw = Math.sin(t * (s === "walk" ? 7 : 3)); p.position.y = 0; p.rotation.set(0, 0, 0); for (const part of [sk.head, sk.body, sk.leftArm, sk.rightArm, sk.leftLeg, sk.rightLeg]) part.rotation.set(0, 0, 0);
    if (s === "idle") { sk.leftArm.rotation.z = -.05 - Math.sin(t * 1.6) * .03; sk.rightArm.rotation.z = .05 + Math.sin(t * 1.6) * .03; sk.head.rotation.y = Math.sin(t * .7) * .12; }
    if (s === "walk") { sk.leftArm.rotation.x = sw * .7; sk.rightArm.rotation.x = -sw * .7; sk.leftLeg.rotation.x = -sw * .7; sk.rightLeg.rotation.x = sw * .7; }
    if (s === "jump") { const j = Math.abs(Math.sin(t * 3.2)); p.position.y = j * 6; sk.leftArm.rotation.z = -2 * j; sk.rightArm.rotation.z = 2 * j; sk.leftLeg.rotation.x = -.5 * j; sk.rightLeg.rotation.x = .3 * j; }
    if (s === "swim") { p.rotation.x = 1.15; p.position.y = -4; sk.leftArm.rotation.x = Math.sin(t * 3) * 1.3 + 3; sk.rightArm.rotation.x = -Math.sin(t * 3) * 1.3 + 3; sk.leftLeg.rotation.x = Math.sin(t * 6) * .4; sk.rightLeg.rotation.x = -Math.sin(t * 6) * .4; }
    if (s === "hurt") { p.rotation.x = -.25; p.rotation.z = Math.sin(t * 40) * .06; sk.head.rotation.x = -.3; sk.leftArm.rotation.z = -.5; sk.rightArm.rotation.z = .5; }
    // emotes
    if (this.emote) { this.emoteT += dt; const e = this.emote;
      if (e === "emote-wave") { sk.rightArm.rotation.z = 2.6; sk.rightArm.rotation.x = 0; sk.rightArm.rotation.z += Math.sin(t * 9) * .35; }
      if (e === "emote-spin") { p.rotation.y = (this.emoteT * 4) % (Math.PI * 2); sk.leftArm.rotation.z = -1.5; sk.rightArm.rotation.z = 1.5; }
      if (e === "emote-hug") { sk.leftArm.rotation.x = -1.5; sk.rightArm.rotation.x = -1.5; p.rotation.y = -.5; p.position.x = Math.min(4, this.emoteT * 8) * -1;
        if (!this.ghost) { const gh = this.twin(p); this.ghost = gh; this.viewer.scene.add(gh); }
        this.sync(this.ghost as PlayerObject, p); this.ghost.position.set(11, 0, 0); this.ghost.rotation.set(0, .5 + Math.PI * 0 - Math.PI, 0); const gs = (this.ghost as PlayerObject).skin; if (gs) { gs.leftArm.rotation.x = -1.5; gs.rightArm.rotation.x = -1.5; } } else if (this.ghost) { this.drop(this.ghost); this.ghost = null; } }
    else if (this.ghost) { this.drop(this.ghost); this.ghost = null; }
    // mini-me: a copy sharing the skin texture, mirroring every joint
    const mini = this.slots.get("pets")?.id === "pet-minime" && this.slots.get("pets")!.target > 0;
    if (mini && !this.mini) { const m = this.twin(p); m.scale.setScalar(.28); this.mini = m; this.viewer.scene.add(m); const helm = new THREE.Mesh(new THREE.SphereGeometry(5.6, 12, 10), mat(0xbfe9ff, { opacity: .35 })); helm.name = "helm"; helm.position.y = 4; (m as PlayerObject).skin.head.add(helm); const ring = new THREE.Mesh(new THREE.TorusGeometry(5.6, .5, 6, 14), mat(0xc9a24a)); ring.rotation.x = Math.PI / 2; ring.position.y = -1; ring.name = "helm"; (m as PlayerObject).skin.head.add(ring); }
    if (!mini && this.mini) { this.drop(this.mini); this.mini = null; }
    if (this.mini) { const m = this.mini as PlayerObject; this.sync(m, p); const lag = Math.sin((t - (s === "walk" ? .12 : .08)) * (s === "walk" ? 7 : 3)); m.position.set(s === "walk" ? 9 : 9, -24 * .72 + (s === "jump" ? 6 * Math.abs(Math.sin((t - .1) * 3.2)) * .6 : 0) + (s === "swim" ? 8 : 0) + 0, 3);
      m.rotation.set(s === "swim" ? 1.1 : 0, .25, 0); const a = m.skin, b = sk; a.head.rotation.copy(b.head.rotation); a.leftArm.rotation.copy(b.leftArm.rotation); a.rightArm.rotation.copy(b.rightArm.rotation); a.leftLeg.rotation.copy(b.leftLeg.rotation); a.rightLeg.rotation.copy(b.rightLeg.rotation);
      if (s === "walk") { a.leftArm.rotation.x = lag * .7; a.rightArm.rotation.x = -lag * .7; a.leftLeg.rotation.x = -lag * .7; a.rightLeg.rotation.x = lag * .7; }
      if (s === "hurt") m.position.x += 2 + Math.sin(t * 30) * .4; a.head.children.forEach((c) => { if (c.name === "helm") c.visible = s === "swim"; }); }
    // items: equip animation + per-item tick
    for (const [k, sl] of [...this.slots]) {
      sl.appear += (sl.target - sl.appear) * Math.min(1, dt * 9); const a = sl.appear, c1 = 1.70158, e = a <= 0 ? 0 : 1 + (c1 + 1) * Math.pow(a - 1, 3) + c1 * Math.pow(a - 1, 2);
      sl.built.group.scale.setScalar(Math.max(.001, sl.target ? e : a)); sl.built.tick?.({ t, dt, state: s, player: p, group: sl.built.group });
      if (sl.target === 0 && a < .03) { sl.built.group.parent?.remove(sl.built.group); this.slots.delete(k); }
    }
    this.extras.position.y = p.position.y * 0; // pets stay planted in the scene, the player moves
    const wing = [...this.slots.values()].some((x) => x.cat === "wings" && x.target > 0); for (const sl of this.slots.values()) if (sl.cat === "back") sl.built.group.visible = !wing;
    this.viewer.playerObject.cape.visible = !wing; (this.viewer.playerObject.elytra as any).visible = false;
  }
  setState(s: PetState) { this.state = s; }
  /** Camera: front, back, or a slow turn so every side shows. */
  setView(m: "front" | "back" | "spin") { const v = this.viewer; v.autoRotate = m === "spin" && !this.reduce; v.autoRotateSpeed = 1.1; v.camera.position.set(m === "back" ? -22 : 22, 10, m === "back" ? -62 : 62); }
  dispose() { clearInterval(this.capeTimer); this.viewer.dispose(); }
}
export { IdleAnimation };
