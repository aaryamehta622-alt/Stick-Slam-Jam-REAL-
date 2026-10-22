// Ability execution: data-driven. Each ability returns either an ActiveAttack
// (melee-style hit), spawns projectiles / AOE zones, or applies status buffs.

import { Fighter, ActiveAttack, ARENA_W } from "./types";
import { AbilityId } from "./classes";
import { GameState, AOEZone, Projectile } from "./engine";
import { sfx } from "./sfx";
import type { MoveVFX } from './vfx-types';
import { castEffect, effects } from './presentation';
import { designFor } from './vfx/designs';
import { startFishing } from './fishing';

function recordMove(f: Fighter, state: GameState, ability: MoveVFX['ability'], now: number, x: number, y: number, element: 0 | 1 | 2, charge = 0) {
  const target = f.id === 'player' ? state.enemy : state.player;
  const projectileDuration = state.projectiles.reduce((n, p) => p.owner === f.id && p.born >= now ? Math.max(n, (p.delay ?? 0) + p.life) : n, 0);
  const areaDuration = state.aoeZones.reduce((n, z) => z.owner === f.id && z.born >= now ? Math.max(n, z.delay + z.life) : n, 0);
  const firstAreaDelay=state.aoeZones.reduce((n,z)=>z.owner===f.id&&z.born>=now?Math.min(n,z.delay):n,Infinity);
  const sustain=['rage','berserk','parry','armor','shield','bulwark','heat','smoke','phase'].includes(designFor(ability,element,f.klass.category).form);
  const statusDuration=sustain?Math.max(f.rage,f.berserk,f.invisible,f.counterStance,f.armorTime):0;
  const duration = Math.max(f.attack?.duration ?? 0, projectileDuration, areaDuration, 0.65, statusDuration);
  for (const p of state.projectiles) if (p.owner === f.id && p.born >= now && !p.visualAbility) { p.visualAbility = ability; p.visualElement = element; }
  for (const z of state.aoeZones) if (z.owner === f.id && z.born >= now && !z.visualAbility) { z.visualAbility = ability; z.visualElement = element; }
  const effects = state.moveVfx ?? (state.moveVfx = []);
  const move: MoveVFX = { ability, owner: f.id, born: now, duration, x, y, endX: target.x, endY: target.y, facing: f.facing, element, charge,
    activeStart: f.attack?.activeStart ?? (Number.isFinite(firstAreaDelay)?firstAreaDelay:undefined), activeEnd: f.attack?.activeEnd, reach: f.attack?.reach, castX: f.x, castY: f.y, fish: f.fishing?.fish };
  effects.push(move);
  castEffect(state, f, move, ability === f.klass.abilities[3].id || (ability === 'heavy' && charge >= 0.95));
  if (effects.length > 64) effects.splice(0, effects.length - 64);
}

export const MAX_HEAVY_CHARGE = 1.0; // seconds
export const HEAVY_COOLDOWN = 1.4;   // seconds after heavy release

function burst(state: GameState, x: number, y: number, color: string, count = 18, speed = 280, ringSize = 14) {
  const pool = effects(state).pool;
  pool.emit({ x, y, color, count, shape: 'mote', speed, gravity: 120, life: 0.5, size: 2.7 });
  pool.emit({ x, y, color, count: 1, shape: 'ring', speed: 0, gravity: 0, life: 0.3, size: ringSize, growth: 45 });
}

export interface AbilityResult {
  attack?: ActiveAttack;
  // Side effects already applied to fighter / state
}

let projId = 1;
let aoeId = 1;

function mkAttack(
  f: Fighter, now: number,
  dur: number, as: number, ae: number, dmg: number,
  knock: number, up: number, reach: number, hitstop: number,
  abilityId: AbilityId, kind: ActiveAttack["kind"] = "punch",
  hitWidth?: number, hitHeight?: number,
): ActiveAttack {
  const dmgBuff = (f.rage > 0 ? 1.4 : 1) * (f.berserk > 0 ? 1.6 : 1);
  return {
    stepIdx: -1, startTime: now, duration: dur,
    activeStart: as, activeEnd: ae,
    recoveryUntil: dur * 0.85, cancelWindow: dur,
    damage: dmg * f.klass.damageMul * dmgBuff,
    knockback: knock * f.klass.knockbackMul,
    knockUp: up * f.klass.knockbackMul,
    reach,
    hitstop,
    kind,
    hit: false,
    isAbility: true,
    abilityId,
    isFinisher: false,
    hitWidth, hitHeight,
  };
}

function spawnProjectile(state: GameState, p: Omit<Projectile, "id">) {
  state.projectiles.push({ ...p, id: projId++ });
}
function spawnAOE(state: GameState, z: Omit<AOEZone, "id">) {
  state.aoeZones.push({ ...z, id: aoeId++ });
}

