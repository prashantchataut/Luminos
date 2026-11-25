import { LockerScene } from "./scene";
import type { Equipped } from "./catalog";
import type { EmoteId } from "./pets";

// One hidden LockerScene renders every card preview (skinview3d + three.js, same lights and models as the stage) to a PNG once.
const EMPTY: Equipped = { pets: null, wings: null, hats: null, masks: null, bandanas: null, cloaks: null, back: null, emotes: null };
export type SnapSpec = { key: string; skin: string; slim: boolean; equipped?: Partial<Equipped>; cape?: string | null; emote?: EmoteId; yaw?: number; at?: number; zoom?: number };
let sc: LockerScene | null = null, cv: HTMLCanvasElement | null = null, chain: Promise<unknown> = Promise.resolve();
const cache = new Map<string, string>();
export const snapCached = (key: string) => cache.get(key);

async function render(spec: SnapSpec) {
  if (!sc) { cv = document.createElement("canvas"); sc = new LockerScene(cv, 360, 400); sc.transparent = true; sc.v.zoom = 0.5; sc.sway = false; sc.setMode("studio"); }
  const s = sc;
  await s.setSkin(spec.skin, spec.slim);
  s.setEquipped({ ...EMPTY, ...spec.equipped });
  await s.setCape(spec.cape ?? null);
  s.setMove("idle");
  s.emote = spec.emote ? { id: spec.emote, t0: performance.now() - (spec.at ?? 0.6) * 1000 } : null;
  s.v.playerWrapper.rotation.y = spec.yaw ?? 0.5; s.v.zoom = spec.zoom ?? 0.62;
  s.settle(); s.tick(); s.v.render();
  const url = cv!.toDataURL("image/png"); cache.set(spec.key, url); return url;
}
export function snap(spec: SnapSpec): Promise<string> {
  const hit = cache.get(spec.key); if (hit) return Promise.resolve(hit);
  const p = chain.then(() => render(spec)); chain = p.catch(() => undefined); return p;
}
