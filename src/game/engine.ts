import {
  Fighter,
  ActiveAttack,
  ARENA_W,
  GRAVITY,
  BASE_MOVE_SPEED,
  JUMP_VEL,
  FRICTION,
  DASH_SPEED,
  DASH_TIME,
  DASH_COOLDOWN,
  COMBO_CHAIN,
  COMBO_CHAIN_TIMEOUT,
  startComboStep,
  attackActive,
  attackDone,
  canChain,
  TrailSample,
} from "./types";
import { getAttackHitPoint } from "./stick";
import { computeJoints } from "./stick";
import { sfx } from "./sfx";
import { startAbility } from "./abilities";
import { startHeavyAttack, MAX_HEAVY_CHARGE } from "./abilities";
import type { MoveVFX } from './vfx-types';
import { impact, updatePresentation, fighterColor, type Presentation } from './presentation';
import type { GameSettings } from './settings';
import { catchHook, fishHit, stepFishing, pickupFish, throwFish, cancelFishing } from './fishing';
import type { DroppedFish, FishKind } from './fishing';

export interface InputState {
  pickup?: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  abilities: [boolean, boolean, boolean, boolean]; // 1..4
  dash: boolean;
  block: boolean;
  // M2 heavy attack: held to charge, released to fire.
  heavyHeld: boolean;
  heavyReleased: boolean;
}

export function emptyInput(): InputState {
  return {
    left: false, right: false, jump: false, attack: false,
    abilities: [false, false, false, false],
    dash: false, block: false,
    heavyHeld: false, heavyReleased: false,
  };
}

export interface FloatingText {
  x: number; y: number; vy: number;
  life: number; max: number; text: string;
  color: string; size: number;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number;
  kind: "spark" | "ring" | "shockwave" | "dust" | "ice";
  color?: string;
}

export interface Projectile {
  fish?: FishKind;
  prevX?: number;
  prevY?: number;
  visualAbility?: MoveVFX['ability'];
  visualElement?: 0 | 1 | 2;
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  gravity: number;
  life: number;
  born: number;
  delay?: number; // not active until this many seconds after born
  owner: "player" | "enemy";
  damage: number;
  knock: number;
  knockUp: number;
  kind: "arrow" | "axe" | "bolt" | "ice" | "meteor" | "fire" | "rocket" | "bullet" | "hook" | "fish";
  color: string;
  radius: number;
  spin?: number;
  freeze?: number;        // applies frozen status seconds
  explodeRadius?: number; // converts to AOE on impact
  hit?: boolean;
}

export interface AOEZone {
  visualAbility?: MoveVFX['ability'];
  visualElement?: 0 | 1 | 2;
  id: number;
  x: number; y: number;
  radius: number;
  born: number;
  delay: number; // seconds before becoming active
  life: number;  // active duration after delay
  max: number;
  damage: number;
  knock: number;
  knockUp: number;
  owner: "player" | "enemy";
  hit: Set<"player" | "enemy">;
  color: string;
  kind: "shock" | "smoke" | "phantom" | "void" | "nova" | "fire" | "sea";
}

export interface AIState {
  decisionTimer: number;
  nextAction: "approach" | "retreat" | "attack" | "jump" | "block" | "ability" | "dash" | "wait";
  comboTarget: number;
  comboDone: number;
  blockReleaseAt: number;
  abilityCycle: number; // round-robin slot picker
}

export type ArenaId = "dojo" | "rooftop" | "volcano";

export interface GameState {
  // Server-only controls are never accepted from a network payload.
  headless?: boolean;
  online?: boolean;
  random?: () => number;
  droppedFish?: DroppedFish[];
  fishingId?: number;
  networkEvents?: import('./network-protocol').CombatEvent[];
  eventId?: number;
  settings?: GameSettings;
  presentation?: Presentation;
  moveVfx?: MoveVFX[];
  player: Fighter;
  enemy: Fighter;
  ai: AIState;
  time: number;
  hitPause: number;
  shake: number;
  shakeT: number;
  particles: Particle[];
  projectiles: Projectile[];
  aoeZones: AOEZone[];
  floats: FloatingText[];
  winner: "player" | "enemy" | null;
  winTime: number;
  flashScreen: number;
  playerCombo: number;
  playerComboTimer: number;
  enemyCombo: number;
  enemyComboTimer: number;
  slowmo: number;
  globalTimeScale: number;
  arena: ArenaId;
  bossMode: boolean;
}

export function makeAI(): AIState {
  return {
    decisionTimer: 0.4,
    nextAction: "approach",
    comboTarget: 2,
    comboDone: 0,
    blockReleaseAt: 0,
    abilityCycle: 0,
  };
}

export function spawnHitParticles(
  state: GameState, x: number, y: number, dir: number, level: 1 | 2 | 3 | 4,
  attacker?: Fighter | null,
) {
  const move=attacker?.classId==='elementalist'?state.moveVfx?.find(v=>v.owner===attacker.id&&v.born===attacker.attack?.startTime):undefined;
  impact(state, x, y, dir, level, attacker?.equipped?.hitFx?.color ?? (attacker ? fighterColor(attacker,move?.element) : '#b9d8ff'), attacker?.attack?.abilityId,move?.element);

}

export function applyShake(state: GameState, intensity: number, duration: number) {
  state.shake = Math.max(state.shake, intensity);
  state.shakeT = Math.max(state.shakeT, duration);
}

