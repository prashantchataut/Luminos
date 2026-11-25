import * as THREE from "three";

// Articulated, pixel-art-textured wings. Each wing hangs from a shoulder pivot (the scene flaps that pivot) and is built from
// many segments (feathers, finger bones, crystal shards) that lag behind it with a phase offset, so the wing bends as it beats.
type Obj = THREE.Group & { userData: { attach: "player"; flap: THREE.Object3D[]; chain: THREE.Object3D[] } };

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!; g.imageSmoothingEnabled = false; draw(g);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rnd = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** a 12x32 pixel feather: spine, barbs, a lit and a shaded half, tapered tip. pal = [shadow, mid, light, spine] */
function featherTex(pal: [string, string, string, string], tipGlow?: string) {
  return canvasTex(12, 32, (g) => {
    for (let y = 0; y < 32; y++) {
      const k = y / 31, half = k < 0.25 ? 2.2 + k * 14 : k < 0.7 ? 5.7 : 5.7 * (1 - (k - 0.7) / 0.3) + 0.4;
      for (let x = 0; x < 12; x++) {
        const d = x + 0.5 - 6; if (Math.abs(d) > half) continue;
        const barb = (x + Math.floor(y * 0.9)) % 3 === 0, side = d < 0 ? 1 : 0;
        let c = d === 0 || Math.abs(d) < 0.6 ? pal[3] : side ? (barb ? pal[1] : pal[2]) : (barb ? pal[0] : pal[1]);
        if (rnd(x, y) > 0.9) c = pal[2];
        if (tipGlow && k > 0.82) c = tipGlow;
        g.fillStyle = c; g.fillRect(x, y, 1, 1);
      }
    }
  });
}
const mkMat = (map: THREE.Texture, emissive = 0x000000) => new THREE.MeshLambertMaterial({ map, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, emissive, emissiveIntensity: 0.55 });

function shell(): Obj { const o = new THREE.Group() as Obj; o.userData = { attach: "player", flap: [], chain: [] }; return o; }
function pivot(o: Obj, s: number, y = -1.2) { const w = new THREE.Group(); w.position.set(s * 1.5, y, -2.5); w.userData.side = s; o.userData.flap.push(w); o.add(w); return w; }

function feather(parent: THREE.Object3D, o: Obj, s: number, mat: THREE.Material, len: number, wid: number, theta: number, z: number, k: number, y = 0) {
  const geo = new THREE.PlaneGeometry(wid, len); geo.translate(0, -len / 2, 0);
  const g = new THREE.Group(); const m = new THREE.Mesh(geo, mat); g.add(m);
  g.position.set(0, y, z); g.rotation.z = s * theta; g.userData = { base: g.rotation.z, k, side: s }; parent.add(g); o.userData.chain.push(g); return g;
}