// slotIndex: 0..3 — drives cooldown slot
export function startAbility(f: Fighter, slotIndex: number, state: GameState, now: number): boolean {
  const def = f.klass.abilities[slotIndex];
  if (!def) return false;
  if (f.grabbedBy || (f.cooldowns[slotIndex] > 0 && !(def.id === 'axeThrow' && f.axeOut)) || f.attack || f.hitstun > 0 || f.frozen > 0) return false;

  const id = def.id;
  const originX = f.x, originY = f.y, castElement = f.element;
  let consumed = true;

  switch (id) {
    case 'fishHook': case 'catchOfDay': case 'freshCatch': case 'seaBeast':
      startFishing(f, state, id, now); break;
    // ============== SAMURAI ==============
    case "fastSlash":
      f.attack = mkAttack(f, now, 0.28, 0.05, 0.14, 12, 180, 30, 95, 0.07, id, "slash");
      sfx.ability();
      break;
    case "dashStrike":
      f.attack = mkAttack(f, now, 0.42, 0.05, 0.22, 16, 320, 80, 110, 0.10, id, "slash");
      f.vx = f.facing * 980;
      f.armorTime = 0.25;
      sfx.dash(); sfx.ability();
      break;
    case "counterStance":
      f.counterStance = 0.6;
      f.armorTime = 0.6;
      sfx.block();
      break;
    case "rapidFlurry": {
      // Multi-hit: long active window with very small reach repeating via 4 mini-hits
      // Simpler: one long active window; engine resets `hit` periodically (handled via re-entry).
      f.attack = mkAttack(f, now, 0.85, 0.10, 0.75, 6, 60, 10, 90, 0.04, id, "slash");
      // mark as multi-hit via large hitbox + we reset `hit` in engine for multi-strike
      (f.attack as any).multiHit = true;
      (f.attack as any).hitInterval = 0.08;
      (f.attack as any).lastHitAt = -1;
      f.armorTime = 0.85;
      sfx.ability();
      break;
    }

    // ============== NINJA ==============
    case "shadowTeleport": {
      // Teleport behind nearest opponent then slash
      const tgt = state.player === f ? state.enemy : state.player;
      burst(state, f.x, f.y + 70, "#7df0c0", 14, 240, 12);
      const newX = tgt.x - tgt.facing * 60;
      f.x = Math.max(50, Math.min(ARENA_W - 50, newX));
      f.facing = tgt.facing === 1 ? -1 : 1;
      f.attack = mkAttack(f, now, 0.30, 0.04, 0.16, 14, 180, 60, 95, 0.08, id, "slash");
      f.invisible = 0.05;
      burst(state, f.x, f.y + 70, "#7df0c0", 14, 240, 12);
      sfx.dash(); sfx.ability();
      break;
    }
    case "smokeBomb":
      f.invisible = 1.4;
      f.armorTime = 0.4;
      burst(state, f.x, f.y + 70, "#cfd8e8", 28, 220, 24);
      // small puff aoe pushback
      spawnAOE(state, {
        x: f.x, y: f.y, radius: 90, born: now, life: 0.25, max: 0.25,
        damage: 4 * f.klass.damageMul, knock: 80, knockUp: 40,
        owner: f.id, hit: new Set(), color: "#cfd8e8", kind: "smoke",
        delay: 0,
      });
      sfx.ability();
      break;
    case "multiDash":
      f.vx = f.facing * 1200;
      f.dashTime = 0.28;
      f.armorTime = 0.32;
      f.trailUntil = now + 0.4;
      burst(state, f.x, f.y + 70, f.klass.color, 12, 200, 10);
      sfx.dash();
      break;
    case "cloneBarrage": {
      // Spawn 3 phantom strike AOEs around the opponent
      const tgt = state.player === f ? state.enemy : state.player;
      for (let i = 0; i < 3; i++) {
        spawnAOE(state, {
          x: tgt.x + (i - 1) * 70,
          y: 0, radius: 70, born: now, life: 0.25, max: 0.25,
          damage: 8 * f.klass.damageMul, knock: 180, knockUp: 60,
          owner: f.id, hit: new Set(), color: f.klass.color, kind: "phantom",
          delay: 0.12 + i * 0.16,
        });
      }
      sfx.ability();
      break;
    }

    // ============== VIKING ==============
    case "axeThrow":
      if (f.axeOut) {
        // RECALL — Thor-style. Pull every owned axe back, damaging foes it crosses.
        const recalled: typeof state.projectiles = [];
        for (const pr of state.projectiles) {
          if (pr.kind === "axe" && pr.owner === f.id) {
            const dx = f.x - pr.x;
            const dy = (f.y + 70) - pr.y;
            const d = Math.hypot(dx, dy) || 1;
            const sp = 1100;
            pr.vx = (dx / d) * sp;
            pr.vy = (dy / d) * sp;
            pr.gravity = 0;
            pr.life = Math.max(pr.life, 0.9);
            pr.born = now;
            pr.delay = 0;
            pr.hit = false;
            (pr as any).recalling = true;
            (pr as any).recallOwner = f.id;
            recalled.push(pr);
            burst(state, pr.x, pr.y, "#ffd060", 8, 220, 10);
          }
        }
        burst(state, f.x, f.y + 70, "#ffd060", 14, 240, 14);
        sfx.ability();
        // shorter cooldown for recall
        if (recalled.length > 0) {
          // override cooldown after switch's default assignment below
          (f as any)._axeRecallShortCd = 1.2;
        }
      } else {
        spawnProjectile(state, {
          x: f.x + f.facing * 40, y: f.y + 70, vx: f.facing * 700, vy: 60,
          gravity: 600, life: 4.5, born: now, owner: f.id,
          damage: 18 * f.klass.damageMul, knock: 280, knockUp: 120,
          kind: "axe", color: "#bcae9a", radius: 14, spin: 14,
        });
        f.axeOut = true;
        sfx.ability();
      }
      break;
    case "groundSlam": {
      // jump then slam AOE
      f.vy = 480; f.onGround = false;
      f.attack = mkAttack(f, now, 0.7, 0.32, 0.46, 22, 380, 200, 150, 0.18, id, "kick", 280, 80);
      f.armorTime = 0.45;
      // delayed shockwave AOE on landing area
      spawnAOE(state, {
        x: f.x, y: 0, radius: 180, born: now, life: 0.4, max: 0.4,
        damage: 10 * f.klass.damageMul, knock: 260, knockUp: 100,
        owner: f.id, hit: new Set(), color: "#ff9a4a", kind: "shock",
        delay: 0.42,
      });
      sfx.ability();
      break;
    }
    case "rageBoost":
      f.rage = 5;
      f.armorTime = 0.4;
      burst(state, f.x, f.y + 70, "#ff6a30", 22, 260, 18);
      sfx.ability();
      break;
    case "berserker":
      f.berserk = 4.5;
      f.rage = Math.max(f.rage, 4.5);
      f.armorTime = 4.5;
      burst(state, f.x, f.y + 70, "#ffd060", 36, 360, 30);
      sfx.finisher();
      break;

    // ============== ARCHER ==============
    case "quickShot":
      burst(state, f.x + f.facing * 40, 90, "#fff2c0", 6, 180, 8);
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 1100, vy: 0,
        gravity: 200, life: 1.2, born: now, owner: f.id,
        damage: 9 * f.klass.damageMul, knock: 140, knockUp: 30,
        kind: "arrow", color: "#e8d8a8", radius: 4,
      });
      sfx.dash();
      break;
    case "multiArrow":
      burst(state, f.x + f.facing * 40, 90, "#fff2c0", 10, 220, 10);
      for (let i = -1; i <= 1; i++) {
        spawnProjectile(state, {
          x: f.x + f.facing * 30, y: f.y + 90 + i * 18, vx: f.facing * 1000, vy: i * 60,
          gravity: 200, life: 1.2, born: now, owner: f.id,
          damage: 8 * f.klass.damageMul, knock: 110, knockUp: 30,
          kind: "arrow", color: "#e8d8a8", radius: 4,
        });
      }
      sfx.ability();
      break;
    case "backflip":
      f.vy = 720; f.vx = -f.facing * 480; f.onGround = false;
      f.armorTime = 0.35;
      f.dashTime = 0.2;
      f.trailUntil = now + 0.4;
      burst(state, f.x, f.y + 30, f.klass.color, 12, 200, 10);
      sfx.dash();
      break;
    case "rainOfArrows": {
      // 8 arrows fall from sky targeting around opponent over 1.0s
      const tgt = state.player === f ? state.enemy : state.player;
      for (let i = 0; i < 10; i++) {
        const tx = tgt.x + (Math.random() - 0.5) * 280;
        spawnProjectile(state, {
          x: tx + 30, y: 600, vx: -50, vy: -900,
          gravity: 1500, life: 2, born: now, owner: f.id,
          damage: 7 * f.klass.damageMul, knock: 80, knockUp: 50,
          kind: "arrow", color: "#e8d8a8", radius: 4, delay: i * 0.08,
        });
      }
      sfx.finisher();
      break;
    }

    // ============== MAGE ==============
    case "energyBolt":
      burst(state, f.x + f.facing * 40, 90, "#c79bff", 8, 200, 10);
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 850, vy: 0,
        gravity: 0, life: 1.2, born: now, owner: f.id,
        damage: 10 * f.klass.damageMul, knock: 140, knockUp: 30,
        kind: "bolt", color: "#c79bff", radius: 10,
      });
      sfx.ability();
      break;
    case "freezeSpell":
      burst(state, f.x + f.facing * 40, 90, "#9ad8ff", 10, 200, 12);
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 700, vy: 0,
        gravity: 0, life: 1.2, born: now, owner: f.id,
        damage: 5 * f.klass.damageMul, knock: 40, knockUp: 0,
        kind: "ice", color: "#9ad8ff", radius: 12, freeze: 1.6,
      });
      sfx.ability();
      break;
    case "teleport": {
      burst(state, f.x, f.y + 70, "#c79bff", 18, 240, 16);
      // Teleport in facing direction by 280px (or cap arena)
      const dx = f.facing * 280;
      f.x = Math.max(50, Math.min(ARENA_W - 50, f.x + dx));
      f.invisible = 0.2;
      f.armorTime = 0.2;
      burst(state, f.x, f.y + 70, "#c79bff", 18, 240, 16);
      sfx.dash();
      break;
    }
    case "meteor": {
      const tgt = state.player === f ? state.enemy : state.player;
      // sky telegraph burst
      burst(state, tgt.x, 600, "#ff7a3c", 14, 200, 18);
      spawnProjectile(state, {
        x: tgt.x, y: 700, vx: 0, vy: -200,
        gravity: 1800, life: 2.5, born: now, owner: f.id,
        damage: 32 * f.klass.damageMul, knock: 520, knockUp: 360,
        kind: "meteor", color: "#ff7a3c", radius: 28, delay: 0.4,
      });
      sfx.finisher();
      break;
    }

    // ============== BOSS: GIANT BRUTE ==============
    case "brutePunch":
      f.attack = mkAttack(f, now, 0.45, 0.16, 0.28, 22, 360, 100, 130, 0.14, id, "punch");
      f.armorTime = 0.45;
      sfx.kick();
      break;
    case "bruteRush":
      f.attack = mkAttack(f, now, 0.55, 0.05, 0.45, 24, 480, 120, 120, 0.16, id, "punch");
      f.vx = f.facing * 1000;
      f.armorTime = 0.55;
      sfx.dash();
      break;
    case "bruteSlam":
      f.attack = mkAttack(f, now, 0.7, 0.35, 0.5, 26, 420, 220, 180, 0.18, id, "kick", 320, 90);
      f.vy = Math.max(f.vy, 380); f.onGround = false;
      f.armorTime = 0.7;
      spawnAOE(state, {
        x: f.x, y: 0, radius: 240, born: now, life: 0.4, max: 0.4,
        damage: 14 * f.klass.damageMul, knock: 320, knockUp: 140,
        owner: f.id, hit: new Set(), color: "#ff8050", kind: "shock", delay: 0.45,
      });
      sfx.finisher();
      break;
    case "bruteRoar":
      f.rage = 6;
      f.berserk = Math.max(f.berserk, 3);
      f.armorTime = 0.6;
      spawnAOE(state, {
        x: f.x, y: 0, radius: 200, born: now, life: 0.3, max: 0.3,
        damage: 6 * f.klass.damageMul, knock: 240, knockUp: 80,
        owner: f.id, hit: new Set(), color: "#ffaa55", kind: "smoke", delay: 0,
      });
      sfx.ability();
      break;

    // ============== BOSS: SHADOW ASSASSIN ==============
    case "shadowBlink": {
      const tgt = state.player === f ? state.enemy : state.player;
      f.x = Math.max(50, Math.min(ARENA_W - 50, tgt.x - tgt.facing * 55));
      f.facing = tgt.facing === 1 ? -1 : 1;
      f.attack = mkAttack(f, now, 0.32, 0.04, 0.18, 16, 220, 80, 100, 0.10, id, "slash");
      f.invisible = 0.1;
      sfx.ability();
      break;
    }
    case "shadowMulti":
      f.attack = mkAttack(f, now, 0.7, 0.08, 0.62, 7, 80, 20, 95, 0.05, id, "slash");
      (f.attack as any).multiHit = true;
      (f.attack as any).hitInterval = 0.09;
      (f.attack as any).lastHitAt = -1;
      f.armorTime = 0.7;
      sfx.ability();
      break;
    case "shadowCounter":
      f.counterStance = 0.7;
      f.armorTime = 0.7;
      sfx.block();
      break;
    case "shadowVoid": {
      const tgt = state.player === f ? state.enemy : state.player;
      spawnAOE(state, {
        x: tgt.x, y: 0, radius: 200, born: now, life: 0.5, max: 0.5,
        damage: 28 * f.klass.damageMul, knock: 380, knockUp: 280,
        owner: f.id, hit: new Set(), color: "#9f7dff", kind: "void", delay: 0.45,
      });
      sfx.finisher();
      break;
    }

    // ============== BOSS: WAR MACHINE ==============
    case "minigun":
      // 5 quick bullets
      for (let i = 0; i < 5; i++) {
        spawnProjectile(state, {
          x: f.x + f.facing * 30, y: 90 + (Math.random() - 0.5) * 10,
          vx: f.facing * 1200, vy: (Math.random() - 0.5) * 80,
          gravity: 0, life: 1, born: now + i * 0.06, owner: f.id,
          damage: 5 * f.klass.damageMul, knock: 60, knockUp: 0,
          kind: "bullet", color: "#ffd060", radius: 4, delay: i * 0.07,
        });
      }
      sfx.ability();
      break;
    case "rocket":
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 700, vy: 0,
        gravity: 50, life: 1.6, born: now, owner: f.id,
        damage: 22 * f.klass.damageMul, knock: 380, knockUp: 220,
        kind: "rocket", color: "#ff8040", radius: 12, explodeRadius: 120,
      });
      sfx.ability();
      break;
    case "shield":
      f.armorTime = Math.max(f.armorTime, 2.5);
      f.flashTime = 0.2;
      spawnAOE(state, {
        x: f.x, y: 0, radius: 130, born: now, life: 0.3, max: 0.3,
        damage: 6 * f.klass.damageMul, knock: 200, knockUp: 60,
        owner: f.id, hit: new Set(), color: "#80c8ff", kind: "shock", delay: 0,
      });
      sfx.block();
      break;
    case "missileRain": {
      const tgt = state.player === f ? state.enemy : state.player;
      for (let i = 0; i < 6; i++) {
        const tx = tgt.x + (Math.random() - 0.5) * 320;
        spawnProjectile(state, {
          x: tx, y: 700, vx: 0, vy: -300,
          gravity: 1600, life: 2, born: now, owner: f.id,
          damage: 16 * f.klass.damageMul, knock: 280, knockUp: 180,
          kind: "rocket", color: "#ff8040", radius: 10, explodeRadius: 90, delay: i * 0.18,
        });
      }
      sfx.finisher();
      break;
    }

    // ============== BOSS: ELEMENTAL TITAN ==============
    case "fireball":
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 750, vy: 0,
        gravity: 0, life: 1.4, born: now, owner: f.id,
        damage: 14 * f.klass.damageMul, knock: 200, knockUp: 60,
        kind: "fire", color: "#ff8030", radius: 14, explodeRadius: 70,
      });
      sfx.ability();
      break;
    case "iceLance":
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 1000, vy: 0,
        gravity: 0, life: 1.2, born: now, owner: f.id,
        damage: 12 * f.klass.damageMul, knock: 100, knockUp: 20,
        kind: "ice", color: "#9ad8ff", radius: 8, freeze: 1.2,
      });
      sfx.ability();
      break;
    case "phaseSwap":
      // toggle: alternate fire/ice color tint via rage flag? Simple: full heal small amount + buff
      f.rage = 5;
      f.armorTime = 0.8;
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.08);
      f.flashTime = 0.3;
      sfx.ability();
      break;
    case "elementalNova": {
      // ring AOE around self
      spawnAOE(state, {
        x: f.x, y: 0, radius: 280, born: now, life: 0.5, max: 0.5,
        damage: 26 * f.klass.damageMul, knock: 460, knockUp: 240,
        owner: f.id, hit: new Set(), color: "#ff6fae", kind: "nova", delay: 0.35,
      });
      f.armorTime = 0.7;
      sfx.finisher();
      break;
    }

    // ============== GLADIATOR ==============
    case "hookPunch":
      f.attack = mkAttack(f, now, 0.32, 0.07, 0.16, 13, 220, 50, 95, 0.08, id, "punch");
      sfx.ability();
      break;
    case "shieldBash":
      f.attack = mkAttack(f, now, 0.4, 0.08, 0.20, 10, 360, 100, 90, 0.12, id, "punch");
      f.armorTime = 0.4;
      f.vx = f.facing * 520;
      sfx.ability();
      break;
    case "guardBreakDash":
      f.attack = mkAttack(f, now, 0.45, 0.06, 0.22, 16, 280, 60, 110, 0.10, id, "slash");
      f.vx = f.facing * 1000;
      f.armorTime = 0.45;
      sfx.dash(); sfx.ability();
      break;
    case "executionSlam":
      f.attack = mkAttack(f, now, 0.7, 0.30, 0.46, 30, 480, 280, 130, 0.20, id, "slash", 220, 80);
      f.armorTime = 0.7;
      spawnAOE(state, {
        x: f.x + f.facing * 60, y: 0, radius: 140, born: now, life: 0.3, max: 0.3,
        damage: 14 * f.klass.damageMul, knock: 340, knockUp: 120,
        owner: f.id, hit: new Set(), color: "#e0b070", kind: "shock", delay: 0.42,
      });
      sfx.finisher();
      break;

    // ============== BOXER ==============
    case "jabCombo":
      f.attack = mkAttack(f, now, 0.5, 0.05, 0.42, 5, 80, 10, 88, 0.04, id, "punch");
      (f.attack as any).multiHit = true;
      (f.attack as any).hitInterval = 0.07;
      (f.attack as any).lastHitAt = -1;
      sfx.ability();
      break;
    case "uppercutLauncher":
      f.attack = mkAttack(f, now, 0.4, 0.10, 0.22, 14, 100, 420, 80, 0.14, id, "punch");
      sfx.ability();
      break;
    case "slipDodge":
      f.vx = -f.facing * 720;
      f.armorTime = 0.32;
      f.invisible = 0.18;
      f.dashTime = 0.22;
      f.trailUntil = now + 0.35;
      burst(state, f.x, f.y + 70, f.klass.color, 10, 200, 10);
      sfx.dash();
      break;
    case "rapidFlurryBarrage":
      f.attack = mkAttack(f, now, 1.0, 0.10, 0.92, 7, 80, 30, 95, 0.05, id, "punch");
      (f.attack as any).multiHit = true;
      (f.attack as any).hitInterval = 0.07;
      (f.attack as any).lastHitAt = -1;
      f.armorTime = 1.0;
      sfx.finisher();
      break;

    // ============== ASSASSIN ==============
    case "daggerStrike":
      f.attack = mkAttack(f, now, 0.26, 0.04, 0.14, 11, 160, 30, 92, 0.07, id, "slash");
      sfx.ability();
      break;
    case "teleportStab": {
      const tgt = state.player === f ? state.enemy : state.player;
      burst(state, f.x, f.y + 70, f.klass.color, 12, 220, 12);
      f.x = Math.max(50, Math.min(ARENA_W - 50, tgt.x - tgt.facing * 50));
      f.facing = tgt.facing === 1 ? -1 : 1;
      f.attack = mkAttack(f, now, 0.30, 0.04, 0.16, 16, 220, 70, 95, 0.10, id, "slash");
      burst(state, f.x, f.y + 70, f.klass.color, 12, 220, 12);
      sfx.dash(); sfx.ability();
      break;
    }
    case "smokeVanish":
      f.invisible = 1.6;
      f.armorTime = 0.5;
      burst(state, f.x, f.y + 70, "#cfd8e8", 28, 220, 24);
      sfx.ability();
      break;
    case "multiAssassin": {
      const tgt = state.player === f ? state.enemy : state.player;
      for (let i = 0; i < 4; i++) {
        spawnAOE(state, {
          x: tgt.x + (i - 1.5) * 60,
          y: 0, radius: 60, born: now, life: 0.22, max: 0.22,
          damage: 9 * f.klass.damageMul, knock: 200, knockUp: 80,
          owner: f.id, hit: new Set(), color: f.klass.color, kind: "phantom",
          delay: 0.1 + i * 0.13,
        });
      }
      sfx.finisher();
      break;
    }

    // ============== LIGHTNING ==============
    case "quickDashStrike":
      f.attack = mkAttack(f, now, 0.32, 0.04, 0.18, 10, 200, 40, 100, 0.07, id, "slash");
      f.vx = f.facing * 1100;
      f.armorTime = 0.25;
      f.trailUntil = now + 0.35;
      sfx.dash(); sfx.ability();
      break;
    case "electricExtender":
      f.attack = mkAttack(f, now, 0.6, 0.06, 0.5, 6, 90, 40, 90, 0.05, id, "punch");
      (f.attack as any).multiHit = true;
      (f.attack as any).hitInterval = 0.08;
      (f.attack as any).lastHitAt = -1;
      f.armorTime = 0.4;
      sfx.ability();
      break;
    case "lightningStep":
      f.vx = f.facing * 1300;
      f.dashTime = 0.28;
      f.armorTime = 0.32;
      f.trailUntil = now + 0.4;
      burst(state, f.x, f.y + 70, "#ffe24a", 16, 280, 12);
      sfx.dash();
      break;
    case "speedStorm":
      f.berserk = Math.max(f.berserk, 4);
      f.rage = Math.max(f.rage, 4);
      f.armorTime = 1.0;
      burst(state, f.x, f.y + 70, "#ffe24a", 36, 360, 28);
      sfx.finisher();
      break;

    // ============== EXECUTIONER ==============
    case "axeSwing":
      f.attack = mkAttack(f, now, 0.55, 0.18, 0.32, 22, 360, 80, 120, 0.16, id, "slash", 80, 80);
      f.armorTime = 0.5;
      sfx.kick();
      break;
    case "hookPull": {
      // Yank target toward you
      const tgt = state.player === f ? state.enemy : state.player;
      const dx = f.x - tgt.x;
      const dir = dx >= 0 ? 1 : -1;
      tgt.vx = dir * 900;
      tgt.vy = 280;
      tgt.onGround = false;
      tgt.hitstun = Math.max(tgt.hitstun, 0.35);
      tgt.flashTime = 0.2;
      burst(state, tgt.x, tgt.y + 70, "#a44060", 12, 240, 12);
      sfx.ability();
      break;
    }
    case "armorStance":
      f.armorTime = Math.max(f.armorTime, 3.0);
      f.rage = Math.max(f.rage, 3.0);
      burst(state, f.x, f.y + 70, "#a44060", 22, 240, 18);
      sfx.block();
      break;
    case "guillotineSlam":
      f.attack = mkAttack(f, now, 0.85, 0.45, 0.6, 38, 560, 320, 140, 0.22, id, "slash", 140, 90);
      f.armorTime = 0.85;
      spawnAOE(state, {
        x: f.x + f.facing * 70, y: 0, radius: 160, born: now, life: 0.35, max: 0.35,
        damage: 18 * f.klass.damageMul, knock: 420, knockUp: 220,
        owner: f.id, hit: new Set(), color: "#a44060", kind: "shock", delay: 0.55,
      });
      sfx.finisher();
      break;

    // ============== SNIPER ==============
    case "snipeShot":
      burst(state, f.x + f.facing * 40, 90, "#9adfff", 8, 220, 10);
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 1500, vy: 0,
        gravity: 0, life: 1.0, born: now, owner: f.id,
        damage: 14 * f.klass.damageMul, knock: 160, knockUp: 30,
        kind: "bullet", color: "#9adfff", radius: 5,
      });
      sfx.dash();
      break;
    case "piercingBullet": {
      // Higher damage + larger radius + can pass through (we mark as multiHit-pierce)
      const proj: Omit<Projectile, "id"> = {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 1700, vy: 0,
        gravity: 0, life: 1.0, born: now, owner: f.id,
        damage: 22 * f.klass.damageMul, knock: 220, knockUp: 50,
        kind: "bullet", color: "#cce8ff", radius: 7,
      };
      spawnProjectile(state, proj);
      sfx.ability();
      break;
    }
    case "rollDodge":
      f.vx = -f.facing * 640;
      f.dashTime = 0.22;
      f.armorTime = 0.32;
      f.invisible = 0.15;
      f.trailUntil = now + 0.35;
      burst(state, f.x, f.y + 30, f.klass.color, 10, 200, 10);
      sfx.dash();
      break;
    case "focusBeam": {
      // Charged beam: a fast bright projectile with high damage
      burst(state, f.x + f.facing * 40, 90, "#ffffff", 16, 260, 16);
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 2000, vy: 0,
        gravity: 0, life: 0.9, born: now, owner: f.id,
        damage: 36 * f.klass.damageMul, knock: 360, knockUp: 80,
        kind: "bolt", color: "#aef0ff", radius: 12,
      });
      sfx.finisher();
      break;
    }

    // ============== STORM MAGE ==============
    case "windBlast": {
      // Cone-style push AOE
      spawnAOE(state, {
        x: f.x + f.facing * 90, y: 0, radius: 130, born: now, life: 0.25, max: 0.25,
        damage: 8 * f.klass.damageMul, knock: 360, knockUp: 100,
        owner: f.id, hit: new Set(), color: "#7bb6ff", kind: "shock", delay: 0,
      });
      burst(state, f.x + f.facing * 50, 90, "#7bb6ff", 16, 280, 14);
      sfx.ability();
      break;
    }
    case "lightningChain": {
      const tgt = state.player === f ? state.enemy : state.player;
      // Instant strike at target
      spawnAOE(state, {
        x: tgt.x, y: 0, radius: 60, born: now, life: 0.2, max: 0.2,
        damage: 16 * f.klass.damageMul, knock: 200, knockUp: 60,
        owner: f.id, hit: new Set(), color: "#7bb6ff", kind: "shock", delay: 0.1,
      });
      // Visual bolt down from sky
      burst(state, tgt.x, 60, "#7bb6ff", 14, 220, 14);
      burst(state, tgt.x, 600, "#ffffff", 8, 100, 8);
      sfx.ability();
      break;
    }
    case "teleportBurst": {
      burst(state, f.x, f.y + 70, "#7bb6ff", 18, 240, 16);
      const dx = f.facing * 280;
      f.x = Math.max(50, Math.min(ARENA_W - 50, f.x + dx));
      f.invisible = 0.2;
      f.armorTime = 0.25;
      // Damage burst at exit point
      spawnAOE(state, {
        x: f.x, y: 0, radius: 100, born: now, life: 0.2, max: 0.2,
        damage: 8 * f.klass.damageMul, knock: 220, knockUp: 80,
        owner: f.id, hit: new Set(), color: "#7bb6ff", kind: "nova", delay: 0,
      });
      burst(state, f.x, f.y + 70, "#7bb6ff", 18, 240, 16);
      sfx.dash();
      break;
    }
    case "stormSummon": {
      const tgt = state.player === f ? state.enemy : state.player;
      for (let i = 0; i < 5; i++) {
        spawnAOE(state, {
          x: tgt.x + (i - 2) * 90,
          y: 0, radius: 70, born: now, life: 0.22, max: 0.22,
          damage: 11 * f.klass.damageMul, knock: 240, knockUp: 120,
          owner: f.id, hit: new Set(), color: "#7bb6ff", kind: "shock",
          delay: 0.15 + i * 0.16,
        });
      }
      sfx.finisher();
      break;
    }

    // ============== FIRE MONK ==============
    case "flameStrike":
      f.attack = mkAttack(f, now, 0.32, 0.06, 0.18, 12, 200, 40, 95, 0.08, id, "punch");
      // Trailing fire orb
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 600, vy: 0,
        gravity: 0, life: 0.7, born: now, owner: f.id,
        damage: 8 * f.klass.damageMul, knock: 120, knockUp: 30,
        kind: "fire", color: "#ff7050", radius: 10,
      });
      sfx.ability();
      break;
    case "fireDash":
      f.vx = f.facing * 1100;
      f.dashTime = 0.26;
      f.armorTime = 0.3;
      f.trailUntil = now + 0.4;
      // Burning trail AOE
      spawnAOE(state, {
        x: f.x + f.facing * 80, y: 0, radius: 140, born: now, life: 0.3, max: 0.3,
        damage: 8 * f.klass.damageMul, knock: 160, knockUp: 30,
        owner: f.id, hit: new Set(), color: "#ff7050", kind: "fire", delay: 0.05,
      });
      burst(state, f.x, f.y + 30, "#ff7050", 14, 260, 12);
      sfx.dash();
      break;
    case "heatShield":
      f.armorTime = Math.max(f.armorTime, 2.2);
      f.rage = Math.max(f.rage, 2.5);
      // Aura damage
      spawnAOE(state, {
        x: f.x, y: 0, radius: 110, born: now, life: 0.3, max: 0.3,
        damage: 6 * f.klass.damageMul, knock: 180, knockUp: 60,
        owner: f.id, hit: new Set(), color: "#ff7050", kind: "nova", delay: 0,
      });
      burst(state, f.x, f.y + 70, "#ff7050", 22, 240, 18);
      sfx.block();
      break;
    case "dragonFlame": {
      // Big AOE eruption in front
      spawnAOE(state, {
        x: f.x + f.facing * 140, y: 0, radius: 220, born: now, life: 0.5, max: 0.5,
        damage: 22 * f.klass.damageMul, knock: 380, knockUp: 200,
        owner: f.id, hit: new Set(), color: "#ff7050", kind: "fire", delay: 0.25,
      });
      f.armorTime = 0.6;
      sfx.finisher();
      break;
    }

    // ============== ELEMENTALIST ==============
    // Each ability behaves differently per current element. Casting any ability
    // also rotates element to the next so each chain feels different.
    case "elementBlast": {
      const el = f.element;
      if (el === 0) {
        // Fire: burning projectile (small explode)
        spawnProjectile(state, {
          x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 820, vy: 0,
          gravity: 0, life: 1.2, born: now, owner: f.id,
          damage: 11 * f.klass.damageMul, knock: 160, knockUp: 40,
          kind: "fire", color: "#ff7a40", radius: 11, explodeRadius: 60,
        });
      } else if (el === 1) {
        // Ice: slowing shard
        spawnProjectile(state, {
          x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 900, vy: 0,
          gravity: 0, life: 1.2, born: now, owner: f.id,
          damage: 9 * f.klass.damageMul, knock: 60, knockUp: 0,
          kind: "ice", color: "#9ad8ff", radius: 10, freeze: 0.9,
        });
      } else {
        // Lightning: fast stun bolt
        spawnProjectile(state, {
          x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 1300, vy: 0,
          gravity: 0, life: 1.0, born: now, owner: f.id,
          damage: 9 * f.klass.damageMul, knock: 140, knockUp: 30,
          kind: "bolt", color: "#fff080", radius: 8,
        });
      }
      f.element = ((f.element + 1) % 3) as 0 | 1 | 2;
      sfx.ability();
      break;
    }
    case "elementCombo": {
      const el = f.element;
      if (el === 0) {
        // Fire: multi-hit flame burst in front
        f.attack = mkAttack(f, now, 0.6, 0.08, 0.5, 6, 100, 30, 110, 0.05, id, "magic");
        (f.attack as any).multiHit = true;
        (f.attack as any).hitInterval = 0.08;
        (f.attack as any).lastHitAt = -1;
        spawnAOE(state, {
          x: f.x + f.facing * 90, y: 0, radius: 110, born: now, life: 0.5, max: 0.5,
          damage: 4 * f.klass.damageMul, knock: 60, knockUp: 20,
          owner: f.id, hit: new Set(), color: "#ff7a40", kind: "fire", delay: 0.05,
        });
      } else if (el === 1) {
        // Ice: freeze chain projectile
        for (let i = -1; i <= 1; i++) {
          spawnProjectile(state, {
            x: f.x + f.facing * 30, y: f.y + 90 + i * 18, vx: f.facing * 800, vy: i * 40,
            gravity: 0, life: 1.2, born: now, owner: f.id,
            damage: 6 * f.klass.damageMul, knock: 60, knockUp: 0,
            kind: "ice", color: "#aee0ff", radius: 9, freeze: 0.7,
          });
        }
      } else {
        // Lightning: rapid strikes
        f.attack = mkAttack(f, now, 0.5, 0.06, 0.42, 5, 80, 20, 100, 0.04, id, "magic");
        (f.attack as any).multiHit = true;
        (f.attack as any).hitInterval = 0.06;
        (f.attack as any).lastHitAt = -1;
      }
      f.element = ((f.element + 1) % 3) as 0 | 1 | 2;
      f.armorTime = 0.3;
      sfx.ability();
      break;
    }
    case "elementMobility": {
      const el = f.element;
      if (el === 0) {
        // Fire: short flame dash with burning trail
        f.vx = f.facing * 1050;
        f.dashTime = 0.22;
        f.armorTime = 0.28;
        f.trailUntil = now + 0.35;
        spawnAOE(state, {
          x: f.x + f.facing * 60, y: 0, radius: 110, born: now, life: 0.3, max: 0.3,
          damage: 6 * f.klass.damageMul, knock: 100, knockUp: 20,
          owner: f.id, hit: new Set(), color: "#ff7a40", kind: "fire", delay: 0.05,
        });
        burst(state, f.x, f.y + 30, "#ff7a40", 14, 240, 12);
      } else if (el === 1) {
        // Ice: slide movement (long, low friction-feel)
        f.vx = f.facing * 900;
        f.dashTime = 0.32;
        f.armorTime = 0.32;
        f.trailUntil = now + 0.4;
        burst(state, f.x, f.y + 30, "#aee0ff", 16, 200, 12);
      } else {
        // Lightning: teleport blink
        burst(state, f.x, f.y + 70, "#fff080", 18, 240, 16);
        f.x = Math.max(50, Math.min(ARENA_W - 50, f.x + f.facing * 280));
        f.invisible = 0.18;
        f.armorTime = 0.22;
        burst(state, f.x, f.y + 70, "#fff080", 18, 240, 16);
      }
      f.element = ((f.element + 1) % 3) as 0 | 1 | 2;
      sfx.dash();
      break;
    }
    case "elementUlt": {
      const el = f.element;
      const tgt = state.player === f ? state.enemy : state.player;
      if (el === 0) {
        // Fire: meteor strike (single big AOE burn)
        burst(state, tgt.x, 600, "#ff7a3c", 14, 200, 18);
        spawnProjectile(state, {
          x: tgt.x, y: 700, vx: 0, vy: -200,
          gravity: 1800, life: 2.5, born: now, owner: f.id,
          damage: 28 * f.klass.damageMul, knock: 460, knockUp: 320,
          kind: "meteor", color: "#ff7a3c", radius: 26, delay: 0.4,
        });
        // Lingering burn area
        spawnAOE(state, {
          x: tgt.x, y: 0, radius: 200, born: now, life: 0.6, max: 0.6,
          damage: 8 * f.klass.damageMul, knock: 100, knockUp: 30,
          owner: f.id, hit: new Set(), color: "#ff7a40", kind: "fire", delay: 0.85,
        });
      } else if (el === 1) {
        // Ice: freezing storm
        for (let i = 0; i < 4; i++) {
          spawnAOE(state, {
            x: tgt.x + (i - 1.5) * 90, y: 0, radius: 90, born: now, life: 0.3, max: 0.3,
            damage: 9 * f.klass.damageMul, knock: 60, knockUp: 30,
            owner: f.id, hit: new Set(), color: "#aee0ff", kind: "nova",
            delay: 0.15 + i * 0.18,
          });
        }
        spawnProjectile(state, {
          x: tgt.x, y: 90, vx: 0, vy: 0,
          gravity: 0, life: 0.4, born: now, owner: f.id,
          damage: 1 * f.klass.damageMul, knock: 0, knockUp: 0,
          kind: "ice", color: "#aee0ff", radius: 12, freeze: 1.4, delay: 0.2,
        });
      } else {
        // Lightning: continuous damage zone (chain of shock AOEs)
        for (let i = 0; i < 5; i++) {
          spawnAOE(state, {
            x: tgt.x + (Math.random() - 0.5) * 200, y: 0, radius: 80, born: now,
            life: 0.22, max: 0.22,
            damage: 8 * f.klass.damageMul, knock: 120, knockUp: 40,
            owner: f.id, hit: new Set(), color: "#fff080", kind: "shock",
            delay: 0.1 + i * 0.18,
          });
        }
      }
      f.element = ((f.element + 1) % 3) as 0 | 1 | 2;
      f.armorTime = 0.5;
      sfx.finisher();
      break;
    }

    // ============== BOSS: ARENA CHAMPION ==============
    case "championCharge":
      f.attack = mkAttack(f, now, 0.55, 0.05, 0.4, 22, 440, 100, 130, 0.16, id, "slash");
      f.vx = f.facing * 1000;
      f.armorTime = 0.55;
      sfx.dash();
      break;
    case "championExecute":
      f.attack = mkAttack(f, now, 0.7, 0.3, 0.46, 32, 500, 280, 130, 0.20, id, "slash", 200, 80);
      f.armorTime = 0.7;
      sfx.finisher();
      break;
    case "championRoar":
      f.rage = 6;
      f.berserk = Math.max(f.berserk, 3);
      f.armorTime = 0.6;
      spawnAOE(state, {
        x: f.x, y: 0, radius: 220, born: now, life: 0.3, max: 0.3,
        damage: 6 * f.klass.damageMul, knock: 220, knockUp: 80,
        owner: f.id, hit: new Set(), color: "#f0c060", kind: "smoke", delay: 0,
      });
      sfx.ability();
      break;
    case "championBarrage":
      f.attack = mkAttack(f, now, 1.1, 0.10, 1.0, 8, 100, 30, 110, 0.05, id, "slash");
      (f.attack as any).multiHit = true;
      (f.attack as any).hitInterval = 0.08;
      (f.attack as any).lastHitAt = -1;
      f.armorTime = 1.1;
      sfx.finisher();
      break;

    // ============== BOSS: SHADOW ROGUE ==============
    case "rogueShadowStep": {
      const tgt = state.player === f ? state.enemy : state.player;
      f.x = Math.max(50, Math.min(ARENA_W - 50, tgt.x - tgt.facing * 55));
      f.facing = tgt.facing === 1 ? -1 : 1;
      f.attack = mkAttack(f, now, 0.32, 0.04, 0.18, 18, 240, 80, 100, 0.10, id, "slash");
      f.invisible = 0.1;
      burst(state, f.x, f.y + 70, "#7df0c0", 14, 220, 14);
      sfx.ability();
      break;
    }
    case "rogueDaggerStorm":
      f.attack = mkAttack(f, now, 0.85, 0.08, 0.78, 8, 90, 30, 100, 0.05, id, "slash");
      (f.attack as any).multiHit = true;
      (f.attack as any).hitInterval = 0.08;
      (f.attack as any).lastHitAt = -1;
      f.armorTime = 0.85;
      sfx.ability();
      break;
    case "rogueVanish":
      f.invisible = 2.0;
      f.armorTime = 0.5;
      burst(state, f.x, f.y + 70, "#cfd8e8", 28, 240, 26);
      sfx.ability();
      break;
    case "rogueDeathmark": {
      const tgt = state.player === f ? state.enemy : state.player;
      spawnAOE(state, {
        x: tgt.x, y: 0, radius: 180, born: now, life: 0.4, max: 0.4,
        damage: 30 * f.klass.damageMul, knock: 380, knockUp: 200,
        owner: f.id, hit: new Set(), color: "#7df0c0", kind: "void", delay: 0.5,
      });
      sfx.finisher();
      break;
    }

    // ============== BOSS: TITAN GUARDIAN ==============
    case "titanQuake":
      f.attack = mkAttack(f, now, 0.7, 0.3, 0.5, 24, 380, 220, 150, 0.18, id, "kick", 280, 90);
      f.vy = Math.max(f.vy, 380); f.onGround = false;
      f.armorTime = 0.7;
      spawnAOE(state, {
        x: f.x, y: 0, radius: 280, born: now, life: 0.4, max: 0.4,
        damage: 14 * f.klass.damageMul, knock: 320, knockUp: 140,
        owner: f.id, hit: new Set(), color: "#a07050", kind: "shock", delay: 0.45,
      });
      sfx.finisher();
      break;
    case "titanSweep":
      f.attack = mkAttack(f, now, 0.65, 0.18, 0.4, 26, 460, 100, 160, 0.18, id, "slash", 220, 70);
      f.armorTime = 0.6;
      sfx.ability();
      break;
    case "titanBulwark":
      f.armorTime = Math.max(f.armorTime, 3.5);
      f.rage = Math.max(f.rage, 4);
      burst(state, f.x, f.y + 70, "#a07050", 24, 220, 22);
      sfx.block();
      break;
    case "titanCataclysm":
      // Two-stage AOE
      spawnAOE(state, {
        x: f.x, y: 0, radius: 320, born: now, life: 0.5, max: 0.5,
        damage: 20 * f.klass.damageMul, knock: 420, knockUp: 220,
        owner: f.id, hit: new Set(), color: "#a07050", kind: "shock", delay: 0.5,
      });
      spawnAOE(state, {
        x: f.x, y: 0, radius: 200, born: now, life: 0.4, max: 0.4,
        damage: 24 * f.klass.damageMul, knock: 480, knockUp: 280,
        owner: f.id, hit: new Set(), color: "#ff8050", kind: "fire", delay: 1.1,
      });
      f.armorTime = 1.4;
      sfx.finisher();
      break;

    // ============== BOSS: ARCANE ENTITY ==============
    case "arcaneOrb":
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 800, vy: 0,
        gravity: 0, life: 1.4, born: now, owner: f.id,
        damage: 16 * f.klass.damageMul, knock: 200, knockUp: 60,
        kind: "bolt", color: "#c79bff", radius: 14,
      });
      sfx.ability();
      break;
    case "arcaneFreeze":
      spawnProjectile(state, {
        x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 900, vy: 0,
        gravity: 0, life: 1.2, born: now, owner: f.id,
        damage: 8 * f.klass.damageMul, knock: 60, knockUp: 0,
        kind: "ice", color: "#9ad8ff", radius: 12, freeze: 1.8,
      });
      sfx.ability();
      break;
    case "arcaneRift": {
      const tgt = state.player === f ? state.enemy : state.player;
      burst(state, f.x, f.y + 70, "#c79bff", 18, 240, 16);
      f.x = Math.max(50, Math.min(ARENA_W - 50, tgt.x - tgt.facing * 80));
      f.facing = tgt.facing === 1 ? -1 : 1;
      f.invisible = 0.18;
      f.armorTime = 0.25;
      burst(state, f.x, f.y + 70, "#c79bff", 18, 240, 16);
      sfx.dash();
      break;
    }
    case "arcaneSupernova":
      spawnAOE(state, {
        x: f.x, y: 0, radius: 320, born: now, life: 0.6, max: 0.6,
        damage: 28 * f.klass.damageMul, knock: 520, knockUp: 280,
        owner: f.id, hit: new Set(), color: "#c79bff", kind: "nova", delay: 0.4,
      });
      f.armorTime = 0.9;
      sfx.finisher();
      break;

    default:
      consumed = false;
  }

  if (consumed) {
    recordMove(f, state, id, now, originX, originY, castElement);
    f.cooldowns[slotIndex] = def.cooldown;
    // Viking axe recall uses a shorter cooldown
    const shortCd = (f as any)._axeRecallShortCd as number | undefined;
    if (shortCd) {
      f.cooldowns[slotIndex] = shortCd;
      (f as any)._axeRecallShortCd = undefined;
    }
    if (f.attack) f.trailUntil = now + f.attack.duration;
  }
  return consumed;
}

