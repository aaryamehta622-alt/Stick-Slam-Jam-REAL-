import { ClassDef, FighterId, ALL_FIGHTERS, AbilityId } from "./classes";
import type { WeaponId } from "./classes";
import type { Cosmetic } from "./rewards";

export type AttackKind = "punch" | "kick" | "slash" | "magic";

export interface ComboStep {
  kind: AttackKind;
  duration: number;
  activeStart: number;
  activeEnd: number;
  recoveryUntil: number;
  cancelWindow: number;
  damage: number;
  knockback: number;
  knockUp: number;
  reach: number;
  hitstop: number;
  isFinisher?: boolean;
}

// 4-hit chain: jab -> cross -> body kick -> launching kick
export const COMBO_CHAIN: ComboStep[] = [
  { kind: "punch", duration: 0.20, activeStart: 0.04, activeEnd: 0.10, recoveryUntil: 0.13, cancelWindow: 0.18, damage: 5,  knockback: 70,  knockUp: 0,   reach: 70,  hitstop: 0.03 },
  { kind: "punch", duration: 0.24, activeStart: 0.06, activeEnd: 0.13, recoveryUntil: 0.17, cancelWindow: 0.22, damage: 7,  knockback: 110, knockUp: 20,  reach: 78,  hitstop: 0.05 },
  { kind: "kick",  duration: 0.32, activeStart: 0.10, activeEnd: 0.18, recoveryUntil: 0.24, cancelWindow: 0.30, damage: 11, knockback: 200, knockUp: 70,  reach: 92,  hitstop: 0.07 },
  { kind: "kick",  duration: 0.44, activeStart: 0.14, activeEnd: 0.24, recoveryUntil: 0.36, cancelWindow: 0.44, damage: 18, knockback: 460, knockUp: 340, reach: 105, hitstop: 0.14, isFinisher: true },
];

export interface ActiveAttack {
  stepIdx: number; // -1 for ability
  startTime: number;
  duration: number;
  activeStart: number;
  activeEnd: number;
  recoveryUntil: number;
  cancelWindow: number;
  damage: number;
  knockback: number;
  knockUp: number;
  reach: number;
  hitstop: number;
  kind: AttackKind;
  hit: boolean;
  isFinisher?: boolean;
  isAbility?: boolean;
  abilityId?: AbilityId;
  hitWidth?: number;  // custom hitbox width for AOE
  hitHeight?: number;
}

import type { FishKind, FishingAction, FishPoison } from './fishing';
export interface Fighter {
  fishing?: FishingAction;
  heldFish?: FishKind;
  grabbedBy?: 'player' | 'enemy';
  poison?: FishPoison;
  id: "player" | "enemy";
  classId: FighterId;
  klass: ClassDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  onGround: boolean;
  attack: ActiveAttack | null;
  comboIdx: number;
  comboTimer: number;
  attackBufferUntil: number;
  hitstun: number;
  blockstun: number;
  flashTime: number;
  ragdoll: number;
  walkPhase: number;
  moveBlend: number;
  dashTime: number;
  dashCooldown: number;
  blocking: boolean;
  // 4-slot ability cooldowns
  cooldowns: [number, number, number, number];
  cooldownReadyFlash: [number, number, number, number]; // visual flash when becoming ready
  armorTime: number;
  trail: TrailSample[];
  trailUntil: number;
  // Status
  invisible: number;       // seconds remaining
  frozen: number;          // can't act
  rage: number;            // damage buff timer
  berserk: number;         // unstoppable timer
  counterStance: number;   // window where any incoming melee gets reflected
  // Weapon state
  weapon: WeaponId | null;        // currently held weapon (null = no weapon visible)
  altWeaponSelected: boolean;     // toggle for alt weapon (e.g. ninja fists)
  axeOut: boolean;                // viking axe currently thrown / detached
  slashTrail: SlashSample[];      // arc trail samples for slash attacks
  // Heavy (M2) charge state
  heavyCharging: boolean;         // currently holding charge
  heavyChargeStart: number;       // time when charge began
  heavyCooldown: number;          // post-heavy cooldown
  // Stun resistance / anti-lock
  consecutiveHits: number;        // hits taken in rapid succession
  consecutiveHitsTimer: number;   // resets to 0 after window of no hits
  stunResist: number;             // 0..1 — scales down hitstun/ragdoll while > 0
  // Stagger system — hidden meter that fills with hits.
  // When full triggers a brief stun + damage vulnerability, then resistance.
  stagger: number;                 // 0..maxStagger
  maxStagger: number;
  staggerDecayDelay: number;       // seconds before stagger starts decaying
  staggered: number;               // > 0 = currently in stagger stun (vulnerable)
  staggerVulnerable: number;       // > 0 = takes bonus damage
  staggerImmune: number;           // > 0 = stagger meter ignored (post-stagger reset)
  // Elementalist current element index (0=fire, 1=ice, 2=lightning)
  element: 0 | 1 | 2;
  // Boss
  isBoss?: boolean;
  bossPhase: number;       // 1, 2, ... increases at low HP
  // Equipped cosmetics (resolved). Only set on the local player fighter.
  equipped?: {
    aura?: Cosmetic;
    trail?: Cosmetic;
    hitFx?: Cosmetic;
    skin?: Cosmetic;
  };
}

