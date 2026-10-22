import { drawFishing, drawFishingFloor } from './vfx/fishing';
import { Fighter, ARENA_W, ARENA_H } from "./types";
import { computeJoints } from "./stick";
import { GameState, Projectile, AOEZone, ArenaId } from "./engine";
import type { WeaponId } from "./classes";
import { drawMoveEffects, drawMoveUnderlays, drawDetailedProjectile, drawDetailedArea } from './vfx';
import { hexAlpha } from './colors';
import { drawEnvironment } from './environment';
import { drawAtmosphere, drawEnergy, drawCinematicHUD } from './presentation';
import { computeVisualJoints,drawPixelCharacters,drawRetroEnvironment } from './pixel-art';

interface RenderOpts {
  ctx: CanvasRenderingContext2D;
  state: GameState;
  width: number;
  height: number;
  preview?: boolean;
}

const ARENA_THEMES: Record<ArenaId, {
  top: string; bot: string; ground: string; groundLine: string; accent: string; name: string;
}> = {
  dojo:    { top: "#0a0a0e", bot: "#13131a", ground: "#1c1c24", groundLine: "#3a3a48", accent: "#888", name: "DOJO" },
  rooftop: { top: "#0a1226", bot: "#1a1438", ground: "#0e0a1a", groundLine: "#5a3aa8", accent: "#c799ff", name: "ROOFTOP" },
  volcano: { top: "#1a0808", bot: "#2a0c0a", ground: "#1a0606", groundLine: "#7a2a1a", accent: "#ff6a30", name: "VOLCANO" },
};

function hexA(hex: string, a: number) {
  return hexAlpha(hex, a);
}
function lighten(hex: string, t: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const lr = Math.round(r + (255 - r) * t);
  const lg = Math.round(g + (255 - g) * t);
  const lb = Math.round(b + (255 - b) * t);
  return `rgb(${lr},${lg},${lb})`;
}