// ===================== M2 HEAVY ATTACK =====================
// Per-class heavy profile. Charge multiplier scales damage/knockback/reach.
// Speed classes have low M2 damage but high mobility hops.
// Heavy classes have huge M2 impact but very slow.
// Mage/Ranged get charged or area heavies.
// Brawlers get balanced punish heavies.

interface HeavyProfile {
  // Base attack values at 0% charge
  duration: number;
  activeStart: number;
  activeEnd: number;
  damage: number;
  knock: number;
  knockUp: number;
  reach: number;
  hitstop: number;
  kind: ActiveAttack["kind"];
  // Charge multipliers (applied as 1 + (mul-1)*charge)
  chargeDmgMul: number;     // up to e.g. 2.5x at full charge
  chargeKnockMul: number;
  // Self motion on release
  forwardImpulse: number;   // px/s pushed forward
  upImpulse: number;        // px/s upward
  armorTime: number;        // armor during heavy
  // Stun on max charge?
  stunOnFullCharge?: boolean;
  // Optional extras
  hitWidth?: number;
  hitHeight?: number;
  // Optional AOE on impact (for heavy mages/heavy classes)
  aoeRadius?: number;
  aoeDelay?: number;
  aoeColor?: string;
}

function defaultHeavy(category: string): HeavyProfile {
  switch (category) {
    case "speed":
      return {
        duration: 0.42, activeStart: 0.06, activeEnd: 0.18,
        damage: 9, knock: 200, knockUp: 60, reach: 100, hitstop: 0.10, kind: "slash",
        chargeDmgMul: 1.6, chargeKnockMul: 1.5,
        forwardImpulse: 720, upImpulse: 0, armorTime: 0.25,
      };
    case "heavy":
      return {
        duration: 0.85, activeStart: 0.30, activeEnd: 0.5,
        damage: 24, knock: 460, knockUp: 220, reach: 130, hitstop: 0.22, kind: "slash",
        chargeDmgMul: 2.6, chargeKnockMul: 2.0,
        forwardImpulse: 240, upImpulse: 0, armorTime: 0.85,
        stunOnFullCharge: true, hitWidth: 120, hitHeight: 80,
        aoeRadius: 150, aoeDelay: 0.45, aoeColor: "#ff8050",
      };
    case "ranged":
      return {
        duration: 0.55, activeStart: 0.12, activeEnd: 0.25,
        damage: 14, knock: 240, knockUp: 60, reach: 110, hitstop: 0.12, kind: "punch",
        chargeDmgMul: 2.4, chargeKnockMul: 1.6,
        forwardImpulse: 80, upImpulse: 0, armorTime: 0.4,
      };
    case "mage":
      return {
        duration: 0.6, activeStart: 0.18, activeEnd: 0.32,
        damage: 16, knock: 280, knockUp: 100, reach: 110, hitstop: 0.14, kind: "magic",
        chargeDmgMul: 2.2, chargeKnockMul: 1.6,
        forwardImpulse: 60, upImpulse: 0, armorTime: 0.5,
        aoeRadius: 130, aoeDelay: 0.32, aoeColor: "#c79bff",
      };
    case "brawler":
    default:
      return {
        duration: 0.55, activeStart: 0.14, activeEnd: 0.26,
        damage: 18, knock: 360, knockUp: 120, reach: 110, hitstop: 0.16, kind: "punch",
        chargeDmgMul: 2.0, chargeKnockMul: 1.7,
        forwardImpulse: 280, upImpulse: 0, armorTime: 0.45,
        stunOnFullCharge: true,
      };
  }
}

