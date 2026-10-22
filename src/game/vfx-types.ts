import type { AbilityId } from './classes';

export interface MoveVFX {
  fish?: import('./fishing').FishKind;
  ability: AbilityId | 'light' | 'heavy' | 'dash';
  owner: 'player' | 'enemy';
  born: number;
  duration: number;
  x: number;
  y: number;
  endX: number;
  endY: number;
  facing: 1 | -1;
  element: 0 | 1 | 2;
  charge: number;
  activeStart?: number;
  activeEnd?: number;
  reach?: number;
  castX?: number;
  castY?: number;
}