export function buildWings(kind: "angel" | "dragon" | "crystal" | "nebula"): Obj {
  const o = shell();
  if (kind === "angel" || kind === "nebula") {
    const nb = kind === "nebula";
    const pal: [string, string, string, string][] = nb
      ? [["#2a1b6e", "#5a3cc4", "#8f6bff", "#d9c9ff"], ["#1b3a7a", "#2f7bd6", "#58c4ff", "#d3f2ff"], ["#4a1d6e", "#9b3fc9", "#e277ff", "#ffe0ff"]]
      : [["#9fb0cc", "#d7e0f0", "#ffffff", "#fff4cf"], ["#b8c4dc", "#e6ecf7", "#ffffff", "#ffe9a8"], ["#c9a24a", "#f2d27a", "#fff2b8", "#ffffff"]];
    const mats = pal.map((p) => mkMat(featherTex(p, nb ? "#ffffff" : undefined), nb ? 0x4a3aa0 : 0x303848));
    for (const s of [-1, 1]) {
      const w = pivot(o, s);
      const bone = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: nb ? 0x3a2a8a : 0xd9c58a })); bone.position.set(s * 2.6, 0.9, 0.1); bone.rotation.z = s * 0.16; w.add(bone);
      // three rows of feathers: coverts (short, near the arm), secondaries, primaries (long, at the tip)
      const rows: [number, number, number, number, number, number][] = [[7, 3.4, 0.35, 1.25, 8, 0.2], [11, 3.6, 0.5, 1.7, 8, 0.1], [16, 3.4, 0.9, 2.15, 7, 0]];
      rows.forEach(([len, wid, t0, t1, n, z], r) => {
        for (let i = 0; i < n; i++) { const k = i / (n - 1), th = t0 + (t1 - t0) * k; feather(w, o, s, mats[(r + i) % mats.length], len + Math.sin(k * 3) * 1.2 - (r === 2 ? 0 : 0), wid, th, -r * 0.08 - i * 0.012 + z * 0, k + r * 0.15, 1.4 - k * 0.6); }
      });
      if (nb) for (let i = 0; i < 9; i++) { const star = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0x8fd9ff })); star.position.set(s * (4 + i * 1.6), 3 - Math.sin(i * 1.1) * 4, 0.5); w.add(star); }
    }
  } else if (kind === "dragon") {
    const bone = new THREE.MeshLambertMaterial({ color: 0x3a1c22 }), memCol = [new THREE.Color(0x5a0f1c), new THREE.Color(0xd24a22)];
    for (const s of [-1, 1]) {
      const w = pivot(o, s, -0.8);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1, 1), bone); arm.position.set(s * 3.2, 2.2, 0); arm.rotation.z = s * 0.38; w.add(arm);
      const wrist = new THREE.Group(); wrist.position.set(s * 6.1, 4.2, 0); wrist.userData = { base: 0, k: 0.3, side: s }; w.add(wrist); o.userData.chain.push(wrist);
      const tips: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
      for (let i = 0; i < 4; i++) { const ang = s * (0.15 + i * 0.5) + (s > 0 ? 0 : 0), len = 13 - i * 1.2; const dir = new THREE.Vector2(s * Math.cos(0.5 - i * 0.55 + 0.2), Math.sin(0.5 - i * 0.55 + 0.2) - (i > 1 ? 0.15 : 0)).normalize(); void ang;
        const f = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.55), bone); f.position.set(dir.x * len / 2, dir.y * len / 2, 0); f.rotation.z = Math.atan2(dir.y, dir.x); wrist.add(f);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 4), new THREE.MeshLambertMaterial({ color: 0xe8d8b8 })); claw.position.set(dir.x * len, dir.y * len, 0); claw.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2; wrist.add(claw);
        tips.push(new THREE.Vector2(dir.x * len, dir.y * len)); }
      // webbing between neighbouring fingers, shaded dark at the bone and warm toward the edge
      for (let i = 1; i < tips.length - 1; i++) {
        const sh = new THREE.Shape([new THREE.Vector2(0, 0), tips[i], new THREE.Vector2((tips[i].x + tips[i + 1].x) * 0.46, (tips[i].y + tips[i + 1].y) * 0.38), tips[i + 1]]);
        const geo = new THREE.ShapeGeometry(sh), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
        for (let v = 0; v < pos.count; v++) { const d = Math.min(1, Math.hypot(pos.getX(v), pos.getY(v)) / 13), c = memCol[0].clone().lerp(memCol[1], d * d); col.set([c.r, c.g, c.b], v * 3); }
        geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); const mem = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x401008, emissiveIntensity: 0.4 })); mem.position.z = -0.1; wrist.add(mem);
      }
      const inner = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(s * 6.3, 4.2), new THREE.Vector2(s * 4, -9), new THREE.Vector2(0, -7)]);
      const ig = new THREE.Mesh(new THREE.ShapeGeometry(inner), new THREE.MeshLambertMaterial({ color: 0x7a1424, side: THREE.DoubleSide, emissive: 0x300810, emissiveIntensity: 0.4 })); ig.position.z = -0.12; w.add(ig);
    }
  } else {
    const core = new THREE.MeshLambertMaterial({ color: 0x35d4ff, emissive: 0x0a7fa8, emissiveIntensity: 0.9, flatShading: true, transparent: true, opacity: 0.92 });
    const edge = new THREE.MeshLambertMaterial({ color: 0xc9f6ff, emissive: 0x6fe4ff, emissiveIntensity: 0.9, flatShading: true });
    for (const s of [-1, 1]) {
      const w = pivot(o, s, -0.6);
      for (let i = 0; i < 7; i++) {
        const k = i / 6, len = 8 + Math.sin(k * Math.PI) * 6 + (i === 3 ? 2 : 0), g = new THREE.Group(); g.position.set(s * 0.8, 1.6 - k * 0.8, -k * 0.2);
        g.rotation.z = s * (0.55 + k * 1.3); g.userData = { base: g.rotation.z, k: k + 0.1, side: s };
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), i % 2 ? core : edge); shard.scale.set(1.15, len / 2, 0.38); shard.position.y = -len / 2; g.add(shard);
        const sub = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), edge); sub.scale.set(0.6, 2.1, 0.3); sub.position.set(0, -len - 0.8, 0); g.add(sub);
        w.add(g); o.userData.chain.push(g);
      }
    }
  }
  return o;
}
