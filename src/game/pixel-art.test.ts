import { describe,it,expect,vi } from 'vitest';
import { ALL_FIGHTERS,type FighterId } from './classes';
import { makeFighter } from './types';
import { emptyInput,makeAI,type GameState } from './engine';
import { startAbility } from './abilities';
import { getAttackHitPoint } from './stick';
import { computeVisualJoints,drawPixelCharacters } from './pixel-art';
vi.mock('./sfx',()=>({sfx:new Proxy({},{get:()=>()=>{}})}));
function scene(id:FighterId):GameState {return {player:makeFighter('player',id,440,1),enemy:makeFighter('enemy','boxer',550,-1),ai:makeAI(),time:0,hitPause:0,shake:0,shakeT:0,particles:[],projectiles:[],aoeZones:[],floats:[],winner:null,winTime:0,flashScreen:0,playerCombo:0,playerComboTimer:0,enemyCombo:0,enemyComboTimer:0,slowmo:0,globalTimeScale:1,arena:'dojo',bossMode:false};}
describe('hybrid pixel rendering',()=>{
  it('samples all fighter poses without moving hit points or changing combat state',()=>{
    for(const id of Object.keys(ALL_FIGHTERS) as FighterId[])for(let slot=0;slot<4;slot++){
      const s=scene(id);startAbility(s.player,slot,s,0);s.player.y=77.25;s.player.walkPhase=2.7;
      for(const time of [.01,.08,.16,.3,.7]){const original=JSON.stringify(s),hit=getAttackHitPoint(s.player,time),j=computeVisualJoints(s.player,time);
        expect(Object.values(j).flat().every(Number.isFinite)).toBe(true);expect(JSON.stringify(s)).toBe(original);expect(getAttackHitPoint(s.player,time)).toEqual(hit);}
    }
  });
  it('keeps continuous jump position even while the local pose is snapped',()=>{
    const f=makeFighter('player','samurai',440,1);f.y=0;const ground=computeVisualJoints(f,0);f.y=77.25;const air=computeVisualJoints(f,0);
    for(const key of Object.keys(ground) as (keyof typeof ground)[])expect(air[key][1]-ground[key][1]).toBe(77.25);
  });
  it('isolates the actor resolution and nearest-neighbor composite from effects quality',()=>{
    const paint=vi.fn(),draws:unknown[][]=[],nearest:boolean[]=[];
    const context={setTransform:vi.fn(),clearRect:vi.fn()} as unknown as CanvasRenderingContext2D;
    const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
    const out={save:vi.fn(),restore:vi.fn(),imageSmoothingEnabled:true,drawImage:(...args:unknown[])=>{draws.push(args);nearest.push(out.imageSmoothingEnabled);}} as unknown as CanvasRenderingContext2D;
    try{for(const quality of ['low','high'] as const)for(const pixelation of ['subtle','moderate','strong'] as const){const s=scene('samurai');s.settings={quality,pixelation,sound:false,reducedMotion:false};drawPixelCharacters(out,s,460,paint);}
      expect(paint).toHaveBeenCalledTimes(12);expect(nearest.every(value=>!value)).toBe(true);expect(draws[0][3]).toBe(draws[3][3]);expect(draws[0][3]).toBeGreaterThan(draws[1][3] as number);expect(draws[1][3]).toBeGreaterThan(draws[2][3] as number);
    }finally{spy.mockRestore();}
  });
});
