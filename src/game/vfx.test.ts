import { describe, it, expect } from 'vitest';
import { ALL_FIGHTERS, type FighterId } from './classes';
import { makeFighter } from './types';
import { makeAI, emptyInput, updateGame, type GameState } from './engine';
import { startAbility, startHeavyAttack } from './abilities';

function match(id: FighterId): GameState {
  return { player: makeFighter('player', id, 480, 1), enemy: makeFighter('enemy', 'viking', 575, -1), ai: makeAI(), time: 0, hitPause: 0, shake: 0, shakeT: 0, particles: [], projectiles: [], aoeZones: [], floats: [], winner: null, winTime: 0, flashScreen: 0, playerCombo: 0, playerComboTimer: 0, enemyCombo: 0, enemyComboTimer: 0, slowmo: 0, globalTimeScale: 1, arena: 'dojo', bossMode: false };
}
describe('accepted moves carry presentation data without losing combat state', () => {
  for (const id of Object.keys(ALL_FIGHTERS) as FighterId[]) {
    it(`${id}: records all four casts and charged release`, () => {
      for (let element = 0; element < (id === 'elementalist' ? 3 : 1); element++) {
        for (let slot = 0; slot < 5; slot++) {
          const s = match(id);
          s.player.element = element as 0 | 1 | 2;
          const accepted = slot === 4 ? startHeavyAttack(s.player, 1, s, 0) : startAbility(s.player, slot, s, 0);
          expect(accepted).toBe(true);
          expect(s.moveVfx?.[0]?.ability).toBe(slot === 4 ? 'heavy' : s.player.klass.abilities[slot].id);
          expect(s.moveVfx?.[0]?.element).toBe(element);
          if (slot < 4) expect(s.player.cooldowns[slot]).toBe(s.player.klass.abilities[slot].cooldown);
          for (let frame = 0; frame < 600; frame++) {
            s.enemy.hp = s.enemy.maxHp;
            s.player.hp = s.player.maxHp;
            s.ai.decisionTimer = 100;
            updateGame(s, emptyInput(), 1 / 60);
          }
          expect(Number.isFinite(s.player.x)).toBe(true);
          expect(s.moveVfx).toHaveLength(0);
        }
      }
    });
  }
});