function checkHit(attacker: Fighter, defender: Fighter, now: number): { x: number; y: number } | null {
  if (!attacker.attack) return null;
  const a = attacker.attack;
  const isMulti = (a as any).multiHit === true;

  // Multi-hit ability: poll inside active window with hitInterval cooldown
  if (isMulti) {
    const t = now - a.startTime;
    if (t < a.activeStart || t > a.activeEnd) return null;
    const lastHitAt = (a as any).lastHitAt as number;
    const interval = (a as any).hitInterval as number;
    if (lastHitAt >= 0 && now - lastHitAt < interval) return null;
  } else {
    if (!attackActive(a, now)) return null;
  }

  const hitPt = getAttackHitPoint(attacker, now);
  if (!hitPt) return null;
  const worldX = attacker.x + hitPt[0];
  const worldY = hitPt[1]; // computeJoints already includes the airborne height.
  const bx = defender.x;
  const by = defender.y + 70;
  const halfW = a.hitWidth ?? 40;
  const halfH = a.hitHeight ?? 65;
  if (Math.abs(worldX - bx) < halfW && Math.abs(worldY - by) < halfH) {
    return { x: worldX, y: worldY };
  }
  return null;
}

function getComboLevel(a: ActiveAttack): 1 | 2 | 3 | 4 {
  if (a.isAbility) return 4;
  return Math.min(4, Math.max(1, a.stepIdx + 1)) as 1 | 2 | 3 | 4;
}

function pushFloat(state: GameState, x: number, y: number, text: string, color: string, size = 22) {
  state.floats.push({ x, y, vy: -110, life: 0.85, max: 0.85, text, color, size });
}

function bumpCombo(state: GameState, who: "player" | "enemy") {
  if (who === "player") { state.playerCombo += 1; state.playerComboTimer = 1.6; }
  else { state.enemyCombo += 1; state.enemyComboTimer = 1.6; }
}
function resetOpposingCombo(state: GameState, attackerId: "player" | "enemy") {
  if (attackerId === "player") { state.enemyCombo = 0; state.enemyComboTimer = 0; }
  else { state.playerCombo = 0; state.playerComboTimer = 0; }
}

export function finishKO(state: GameState, def: Fighter, winner: 'player' | 'enemy') {
  if (def.hp > 0 || state.winner) return;
  state.winner = winner; state.winTime = state.time;
  applyShake(state, 24, 0.6); state.hitPause = 0.4; state.slowmo = 1.2; sfx.ko();
}

