import type { GameState } from '../engine';
import type { MoveVFX } from '../vfx-types';
import { FISH, fishStrikeTime, type FishKind } from '../fishing';
import { hexAlpha } from '../colors';
import { orb, beam, ring, bolt, star, TAU, clamp, noise } from './geometry';
import { computeVisualJoints } from '../pixel-art';

export function drawFish(c: CanvasRenderingContext2D, kind: FishKind, x: number, y: number, t: number, scale = 1, angle = 0) {
  const d = FISH[kind], r = d.size;
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  const flex = Math.sin(t * 15) * .12;
  if (kind === 'eel') {
    c.lineCap = 'round'; c.strokeStyle = '#15354a'; c.lineWidth = 14;
    const path = () => { c.beginPath(); for (let i = 0; i <= 14; i++) { const px = -r + i * r * 2 / 14, py = Math.sin(i * .65 - t * 12) * 9; if (!i) c.moveTo(px, py); else c.lineTo(px, py); } };
    path(); c.stroke(); c.strokeStyle = d.color; c.lineWidth = 5; path(); c.stroke();
    bolt(c, -r, -10, r, 9, '#b8faff', t, 1.5, 2);
  } else {
    const tall = kind === 'puffer' ? .8 + Math.sin(t * 9) * .07 : .44;
    c.fillStyle = '#0d2639'; c.strokeStyle = d.color; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 0, r, r * tall, flex, 0, TAU); c.fill(); c.stroke();
    const g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, d.color); g.addColorStop(.55, '#397a92'); g.addColorStop(1, '#defaf1');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * .92, r * tall * .9, flex, 0, TAU); c.fill();
    c.fillStyle = d.color; c.beginPath(); c.moveTo(-r * .8, 0); c.lineTo(-r * 1.5, -r * .45 + Math.sin(t * 17) * 5); c.lineTo(-r * 1.5, r * .45); c.closePath(); c.fill();
    c.fillStyle = '#c5f4df'; c.beginPath(); c.moveTo(-r * .4, -r * tall); c.lineTo(-r * .1, -r * tall - 10); c.lineTo(r * .35, -r * tall); c.fill();
    c.strokeStyle = '#f1fff7'; c.lineWidth = 1; c.beginPath(); c.arc(r * .4, 0, r * .28, -1.4, 1.4); c.stroke();
    if (kind === 'puffer') for (let i = 0; i < 13; i++) { const a = i * TAU / 13; beam(c, Math.cos(a) * r, Math.sin(a) * r * tall, Math.cos(a) * (r + 8), Math.sin(a) * (r * tall + 8), d.color, 2); }
    if (kind === 'swordfish') { c.beginPath(); c.moveTo(r * .75, -3); c.lineTo(r * 2.5, -2); c.lineTo(r * .85, 4); c.fill(); }
    c.fillStyle = '#06151e'; c.beginPath(); c.arc(r * .63, -r * .12, 3.3, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.fillRect(r * .63, -r * .12 - 2, 1.5, 1.5);
  }
  c.restore();
}
function liquid(c: CanvasRenderingContext2D, x: number, ground: number, radius: number, t: number, strength: number, detail: number) {
  // Refract the arena's own already-painted floor. No world object or collision surface is added.
  c.save(); c.globalAlpha *= strength;
  c.beginPath(); c.ellipse(x, ground + 6, radius, 25, 0, 0, TAU); c.clip();
  const m = c.getTransform(), canvas = c.canvas;
  if (canvas && m && m.a > 0 && Math.abs(m.b) < .001) {
    for (let i = 0; i < 7; i++) {
      const y = ground - 17 + i * 6, offset = Math.sin(t * 10 + i * 1.1) * 7 * strength;
      const sx = (x - radius) * m.a + m.e, sy = y * m.d + m.f;
      if (sy > 0 && sy + 6 * m.d < canvas.height && sx > 0 && sx + radius * 2 * m.a < canvas.width)
        c.drawImage(canvas, sx, sy, radius * 2 * m.a, 6 * m.d, x - radius + offset, y, radius * 2, 6);
    }
  }
  const depth = c.createRadialGradient(x, ground + 8, 2, x, ground + 8, radius);
  depth.addColorStop(0, '#010b25dd'); depth.addColorStop(.58, '#0530569c'); depth.addColorStop(1, '#1ce7f000');
  c.fillStyle = depth; c.fillRect(x - radius, ground - 24, radius * 2, 56);
  c.restore();
  c.save(); c.globalAlpha *= strength;
  orb(c, x, ground + 3, radius * 1.1, '#168edc', .25);
  for (let i = 0; i < Math.round(7 * detail); i++) {
    const p = (t * .65 + i / 7) % 1;
    ring(c, x, ground + 5, 8 + p * radius, i % 2 ? '#70f8ee' : '#2496e0', 1.4, .12 + p * .04);
  }
  for (let i = 0; i < Math.round(16 * detail); i++) {
    const p = (t * .4 + noise(i) * 3) % 1, bx = x + (noise(i + 41) - .5) * radius * 1.7;
    c.globalAlpha = strength * Math.sin(p * Math.PI) * .65;
    ring(c, bx, ground - p * 65, 1.5 + noise(i + 8) * 4, '#a4f7ff', 1);
    orb(c, bx, ground - p * 65, 7, '#4cd5ff', .15);
  }
  c.restore();
}
function leviathan(c: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, shadow = false) {
  c.save(); c.translate(x, y); c.scale(size, size);
  c.fillStyle = shadow ? '#010819' : '#0b3459'; c.strokeStyle = shadow ? '#052c4c' : '#41bfe9'; c.lineWidth = shadow ? 1 : 2;
  c.beginPath(); c.moveTo(-155, 70); c.bezierCurveTo(-230, -50, -125, -230, 0, -260);
  c.bezierCurveTo(120, -245, 175, -115, 145, 20); c.lineTo(225, 90); c.lineTo(100, 65); c.bezierCurveTo(35, 135, -30, 130, -155, 70); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-110, -70); c.lineTo(-250, 5); c.lineTo(-140, 30); c.moveTo(95, -70); c.lineTo(220, -20); c.lineTo(145, 50); c.fill(); c.stroke();
  if (!shadow) {
    const g = c.createLinearGradient(-70, -220, 70, 60); g.addColorStop(0, '#267696'); g.addColorStop(.45, '#1e5277'); g.addColorStop(1, '#091329');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -95, 102, 150, -.1, 0, TAU); c.fill();
    for (let i = 0; i < 9; i++) { const yy = -220 + i * 32; beam(c, -85 + i * 2, yy, 68, yy + 15, '#55d9f2', .7); }
    c.fillStyle = '#010815'; c.beginPath(); c.ellipse(6, -105, 79, 99, -.1, 0, TAU); c.fill();
    c.strokeStyle = '#82eaf7'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#defdff';
    for (let i = 0; i < 11; i++) { const a = i * TAU / 11; const xx = 6 + Math.cos(a) * 72, yy = -105 + Math.sin(a) * 91; c.beginPath(); c.moveTo(xx - 7, yy); c.lineTo(xx + 7, yy); c.lineTo(xx * .63, -105 + (yy + 105) * .58); c.fill(); }
    for (const side of [-1, 1]) { orb(c, side * 58, -213, 30, '#55f6ff', .9); beam(c, side * 47, -213, side * 72, -210, '#e7ffff', 4); }
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + t; orb(c, Math.cos(a) * 110, -90 + Math.sin(a) * 130, 4, '#67eafa', .8); }
  }
  c.restore();
}
const fishingMove = (v: MoveVFX) => ['fishHook', 'catchOfDay', 'freshCatch', 'seaBeast'].includes(v.ability);
export function drawFishingFloor(c: CanvasRenderingContext2D, s: GameState, ground: number) {
  const detail = s.settings?.quality === 'low' ? .45 : s.settings?.quality === 'medium' ? .7 : 1;
  for (const v of s.moveVfx ?? []) {
    if (!fishingMove(v) || v.ability === 'fishHook') continue;
    const age = s.time - v.born; if (age < 0 || age > v.duration) continue;
    const strength = clamp(age * 8) * clamp((v.duration - age) * 5);
    const origin = v.x - v.facing * (v.ability === 'catchOfDay' ? 65 : -45);
    liquid(c, origin, ground, v.ability === 'seaBeast' ? 130 : 78, age, strength, detail);
    if (v.ability === 'seaBeast') {
      const approach = clamp((age - .35) / 1.3), x = origin + (v.endX - origin) * approach;
      liquid(c, x, ground, 165, age, strength * .8, detail);
      if (age < 1.8) {
        c.save(); c.globalAlpha = strength * .7; c.translate(x, ground + 6); c.scale(1, .14);
        leviathan(c, 0, 0, .8 + approach * .5, age, true); c.restore();
        // This ring is the actual fixed server hit radius, not a tracking target.
        c.save(); c.globalAlpha = .5 + Math.sin(age * 14) * .18;
        ring(c, v.endX, ground, 135, '#7fecff', 2, .16);
        c.font = 'bold 11px monospace'; c.fillStyle = '#bdf7ff'; c.textAlign = 'center'; c.fillText('ABYSS RISING · MOVE!', v.endX, ground - 36); c.restore();
      }
    }
  }
}
export function drawFishing(c: CanvasRenderingContext2D, s: GameState, ground: number) {
  for (const f of [s.player, s.enemy]) {
    if (f.poison) { c.save(); c.globalAlpha = .6; for (let i = 0; i < 4; i++) orb(c, f.x + Math.sin(s.time * 5 + i * 2) * 22, ground - f.y - 20 - i * 24, 9, '#b4f05b', .4); c.restore(); }
    if (f.classId !== 'fisherman') continue;
    const a = f.fishing, age = a ? s.time - a.born : 0, dir = f.facing;
    const hand = computeVisualJoints(f,s.time).handR;
    const handX = f.x + hand[0], handY = ground - hand[1];
    const struggle = a?.ability === 'seaBeast' ? Math.sin(age * 42) * 9 * Math.min(1, age) : 0;
    const casting = a && a.ability !== 'fishHook';
    const tipX = handX + dir * (casting ? 55 + struggle : 45), tipY = handY - (casting ? 45 - struggle : 80);
    c.save(); c.lineCap = 'round';
    c.strokeStyle = '#131722'; c.lineWidth = 6; c.beginPath(); c.moveTo(handX - dir * 8, handY + 16); c.quadraticCurveTo(handX - dir * 15, tipY - 40, tipX, tipY); c.stroke();
    c.strokeStyle = '#d9bd7e'; c.lineWidth = 2.4; c.stroke();
    ring(c, handX, handY + 2, 5, '#dcf0f0', 1.6);
    const hook = s.projectiles.find(p => p.owner === f.id && p.kind === 'hook');
    const target = a?.target ? a.target === 'player' ? s.player : s.enemy : undefined;
    const lineX = target?.x ?? hook?.x ?? (casting ? f.x + dir * (a?.ability === 'catchOfDay' ? -65 : 45) : tipX + dir * 8);
    const lineY = target ? ground - target.y - 80 : hook ? ground - hook.y : casting ? ground + 3 : handY + 35;
    c.strokeStyle = '#c6f4f1'; c.lineWidth = target ? 1.8 : .85; c.globalAlpha = .8;
    c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo((tipX + lineX) / 2, (tipY + lineY) / 2 + (target ? 0 : 30), lineX, lineY); c.stroke();
    if (target) { orb(c, target.x, lineY, 26, '#75faff', .7); star(c, target.x, lineY, 12, '#efffff', age); }
    c.restore();
    if (f.heldFish) drawFish(c, f.heldFish, f.x + dir * 32, handY + 8, s.time, .7, dir < 0 ? Math.PI : 0);
    if (a?.fish && age > .2 && age < fishStrikeTime(a.fish)+.25) {
      const swing = clamp((age - .2) / (fishStrikeTime(a.fish)-.2)), x = f.x + dir * (-65 + swing * FISH[a.fish].reach), y = ground - f.y - 45 - Math.sin(swing * Math.PI) * 95;
      beam(c, tipX, tipY, x, y, '#c6f4f1', .8); drawFish(c, a.fish, x, y, age, 1, (swing - .5) * 2 * dir);
    }
    if (a?.ability === 'freshCatch' && age > .65) drawFish(c, 'small', f.x + dir * (age > 1.08 ? 9 : 37), ground - f.y - (age > 1.08 ? 112 : 80), age, Math.max(.1, 1 - clamp((age - 1.08) * 5)));
  }
  for (const d of s.droppedFish ?? []) {
    c.save(); c.globalAlpha = Math.min(1, d.expires - s.time);
    orb(c, d.x, ground - d.y - 4, 30, FISH[d.kind].color, .25);
    drawFish(c, d.kind, d.x, ground - d.y - 9, s.time, .65, Math.sin(s.time * 8) * .08); c.restore();
    for (const f of [s.player, s.enemy]) if (f.classId === 'fisherman' && !f.heldFish && Math.abs(f.x - d.x) < 65 && f.y < 45 && d.y < 35) {
      c.save(); c.font = 'bold 14px monospace'; c.textAlign = 'center'; c.fillStyle = '#e9ffed'; c.fillText('Press E to Pick Up', f.x, ground - 157); c.restore();
    }
  }
  for (const v of s.moveVfx ?? []) if (v.ability === 'seaBeast') {
    const age = s.time - v.born, erupt = age - 1.65;
    if (erupt < 0 || age > v.duration) continue;
    const envelope = Math.sin(Math.PI * clamp(erupt / .85));
    c.save(); c.beginPath(); c.rect(v.endX - 360, ground - 450, 720, 455); c.clip();
    orb(c, v.endX, ground - 60, 290, '#168ddd', .55 * envelope);
    leviathan(c, v.endX, ground + 280 - envelope * 265, 1.05, age);
    for (let i = 0; i < (s.settings?.quality === 'low' ? 12 : 32); i++) {
      const a = i * TAU / 32, r = 35 + erupt * (250 + noise(i) * 240), x = v.endX + Math.cos(a) * r, y = ground - Math.abs(Math.sin(a)) * r * .7 + erupt * erupt * 180;
      beam(c, x, y, x + Math.cos(a) * 18, y - 18, '#98f8ff', 2.5 * envelope); orb(c, x, y, 5 * envelope + 1, '#62d8ff', .65);
    }
    for (let i = 0; i < 4; i++) ring(c, v.endX, ground, 30 + erupt * 550 + i * 15, '#a5f7ff', 3 * envelope + .2, .16);
    c.restore();
  }
}