// Returns true if a heavy was started.
export function startHeavyAttack(f: Fighter, charge: number, state: GameState, now: number): boolean {
  if (f.attack || f.hitstun > 0 || f.frozen > 0) return false;
  if (f.heavyCooldown > 0) return false;
  const c = Math.max(0, Math.min(1, charge / MAX_HEAVY_CHARGE));
  const prof = defaultHeavy(f.klass.category);
  // Elementalist heavy = elemental beam variant
  if (f.klass.id === "elementalist") {
    const castElement = f.element;
    const started = startElementalHeavy(f, c, state, now);
    if (started) recordMove(f, state, 'heavy', now, f.x, f.y, castElement, c);
    return started;
  }
  const dmgBuff = (f.rage > 0 ? 1.4 : 1) * (f.berserk > 0 ? 1.6 : 1);
  const cMulD = 1 + (prof.chargeDmgMul - 1) * c;
  const cMulK = 1 + (prof.chargeKnockMul - 1) * c;
  const reach = prof.reach * (1 + 0.25 * c);

  const atk: ActiveAttack = {
    stepIdx: -1, startTime: now,
    duration: prof.duration, activeStart: prof.activeStart, activeEnd: prof.activeEnd,
    recoveryUntil: prof.duration * 0.85, cancelWindow: prof.duration,
    damage: prof.damage * f.klass.damageMul * dmgBuff * cMulD,
    knockback: prof.knock * f.klass.knockbackMul * cMulK,
    knockUp: prof.knockUp * f.klass.knockbackMul * cMulK,
    reach,
    hitstop: prof.hitstop,
    kind: prof.kind,
    hit: false,
    isAbility: true,
    abilityId: undefined,
    isFinisher: c >= 0.95,
    hitWidth: prof.hitWidth,
    hitHeight: prof.hitHeight,
  };
  (atk as any).isHeavy = true;
  (atk as any).heavyCharge = c;
  (atk as any).heavyStun = !!(prof.stunOnFullCharge && c >= 0.85);
  // Heavy attacks at >= 50% charge break block / pressure reset
  (atk as any).breakBlock = c >= 0.5;
  f.attack = atk;
  f.armorTime = Math.max(f.armorTime, prof.armorTime);
  f.vx += f.facing * prof.forwardImpulse * (0.5 + 0.5 * c);
  if (prof.upImpulse) { f.vy = Math.max(f.vy, prof.upImpulse); f.onGround = false; }
  f.trailUntil = now + atk.duration;

  // Charge release burst
  burst(state, f.x + f.facing * 30, 90, f.klass.color, 14 + Math.floor(c * 16), 200 + c * 200, 12 + c * 14);

  // AOE on impact for heavy/mage profiles (delayed shockwave)
  if (prof.aoeRadius && c > 0.3) {
    spawnAOE(state, {
      x: f.x + f.facing * 60, y: 0, radius: prof.aoeRadius * (0.6 + 0.4 * c),
      born: now, life: 0.3, max: 0.3, delay: prof.aoeDelay ?? 0.3,
      damage: prof.damage * 0.6 * cMulD * f.klass.damageMul,
      knock: prof.knock * 0.6 * cMulK,
      knockUp: prof.knockUp * 0.6 * cMulK,
      owner: f.id, hit: new Set(),
      color: prof.aoeColor ?? f.klass.color,
      kind: "shock",
    });
  }

  // Cooldown scales mildly with charge
  f.heavyCooldown = HEAVY_COOLDOWN + c * 0.6;
  recordMove(f, state, 'heavy', now, f.x, f.y, f.element, c);
  if (c >= 0.95) sfx.finisher(); else sfx.ability();
  return true;
}