// Apply a damage instance (used by melee, projectiles, AOEs)
export function applyDamage(
  state: GameState, atk: Fighter | null, def: Fighter,
  hit: { x: number; y: number },
  damage: number, knock: number, knockUp: number,
  opts: {
    dirOverride?: number;
    level?: 1 | 2 | 3 | 4;
    hitstop?: number;
    isFinisher?: boolean;
    canBlock?: boolean;
    freeze?: number;
    silent?: boolean;
    canCounter?: boolean;
    sound?: "punch" | "kick" | "ability" | "finisher" | null;
  } = {},
) {
  const dir = opts.dirOverride ?? (atk ? atk.facing : (def.x > hit.x ? 1 : -1));
  const level = opts.level ?? 2;

  // Counter stance reflects melee
  if (def.counterStance > 0 && atk && opts.canCounter !== false) {
    // reflect: damage attacker instead
    const reflected = damage * 1.2;
    def.counterStance = 0;
    if (atk.hp > 0) {
      atk.hp = Math.max(0, atk.hp - reflected);
      atk.hitstun = 0.3;
      atk.flashTime = 0.2;
      atk.vx = -dir * (knock + 200);
      atk.vy = Math.max(atk.vy, 200);
      atk.onGround = false;
      spawnHitParticles(state, hit.x, hit.y, -dir, 4, def);
      pushFloat(state, hit.x, hit.y - 10, "COUNTER!", "#fff", 22);
      applyShake(state, 14, 0.25);
      state.hitPause = 0.18;
      state.flashScreen = 0.18;
      sfx.finisher();
      finishKO(state, atk, def.id);
    }
    return;
  }

  const facingAttacker = opts.dirOverride !== undefined ? def.facing === -dir : atk
    ? ((def.facing === 1 && atk.x > def.x) || (def.facing === -1 && atk.x < def.x))
    : ((def.facing === 1 && hit.x > def.x) || (def.facing === -1 && hit.x < def.x));
  // Heavy attacks at 50%+ charge break block. Force feedback on broken block.
  const heavyBlockBreak = !!(opts.canCounter !== false && atk && atk.attack && (atk.attack as any).breakBlock);
  const blocked = opts.canBlock !== false && def.blocking && def.onGround && facingAttacker
    && def.hitstun <= 0 && !heavyBlockBreak;

  if (blocked) {
    const dmg = Math.max(1, damage * 0.18);
    def.hp = Math.max(0, def.hp - dmg);
    def.blockstun = 0.18;
    def.vx = dir * knock * 0.25;
    def.flashTime = 0.06;
    applyShake(state, 4, 0.1);
    state.hitPause = 0.05;
    if (!opts.silent) sfx.block();
    spawnHitParticles(state, hit.x, hit.y, dir, 1, atk);
    pushFloat(state, hit.x, hit.y - 10, "BLOCK", "#9ad", 16);
    // Blocking still adds a tiny bit of stagger (much less than a clean hit)
    def.stagger = Math.min(def.maxStagger, def.stagger + Math.max(2, damage * 0.08));
    def.staggerDecayDelay = 0.5;
    finishKO(state, def, atk?.id ?? (def.id === 'player' ? 'enemy' : 'player'));
    return;
  }

  cancelFishing(def, state);
  // Defender armor: reduce damage but don't fully cancel
  if (def.armorTime > 0 && !opts.isFinisher) {
    const dmg = damage * 0.6;
    def.hp = Math.max(0, def.hp - dmg);
    def.flashTime = 0.1;
    spawnHitParticles(state, hit.x, hit.y, dir, level, atk);
    applyShake(state, 5, 0.12);
    pushFloat(state, hit.x, hit.y - 10, Math.round(dmg).toString(), "#fc6", 18);
    if (!opts.silent) sfx.hurt();
  } else {
    // Stagger vulnerability: bonus damage while in vulnerable window.
    let dmgFinal = damage;
    if (def.staggerVulnerable > 0) dmgFinal *= 1.4;
    def.hp = Math.max(0, def.hp - dmgFinal);
    def.flashTime = 0.14;
    // Track consecutive hits — builds stun resistance to prevent infinite combos.
    def.consecutiveHits += 1;
    def.consecutiveHitsTimer = 1.0;
    // Stun resist ramps up after 2 hits, peaks at ~5+ hits.
    const extraResist = Math.max(0, def.consecutiveHits - 2) * 0.18;
    def.stunResist = Math.min(0.7, def.stunResist + extraResist);
    const resistMul = 1 - def.stunResist;
    // Bosses get reduced hitstun for stagger resistance
    const stagger = (def.isBoss ? 0.5 : 1) * resistMul;
    // Corner detection: less hitstun + stronger pushback when wall behind defender
    const wallBehind = (dir < 0 && def.x <= 90) || (dir > 0 && def.x >= ARENA_W - 90);
    const cornerStunMul = wallBehind ? 0.55 : 1;
    const cornerKnockMul = wallBehind ? 1.5 : 1;
    def.hitstun = (0.16 + level * 0.05 + (opts.isFinisher ? 0.35 : 0)) * stagger * cornerStunMul;
    def.ragdoll = (0.35 + level * 0.15) * stagger;
    def.vx = dir * knock * (def.isBoss ? 0.4 : 1) * cornerKnockMul;
    def.vy = Math.max(def.onGround ? 0 : def.vy * 0.4, knockUp * (def.isBoss ? 0.4 : 1));
    def.armorTime = 0;
    if (knockUp > 0 || !def.onGround) def.onGround = false;
    spawnHitParticles(state, hit.x, hit.y, dir, level, atk);

    // ===== Stagger meter =====
    if (def.staggerImmune <= 0) {
      // Each hit fills based on damage (heavies fill more), bosses harder to stagger.
      const fill = damage * (opts.isFinisher ? 1.6 : 1) * (def.isBoss ? 0.55 : 1);
      def.stagger = Math.min(def.maxStagger, def.stagger + fill);
      def.staggerDecayDelay = 1.2;
      // Trigger stagger break when meter fills
      if (def.stagger >= def.maxStagger) {
        def.stagger = 0;
        def.staggered = 0.55;
        def.staggerVulnerable = 1.0;
        // After stagger, immune for a window so opponent can't infinite-stagger.
        def.staggerImmune = 5.5;
        def.hitstun = Math.max(def.hitstun, 0.45);
        def.frozen = Math.max(def.frozen, 0.35);
        pushFloat(state, hit.x, hit.y - 28, "STAGGERED!", "#ffe24a", 22);
        applyShake(state, 12, 0.3);
        state.flashScreen = Math.max(state.flashScreen, 0.18);
      }
    }
    applyShake(state, level < 3 ? 2 + level * 2 : 4 + level * 3, 0.1 + level * 0.035);
    state.hitPause = opts.hitstop ?? (0.04 + level * 0.02);
    state.flashScreen = level < 3 ? 0 : Math.min(0.08, 0.02 + level * 0.01);
    if (!opts.silent) {
      if (opts.sound === null) {} else
      if (opts.sound === "ability") sfx.ability();
      else if (opts.sound === "finisher" || opts.isFinisher) sfx.finisher();
      else if (opts.sound === "kick") sfx.kick();
      else sfx.punch();
    }
    pushFloat(state, hit.x, hit.y - 10, Math.round(dmgFinal).toString(),
      level >= 3 ? "#ff5566" : "#fff", 18 + level * 2);

    if (opts.freeze && opts.freeze > 0) {
      def.frozen = Math.max(def.frozen, opts.freeze);
      pushFloat(state, hit.x, hit.y - 28, "FROZEN", "#9ad8ff", 14);
    }

    if (opts.isFinisher) state.slowmo = 0.55;

    if (atk) {
      bumpCombo(state, atk.id);
      resetOpposingCombo(state, atk.id);
    }
  }

  finishKO(state, def, atk?.id ?? (def.id === 'player' ? 'enemy' : 'player'));
}