function capsule(
  ctx: CanvasRenderingContext2D,
  a: [number, number],
  b: [number, number],
  radius: number,
) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ang = Math.atan2(dy, dx);
  const len = Math.hypot(dx, dy) || 0.0001;
  ctx.save();
  ctx.translate(a[0], a[1]);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI / 2, -Math.PI / 2, false);
  ctx.lineTo(len, -radius);
  ctx.arc(len, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStick(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  groundY: number,
  time: number,
  alpha: number,
  colorOverride?: string,
  layer:'all'|'body'|'back'|'front'='all',
) {
  const j = computeVisualJoints(f, time);
  ctx.save();
  ctx.translate(f.x, groundY);
  ctx.scale(1, -1);

  let baseColor = colorOverride ?? f.klass.color;
  // Equipped skin recolors the fighter (skin is per-class)
  if (!colorOverride && f.equipped?.skin) {
    baseColor = f.equipped.skin.color;
  }
  if (f.flashTime > 0) {
    const k = Math.min(1, f.flashTime / 0.14);
    if (k > 0.5) baseColor = "#ffffff";
  }
  if (f.frozen > 0) baseColor = "#9ad8ff";
  if (f.berserk > 0 && Math.floor(time * 12) % 2) baseColor = "#ffd060";

  let renderAlpha = alpha;
  if (f.invisible > 0) renderAlpha = alpha * 0.18;
  ctx.globalAlpha = renderAlpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const body = baseColor;
  const hi = lighten(baseColor, 0.28);

  const isBoss = !!f.isBoss;
  const scale = isBoss ? 1.35 : 1;
  ctx.scale(scale, scale);

  const armR = 5;
  const legR = 6.5;
  const torsoR = 9;
  const headR = 13;

  if(layer==='all'||layer==='back'){
  // Shadow
  ctx.save();
  ctx.scale(1, -1);
  const shadowW = 28 - Math.min(20, Math.abs(f.y) * 0.25);
  if (shadowW > 4) {
    const sg = ctx.createRadialGradient(0, -1, 2, 0, -1, shadowW);
    sg.addColorStop(0, "rgba(0,0,0,0.45)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, -1, shadowW, shadowW * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Equipped cosmetic aura (always-on flair while alive)
  if (f.equipped?.aura && f.hp > 0) {
    ctx.save();
    ctx.scale(1, -1);
    const c = f.equipped.aura.color;
    const r = 56 + Math.sin(time * 4) * 4;
    const g = ctx.createRadialGradient(0, -50, 6, 0, -50, r);
    g.addColorStop(0, hexA(c, 0.55));
    g.addColorStop(0.55, hexA(c, 0.18));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -50, r, 0, Math.PI * 2);
    ctx.fill();
    // Orbiting motes
    ctx.fillStyle = hexA(c, 0.9);
    for (let i = 0; i < 4; i++) {
      const a = time * 2 + i * (Math.PI / 2);
      const ox = Math.cos(a) * 32;
      const oy = -50 + Math.sin(a) * 16;
      ctx.beginPath();
      ctx.arc(ox, oy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Rage / counter / berserk auras
  if (f.rage > 0 || f.berserk > 0 || f.counterStance > 0) {
    ctx.save();
    ctx.scale(1, -1);
    const c = f.berserk > 0 ? "#ffd060" : (f.counterStance > 0 ? "#9ad" : "#ff6a30");
    const r = 50 + Math.sin(time * 16) * 6;
    const g = ctx.createRadialGradient(0, -50, 8, 0, -50, r);
    g.addColorStop(0, hexA(c, 0.4));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -50, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Heavy charge VFX: pulsing ring + concentric arcs that intensify with charge level
  if (f.heavyCharging) {
    const charge = Math.min(1, (time - f.heavyChargeStart) / 1.0);
    ctx.save();
    ctx.scale(1, -1);
    const cc = f.klass.color;
    const r = 38 + charge * 28 + Math.sin(time * 24) * 3;
    const g = ctx.createRadialGradient(0, -50, 4, 0, -50, r);
    g.addColorStop(0, hexA("#ffffff", 0.4 + 0.4 * charge));
    g.addColorStop(0.5, hexA(cc, 0.45 + 0.4 * charge));
    g.addColorStop(1, hexA(cc, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -50, r, 0, Math.PI * 2);
    ctx.fill();
    // arcs
    ctx.strokeStyle = hexA(charge >= 0.95 ? "#ffffff" : cc, 0.85);
    ctx.lineWidth = 2 + charge * 2;
    ctx.beginPath();
    ctx.arc(0, -50, r * 0.85, 0, Math.PI * 2 * charge);
    ctx.stroke();
    if (charge >= 0.95) {
      // sparks
      for (let i = 0; i < 6; i++) {
        const a = time * 6 + i;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.9, -50 + Math.sin(a) * r * 0.9, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  }
  if(layer==='all'||layer==='body'){
  // A dark silhouette rim survives bright effects and gives the pixel layer a deliberate outline.
  const limb=(a:[number,number],b:[number,number],r:number)=>{ctx.strokeStyle='#11131c';ctx.lineWidth=r*2+3;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};
  limb(j.pelvis,j.neck,torsoR);for(const [a,b,r] of [[j.pelvis,j.kneeL,legR],[j.kneeL,j.footL,legR],[j.pelvis,j.kneeR,legR],[j.kneeR,j.footR,legR],[j.shoulderL,j.elbowL,armR],[j.elbowL,j.handL,armR],[j.shoulderR,j.elbowR,armR],[j.elbowR,j.handR,armR]] as [[number,number],[number,number],number][])limb(a,b,r);
  ctx.fillStyle='#11131c';ctx.beginPath();ctx.arc(j.head[0],j.head[1],headR+2,0,Math.PI*2);ctx.fill();
  const backColor = hexA(baseColor, 0.78);
  ctx.fillStyle = backColor;
  if (f.facing === 1) {
    capsule(ctx, j.pelvis, j.kneeL, legR);
    capsule(ctx, j.kneeL, j.footL, legR * 0.9);
    capsule(ctx, j.shoulderL, j.elbowL, armR);
    capsule(ctx, j.elbowL, j.handL, armR * 0.9);
  } else {
    capsule(ctx, j.pelvis, j.kneeR, legR);
    capsule(ctx, j.kneeR, j.footR, legR * 0.9);
    capsule(ctx, j.shoulderR, j.elbowR, armR);
    capsule(ctx, j.elbowR, j.handR, armR * 0.9);
  }

  ctx.fillStyle = body;
  capsule(ctx, j.pelvis, j.neck, torsoR);

  ctx.beginPath();
  ctx.arc(j.pelvis[0], j.pelvis[1], torsoR * 0.9, 0, Math.PI * 2);
  ctx.fill();

  if (f.facing === 1) {
    capsule(ctx, j.pelvis, j.kneeR, legR);
    capsule(ctx, j.kneeR, j.footR, legR * 0.9);
    capsule(ctx, j.shoulderR, j.elbowR, armR);
    capsule(ctx, j.elbowR, j.handR, armR * 0.9);
  } else {
    capsule(ctx, j.pelvis, j.kneeL, legR);
    capsule(ctx, j.kneeL, j.footL, legR * 0.9);
    capsule(ctx, j.shoulderL, j.elbowL, armR);
    capsule(ctx, j.elbowL, j.handL, armR * 0.9);
  }

  ctx.fillStyle = body;
  for (const jt of [j.kneeL, j.kneeR, j.elbowL, j.elbowR, j.shoulderL, j.shoulderR]) {
    ctx.beginPath();
    ctx.arc(jt[0], jt[1], armR * 0.95, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const jt of [j.handL, j.handR]) {
    ctx.beginPath();
    ctx.arc(jt[0], jt[1], armR * 1.05, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const jt of [j.footL, j.footR]) {
    ctx.beginPath();
    ctx.ellipse(jt[0] + f.facing * 3, jt[1], legR * 1.3, legR * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(j.head[0], j.head[1], headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle=hexA(hi,.65);ctx.fillRect(j.head[0]-7,j.head[1]+5,6,4);
  ctx.fillStyle='#151824';ctx.fillRect(j.head[0]+f.facing*3-(f.facing<0?4:0),j.head[1]+1,4,3);
  if(['samurai','ninja','assassin','shadowAssassin','shadowRogue'].includes(f.classId)){
    ctx.fillStyle='#20202a';ctx.fillRect(j.head[0]-12,j.head[1]+5,24,4);
    if(f.klass.category==='speed'){ctx.fillRect(j.head[0]-12,j.head[1]-10,24,9);ctx.fillStyle=baseColor;ctx.fillRect(j.head[0]-f.facing*23,j.head[1]-10,12,4);}
  }
  if(f.classId==='fisherman'){ctx.fillStyle='#cdb77c';ctx.fillRect(j.head[0]-21,j.head[1]+8,42,5);ctx.fillRect(j.head[0]-12,j.head[1]+13,24,12);ctx.fillStyle='#40665d';ctx.fillRect(j.head[0]-12,j.head[1]+13,24,3);}
  if(f.classId==='viking'){ctx.strokeStyle='#e1d7b6';ctx.lineWidth=3;ctx.beginPath();for(const side of [-1,1]){ctx.moveTo(j.head[0]+side*9,j.head[1]+8);ctx.lineTo(j.head[0]+side*18,j.head[1]+16);ctx.lineTo(j.head[0]+side*18,j.head[1]+24);}ctx.stroke();}
  if(['mage','stormMage'].includes(f.classId)){ctx.fillStyle='#222336';ctx.beginPath();ctx.moveTo(j.head[0]-16,j.head[1]+7);ctx.lineTo(j.head[0]-3,j.head[1]+29);ctx.lineTo(j.head[0]+12,j.head[1]+8);ctx.closePath();ctx.fill();ctx.fillStyle=baseColor;ctx.fillRect(j.head[0]-17,j.head[1]+7,34,4);}
  }

  if(layer==='all'||layer==='front'){

  // Frozen overlay
  if (f.frozen > 0) {
    ctx.strokeStyle = "rgba(180,220,255,0.8)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-12 + i * 8, -5);
      ctx.lineTo(-8 + i * 8, 70);
      ctx.stroke();
    }
  }

  if (f.blocking) {
    ctx.strokeStyle = "rgba(180,200,255,0.85)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const bx = f.facing * 22;
    const by = 70;
    ctx.beginPath();
    ctx.moveTo(bx - f.facing * 4, by - 14);
    ctx.lineTo(bx + f.facing * 6, by);
    ctx.lineTo(bx - f.facing * 4, by + 14);
    ctx.stroke();
  }

  // Weapon held in lead hand
  drawWeaponHeld(ctx, f, j, time);
  }

  ctx.restore();
}

// Draw weapon in lead hand. Called from inside drawStick (already translated/scaled/y-flipped).
function drawWeaponHeld(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  j: ReturnType<typeof computeJoints>,
  time: number,
) {
  // Determine effective weapon (alt toggle for ninja)
  let w: WeaponId | null = f.weapon;
  if (f.altWeaponSelected && f.klass.altWeapon) w = f.klass.altWeapon;
  // Viking with axe out → fights with fists (no weapon shown)
  if (f.klass.id === "viking" && f.axeOut) w = "fists";
  if (!w || w === "fists" || w === "bruteFists" || w === "boxingGloves" || w === "fireFists") {
    // Render hand wraps for fist-class weapons
    if (w === "boxingGloves" || w === "fireFists") {
      ctx.save();
      const handWraps = [j.handR, j.handL] as [number, number][];
      for (const h of handWraps) {
        ctx.fillStyle = w === "fireFists" ? "#ff7050" : "#c84040";
        ctx.beginPath();
        ctx.arc(h[0], h[1], 7, 0, Math.PI * 2);
        ctx.fill();
        if (w === "fireFists") {
          // flame flicker
          ctx.fillStyle = hexA("#ffe080", 0.65 + Math.sin(time*17+h[0]) * 0.15);
          ctx.beginPath();
          ctx.arc(h[0], h[1] + 4, 5 + Math.sin(time*21+h[1]), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    return;
  }

  const facing = f.facing;
  const hand: [number, number] = j.handR;
  const off: [number, number] = j.handL;

  ctx.save();
  // The drawStick context is already translated/scaled/y-flipped, so we draw
  // in fighter-local space matching joint coordinates directly.
  switch (w) {
    case "katana":
    case "shadowBlade": {
      const bladeColor = w === "shadowBlade" ? "#d8c8ff" : "#e8eef8";
      const guardColor = w === "shadowBlade" ? "#5a3aa8" : "#3a3a48";
      ctx.translate(hand[0], hand[1]);
      // tilt blade based on attack phase
      let ang = 0;
      if (f.attack && f.attack.kind === "slash") {
        const t = (time - f.attack.startTime) / f.attack.duration;
        ang = (-0.6 + 1.6 * Math.max(0, Math.min(1, t))) * facing;
      } else {
        ang = -0.25 * facing;
      }
      ctx.rotate(ang);
      // grip
      ctx.fillStyle = "#1d1410";
      ctx.fillRect(-2.5, -2, 10 * facing, 4);
      // guard (tsuba)
      ctx.fillStyle = guardColor;
      ctx.fillRect(7 * facing - (facing > 0 ? 0 : 2), -5, 2 * facing, 10);
      // blade
      ctx.fillStyle = bladeColor;
      ctx.beginPath();
      ctx.moveTo(8 * facing, -2.5);
      ctx.lineTo(46 * facing, -1.5);
      ctx.lineTo(50 * facing, 0);
      ctx.lineTo(46 * facing, 1.5);
      ctx.lineTo(8 * facing, 2.5);
      ctx.closePath();
      ctx.fill();
      // shine line
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(10 * facing, -1);
      ctx.lineTo(44 * facing, -0.5);
      ctx.stroke();
      break;
    }
    case "kunai": {
      ctx.translate(hand[0], hand[1]);
      let ang = -0.2 * facing;
      if (f.attack && f.attack.kind === "slash") {
        const t = (time - f.attack.startTime) / f.attack.duration;
        ang = (-0.5 + 1.4 * Math.max(0, Math.min(1, t))) * facing;
      }
      ctx.rotate(ang);
      // handle wrap
      ctx.fillStyle = "#1a1410";
      ctx.fillRect(-2 * facing, -1.5, 8 * facing, 3);
      // ring
      ctx.strokeStyle = "#7a6a55";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-3 * facing, 0, 2.5, 0, Math.PI * 2);
      ctx.stroke();
      // diamond blade
      ctx.fillStyle = "#d8e0ec";
      ctx.beginPath();
      ctx.moveTo(7 * facing, 0);
      ctx.lineTo(11 * facing, -3);
      ctx.lineTo(20 * facing, 0);
      ctx.lineTo(11 * facing, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(9 * facing, -0.6);
      ctx.lineTo(18 * facing, 0);
      ctx.lineTo(9 * facing, 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "bow": {
      ctx.translate(off[0], off[1]);
      // bow held vertical in off-hand
      ctx.strokeStyle = "#9a7a4a";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 22, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      // string
      ctx.strokeStyle = "rgba(240,240,255,0.8)";
      ctx.lineWidth = 0.8;
      let drawT = 0;
      if (f.attack && f.attack.isAbility) {
        const t = (time - f.attack.startTime) / f.attack.duration;
        drawT = Math.max(0, Math.sin(Math.min(1, t) * Math.PI)) * 6;
      }
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(-drawT * facing, 0);
      ctx.lineTo(0, 22);
      ctx.stroke();
      // arrow nocked
      if (drawT > 1) {
        ctx.fillStyle = "#e8d8a8";
        ctx.fillRect(-drawT * facing, -0.8, 18 * facing, 1.6);
        ctx.beginPath();
        ctx.moveTo(18 * facing - drawT * facing, 0);
        ctx.lineTo(14 * facing - drawT * facing, -2.5);
        ctx.lineTo(14 * facing - drawT * facing, 2.5);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "axe": {
      ctx.translate(hand[0], hand[1]);
      let ang = 0.2 * facing;
      if (f.attack) {
        const t = (time - f.attack.startTime) / f.attack.duration;
        ang = (0.6 - 1.6 * Math.max(0, Math.min(1, t))) * facing;
      }
      ctx.rotate(ang);
      // shaft
      ctx.fillStyle = "#7a5a38";
      ctx.fillRect(-3 * facing, -2, 28 * facing, 3.2);
      // axe head
      ctx.fillStyle = "#bcae9a";
      ctx.beginPath();
      ctx.moveTo(22 * facing, -2);
      ctx.lineTo(34 * facing, -10);
      ctx.lineTo(38 * facing, 0);
      ctx.lineTo(34 * facing, 10);
      ctx.lineTo(22 * facing, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(26 * facing, -6);
      ctx.lineTo(34 * facing, -8);
      ctx.lineTo(34 * facing, -2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "staff":
    case "elementalStaff": {
      const orbColor = w === "elementalStaff" ? "#ff6fae" : f.klass.color;
      ctx.translate(hand[0], hand[1]);
      ctx.rotate(-0.7 * facing);
      // shaft
      ctx.fillStyle = "#5a3a2a";
      ctx.fillRect(-2 * facing, -2, 42 * facing, 3);
      // orb
      const og = ctx.createRadialGradient(40 * facing, 0, 1, 40 * facing, 0, 11);
      og.addColorStop(0, "#ffffff");
      og.addColorStop(0.4, orbColor);
      og.addColorStop(1, hexA(orbColor, 0));
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(40 * facing, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      // sparkle pulse during cast
      if (f.attack && f.attack.isAbility) {
        ctx.strokeStyle = hexA(orbColor, 0.8);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const a = time * 6 + i * Math.PI * 2 / 3;
          ctx.beginPath();
          ctx.moveTo(40 * facing + Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.lineTo(40 * facing + Math.cos(a) * 14, Math.sin(a) * 14);
          ctx.stroke();
        }
      }
      break;
    }
    case "cannon": {
      ctx.translate(hand[0], hand[1]);
      ctx.rotate(0);
      ctx.fillStyle = "#444";
      ctx.fillRect(0, -5, 26 * facing, 10);
      ctx.fillStyle = "#222";
      ctx.fillRect(20 * facing, -7, 8 * facing, 14);
      ctx.fillStyle = "#ffb14d";
      ctx.beginPath();
      ctx.arc(28 * facing, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "gladius": {
      ctx.translate(hand[0], hand[1]);
      let ang = -0.2 * facing;
      if (f.attack && (f.attack.kind === "slash" || f.attack.kind === "punch")) {
        const t = (time - f.attack.startTime) / f.attack.duration;
        ang = (-0.5 + 1.4 * Math.max(0, Math.min(1, t))) * facing;
      }
      ctx.rotate(ang);
      ctx.fillStyle = "#1d1410";
      ctx.fillRect(-2 * facing, -2, 7 * facing, 4);
      ctx.fillStyle = "#a07050";
      ctx.fillRect(5 * facing, -5, 2 * facing, 10);
      ctx.fillStyle = "#e0e8f0";
      ctx.beginPath();
      ctx.moveTo(7 * facing, -3);
      ctx.lineTo(32 * facing, -1);
      ctx.lineTo(36 * facing, 0);
      ctx.lineTo(32 * facing, 1);
      ctx.lineTo(7 * facing, 3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "twinDaggers": {
      // Two daggers, lead hand + offhand
      const drawDagger = (h: [number, number], swing: number) => {
        ctx.save();
        ctx.translate(h[0], h[1]);
        ctx.rotate(swing);
        ctx.fillStyle = "#1a1410";
        ctx.fillRect(-2 * facing, -1.5, 6 * facing, 3);
        ctx.fillStyle = "#d8e0ec";
        ctx.beginPath();
        ctx.moveTo(5 * facing, -2);
        ctx.lineTo(18 * facing, 0);
        ctx.lineTo(5 * facing, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
      let ang = -0.2 * facing;
      if (f.attack && (f.attack.kind === "slash" || f.attack.kind === "punch")) {
        const t = (time - f.attack.startTime) / f.attack.duration;
        ang = (-0.4 + 1.2 * Math.max(0, Math.min(1, t))) * facing;
      }
      drawDagger(hand, ang);
      drawDagger(off, ang * 0.7 + 0.1);
      break;
    }
    case "lightningGauntlets": {
      // Glowing fists with sparks
      for (const h of [hand, off]) {
        ctx.save();
        ctx.translate(h[0], h[1]);
        ctx.fillStyle = "#3a3018";
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
        g.addColorStop(0, hexA("#ffe24a", 0.85));
        g.addColorStop(1, hexA("#ffe24a", 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        // spark line
        ctx.strokeStyle = "#fff8a0";
        ctx.lineWidth = 1;
        for (let k = 0; k < 2; k++) {
          const a = time * 12 + k * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
          ctx.stroke();
        }
        ctx.restore();
      }
      break;
    }
    case "execAxe": {
      // Larger version of axe
      ctx.translate(hand[0], hand[1]);
      let ang = 0.2 * facing;
      if (f.attack) {
        const t = (time - f.attack.startTime) / f.attack.duration;
        ang = (0.7 - 1.8 * Math.max(0, Math.min(1, t))) * facing;
      }
      ctx.rotate(ang);
      ctx.fillStyle = "#5a3018";
      ctx.fillRect(-4 * facing, -2.5, 36 * facing, 4);
      ctx.fillStyle = "#9c8878";
      ctx.beginPath();
      ctx.moveTo(28 * facing, -3);
      ctx.lineTo(46 * facing, -14);
      ctx.lineTo(52 * facing, 0);
      ctx.lineTo(46 * facing, 14);
      ctx.lineTo(28 * facing, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(34 * facing, -8);
      ctx.lineTo(44 * facing, -10);
      ctx.lineTo(44 * facing, -3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "rifle": {
      ctx.translate(hand[0], hand[1]);
      ctx.fillStyle = "#2a2a32";
      ctx.fillRect(-4 * facing, -3, 36 * facing, 5);
      ctx.fillStyle = "#1a1a22";
      ctx.fillRect(-12 * facing, -1, 8 * facing, 6);
      // scope
      ctx.fillStyle = "#444";
      ctx.fillRect(8 * facing, -7, 10 * facing, 4);
      // muzzle
      ctx.fillStyle = "#888";
      ctx.fillRect(28 * facing, -1, 6 * facing, 3);
      if (f.attack && f.attack.isAbility) {
        ctx.fillStyle = "#fff8a0";
        ctx.beginPath();
        ctx.arc(36 * facing, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "stormStaff": {
      ctx.translate(hand[0], hand[1]);
      ctx.rotate(-0.7 * facing);
      ctx.fillStyle = "#3a4a5a";
      ctx.fillRect(-2 * facing, -2, 42 * facing, 3);
      // crystal orb
      const orbColor = "#7bb6ff";
      const og = ctx.createRadialGradient(40 * facing, 0, 1, 40 * facing, 0, 12);
      og.addColorStop(0, "#ffffff");
      og.addColorStop(0.4, orbColor);
      og.addColorStop(1, hexA(orbColor, 0));
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(40 * facing, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      // lightning arcs
      ctx.strokeStyle = "#cfe4ff";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = time * 8 + i * 2;
        ctx.beginPath();
        ctx.moveTo(40 * facing, 0);
        ctx.lineTo(40 * facing + Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.stroke();
      }
      break;
    }
    case "elementOrb": {
      // Floating orb that changes color based on current element
      const elColors = ["#ff7a40", "#aee0ff", "#fff080"];
      const orbColor = elColors[f.element];
      ctx.translate(hand[0], hand[1]);
      // floating slightly above the hand with bob
      const bob = Math.sin(time * 6) * 1.5;
      const ox = 6 * facing;
      const oy = -8 + bob;
      // outer aura
      const og = ctx.createRadialGradient(ox, oy, 1, ox, oy, 18);
      og.addColorStop(0, "#ffffff");
      og.addColorStop(0.45, orbColor);
      og.addColorStop(1, hexA(orbColor, 0));
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(ox, oy, 14, 0, Math.PI * 2);
      ctx.fill();
      // sparks orbiting
      ctx.strokeStyle = hexA(orbColor, 0.85);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = time * 7 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(a) * 6, oy + Math.sin(a) * 6);
        ctx.lineTo(ox + Math.cos(a) * 12, oy + Math.sin(a) * 12);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, f: Fighter, groundY: number, time: number) {
  const samples = f.trail;
  if (samples.length === 0) return;
  const trailColor = f.equipped?.trail?.color ?? f.klass.color;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const age = time - s.born;
    const a = Math.max(0, 1 - age / 0.2) * 0.35;
    if (a <= 0.02) continue;
    const ghost: Fighter = { ...f, x: s.x, y: s.y, facing: s.facing, attack: f.attack, blocking: false, trail: [] };
    drawStick(ctx, ghost, groundY, time - age, a, trailColor);
  }
}

// Bright curved arc following the blade tip during slash attacks.
function drawSlashTrail(ctx: CanvasRenderingContext2D, f: Fighter, groundY: number, time: number) {
  const samples = f.slashTrail;
  if (!samples || samples.length < 2) return;
  ctx.save();
  // Outer glow pass (thick, faint, additive)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  for (let pass = 0; pass < 2; pass++) {
    const widthMul = pass === 0 ? 8 : 3;
    const alphaMul = pass === 0 ? 0.18 : 0.85;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const age = time - s.born;
      const t = Math.max(0, 1 - age / 0.22);
      if (t <= 0) continue;
      const sy = groundY - s.y;
      if (!started) {
        ctx.moveTo(s.x, sy);
        started = true;
      } else {
        ctx.lineTo(s.x, sy);
      }
    }
    if (started) {
      // gradient feel: stroke once with weighted alpha based on newest sample
      const newest = samples[samples.length - 1];
      const c = pass === 0 ? newest.color : "#ffffff";
      ctx.strokeStyle = hexA(c, alphaMul);
      ctx.lineWidth = widthMul;
      ctx.stroke();
    }
  }
  // Inner sharp white core: per-segment alpha for clean fade
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const age = time - b.born;
    const t = Math.max(0, 1 - age / 0.22);
    if (t <= 0.05) continue;
    ctx.strokeStyle = hexA("#ffffff", 0.9 * t);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, groundY - a.y);
    ctx.lineTo(b.x, groundY - b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, groundY: number, now: number) {
  if (p.delay && now - p.born < p.delay) return;
  const sx = p.x;
  const sy = groundY - p.y;
  ctx.save();
  ctx.translate(sx, sy);
  if (p.spin) ctx.rotate((now - p.born) * p.spin);
  switch (p.kind) {
    case "arrow": {
      const ang = Math.atan2(-p.vy, p.vx);
      ctx.rotate(ang);
      // motion streak
      ctx.fillStyle = "rgba(255,240,180,0.35)";
      ctx.fillRect(-30, -1, 18, 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(-14, -1, 28, 2);
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(-16, -2, 4, 4);
      break;
    }
    case "axe": {
      // glow
      const ag = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
      ag.addColorStop(0, "rgba(255,220,160,0.55)");
      ag.addColorStop(1, "rgba(255,220,160,0)");
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7a6a55";
      ctx.fillRect(-3, -16, 6, 32);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(2, -14); ctx.lineTo(18, -8); ctx.lineTo(18, 8); ctx.lineTo(2, 14);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "bolt": case "fire": case "ice": {
      const r = p.radius;
      const c = p.color;
      // outer aura
      const og = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 3.2);
      og.addColorStop(0, hexA(c, 0.55));
      og.addColorStop(0.5, hexA(c, 0.25));
      og.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      // bright core
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.6);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, c);
      g.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      // motion streak
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 50) {
        const tx = -p.vx * 0.025;
        const ty = p.vy * 0.025;
        const sg = ctx.createLinearGradient(0, 0, tx, ty);
        sg.addColorStop(0, hexA(c, 0.6));
        sg.addColorStop(1, hexA(c, 0));
        ctx.strokeStyle = sg;
        ctx.lineWidth = r * 1.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      // sparkle ring
      if (p.kind === "ice") {
        ctx.strokeStyle = "rgba(220,240,255,0.7)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const a = (now * 5 + i * Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
          ctx.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4);
          ctx.stroke();
        }
      } else if (p.kind === "fire" || p.kind === "bolt") {
        // pulsing inner glow
        const pulse = 0.7 + Math.sin(now * 25) * 0.3;
        ctx.fillStyle = hexA("#ffffff", pulse * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "meteor": {
      const r = p.radius;
      // tail streak (drawn first, behind)
      ctx.strokeStyle = hexA(p.color, 0.6);
      ctx.lineWidth = r;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 0.06, p.vy * 0.06);
      ctx.stroke();
      // outer aura
      const oa = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 3);
      oa.addColorStop(0, hexA("#ffeb80", 0.6));
      oa.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = oa;
      ctx.beginPath();
      ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2);
      g.addColorStop(0, "#ffe080");
      g.addColorStop(0.5, p.color);
      g.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "rocket": {
      // exhaust trail
      const eg = ctx.createLinearGradient(0, 0, -p.vx * 0.05, 0);
      eg.addColorStop(0, "rgba(255,200,100,0.85)");
      eg.addColorStop(1, "rgba(255,200,100,0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.ellipse(-p.vx * 0.025, 0, Math.abs(p.vx) * 0.03, p.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // body glow
      const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2.4);
      rg.addColorStop(0, hexA(p.color, 0.6));
      rg.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius, p.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // nose tip
      ctx.fillStyle = "#fff8e0";
      ctx.beginPath();
      ctx.arc(p.radius * 0.6, 0, p.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bullet": {
      // tracer streak
      const tg = ctx.createLinearGradient(0, 0, -p.vx * 0.03, 0);
      tg.addColorStop(0, hexA(p.color, 0.9));
      tg.addColorStop(1, hexA(p.color, 0));
      ctx.strokeStyle = tg;
      ctx.lineWidth = p.radius * 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 0.025, 0);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawAOE(ctx: CanvasRenderingContext2D, z: AOEZone, groundY: number, now: number) {
  const t = now - z.born;
  if (t < 0) return;
  if (t < z.delay) {
    // telegraph (warning circle)
    const k = t / z.delay;
    ctx.save();
    ctx.translate(z.x, groundY - z.y);
    ctx.strokeStyle = hexA(z.color, 0.35 + 0.4 * k);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.ellipse(0, 0, z.radius, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // pulsing fill
    ctx.fillStyle = hexA(z.color, 0.08 * k);
    ctx.beginPath();
    ctx.ellipse(0, 0, z.radius * k, 14 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const at = (t - z.delay) / z.life;
  if (at > 1) return;
  const a = 1 - at;
  ctx.save();
  ctx.translate(z.x, groundY - z.y);
  if (z.kind === "smoke") {
    ctx.fillStyle = hexA(z.color, 0.3 * a);
    ctx.beginPath();
    ctx.ellipse(0, -20, z.radius * (0.6 + at * 0.6), 40 + at * 40, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (z.kind === "phantom") {
    ctx.strokeStyle = hexA(z.color, 0.9 * a);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -40, z.radius * (1 - at) + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = hexA(z.color, 0.2 * a);
    ctx.beginPath();
    ctx.arc(0, -40, z.radius * (1 - at), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // shock/void/nova/fire
    const r = z.radius * (0.6 + 0.6 * at);
    const g = ctx.createRadialGradient(0, -10, 4, 0, -10, r);
    g.addColorStop(0, hexA(z.color, 0.7 * a));
    g.addColorStop(1, hexA(z.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -10, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexA("#ffffff", 0.6 * a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -10, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ratio: number, align: "left" | "right",
  label: string, color: string, bossPhase?: number, boss?: boolean,
  staggerRatio?: number,
  staggered?: boolean,
  vulnerable?: boolean,
  elementIdx?: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x, y, w, h);
  const fillW = Math.max(0, w * ratio);
  const fx = align === "left" ? x : x + w - fillW;
  let c = color;
  if (ratio < 0.25) c = "#ff4d5c";
  else if (ratio < 0.55) c = "#ffb947";
  ctx.fillStyle = c;
  ctx.fillRect(fx, y, fillW, h);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // Stagger bar (thinner, just under HP bar)
  if (staggerRatio !== undefined) {
    const sh = 4;
    const sy = y + h + 2;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, sy, w, sh);
    const sw = Math.max(0, w * Math.min(1, staggerRatio));
    const sfx_ = align === "left" ? x : x + w - sw;
    let sc = "#ffe24a";
    if (staggered) sc = "#ff66ff";
    else if (vulnerable) sc = "#ff8866";
    ctx.fillStyle = sc;
    ctx.fillRect(sfx_, sy, sw, sh);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = align === "left" ? "left" : "right";
  ctx.textBaseline = "bottom";
  const elNames = ["🔥 FIRE", "❄️ ICE", "⚡ LIGHTNING"];
  let tag = boss ? `👑 ${label}  · PHASE ${bossPhase ?? 1}` : label;
  if (elementIdx !== undefined) tag = `${label}  · ${elNames[elementIdx]}`;
  ctx.fillText(tag, align === "left" ? x : x + w, y - 6);
}

// Ability slot HUD
function drawAbilitySlots(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  startX: number, startY: number, slotSize: number,
  align: "left" | "right",
) {
  const gap = 6;
  for (let i = 0; i < 4; i++) {
    const def = f.klass.abilities[i];
    const cd = f.cooldowns[i];
    const total = def.cooldown;
    const cdRatio = total > 0 ? Math.min(1, cd / total) : 0;
    const ready = cd <= 0;
    const flash = f.cooldownReadyFlash[i];

    const dir = align === "left" ? 1 : -1;
    const x = align === "left" ? startX + i * (slotSize + gap) : startX - i * (slotSize + gap) - slotSize;
    const y = startY;

    // BG
    ctx.fillStyle = ready ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
    roundedRect(ctx, x, y, slotSize, slotSize, 6);
    ctx.fill();

    // Cooldown sweep (from bottom up)
    if (!ready) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const ch = slotSize * cdRatio;
      ctx.fillRect(x, y, slotSize, ch);
    }

    // Border + ready glow
    ctx.lineWidth = 2;
    if (ready) {
      const glow = 0.6 + (flash > 0 ? 0.4 : 0.2 * Math.sin(performance.now() * 0.005 + i));
      ctx.strokeStyle = hexA(f.klass.color, glow);
      ctx.shadowColor = f.klass.color;
      ctx.shadowBlur = 8 + (flash > 0 ? 12 : 0);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.shadowBlur = 0;
    }
    roundedRect(ctx, x, y, slotSize, slotSize, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Icon (emoji)
    ctx.font = `${Math.floor(slotSize * 0.55)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.fillText(def.icon, x + slotSize / 2, y + slotSize / 2 + 2);
    ctx.globalAlpha = 1;

    // Slot number
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${i + 1}`, x + 4, y + 3);

    // CD seconds
    if (!ready) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(cd.toFixed(1), x + slotSize / 2, y + slotSize - 3);
    }
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Pixel buffer
let pixelBuf: HTMLCanvasElement | null = null;
let pixelBufCtx: CanvasRenderingContext2D | null = null;


export function render(opts: RenderOpts) {
  const { ctx: outCtx, state, width, height } = opts;
  const theme = ARENA_THEMES[state.arena];
  // Effects and text retain display resolution. Pixelation is confined to actors/scenery.
  const PIXEL_SIZE = 1/Math.min(2,typeof window==='undefined'?1:window.devicePixelRatio||1);
  outCtx.clearRect(0, 0, width, height);
  outCtx.fillStyle = theme.top;
  outCtx.fillRect(0, 0, width, height);

  const bufW = Math.max(1, Math.floor(width / PIXEL_SIZE));
  const bufH = Math.max(1, Math.floor(height / PIXEL_SIZE));
  if (!pixelBuf) {
    pixelBuf = document.createElement("canvas");
    pixelBufCtx = pixelBuf.getContext("2d");
  }
  if (pixelBuf.width !== bufW || pixelBuf.height !== bufH) {
    pixelBuf.width = bufW;
    pixelBuf.height = bufH;
  }
  const ctx = pixelBufCtx;
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bufW, bufH);
  ctx.fillStyle = theme.top;
  ctx.fillRect(0, 0, bufW, bufH);

  const scale = Math.min(bufW / ARENA_W, bufH / ARENA_H);
  const offX = (bufW - ARENA_W * scale) / 2;
  const offY = (bufH - ARENA_H * scale) / 2;

  if (state.flashScreen > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, state.flashScreen * 4)})`;
    ctx.fillRect(0, 0, bufW, bufH);
  }

  ctx.save();
  if (!state.settings?.reducedMotion && state.shake > 0 && state.shakeT > 0) {
    const s = state.shake * Math.min(1, state.shakeT * 3) / PIXEL_SIZE;
    const phase=(state.time+state.shakeT)*100;
    ctx.translate(Math.sin(phase*1.39)*s*.5,Math.cos(phase*1.73)*s*.5);
  }
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  // The camera affects world geometry only; the HUD remains anchored.
  ctx.save();
  const camera = state.presentation;
  if (camera) {
    ctx.translate(ARENA_W / 2, ARENA_H - 80);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.cameraX, -(ARENA_H - 80));
  }
  // BG gradient
  const grad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  grad.addColorStop(0, theme.top);
  grad.addColorStop(1, theme.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  const groundY = ARENA_H - 80;
  drawRetroEnvironment(ctx,state,groundY,camera?.cameraX);
  drawAtmosphere(ctx, state, groundY);
  ctx.strokeStyle = theme.groundLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(ARENA_W, groundY);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let i = 30; i < ARENA_W; i += 40) {
    const big = i % 200 === 30;
    ctx.beginPath();
    ctx.moveTo(i, groundY);
    ctx.lineTo(i, groundY + (big ? 14 : 8));
    ctx.stroke();
  }

  drawFishingFloor(ctx, state, groundY);
  // AOE telegraphs/effects (under fighters)
  drawMoveUnderlays(ctx, state, groundY);
  const effectDetail = state.settings?.quality === 'low' ? .5 : state.settings?.quality === 'medium' ? .75 : 1;
  for (const z of state.aoeZones) drawDetailedArea(ctx, z, groundY, state.time, effectDetail);

  // Trails
  drawTrail(ctx, state.player, groundY, state.time);
  drawTrail(ctx, state.enemy, groundY, state.time);

  drawStick(ctx,state.player,groundY,state.time,1,undefined,'back');
  drawStick(ctx,state.enemy,groundY,state.time,1,undefined,'back');
  drawPixelCharacters(ctx,state,groundY,(c,f,g,t)=>drawStick(c,f,g,t,1,undefined,'body'));
  drawStick(ctx,state.player,groundY,state.time,1,undefined,'front');
  drawStick(ctx,state.enemy,groundY,state.time,1,undefined,'front');

  // Slash arc trails (drawn over fighters for impact)
  drawSlashTrail(ctx, state.player, groundY, state.time);
  drawSlashTrail(ctx, state.enemy, groundY, state.time);
  drawMoveEffects(ctx, state, groundY);
  drawFishing(ctx, state, groundY);

  // Projectiles
  for (const p of state.projectiles) drawDetailedProjectile(ctx, p, groundY, state.time);

  // Particles
  for (const p of state.particles) {
    const sx = p.x;
    const sy = groundY - p.y;
    const a = Math.max(0, p.life / p.max);
    if (p.kind === "ring") {
      const r = (1 - a) * 60 + p.size;
      ctx.strokeStyle = p.color ? hexA(p.color, a * 0.9) : `rgba(255,255,255,${a * 0.85})`;
      ctx.lineWidth = 3 * a + 1;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
    } else if (p.kind === "shockwave") {
      const r = (1 - a) * 140 + p.size;
      ctx.strokeStyle = p.color ? hexA(p.color, a * 0.7) : `rgba(255,180,80,${a * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
    } else if (p.kind === "spark") {
      ctx.fillStyle = p.color ? hexA(p.color, a) : `rgba(255,255,255,${a})`;
      const size = Math.max(1, p.size * a);
      ctx.fillRect(Math.round(sx), Math.round(sy), size, size);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1, size * 0.5);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * 0.015, sy + p.vy * 0.015); ctx.stroke();
    } else if (p.kind === "ice") {
      ctx.fillStyle = p.color ?? '#aee0ff';
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(sx,sy-p.size); ctx.lineTo(sx+p.size*0.5,sy); ctx.lineTo(sx,sy+p.size); ctx.lineTo(sx-p.size*0.5,sy); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(120,110,90,${a * 0.22})`;
      const size = Math.max(1, p.size * 0.55);
      ctx.fillRect(Math.round(sx), Math.round(sy), size, size * 0.65);
    }
  }

  drawEnergy(ctx, state, groundY);

  // Floating texts
  for (const f of state.floats) {
    const a = Math.max(0, f.life / f.max);
    const sy = groundY - f.y;
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.font = `900 ${f.size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.text, f.x, sy);
    ctx.globalAlpha = 1;
  }

  // End camera space before drawing fixed interface elements.
  ctx.restore();
  // Localized flashes above scenery, never a fully opaque screen.
  if (!state.settings?.reducedMotion && state.flashScreen > 0) {
    ctx.fillStyle = 'rgba(219,235,255,' + Math.min(0.16, state.flashScreen) + ')';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
  drawCinematicHUD(ctx, state);
  if (!opts.preview) {
  // HUD: HP
  const pad = 30;
  const barW = 380;
  const barH = 18;
  drawHpBar(
    ctx, pad, pad + 22, barW, barH,
    state.player.hp / state.player.maxHp, "left",
    state.player.klass.name, state.player.klass.color,
    state.player.bossPhase, state.player.isBoss,
    state.player.stagger / state.player.maxStagger,
    state.player.staggered > 0,
    state.player.staggerVulnerable > 0,
    state.player.klass.id === "elementalist" ? state.player.element : undefined,
  );
  drawHpBar(
    ctx, ARENA_W - pad - barW, pad + 22, barW, barH,
    state.enemy.hp / state.enemy.maxHp, "right",
    `${state.enemy.klass.name} (${state.online ? 'P2' : 'AI'})`, state.enemy.klass.color,
    state.enemy.bossPhase, state.enemy.isBoss,
    state.enemy.stagger / state.enemy.maxStagger,
    state.enemy.staggered > 0,
    state.enemy.staggerVulnerable > 0,
    state.enemy.klass.id === "elementalist" ? state.enemy.element : undefined,
  );

  // Ability slots
  const slotSize = 56;
  drawAbilitySlots(ctx, state.player, pad, pad + 50, slotSize, "left");
  drawAbilitySlots(ctx, state.enemy, ARENA_W - pad, pad + 50, slotSize, "right");

  // Combo counters
  if (state.playerCombo > 1) {
    const a = Math.min(1, state.playerComboTimer / 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fff";
    ctx.font = "900 56px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${state.playerCombo}`, pad, pad + 130);
    ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("HIT COMBO", pad + 4, pad + 190);
    ctx.globalAlpha = 1;
  }
  if (state.enemyCombo > 1) {
    const a = Math.min(1, state.enemyComboTimer / 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ff7a8a";
    ctx.font = "900 56px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${state.enemyCombo}`, ARENA_W - pad, pad + 130);
    ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,122,138,0.8)";
    ctx.fillText("HIT COMBO", ARENA_W - pad - 4, pad + 190);
    ctx.globalAlpha = 1;
  }

  // Arena name watermark
  ctx.fillStyle = hexA(theme.accent, 0.35);
  ctx.font = "900 22px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(theme.name, ARENA_W / 2, 12);

  // Slowmo vignette
  if (state.globalTimeScale < 0.9) {
    const v = ctx.createRadialGradient(ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.2, ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.7);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }

  // Winner
  if (state.winner) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, ARENA_H / 2 - 90, ARENA_W, 180);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 78px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(state.online ? `K.O. — ${state.winner === 'player' ? 'P1' : 'P2'} WINS` : state.winner === 'player' ? 'K.O. — YOU WIN' : 'K.O. — YOU LOSE', ARENA_W / 2, ARENA_H / 2 - 6);
    ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(state.online ? 'Use the match controls below to rematch or return to the lobby' : 'press R to rematch · ESC for menu', ARENA_W / 2, ARENA_H / 2 + 46);
  }

  }
  ctx.restore();

  outCtx.imageSmoothingEnabled = true;
  // @ts-ignore
  outCtx.mozImageSmoothingEnabled = false;
  // @ts-ignore
  outCtx.webkitImageSmoothingEnabled = false;
  outCtx.drawImage(pixelBuf, 0, 0, bufW, bufH, 0, 0, width, height);
}