// Elementalist heavy: charged elemental beam.
// Fire = explosion, Ice = piercing slow beam, Lightning = chaining arc strike.
function startElementalHeavy(f: Fighter, c: number, state: GameState, now: number): boolean {
  const dmgBuff = (f.rage > 0 ? 1.4 : 1) * (f.berserk > 0 ? 1.6 : 1);
  const baseDmg = 14 * (1 + c * 1.6);
  const el = f.element;
  // Self-anim: short cast, no melee hitbox
  f.armorTime = Math.max(f.armorTime, 0.4);
  f.vx += f.facing * 60;
  f.heavyCooldown = HEAVY_COOLDOWN + c * 0.7;

  if (el === 0) {
    // Fire: explosive beam (large explode radius)
    spawnProjectile(state, {
      x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 1100, vy: 0,
      gravity: 0, life: 1.0, born: now, owner: f.id,
      damage: baseDmg * f.klass.damageMul * dmgBuff, knock: 280, knockUp: 100,
      kind: "fire", color: "#ff7a40", radius: 14 + c * 6, explodeRadius: 90 + c * 60,
    });
    burst(state, f.x + f.facing * 40, 90, "#ff7a40", 18, 280, 16);
  } else if (el === 1) {
    // Ice: piercing slow beam (long-life projectile that freezes briefly)
    spawnProjectile(state, {
      x: f.x + f.facing * 30, y: f.y + 90, vx: f.facing * 1500, vy: 0,
      gravity: 0, life: 1.2, born: now, owner: f.id,
      damage: baseDmg * f.klass.damageMul * dmgBuff, knock: 200, knockUp: 30,
      kind: "ice", color: "#aee0ff", radius: 12 + c * 4, freeze: 0.6 + c * 0.8,
    });
    burst(state, f.x + f.facing * 40, 90, "#aee0ff", 18, 280, 16);
  } else {
    // Lightning: chaining arc strike — instant AOE near target plus chained sub-AOEs
    const tgt = state.player === f ? state.enemy : state.player;
    spawnAOE(state, {
      x: tgt.x, y: 0, radius: 90 + c * 40, born: now, life: 0.22, max: 0.22, delay: 0.08,
      damage: baseDmg * f.klass.damageMul * dmgBuff, knock: 240, knockUp: 80,
      owner: f.id, hit: new Set(), color: "#fff080", kind: "shock",
    });
    for (let i = 0; i < 2; i++) {
      spawnAOE(state, {
        x: tgt.x + (i === 0 ? -120 : 120), y: 0, radius: 70, born: now, life: 0.2, max: 0.2,
        delay: 0.22 + i * 0.12,
        damage: baseDmg * 0.5 * f.klass.damageMul, knock: 160, knockUp: 40,
        owner: f.id, hit: new Set(), color: "#fff080", kind: "shock",
      });
    }
    burst(state, tgt.x, 90, "#fff080", 14, 240, 16);
  }
  // Rotate element after use
  f.element = ((f.element + 1) % 3) as 0 | 1 | 2;
  if (c >= 0.95) sfx.finisher(); else sfx.ability();
  return true;
}