export function resolveCombat(state: GameState) {
  const now = state.time;
  for (const [atk, def] of [
    [state.player, state.enemy],
    [state.enemy, state.player],
  ] as const) {
    const hit = atk.attack ? checkHit(atk, def, now) : null;
    if (atk.attack && hit) {
      const a = atk.attack;
      const isMulti = (a as any).multiHit === true;
      if (!isMulti) a.hit = true;
      else (a as any).lastHitAt = now;

      const level = getComboLevel(a);
      const dmgBonus = (atk.berserk > 0 ? 1.3 : 1);
      applyDamage(state, atk, def, hit, a.damage * dmgBonus, a.knockback, a.knockUp, {
        level,
        hitstop: a.hitstop,
        isFinisher: a.isFinisher,
        sound: a.isAbility ? "ability" : (a.kind === "kick" ? "kick" : "punch"),
      });
      // Heavy stun: extra hitstun + frozen state on full-charge heavies that flag stunOnFullCharge
      if ((a as any).isHeavy && (a as any).heavyStun && def.hp > 0) {
        def.frozen = Math.max(def.frozen, 0.45);
        def.hitstun = Math.max(def.hitstun, 0.5);
      }
    }
  }
}

// Burst of explosion ring + colored sparks at impact location, scaled to dmg
function projectileImpactFx(state: GameState, x: number, y: number, color: string, damage: number, ability?: MoveVFX['ability'],element?:0|1|2) {
  impact(state, x, y, 1, damage > 20 ? 4 : 2, color,ability,element);

}

export function resolveProjectiles(state: GameState) {
  const now = state.time;
  for (const p of state.projectiles) {
    if (p.hit) continue;
    if (p.delay && now - p.born < p.delay) continue;
    // Targets: opponents only
    // Recalling axes don't damage their own owner; otherwise damage opposing fighter only
    const targets: Fighter[] = [p.owner === "player" ? state.enemy : state.player];
    for (const t of targets) {
      if (t.hp <= 0) continue;
      const px = p.prevX ?? p.x, py = p.prevY ?? p.y;
      const sx = p.x - px, sy = p.y - py;
      const lengthSq = sx * sx + sy * sy;
      const along = lengthSq ? Math.max(0, Math.min(1, ((t.x-px)*sx+(t.y+70-py)*sy)/lengthSq)) : 0;
      const dx = px + sx * along - t.x;
      const dy = py + sy * along - (t.y + 70);
      if (Math.hypot(dx, dy) < p.radius + 36) {
        // Fish and hooks have their own authoritative item/grab rules.
        if (p.kind === 'hook') { catchHook(state, p, t); p.hit = true; break; }
        if (p.kind === 'fish' && p.fish) {
          fishHit(state, p.owner === 'player' ? state.player : state.enemy, t, p.fish, p.vx >= 0 ? 1 : -1);
          p.hit = true; break;
        }
        // hit
        if (p.explodeRadius) {
          // spawn AOE burst
          state.aoeZones.push({
            id: Math.floor(Math.random() * 1e9),
            x: p.x, y: 0, radius: p.explodeRadius, born: now,
            life: 0.22, max: 0.22, delay: 0,
            damage: p.damage, knock: p.knock, knockUp: p.knockUp,
            owner: p.owner, hit: new Set(), color: p.color, kind: "fire", visualAbility:p.visualAbility,visualElement:p.visualElement,
          });
          projectileImpactFx(state, p.x, p.y, p.color, p.damage * 1.3,p.visualAbility,p.visualElement);
        } else {
          applyDamage(state, p.owner === 'player' ? state.player : state.enemy, t, { x: p.x, y: p.y }, p.damage, p.knock, p.knockUp, {
            canCounter: false,
            dirOverride: p.vx >= 0 ? 1 : -1,
            level: 2,
            freeze: p.freeze,
            sound: "ability",
          });
          projectileImpactFx(state, p.x, p.y, p.color, p.damage,p.visualAbility,p.visualElement);
        }
        p.hit = true;
        break;
      }
    }
    // Hit ground for explosive projectiles
    if (p.kind === 'fish' && p.y <= 0) p.hit = true;
    if (!p.hit && p.y <= 0 && p.explodeRadius) {
      state.aoeZones.push({
        id: Math.floor(Math.random() * 1e9),
        x: p.x, y: 0, radius: p.explodeRadius, born: now,
        life: 0.22, max: 0.22, delay: 0,
        damage: p.damage, knock: p.knock, knockUp: p.knockUp,
        owner: p.owner, hit: new Set(), color: p.color, kind: "fire", visualAbility:p.visualAbility,visualElement:p.visualElement,
      });
      projectileImpactFx(state, p.x, 0, p.color, p.damage,p.visualAbility,p.visualElement);
      p.hit = true;
    }
  }
}

export function resolveAOE(state: GameState) {
  const now = state.time;
  for (const z of state.aoeZones) {
    const t = now - z.born;
    if (t < z.delay) continue;
    if (t > z.delay + z.life) continue;
    // damage when active and not yet hit per-target
    const targets: Fighter[] = [state.player, state.enemy].filter(f => f.id !== z.owner) as Fighter[];
    for (const f of targets) {
      if (z.hit.has(f.id)) continue;
      if (f.hp <= 0) continue;
      const dx = f.x - z.x;
      if (Math.abs(dx) < z.radius && Math.abs(f.y - z.y) < (z.kind === 'sea' ? 150 : 200)) {
        const dir = dx >= 0 ? 1 : -1;
        applyDamage(state, z.owner === 'player' ? state.player : state.enemy, f, { x: f.x, y: f.y + 60 }, z.damage, z.knock, z.knockUp, {
          canCounter: false,
          canBlock: false,
          dirOverride: dir,
          level: z.kind === 'sea' ? 4 : 3,
          hitstop: z.kind === 'sea' ? .22 : undefined,
          isFinisher: z.kind === 'sea',
          sound: z.kind === 'sea' ? 'finisher' : 'ability',
        });
        z.hit.add(f.id);
      }
    }
  }
}

