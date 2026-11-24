/** Pet and player behaviour as pure functions of (move, time). No three.js here, so it is unit-tested in node.
 *  Coordinates: the player's neck is the origin, +y up, +z forward, the player's right side is -x. Feet sit at y = -24, head top at +8. */
export type Move = "idle" | "walk" | "jump" | "swim" | "hurt";
export const MOVES: Move[] = ["idle", "walk", "jump", "swim", "hurt"];
export type PetKind = "cube" | "dragon" | "wisp" | "minime";

type V = { x: number; y: number; z: number };
export type Part = { rotation: V; position?: V };
export type Rig = { head: Part; body: Part; rightArm: Part; leftArm: Part; rightLeg: Part; leftLeg: Part };

const air = (t: number, period = 1.2) => { const ph = (t % period) / period; return ph < 0.7 ? Math.sin((ph / 0.7) * Math.PI) : 0; };
const hit = (t: number, period = 1.6) => { const ph = (t % period) / period; return ph < 0.35 ? 1 - ph / 0.35 : 0; };

/** Poses the six body parts and returns how the whole body moves: lift (y), pitch (lean or lie down, radians) and a red flash 0..1. */
export function applyMove(rig: Rig, move: Move, t: number): { lift: number; pitch: number; flash: number } {
  for (const p of Object.values(rig)) { p.rotation.x = 0; p.rotation.y = 0; p.rotation.z = 0; }
  let lift = 0, pitch = 0, flash = 0;
  if (move === "idle") {
    rig.rightArm.rotation.z = 0.06 + Math.sin(t * 1.6) * 0.03; rig.leftArm.rotation.z = -rig.rightArm.rotation.z;
    rig.head.rotation.y = Math.sin(t * 0.7) * 0.15;
  } else if (move === "walk") {
    const w = Math.sin(t * 7);
    rig.rightArm.rotation.x = w * 0.7; rig.leftArm.rotation.x = -w * 0.7; rig.rightLeg.rotation.x = -w * 0.7; rig.leftLeg.rotation.x = w * 0.7;
    lift = Math.abs(Math.cos(t * 7)) * 0.4;
  } else if (move === "jump") {
    const a = air(t);
    rig.rightArm.rotation.x = -a * 2.2; rig.leftArm.rotation.x = -a * 2.2; rig.rightLeg.rotation.x = a * 0.3; rig.leftLeg.rotation.x = -a * 0.2;
    lift = a * 5;
  } else if (move === "swim") {
    pitch = 1.25;
    const w = Math.sin(t * 4);
    rig.rightArm.rotation.x = -1.6 + w * 1.2; rig.leftArm.rotation.x = -1.6 - w * 1.2;
    rig.rightLeg.rotation.x = Math.sin(t * 8) * 0.4; rig.leftLeg.rotation.x = -Math.sin(t * 8) * 0.4;
    lift = Math.sin(t * 2) * 0.6;
  } else {
    const h = hit(t);
    pitch = -h * 0.35; rig.head.rotation.x = h * 0.4; rig.rightArm.rotation.z = 0.1 + h * 0.8; rig.leftArm.rotation.z = -(0.1 + h * 0.8);
    flash = h;
  }
  return { lift, pitch, flash };
}

export type Pose = { x: number; y: number; z: number; ry: number; scale: number; flap: number; helmet: boolean; flash: number; trail: number };

/** Behaviour spec, one row per pet and move. The same table is in docs/research/PET_BEHAVIOUR.md. */
export function petPose(kind: PetKind, move: Move, t: number): Pose {
  const h = move === "hurt" ? hit(t) : 0;
  const base: Pose = { x: 0, y: 0, z: 0, ry: 0, scale: 1, flap: 0, helmet: move === "swim", flash: h, trail: 0 };
  if (kind === "cube") {
    // follows behind-left, floats and turns slowly; keeps up when walking; hops a beat after the player; seals itself in a glass shell underwater
    const walk = move === "walk", swim = move === "swim";
    return { ...base, x: -12 + (h ? Math.sin(t * 60) * 0.8 * h : 0), z: walk ? -7 : 5, ry: t * (walk ? 1.4 : 0.6),
      y: (swim ? 3 : -1) + Math.sin(t * (walk ? 7 : 2.4)) * (walk ? 0.9 : 1.2) + (move === "jump" ? air(Math.max(0, t - 0.25)) * 4 : 0) };
  }
  if (kind === "dragon") {
    // perches on the right shoulder; wings idle slowly, flutter on a jump, fold when swimming, flinch when hit
    const a = move === "jump" ? air(t) : 0;
    return { ...base, x: -6.5, z: 0, y: 3.4 + (move === "walk" ? Math.abs(Math.cos(t * 7)) * 0.4 : 0) + a * 1.2,
      ry: Math.sin(t * 0.9) * 0.3, scale: 1 - h * 0.15,
      flap: move === "jump" ? 0.9 : move === "swim" ? 0 : move === "walk" ? 0.25 : 0.12 + 0.1 * Math.sin(t * 1.5) };
  }
  if (kind === "wisp") {
    // orbits the head, faster when moving, wider on a jump, lower and bubbled underwater, scatters when hit
    const speed = { idle: 1.7, walk: 2.6, jump: 3.2, swim: 1.2, hurt: 5 }[move];
    const r = 11 + (move === "jump" ? air(t) * 3 : 0) + h * 4, ang = t * speed;
    return { ...base, x: Math.cos(ang) * r, z: Math.sin(ang) * r, y: (move === "swim" ? -1 : 5) + Math.sin(t * 2) * 2, trail: 1 };
  }
  // minime: stands beside the player at 35% size and copies the player's move; the scene runs applyMove on it
  return { ...base, x: 13, z: 2, y: -24 + 24 * 0.35, scale: 0.35, helmet: false };
}

/** Emote poses (arms and body only). `partner` marks the one that needs a second player. */
export type EmoteId = "wave" | "hug" | "spin";
export const EMOTE_SECONDS: Record<EmoteId, number> = { wave: 2.4, hug: 3, spin: 1.4 };
export function applyEmote(rig: Rig, id: EmoteId, t: number): { yaw: number; pitch: number; lift: number } {
  applyMove(rig, "idle", t);
  const k = (t % EMOTE_SECONDS[id]) / EMOTE_SECONDS[id];
  if (id === "wave") { rig.rightArm.rotation.z = 2.5 + Math.sin(t * 9) * 0.35; rig.rightArm.rotation.x = 0; return { yaw: 0, pitch: 0, lift: 0 }; }
  if (id === "hug") { const e = Math.sin(Math.min(1, k * 1.4) * Math.PI / 2); rig.rightArm.rotation.x = -1.5 * e; rig.leftArm.rotation.x = -1.5 * e; rig.rightArm.rotation.y = 0.5 * e; rig.leftArm.rotation.y = -0.5 * e; return { yaw: 0, pitch: 0.12 * e, lift: 0 }; }
  const e = k < 0.85 ? Math.sin((k / 0.85) * Math.PI) : 0;
  rig.rightArm.rotation.z = 0.5 + e * 1.2; rig.leftArm.rotation.z = -0.5 - e * 1.2;
  return { yaw: k * Math.PI * 2, pitch: 0, lift: e * 3 };
}

/** Equipment rule: wings, cloaks and back items share the back, so wearing one removes the others. Pets and wings never conflict. */
export const BACK_GROUP = ["wings", "cloaks", "back"] as const;