export interface TrailSample {
  x: number;
  y: number;
  facing: 1 | -1;
  born: number;
  pose: "punch" | "kick" | "dash";
}

// Sample for sword/blade arc trail — captured every frame during slash attacks
export interface SlashSample {
  x: number;        // world x of blade tip
  y: number;        // world y of blade tip
  innerX: number;   // hand pivot x
  innerY: number;   // hand pivot y
  born: number;
  color: string;
}

export const ARENA_W = 1200;
export const ARENA_H = 540;
export const GRAVITY = 2400;
export const JUMP_VEL = 820;
export const BASE_MOVE_SPEED = 380;
export const FRICTION = 0.74;
export const FIGHTER_HEIGHT = 130;
export const DASH_SPEED = 760;
export const DASH_TIME = 0.18;
export const DASH_COOLDOWN = 0.45;
export const COMBO_CHAIN_TIMEOUT = 0.6;

export function makeFighter(id: "player" | "enemy", classId: FighterId, x: number, facing: 1 | -1): Fighter {
  const klass = ALL_FIGHTERS[classId];
  return {
    id,
    classId,
    klass,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    hp: klass.hp,
    maxHp: klass.hp,
    onGround: true,
    attack: null,
    comboIdx: -1,
    comboTimer: 0,
    attackBufferUntil: 0,
    hitstun: 0,
    blockstun: 0,
    flashTime: 0,
    ragdoll: 0,
    walkPhase: 0,
    moveBlend: 0,
    dashTime: 0,
    dashCooldown: 0,
    blocking: false,
    cooldowns: [0, 0, 0, 0],
    cooldownReadyFlash: [0, 0, 0, 0],
    armorTime: 0,
    trail: [],
    trailUntil: 0,
    invisible: 0,
    frozen: 0,
    rage: 0,
    berserk: 0,
    counterStance: 0,
    weapon: klass.weapon ?? null,
    altWeaponSelected: false,
    axeOut: false,
    slashTrail: [],
    heavyCharging: false,
    heavyChargeStart: 0,
    heavyCooldown: 0,
    consecutiveHits: 0,
    consecutiveHitsTimer: 0,
    stunResist: 0,
    stagger: 0,
    maxStagger: klass.isBoss ? 220 : 100,
    staggerDecayDelay: 0,
    staggered: 0,
    staggerVulnerable: 0,
    staggerImmune: 0,
    element: 0,
    isBoss: klass.isBoss,
    bossPhase: 1,
  };
}

export function startComboStep(f: Fighter, idx: number, now: number) {
  const step = COMBO_CHAIN[idx];
  const speedMul = f.klass.comboSpeedMul;
  const dmgBuff = (f.rage > 0 ? 1.4 : 1) * (f.berserk > 0 ? 1.6 : 1);
  f.attack = {
    stepIdx: idx,
    startTime: now,
    duration: step.duration * speedMul,
    activeStart: step.activeStart * speedMul,
    activeEnd: step.activeEnd * speedMul,
    recoveryUntil: step.recoveryUntil * speedMul,
    cancelWindow: step.cancelWindow * speedMul,
    damage: step.damage * f.klass.damageMul * dmgBuff,
    knockback: step.knockback * f.klass.knockbackMul,
    knockUp: step.knockUp * f.klass.knockbackMul,
    reach: step.reach,
    hitstop: step.hitstop,
    kind: step.kind,
    hit: false,
    isFinisher: step.isFinisher,
  };
  if (f.berserk > 0) f.armorTime = Math.max(f.armorTime, f.attack.duration);
  f.vx += f.facing * 80;
  f.trailUntil = now + f.attack.duration;
}

export function attackElapsed(a: ActiveAttack, now: number) {
  return now - a.startTime;
}
export function attackActive(a: ActiveAttack, now: number) {
  const t = attackElapsed(a, now);
  return !a.hit && t >= a.activeStart && t <= a.activeEnd;
}
export function attackDone(a: ActiveAttack, now: number) {
  return attackElapsed(a, now) >= a.duration;
}
export function canChain(f: Fighter, now: number) {
  if (!f.attack || f.attack.isAbility) return false;
  const t = attackElapsed(f.attack, now);
  return f.attack.hit && t >= f.attack.activeEnd && t <= f.attack.cancelWindow;
}