export function stepFighter(f: Fighter, input: InputState | null, state: GameState, dt: number, now: number) {
  if (input?.attack) f.attackBufferUntil = now + 0.16;
  const attackRequested = !!input && f.attackBufferUntil > now;
  if (f.hitstun > 0) f.hitstun = Math.max(0, f.hitstun - dt);
  if (f.blockstun > 0) f.blockstun = Math.max(0, f.blockstun - dt);
  if (f.flashTime > 0) f.flashTime -= dt;
  if (f.ragdoll > 0) f.ragdoll = Math.max(0, f.ragdoll - dt * 1.5);
  if (f.dashCooldown > 0) f.dashCooldown = Math.max(0, f.dashCooldown - dt);
  if (f.dashTime > 0) f.dashTime = Math.max(0, f.dashTime - dt);
  if (f.armorTime > 0) f.armorTime = Math.max(0, f.armorTime - dt);
  if (f.invisible > 0) f.invisible = Math.max(0, f.invisible - dt);
  if (f.frozen > 0) f.frozen = Math.max(0, f.frozen - dt);
  if (f.rage > 0) f.rage = Math.max(0, f.rage - dt);
  if (f.berserk > 0) f.berserk = Math.max(0, f.berserk - dt);
  if (f.counterStance > 0) f.counterStance = Math.max(0, f.counterStance - dt);
  if (f.heavyCooldown > 0) f.heavyCooldown = Math.max(0, f.heavyCooldown - dt);
  // Stagger decay & state timers
  if (f.staggered > 0) f.staggered = Math.max(0, f.staggered - dt);
  if (f.staggerVulnerable > 0) f.staggerVulnerable = Math.max(0, f.staggerVulnerable - dt);
  if (f.staggerImmune > 0) f.staggerImmune = Math.max(0, f.staggerImmune - dt);
  if (f.staggerDecayDelay > 0) {
    f.staggerDecayDelay = Math.max(0, f.staggerDecayDelay - dt);
  } else if (f.stagger > 0) {
    // Decay ~ 30% of bar per second when not under pressure
    f.stagger = Math.max(0, f.stagger - f.maxStagger * 0.3 * dt);
  }
  // Stun resistance decay — reset combo-pressure tracking after window of no hits
  if (f.consecutiveHitsTimer > 0) {
    f.consecutiveHitsTimer = Math.max(0, f.consecutiveHitsTimer - dt);
    if (f.consecutiveHitsTimer === 0) {
      f.consecutiveHits = 0;
      f.stunResist = 0;
    }
  }
  // Successful block while in hitstun acts as combo break — clear stun
  if (input && input.block && f.hitstun > 0 && f.hitstun < 0.18) {
    f.hitstun = 0;
    f.blockstun = 0.05;
    f.stunResist = Math.max(f.stunResist, 0.5);
    f.consecutiveHits = 0;
  }

  // Ability cooldown decay + ready-flash
  for (let i = 0; i < 4; i++) {
    if (f.cooldowns[i] > 0) {
      const next = Math.max(0, f.cooldowns[i] - dt);
      if (next === 0 && f.cooldowns[i] > 0) f.cooldownReadyFlash[i] = 0.4;
      f.cooldowns[i] = next;
    }
    if (f.cooldownReadyFlash[i] > 0) f.cooldownReadyFlash[i] = Math.max(0, f.cooldownReadyFlash[i] - dt);
  }

  // Boss phase escalation
  if (f.isBoss) {
    const ratio = f.hp / f.maxHp;
    if (ratio < 0.5 && f.bossPhase < 2) { f.bossPhase = 2; f.rage = Math.max(f.rage, 4); f.flashTime = 0.3; }
    if (ratio < 0.2 && f.bossPhase < 3) { f.bossPhase = 3; f.berserk = Math.max(f.berserk, 5); f.flashTime = 0.4; }
  }

  // End attack
  if (f.attack && attackDone(f.attack, now)) f.attack = null;
  // Combo timer decay
  if (f.comboTimer > 0) {
    f.comboTimer = Math.max(0, f.comboTimer - dt);
    if (f.comboTimer === 0) f.comboIdx = -1;
  }

  const canAct = f.hitstun <= 0 && f.blockstun <= 0 && f.frozen <= 0 && f.staggered <= 0 && !f.grabbedBy && (!f.attack || attackDone(f.attack, now));

  // Block
  f.blocking = !!(input && input.block && f.onGround && canAct && f.dashTime <= 0);

  if (input && canAct && !f.blocking) {
    let dirInput = 0;
    if (input.left) dirInput -= 1;
    if (input.right) dirInput += 1;

    let moveSpeed = BASE_MOVE_SPEED * f.klass.speedMul * (f.berserk > 0 ? 1.15 : 1);
    if (f.heavyCharging) moveSpeed *= 0.45;
    if (f.dashTime > 0) {
      // velocity locked
    } else if (dirInput !== 0) {
      f.vx = dirInput * moveSpeed;
      if (!f.attack) f.facing = dirInput > 0 ? 1 : -1;
    } else if (f.onGround) {
      f.vx *= Math.pow(FRICTION, dt * 60);
      if (Math.abs(f.vx) < 5) f.vx = 0;
    }

    if (input.jump && f.onGround) {
      f.vy = JUMP_VEL;
      f.onGround = false;
      sfx.jump();
    }
    if (input.dash && f.onGround && f.dashCooldown <= 0 && f.dashTime <= 0) {
      const dd = dirInput !== 0 ? dirInput : f.facing;
      f.vx = dd * DASH_SPEED;
      f.facing = dd > 0 ? 1 : -1;
      f.dashTime = DASH_TIME;
      f.dashCooldown = DASH_COOLDOWN;
      f.armorTime = Math.max(f.armorTime, 0.12);
      f.trailUntil = now + DASH_TIME + 0.05;
      sfx.dash();
    }
    if (input.pickup) pickupFish(f, state);
    // Ability slots
    for (let i = 0; i < 4; i++) {
      if (input.abilities[i]) {
        startAbility(f, i, state, now);
        break;
      }
    }
    // Heavy attack (M2): held to charge, released to fire.
    if (input.heavyHeld) {
      if (!f.heavyCharging && f.heavyCooldown <= 0 && !f.attack) {
        f.heavyCharging = true;
        f.heavyChargeStart = now;
      }
    }
    if (input.heavyReleased && f.heavyCharging) {
      const charge = now - f.heavyChargeStart;
      f.heavyCharging = false;
      startHeavyAttack(f, charge, state, now);
    } else if (f.heavyCharging && (now - f.heavyChargeStart) > MAX_HEAVY_CHARGE + 0.05 && !input.heavyHeld) {
      // safety: if no release event arrived, auto-fire at max
      f.heavyCharging = false;
      startHeavyAttack(f, MAX_HEAVY_CHARGE, state, now);
    }
    if (attackRequested && !f.attack) {
      const next = f.comboTimer > 0 ? Math.min(3, f.comboIdx + 1) : 0;
      if (!throwFish(f, state, now)) startComboStep(f, next, now);
      f.comboIdx = next;
      f.attackBufferUntil = 0;
    }
  }

  // Combo chain mid-attack
  if (input && f.attack && !f.attack.isAbility && attackRequested && canChain(f, now)) {
    const nextIdx = f.attack.stepIdx + 1;
    if (nextIdx < COMBO_CHAIN.length) {
      startComboStep(f, nextIdx, now);
      f.comboIdx = nextIdx;
      f.attackBufferUntil = 0;
    }
  }

  if (f.grabbedBy) { f.vx = 0; f.vy = 0; }
  // Gravity
  if (!f.onGround) f.vy -= GRAVITY * dt;
  // Integrate
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  // Ground
  if (f.y <= 0) { f.y = 0; f.vy = 0; f.onGround = true; }
  // Walls
  const margin = 50;
  if (f.x < margin) { f.x = margin; if (f.vx < 0) f.vx = 0; }
  if (f.x > ARENA_W - margin) { f.x = ARENA_W - margin; if (f.vx > 0) f.vx = 0; }

  // Walk phase
  const moving = f.onGround && Math.abs(f.vx) > 30 && !f.attack && f.hitstun <= 0;
  f.moveBlend += ((moving ? 1 : 0) - f.moveBlend) * (1 - Math.exp(-dt * 16));
  if (moving) {
    f.walkPhase += Math.abs(f.vx) * dt * 0.022;
  } else {
    f.walkPhase *= Math.pow(0.9, dt * 60);
  }
}

