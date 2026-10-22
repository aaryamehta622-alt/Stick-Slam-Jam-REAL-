import { Fighter, ActiveAttack, FIGHTER_HEIGHT } from "./types";

const HEAD_R = 12;
const TORSO_LEN = 42;
const ARM_LEN = 32;
const LEG_LEN = 46;

export interface Joints {
  head: [number, number];
  neck: [number, number];
  pelvis: [number, number];
  shoulderL: [number, number];
  shoulderR: [number, number];
  elbowL: [number, number];
  elbowR: [number, number];
  handL: [number, number];
  handR: [number, number];
  kneeL: [number, number];
  kneeR: [number, number];
  footL: [number, number];
  footR: [number, number];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Compute joint kinematics with smooth interpolation between idle/walk/jump/attack/hitstun.
export function computeJoints(f: Fighter, now: number): Joints {
  const facing = f.facing;
  const ragdollLean = f.ragdoll * facing * -1;

  // Base idle pose
  let pelvisX = ragdollLean * 6;
  let pelvisY = LEG_LEN;

  // Feet
  let footLx = -10, footLy = 0;
  let footRx = 10, footRy = 0;
  let kneeLx = -8, kneeLy = LEG_LEN * 0.5;
  let kneeRx = 8, kneeRy = LEG_LEN * 0.5;

  // Walk cycle
  if (f.onGround && f.moveBlend > 0.01 && !f.attack && f.hitstun <= 0) {
    const ph = f.walkPhase;
    const gait = f.moveBlend;
    footLx = -10 + Math.cos(ph) * 16 * gait;
    footRx = 10 + Math.cos(ph + Math.PI) * 16 * gait;
    footLy = Math.max(0, Math.sin(ph) * 14) * gait;
    footRy = Math.max(0, Math.sin(ph + Math.PI) * 14) * gait;
    kneeLx = (footLx - 0) * 0.5 - 4;
    kneeRx = (footRx - 0) * 0.5 + 4;
    kneeLy = LEG_LEN * 0.5 + footLy * 0.4;
    kneeRy = LEG_LEN * 0.5 + footRy * 0.4;
    pelvisY = LEG_LEN + Math.sin(ph * 2) * 2;
  } else if (!f.onGround) {
    // Tucked legs in air
    footLx = -8;
    footRx = 10;
    footLy = 14;
    footRy = 22;
    kneeLx = -6; kneeLy = 28;
    kneeRx = 8;  kneeRy = 32;
  }

  let neckX = pelvisX + ragdollLean * 6;
  let neckY = pelvisY + TORSO_LEN;
  let headX = neckX + ragdollLean * 4 + facing * 2;
  let headY = neckY + HEAD_R + 4;

  let shoulderLx = neckX - 6, shoulderLy = neckY - 2;
  let shoulderRx = neckX + 6, shoulderRy = neckY - 2;

  // Idle hands
  let handLx = shoulderLx - 10, handLy = shoulderLy - ARM_LEN + 2;
  let handRx = shoulderRx + 10, handRy = shoulderRy - ARM_LEN + 2;
  let elbowLx = shoulderLx - 6, elbowLy = shoulderLy - ARM_LEN * 0.5;
  let elbowRx = shoulderRx + 6, elbowRy = shoulderRy - ARM_LEN * 0.5;

  // Subtle idle breathing
  const breath = Math.sin(now * 2 + (f.id === "player" ? 0 : 1)) * 1.2;
  pelvisY += breath * 0.4;
  neckY += breath * 0.6;
  headY += breath * 0.6;

  // BLOCK pose
  if (f.blocking && !f.attack) {
    handLx = shoulderLx + facing * 8;
    handLy = shoulderLy + 6;
    handRx = shoulderRx + facing * 14;
    handRy = shoulderRy + 12;
    elbowLx = shoulderLx + facing * 4;
    elbowLy = shoulderLy - 6;
    elbowRx = shoulderRx + facing * 8;
    elbowRy = shoulderRy - 4;
  }

  // ATTACK pose with smooth in/out
  if (f.attack) {
    const a = f.attack;
    const t = (now - a.startTime) / a.duration;
    // wind-up (0 to activeStart/duration), strike (to activeEnd), recover (to 1)
    const ws = a.activeStart / a.duration;
    const we = a.activeEnd / a.duration;
    let phase: "wind" | "strike" | "recover";
    let pT: number;
    if (t < ws) {
      phase = "wind";
      pT = t / ws;
    } else if (t < we) {
      phase = "strike";
      pT = (t - ws) / (we - ws);
    } else {
      phase = "recover";
      pT = (t - we) / (1 - we);
    }
    pT = Math.max(0, Math.min(1, pT));

    if (a.kind === "punch" || a.kind === "slash" || a.kind === "magic") {
      // Lead hand: cock back during wind, snap forward during strike, recover
      const baseX = shoulderRx;
      const baseY = shoulderRy - 4;
      let extend = 0;
      if (phase === "wind") extend = lerp(0, -0.4, easeOut(pT));
      else if (phase === "strike") extend = lerp(-0.4, 1.0, easeOut(pT));
      else extend = lerp(1.0, 0, easeOut(pT));
      const reach = a.reach;
      handRx = baseX + facing * reach * extend;
      handRy = baseY + Math.sin(t * 8) * 2;
      if (a.kind === 'magic') handRy = baseY + Math.sin(Math.max(0, extend) * Math.PI) * 24;
      if (a.abilityId === 'uppercutLauncher') handRy = baseY + Math.max(0, extend) * 64 - 15;
      if (a.kind === 'slash') handRy = baseY + Math.sin(extend * Math.PI * 1.2) * 22;
      elbowRx = baseX + facing * reach * extend * 0.55;
      elbowRy = baseY - 6 + Math.abs(extend) * 4;
      // Off arm cocks back
      handLx = shoulderLx - facing * (12 + 10 * Math.abs(extend));
      handLy = shoulderLy - 14;
      elbowLx = shoulderLx - facing * 4;
      elbowLy = shoulderLy - 18;
    } else {
      // KICK: leg swings up & forward
      let extend = 0;
      if (phase === "wind") extend = lerp(0, -0.3, easeOut(pT));
      else if (phase === "strike") extend = lerp(-0.3, 1.0, easeInOut(pT));
      else extend = lerp(1.0, 0, easeOut(pT));
      const reach = a.reach;
      // Use front foot
      const ky = pelvisY + 28 - Math.abs(extend) * 8;
      const kickFootX = pelvisX + facing * reach * extend;
      const kickFootY = ky;
      const kickKneeX = pelvisX + facing * reach * extend * 0.55;
      const kickKneeY = pelvisY + 12;
      if (facing === 1) {
        footRx = kickFootX; footRy = kickFootY;
        kneeRx = kickKneeX; kneeRy = kickKneeY;
        // back leg plants
        footLx = -14; footLy = 0;
        kneeLx = -10; kneeLy = LEG_LEN * 0.5;
      } else {
        footLx = kickFootX; footLy = kickFootY;
        kneeLx = kickKneeX; kneeLy = kickKneeY;
        footRx = 14; footRy = 0;
        kneeRx = 10; kneeRy = LEG_LEN * 0.5;
      }
      // Arms balance
      handRx = shoulderRx - facing * 14;
      handRy = shoulderRy - 22;
      handLx = shoulderLx - facing * 6;
      handLy = shoulderLy - 28;
      elbowRx = shoulderRx - facing * 6; elbowRy = shoulderRy - 12;
      elbowLx = shoulderLx - facing * 2; elbowLy = shoulderLy - 16;
      // Slight crouch
      pelvisY -= 4 * Math.abs(extend);
      neckY -= 4 * Math.abs(extend);
      headY -= 4 * Math.abs(extend);
    }
  }

  // Hitstun: arms flail back, slight tilt
  if (f.hitstun > 0 && !f.attack) {
    const k = Math.min(1, f.hitstun * 4);
    handLx = shoulderLx - facing * 16 * k;
    handLy = shoulderLy - 8 + 8 * k;
    handRx = shoulderRx - facing * 22 * k;
    handRy = shoulderRy - 4 + 12 * k;
    elbowLx = shoulderLx - facing * 8 * k;
    elbowLy = shoulderLy - 14;
    elbowRx = shoulderRx - facing * 12 * k;
    elbowRy = shoulderRy - 12;
  }

  // Add fighter y offset (jumping)
  const off = f.y;
  return {
    head: [headX, headY + off],
    neck: [neckX, neckY + off],
    pelvis: [pelvisX, pelvisY + off],
    shoulderL: [shoulderLx, shoulderLy + off],
    shoulderR: [shoulderRx, shoulderRy + off],
    elbowL: [elbowLx, elbowLy + off],
    elbowR: [elbowRx, elbowRy + off],
    handL: [handLx, handLy + off],
    handR: [handRx, handRy + off],
    kneeL: [kneeLx, kneeLy + off],
    kneeR: [kneeRx, kneeRy + off],
    footL: [footLx, footLy + off],
    footR: [footRx, footRy + off],
  };
}

// Returns world hit point (relative to fighter root, +y up)
export function getAttackHitPoint(f: Fighter, now: number): [number, number] | null {
  if (!f.attack) return null;
  const j = computeJoints(f, now);
  if (f.attack.kind === "punch") {
    return [j.handR[0] + f.facing * 4, j.handR[1]];
  }
  if (f.attack.kind === "slash" || f.attack.kind === "magic") {
    // blade tip extends beyond the lead hand
    return [j.handR[0] + f.facing * 36, j.handR[1] + 4];
  }
  return f.facing === 1 ? j.footR : j.footL;
}

export const STICK_DIMS = { headR: HEAD_R, torsoLen: TORSO_LEN, armLen: ARM_LEN, legLen: LEG_LEN, height: FIGHTER_HEIGHT };
