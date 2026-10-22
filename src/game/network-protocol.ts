import type { ClassId } from './classes';
import { CLASSES } from './classes';
import type { GameState, InputState, ArenaId, Projectile, AOEZone } from './engine';
import { makeAI, emptyInput } from './engine';
import { makeFighter, type Fighter } from './types';
import type { MoveVFX } from './vfx-types';
export const PROTOCOL_VERSION = 1;
export const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;
export function normalizeCode(value: string) { return value.trim().toUpperCase(); }
export type Side = 'player' | 'enemy';
export type RoomPhase = 'lobby' | 'countdown' | 'fight' | 'results';
export interface LobbyPlayer { sessionId: string; side: Side; classId: ClassId; ready: boolean; connected: boolean; rematch: boolean }
export interface Lobby { code: string; host: string; arena: ArenaId; phase: RoomPhase; players: LobbyPlayer[]; countdown: number; matchId: number; note: string }
export type CombatEvent = { id: number; type: 'impact'; x: number; y: number; dir: number; level: number; color: string; ability: string; element?: 0|1|2 }
  | { id: number; type: 'cast'; move: MoveVFX; ultimate: boolean };
export type WireFighter = Omit<Fighter, 'klass'|'equipped'|'trail'|'slashTrail'>;
export interface WireState {
  player: WireFighter; enemy: WireFighter; time: number; hitPause: number; shake: number; shakeT: number; flashScreen: number;
  projectiles: Projectile[]; aoeZones: (Omit<AOEZone,'hit'> & {hit: Side[]})[];
  droppedFish: NonNullable<GameState['droppedFish']>; moveVfx: MoveVFX[]; winner: Side|null; winTime: number;
  playerCombo: number; enemyCombo: number; playerComboTimer: number; enemyComboTimer: number; globalTimeScale: number; arena: ArenaId;
}
export interface MatchSnapshot { matchId: number; seq: number; at: number; ack: [number,number]; state: WireState; events: CombatEvent[] }
export function createMatch(player: ClassId, enemy: ClassId, arena: ArenaId = 'dojo'): GameState {
  return { player: makeFighter('player', player, 360, 1), enemy: makeFighter('enemy', enemy, 840, -1),
    ai: makeAI(), time: 0, hitPause: 0, shake: 0, shakeT: 0, flashScreen: 0, particles: [], projectiles: [], aoeZones: [], floats: [],
    winner: null, winTime: 0, playerCombo: 0, enemyCombo: 0, playerComboTimer: 0, enemyComboTimer: 0,
    slowmo: 0, globalTimeScale: 1, arena, bossMode: false, online: true, droppedFish: [], moveVfx: [] };
}
export function toWire(s: GameState): WireState {
  const fighter = (f: Fighter): WireFighter => { const { klass, equipped, trail, slashTrail, ...data } = f; return data; };
  return { player: fighter(s.player), enemy: fighter(s.enemy), time: s.time, hitPause: s.hitPause, shake: s.shake, shakeT: s.shakeT,
    flashScreen: s.flashScreen, projectiles: s.projectiles, aoeZones: s.aoeZones.map(z => ({...z, hit: [...z.hit]})),
    droppedFish: s.droppedFish ?? [], moveVfx: s.moveVfx ?? [], winner: s.winner, winTime: s.winTime,
    playerCombo: s.playerCombo, enemyCombo: s.enemyCombo, playerComboTimer: s.playerComboTimer, enemyComboTimer: s.enemyComboTimer,
    globalTimeScale: s.globalTimeScale, arena: s.arena };
}
export function fromWire(w: WireState): GameState {
  // Render interpolation and movement prediction must never edit an authoritative sample.
  w = structuredClone(w);
  const state = createMatch(w.player.classId as ClassId, w.enemy.classId as ClassId, w.arena);
  Object.assign(state, w, { aoeZones: w.aoeZones.map(z => ({...z, hit: new Set(z.hit)})),
    player: {...state.player, ...w.player, klass: CLASSES[w.player.classId as ClassId]},
    enemy: {...state.enemy, ...w.enemy, klass: CLASSES[w.enemy.classId as ClassId]} });
  return state;
}
const scalarKeys = ['left','right','jump','attack','dash','block','heavyHeld','heavyReleased','pickup'] as const;
export function validInput(value: unknown): InputState|null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string,unknown>;
  if (Object.keys(data).some(k => !scalarKeys.includes(k as typeof scalarKeys[number]) && k !== 'abilities')) return null;
  if (!Array.isArray(data.abilities) || data.abilities.length !== 4 || data.abilities.some(x => typeof x !== 'boolean')) return null;
  if (scalarKeys.some(k => data[k] !== undefined && typeof data[k] !== 'boolean')) return null;
  if (scalarKeys.slice(0,-1).some(k => data[k] === undefined)) return null;
  return {...emptyInput(), ...data} as InputState;
}
export function clearEdges(input: InputState) {
  input.attack = input.jump = input.dash = input.heavyReleased = input.pickup = false; input.abilities.fill(false);
}