function comboTimerSet(f: Fighter) {
  if (f.attack && f.attack.hit && !f.attack.isAbility) {
    f.comboTimer = COMBO_CHAIN_TIMEOUT;
  }
}

export function stepAI(state: GameState, dt: number, now: number): InputState {
  const enemy = state.enemy;
  const player = state.player;
  const ai = state.ai;
  ai.decisionTimer -= dt;
  const dx = player.x - enemy.x;
  const dist = Math.abs(dx);
  const dir = dx > 0 ? 1 : -1;

  if (!enemy.attack) enemy.facing = dir as 1 | -1;

  const input = emptyInput();
  if (enemy.frozen > 0) return input;

  // Find any ready ability
  const readySlot = enemy.cooldowns.findIndex(c => c <= 0);
  const hasReady = readySlot >= 0;

  // Reactive block
  const playerThreat =
    player.attack && !player.attack.hit &&
    dist < 160 &&
    (player.x < enemy.x ? player.facing === 1 : player.facing === -1);

  // Heavy charge reaction: dodge away or block
  if (player.heavyCharging && dist < 260 && enemy.dashCooldown <= 0 && Math.random() < 0.6) {
    input.dash = true;
    if (dir > 0) input.left = true; else input.right = true;
    ai.decisionTimer = 0.3;
    return input;
  }
  if (player.heavyCharging && dist < 200 && Math.random() < 0.55) {
    input.block = true;
    ai.blockReleaseAt = now + 0.4;
    return input;
  }
  // Punish missed heavy: if player just released heavy and missed (in recovery), close in & attack
  if (player.attack && (player.attack as any).isHeavy && (now - player.attack.startTime) > player.attack.activeEnd && !player.attack.hit && dist < 220) {
    if (dir > 0) input.right = true; else input.left = true;
    if (dist < 130) input.attack = true;
    return input;
  }

  if (playerThreat && Math.random() < 0.5 && !enemy.isBoss) {
    if (enemy.dashCooldown <= 0 && Math.random() < 0.3) {
      input.dash = true;
      if (dir > 0) input.left = true; else input.right = true;
      ai.decisionTimer = 0.3;
      return input;
    }
    input.block = true;
    ai.blockReleaseAt = now + 0.25;
    return input;
  }

  if (now < ai.blockReleaseAt) { input.block = true; return input; }

  // Continue ongoing combo
  if (enemy.attack && enemy.attack.hit && !enemy.attack.isAbility && ai.comboDone < ai.comboTarget) {
    if (canChain(enemy, now)) { input.attack = true; ai.comboDone += 1; }
    if (dir > 0) input.right = true; else input.left = true;
    return input;
  }

  if (ai.decisionTimer <= 0) {
    ai.decisionTimer = 0.22 + Math.random() * 0.4;
    const r = Math.random();
    // Boss and ranged classes use abilities more often
    const abilityBias = enemy.isBoss ? 0.45 : (enemy.klass.category === "ranged" || enemy.klass.category === "mage" ? 0.55 : 0.25);
    if (hasReady && r < abilityBias) {
      ai.nextAction = "ability";
    } else if (dist > 280) {
      ai.nextAction = r < 0.6 ? "approach" : r < 0.85 ? "dash" : "jump";
    } else if (dist > 140) {
      ai.nextAction = r < 0.45 ? "approach" : r < 0.7 ? "attack" : r < 0.85 ? "dash" : "jump";
    } else {
      if (r < 0.55) ai.nextAction = "attack";
      else if (r < 0.72) ai.nextAction = "block";
      else if (r < 0.88) ai.nextAction = "retreat";
      else ai.nextAction = "jump";
    }
    if (ai.nextAction === "attack") {
      ai.comboTarget = 1 + Math.floor(Math.random() * 4);
      ai.comboDone = 0;
    }
  }

  switch (ai.nextAction) {
    case "approach":
      if (dir > 0) input.right = true; else input.left = true;
      break;
    case "retreat":
      if (dir > 0) input.left = true; else input.right = true;
      break;
    case "jump":
      input.jump = true;
      if (dir > 0) input.right = true; else input.left = true;
      ai.nextAction = "approach";
      break;
    case "dash":
      if (enemy.dashCooldown <= 0) {
        input.dash = true;
        if (dir > 0) input.right = true; else input.left = true;
      }
      ai.nextAction = "approach";
      break;
    case "block":
      input.block = true;
      ai.blockReleaseAt = now + 0.3;
      break;
    case "ability": {
      // Pick a ready ability (round-robin biased)
      let slot = -1;
      for (let i = 0; i < 4; i++) {
        const s = (ai.abilityCycle + i) % 4;
        if (enemy.cooldowns[s] <= 0) { slot = s; break; }
      }
      if (slot >= 0) {
        ai.abilityCycle = (slot + 1) % 4;
        input.abilities[slot] = true;
      }
      ai.nextAction = "approach";
      break;
    }
    case "attack":
      if (dist < 130 && !enemy.attack && enemy.hitstun <= 0) {
        input.attack = true;
        ai.comboDone += 1;
      } else {
        if (dir > 0) input.right = true; else input.left = true;
      }
      break;
  }

  return input;
}

