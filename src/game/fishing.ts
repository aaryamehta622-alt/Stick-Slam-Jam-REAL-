import type { GameState, Projectile } from './engine';
import { applyDamage, finishKO, applyShake } from './engine';
import type { Fighter, ActiveAttack } from './types';
import type { AbilityId } from './classes';
import { impact } from './presentation';
import { sfx } from './sfx';

export type FishKind = 'small' | 'puffer' | 'giant' | 'eel' | 'swordfish';
// Relative weights: 45%, 20%, 8%, 10%, 17%. Shared by offline and server simulation.
export const FISH = {
  small: { name: 'Small fish', weight: 45, damage: 9, knock: 150, up: 65, size: 22, color: '#80efd1', reach: 140 },
  puffer: { name: 'Pufferfish', weight: 20, damage: 7, knock: 155, up: 85, size: 27, color: '#c3f46d', reach: 150 },
  giant: { name: 'Giant fish', weight: 8, damage: 23, knock: 520, up: 230, size: 56, color: '#80bdff', reach: 165 },
  eel: { name: 'Electric eel', weight: 10, damage: 12, knock: 200, up: 110, size: 34, color: '#ffe47d', reach: 170 },
  swordfish: { name: 'Swordfish', weight: 17, damage: 16, knock: 370, up: 85, size: 35, color: '#9cecff', reach: 245 },
} as const;
export interface DroppedFish { id: number; kind: FishKind; x: number; y: number; vy: number; expires: number }
export interface FishingAction { ability: AbilityId; born: number; fish?: FishKind; used: boolean; target?: 'player' | 'enemy'; caughtAt?: number }
export interface FishPoison { owner: 'player' | 'enemy'; remaining: number; next: number }
export function rollFish(random: () => number = Math.random): FishKind {
  const entries = Object.entries(FISH) as [FishKind, typeof FISH[FishKind]][];
  let roll = Math.max(0, Math.min(.999999999, random())) * entries.reduce((s, [, f]) => s + f.weight, 0);
  for (const [kind, f] of entries) { roll -= f.weight; if (roll < 0) return kind; }
  return 'small';
}
export function nextFishingId(s: GameState) { return s.fishingId = (s.fishingId ?? 1000000) + 1; }
export const fishStrikeTime = (fish: FishKind) => fish === 'small' ? .4 : fish === 'giant' ? .65 : .5;
function channel(f: Fighter, id: AbilityId, now: number, duration: number): ActiveAttack {
  return { stepIdx: -1, startTime: now, duration, activeStart: duration + 1, activeEnd: duration + 1,
    recoveryUntil: duration, cancelWindow: duration, damage: 0, knockback: 0, knockUp: 0, reach: 0,
    hitstop: 0, kind: 'magic', hit: true, isAbility: true, abilityId: id };
}
export function startFishing(f: Fighter, s: GameState, id: AbilityId, now: number) {
  const fish=id==='catchOfDay'?rollFish(s.random):undefined;
  const duration = id === 'freshCatch' ? 1.35 : id === 'seaBeast' ? 2.5 : id === 'fishHook' ? .95 : fish==='small' ? .78 : fish==='giant' ? 1.2 : 1.0;
  f.attack = channel(f, id, now, duration);
  f.fishing = { ability: id, born: now, used: false, fish };
  f.vx *= .15; f.heavyCharging = false;
  if (id === 'fishHook') s.projectiles.push({ id: nextFishingId(s), owner: f.id, kind: 'hook', x: f.x + f.facing * 35,
    y: f.y + 85, vx: f.facing * 1050, vy: 0, gravity: 0, born: now, life: .42,
    damage: 2, knock: 0, knockUp: 0, radius: 10, color: '#a5f7ff', visualAbility: id });
  if (id === 'seaBeast') {
    const target = f.id === 'player' ? s.enemy : s.player;
    s.aoeZones.push({ id: nextFishingId(s), owner: f.id, x: target.x, y: 0, radius: 135,
      born: now, delay: 1.8, life: .22, max: .22, damage: 36 * f.klass.damageMul, knock: 460, knockUp: 820,
      hit: new Set(), kind: 'sea', color: '#55dfff', visualAbility: 'seaBeast' });
  }
  sfx.cast();
}
export function cancelFishing(f: Fighter, s: GameState) {
  if (!f.fishing) return;
  for (const target of [s.player, s.enemy]) if (target.grabbedBy === f.id) target.grabbedBy = undefined;
  const a = f.fishing;
  if (a.ability !== 'seaBeast') {
    const move = s.moveVfx?.find(v => v.owner === f.id && v.born === a.born);
    if (move) move.duration = Math.min(move.duration, s.time - move.born + .12);
  }
  f.fishing = undefined;
  if (f.attack?.abilityId === a.ability) f.attack = null;
}
export function catchHook(s: GameState, p: Projectile, target: Fighter) {
  const owner = p.owner === 'player' ? s.player : s.enemy;
  if (owner.fishing?.ability !== 'fishHook' || owner.hp <= 0 || target.grabbedBy || target.blocking) return;
  applyDamage(s, owner, target, { x: target.x, y: target.y + 80 }, 2, 0, 0, { canCounter: false, hitstop: .045 });
  owner.fishing.target = target.id; owner.fishing.caughtAt = s.time;
  target.grabbedBy = owner.id; target.vx = 0; target.vy = 0;
  sfx.reel();
}
export function fishHit(s: GameState, owner: Fighter, target: Fighter, fish: FishKind, dir: number) {
  const data = FISH[fish];
  const guarded = target.blocking && target.onGround && target.facing === -dir && target.hitstun <= 0;
  applyDamage(s, owner, target, { x: target.x, y: target.y + 65 }, data.damage * owner.klass.damageMul,
    data.knock, data.up, { canCounter: false, dirOverride: dir, level: fish === 'giant' ? 4 : 2,
      hitstop: fish === 'giant' ? .15 : .065, freeze: fish === 'eel' ? .25 : undefined, sound: 'ability' });
  if (!guarded && fish === 'puffer') target.poison = { owner: owner.id, remaining: 9, next: s.time + .65 };
  impact(s, target.x, target.y + 65, dir, fish === 'giant' ? 4 : 2, data.color, fish === 'eel' ? 'electricExtender' : 'catchOfDay');
  sfx.splash();
}
export function pickupFish(f: Fighter, s: GameState): boolean {
  if (f.classId !== 'fisherman' || f.heldFish || f.attack || f.hitstun > 0 || f.frozen > 0 || f.grabbedBy) return false;
  const item = s.droppedFish?.find(d => d.expires > s.time && d.y < 35 && Math.abs(d.x - f.x) < 65 && f.y < 45);
  if (!item) return false;
  f.heldFish = item.kind;
  s.droppedFish = s.droppedFish!.filter(d => d.id !== item.id);
  sfx.reel(); return true;
}
export function throwFish(f: Fighter, s: GameState, now: number): boolean {
  if (!f.heldFish) return false;
  const fish = f.heldFish; f.heldFish = undefined; // Consume BEFORE spawning: one item, one throw.
  const data = FISH[fish];
  f.attack = channel(f, 'catchOfDay', now, .32);
  s.projectiles.push({ id: nextFishingId(s), owner: f.id, kind: 'fish', fish, x: f.x + f.facing * 35,
    y: f.y + 80, vx: f.facing * (fish === 'swordfish' ? 850 : 680), vy: 220, gravity: 650,
    life: 1.7, born: now, damage: data.damage, knock: data.knock, knockUp: data.up,
    radius: data.size * .48, color: data.color, spin: 5, visualAbility: 'catchOfDay' });
  sfx.cast(); return true;
}
export function stepFishing(s: GameState, dt: number) {
  for (const f of [s.player, s.enemy]) {
    if (f.poison && !s.winner) {
      const poison = f.poison;
      if (s.time >= poison.next) {
        const damage = Math.min(3, poison.remaining); f.hp = Math.max(0, f.hp - damage);
        poison.remaining -= damage; poison.next += .65;
        impact(s, f.x, f.y + 60, 1, 1, FISH.puffer.color);
        finishKO(s, f, poison.owner);
        if (poison.remaining <= 0) f.poison = undefined;
      }
    }
    const a = f.fishing;
    if (!a) continue;
    if (f.hp <= 0 || f.hitstun > 0 || f.frozen > 0 || s.winner) { cancelFishing(f, s); continue; }
    const elapsed = s.time - a.born;
    if (a.target && a.caughtAt !== undefined) {
      const t = a.target === 'player' ? s.player : s.enemy;
      if (t.hp <= 0) { cancelFishing(f, s); continue; }
      const goal = Math.max(50, Math.min(1150, f.x + f.facing * 62));
      t.x += (goal - t.x) * Math.min(1, dt * 18); t.vx = 0; t.vy = 0;
      if (s.time - a.caughtAt > .32) {
        t.grabbedBy = undefined;
        applyDamage(s, f, t, { x: t.x, y: t.y + 70 }, 19 * f.klass.damageMul, 410, 220,
          { level: 4, canBlock: false, canCounter: false, hitstop: .15, sound: 'finisher' });
        a.target = undefined; a.used = true;
      }
    }
    if (a.ability === 'catchOfDay' && !a.used && elapsed >= fishStrikeTime(a.fish!)) {
      a.used = true;
      const fish = a.fish!, data = FISH[fish], target = f.id === 'player' ? s.enemy : s.player;
      if ((target.x - f.x) * f.facing > -20 && Math.abs(target.x - f.x) < data.reach && Math.abs(target.y - f.y) < 95) {
        fishHit(s, f, target, fish, f.facing);
        (s.droppedFish ??= []).push({ id: nextFishingId(s), kind: fish, x: target.x, y: target.y + 65, vy: 130, expires: s.time + 10 });
      }
      sfx.splash();
    }
    if (a.ability === 'freshCatch' && !a.used && elapsed >= 1.08) {
      a.used = true; const heal = Math.min(18, f.maxHp - f.hp); f.hp += heal;
      s.floats.push({ x: f.x, y: f.y + 145, vy: -65, text: `+${Math.round(heal)} HP`, color: '#98ffc0', life: 1, max: 1, size: 23 });
      impact(s, f.x, f.y + 75, f.facing, 3, '#98ffc0','freshCatch'); sfx.heal();
    }
    if (elapsed >= (f.attack?.duration ?? 0) && !a.target) f.fishing = undefined;
  }
  s.droppedFish = s.droppedFish?.filter(d => d.expires > s.time);
  for (const d of s.droppedFish ?? []) { d.vy -= 650 * dt; d.y = Math.max(0, d.y + d.vy * dt); if (d.y === 0) d.vy = 0; }
}
