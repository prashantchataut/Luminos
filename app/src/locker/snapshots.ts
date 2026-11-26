import { SkinViewer } from "skinview3d";
import { makeRelief } from "./scene";

/**
 * One shared offscreen skinview3d viewer (260x280). Grid cards never own a WebGL context: every skin portrait and every cape card
 * is rendered here once (queued), captured with toDataURL and cached, so scrolling the grid costs no GPU time.
 *  - skins: walking pose, yaw 25 deg, pitch -10 deg
 *  - capes: the cape draped on the equipped skin from a 3/4 back angle (yaw 150 deg, pitch -10 deg), tilted back and with the
 *    3D voxel relief layer extruded from the cape texture
 */
const W = 260, H = 280, rad = (d: number) => (d * Math.PI) / 180;
let viewer: SkinViewer | null = null;
let chain: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string>>();
/** Cheap FNV-1a hash of a whole data URL, so two different skins of equal length never share a cached render. */
function h(str: string) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); }

function get(): SkinViewer {
  if (!viewer) {
    viewer = new SkinViewer({ width: W, height: H, preserveDrawingBuffer: true, renderPaused: true });
    viewer.fov = 36; viewer.globalLight.intensity = 1.1; viewer.cameraLight.intensity = 0.9;
    viewer.background = null;
  }
  return viewer;
}
function aim(v: SkinViewer, yawDeg: number, pitchDeg: number, dist: number) {
  v.playerWrapper.rotation.y = rad(yawDeg);
  v.camera.position.set(0, Math.sin(rad(-pitchDeg)) * dist, Math.cos(rad(-pitchDeg)) * dist);
  v.camera.lookAt(0, 0, 0);
}
function image(src: string): Promise<HTMLCanvasElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; c.getContext("2d")!.drawImage(i, 0, 0); res(c); }; i.onerror = rej; i.src = src; });
}
function enqueue(key: string, job: () => Promise<string>): Promise<string> {
  const hit = cache.get(key); if (hit) return hit;
  const p = chain.then(job); chain = p.catch(() => undefined); cache.set(key, p); p.catch(() => cache.delete(key));
  return p;
}
function clearCape(v: SkinViewer) { const cape: any = (v.playerObject as any).cape; for (const ch of [...cape.children]) if (ch.userData?.voxels !== undefined) { cape.remove(ch); ch.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); } }

export function snapSkin(src: string, slim: boolean): Promise<string> {
  return enqueue(`s|${src.slice(0, 120)}|${src.length}|${slim}`, async () => {
    const v = get(); clearCape(v);
    await v.loadSkin(src, { model: slim ? "slim" : "default" }); v.loadCape(null);
    const s = v.playerObject.skin; s.leftLeg.rotation.x = 0.5; s.rightLeg.rotation.x = -0.5; s.leftArm.rotation.x = -0.5; s.rightArm.rotation.x = 0.5;
    v.playerObject.cape.rotation.x = 0;
    v.camera.position.set(0, 0, 1); v.zoom = 0.9; aim(v, 25, -10, 50);
    v.render(); return v.canvas.toDataURL("image/png");
  });
}
export function snapCape(capeSrc: string, skinSrc: string, slim: boolean): Promise<string> {
  return enqueue(`c|${capeSrc}|${h(skinSrc)}|${slim}`, async () => {
    const v = get(); clearCape(v);
    const [cc] = await Promise.all([image(capeSrc), v.loadSkin(skinSrc, { model: slim ? "slim" : "default" })]);
    await v.loadCape(cc.toDataURL(), { backEquipment: "cape" });
    const s = v.playerObject.skin; s.leftLeg.rotation.x = 0.12; s.rightLeg.rotation.x = -0.12; s.leftArm.rotation.x = -0.1; s.rightArm.rotation.x = 0.1;
    v.playerObject.cape.rotation.x = rad(18);
    (v.playerObject as any).cape.add(makeRelief(cc));
    aim(v, 150, -10, 46);
    v.render(); return v.canvas.toDataURL("image/png");
  });
}