function pushTrail(f: Fighter, now: number) {
  // Equipped trail cosmetic: keep emitting samples whenever the fighter is moving,
  // not only during dashes/attacks. This makes the cosmetic visible in normal play.
  if (f.equipped?.trail && (Math.abs(f.vx) > 40 || !f.onGround)) {
    f.trailUntil = Math.max(f.trailUntil, now + 0.05);
  }
  if (now > f.trailUntil) {
    if (f.trail.length === 0) return;
    f.trail = f.trail.filter((t) => now - t.born < 0.25);
    return;
  }
  const last = f.trail[f.trail.length - 1];
  if (!last || now - last.born > 0.018) {
    let pose: TrailSample["pose"] = "dash";
    if (f.attack) pose = f.attack.kind === "punch" ? "punch" : "kick";
    f.trail.push({ x: f.x, y: f.y, facing: f.facing, born: now, pose });
  }
  f.trail = f.trail.filter((t) => now - t.born < 0.2);
}

const BLADE_WEAPONS = new Set(["katana", "kunai", "shadowBlade"]);
function pushSlashTrail(f: Fighter, now: number) {
  // Only capture during slash attacks for fighters with bladed weapons (or katana/kunai/shadow blade).
  // For ninja, only when kunai is the active weapon (not fists).
  const w = f.weapon;
  if (!w) return;
  // Ninja toggle: if alt weapon (fists) is selected, no slash trail
  if (f.altWeaponSelected) return;
  if (!BLADE_WEAPONS.has(w)) return;
  const a = f.attack;
  if (!a || a.kind !== "slash") {
    if (f.slashTrail.length > 0) {
      f.slashTrail = f.slashTrail.filter(s => now - s.born < 0.18);
    }
    return;
  }
  const j = computeJoints(f, now);
  // Use lead hand world position; tip extends along facing
  const handX = f.x + j.handR[0];
  const handY = j.handR[1];
  // Blade tip ~36px past hand in facing direction
  const tipX = handX + f.facing * 36;
  const tipY = handY + 6;
  const last = f.slashTrail[f.slashTrail.length - 1];
  if (!last || now - last.born > 0.012) {
    f.slashTrail.push({
      x: tipX, y: tipY,
      innerX: handX, innerY: handY,
      born: now,
      color: f.klass.color,
    });
  }
  f.slashTrail = f.slashTrail.filter(s => now - s.born < 0.22);
}

export function updateGame(state: GameState, input: InputState, dt: number, opponentInput?: InputState) {
  dt = Math.max(0, Math.min(0.05, dt));
  if (state.hitPause > 0) {
    state.hitPause = Math.max(0, state.hitPause - dt);
    updatePresentation(state, dt, false);
    if (state.shakeT > 0) { state.shakeT -= dt; if (state.shakeT <= 0) state.shake = 0; }
    if (state.flashScreen > 0) state.flashScreen -= dt * 4;
    return;
  }

  let scale = 1;
  if (state.slowmo > 0) { state.slowmo -= dt; scale = 0.32; }
  state.globalTimeScale = scale;
  const realDt = dt * scale;
  state.time += realDt;

  if (state.playerComboTimer > 0) {
    state.playerComboTimer -= realDt;
    if (state.playerComboTimer <= 0) state.playerCombo = 0;
  }
  if (state.enemyComboTimer > 0) {
    state.enemyComboTimer -= realDt;
    if (state.enemyComboTimer <= 0) state.enemyCombo = 0;
  }

  if (state.winner) {
    stepFighter(state.player, null, state, realDt, state.time);
    stepFighter(state.enemy, null, state, realDt, state.time);
  } else {
    stepFighter(state.player, input, state, realDt, state.time);
    const aiInput = opponentInput ?? stepAI(state, realDt, state.time);
    stepFighter(state.enemy, aiInput, state, realDt, state.time);
  }

  pushTrail(state.player, state.time);
  pushTrail(state.enemy, state.time);
  pushSlashTrail(state.player, state.time);
  pushSlashTrail(state.enemy, state.time);

  stepFishing(state, realDt);

  // Soft fighter collision
  const dx = state.enemy.x - state.player.x;
  const minDist = state.enemy.isBoss ? 70 : 52;
  if (Math.abs(dx) < minDist && Math.abs(state.player.y - state.enemy.y) < 100) {
    const push = (minDist - Math.abs(dx)) * 0.5;
    const sign = dx >= 0 ? 1 : -1;
    state.enemy.x += sign * push * 0.5;
    state.player.x -= sign * push * 0.5;
  }

  resolveCombat(state);

  // Projectiles
  for (const p of state.projectiles) {
    if (p.hit) continue;
    if (p.delay && state.time - p.born < p.delay) continue;
    p.prevX = p.x; p.prevY = p.y;
    p.x += p.vx * realDt;
    p.y += p.vy * realDt;
    p.vy -= p.gravity * realDt;
    p.vx *= Math.pow(0.999, realDt * 60);
    p.life -= realDt;
  }
  resolveProjectiles(state);
  // Axe recall return: when a recalling axe reaches its owner, mark caught.
  for (const p of state.projectiles) {
    if (p.hit) continue;
    if (p.kind !== "axe") continue;
    const owner = p.owner === "player" ? state.player : state.enemy;
    if ((p as any).recalling) {
      const dx = owner.x - p.x;
      const dy = (owner.y + 70) - p.y;
      if (Math.hypot(dx, dy) < 36) {
        p.hit = true;
        owner.axeOut = false;
        owner.flashTime = Math.max(owner.flashTime, 0.12);
      }
    }
  }
  // Axes that expire / leave arena release the axeOut lock too
  for (const p of state.projectiles) {
    if (p.kind !== "axe") continue;
    const expiring = p.life <= 0 || p.x < -200 || p.x > ARENA_W + 200 || p.y < -200 || p.hit;
    if (expiring) {
      const owner = p.owner === "player" ? state.player : state.enemy;
      if (owner.axeOut) owner.axeOut = false;
    }
  }
  state.projectiles = state.projectiles.filter(p => !p.hit && p.life > 0 && p.x > -200 && p.x < ARENA_W + 200 && p.y > -200);

  // AOE zones
  resolveAOE(state);
  state.aoeZones = state.aoeZones.filter(z => state.time - z.born < z.delay + z.life + 0.2);

  comboTimerSet(state.player);
  comboTimerSet(state.enemy);

  for (const p of state.particles) {
    p.life -= realDt;
    p.x += p.vx * realDt;
    p.y += p.vy * realDt;
    p.vy -= 600 * realDt;
    p.vx *= Math.pow(0.96, realDt * 60);
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  state.moveVfx = state.moveVfx?.filter(v => state.time - v.born < v.duration);

  for (const f of state.floats) {
    f.life -= realDt;
    f.y += -f.vy * realDt;
    f.vy *= Math.pow(0.96, realDt * 60);
  }
  state.floats = state.floats.filter((f) => f.life > 0);

  if (state.shakeT > 0) { state.shakeT -= realDt; if (state.shakeT <= 0) state.shake = 0; }
  if (state.flashScreen > 0) state.flashScreen -= realDt * 4;
  // Legacy emitters remain compatible, but have a fixed visual budget.
  const legacyBudget = state.settings?.quality === 'low' ? 80 : 200;
  if (state.particles.length > legacyBudget) state.particles.splice(0, state.particles.length - legacyBudget);
  updatePresentation(state, realDt);
}
