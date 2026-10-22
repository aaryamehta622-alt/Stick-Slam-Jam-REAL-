import { describe,it,expect,vi } from 'vitest';
import { ALL_FIGHTERS,type FighterId } from '../classes';
import { makeFighter } from '../types';
import { emptyInput,makeAI,updateGame,type GameState } from '../engine';
import { startAbility } from '../abilities';
import { ABILITY_DESIGNS,designFor } from './designs';
import { drawMoveEffects,drawMoveUnderlays } from './moves';
import { drawFishing,drawFishingFloor } from './fishing';
import { drawDetailedArea } from './areas';
import { drawDetailedProjectile } from './projectiles';
import { effects,impact,updatePresentation,drawEnergy } from '../presentation';
vi.mock('../sfx',()=>({sfx:new Proxy({},{get:()=>()=>{}})}));
function match(id:FighterId='samurai'):GameState{
  return {player:makeFighter('player',id,440,1),enemy:makeFighter('enemy','viking',550,-1),ai:makeAI(),time:0,hitPause:0,shake:0,shakeT:0,particles:[],projectiles:[],aoeZones:[],floats:[],winner:null,winTime:0,flashScreen:0,playerCombo:0,playerComboTimer:0,enemyCombo:0,enemyComboTimer:0,slowmo:0,globalTimeScale:1,arena:'dojo',bossMode:false};
}
function drawingContext(){
  let calls=0;const stack:number[]=[];
  const data:Record<string,unknown>={globalAlpha:1,globalCompositeOperation:'source-over',lineWidth:1,
    createLinearGradient:()=>({addColorStop:()=>{}}),createRadialGradient:()=>({addColorStop:()=>{}}),
    save:()=>{stack.push(data.globalAlpha as number);},restore:()=>{data.globalAlpha=stack.pop()??1;}};
  const context=new Proxy(data,{get(target,key){return key in target?target[key as string]:(...args:unknown[])=>{calls++;for(const arg of args)if(typeof arg==='number'&&!Number.isFinite(arg))throw new Error(`Invalid geometry in ${String(key)}`);};},
    set(target,key,value){if(key==='globalAlpha'&&(!Number.isFinite(value)||value<0||value>1))throw new Error('Invalid effect opacity');target[key as string]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  return {context,calls:()=>calls,depth:()=>stack.length};
}
describe('authored ability effects',()=>{
  it('covers every playable and boss ability without a fallback',()=>{
    const abilities=Object.values(ALL_FIGHTERS).flatMap(f=>f.abilities);
    expect(abilities).toHaveLength(Object.keys(ALL_FIGHTERS).length * 4);
    for(const a of abilities){expect(ABILITY_DESIGNS[a.id]).toBeDefined();expect(designFor(a.id).signature).not.toBe('basic');}
    for(const element of [0,1,2])expect(designFor('elementUlt',element).color).not.toBe(designFor('elementUlt',(element+1)%3).color);
  });
  it('preserves teleport origin and destination in the accepted event',()=>{
    const s=match('ninja'),origin=s.player.x;startAbility(s.player,0,s,0);const move=s.moveVfx![0],destination=s.player.x;
    s.player.x+=100;expect(move.x).toBe(origin);expect(move.castX).toBe(destination);
  });
  it('keeps rejected casts free of new presentation events',()=>{
    const s=match();s.player.cooldowns[0]=1;expect(startAbility(s.player,0,s,0)).toBe(false);expect(s.moveVfx).toBeUndefined();expect(s.presentation).toBeUndefined();
  });
  it('bounds impact choreography and expires it through hitstop',()=>{
    const s=match();for(let i=0;i<500;i++)impact(s,500,70,1,4,'#f79','arcaneSupernova');
    expect(effects(s).bursts).toHaveLength(24);expect(effects(s).pool.active.length).toBeLessThanOrEqual(720);
    for(let i=0;i<90;i++)updatePresentation(s,1/120,false);expect(effects(s).bursts).toHaveLength(0);
  });
  it('retains elemental identity on impact',()=>{
    const s=match('elementalist');impact(s,500,70,1,3,'#64e1ff','elementUlt',1);
    expect(effects(s).bursts[0].form).toBe('frost');expect(effects(s).bursts[0].accent).toBe('#f1ffff');
  });
  it('keeps sustained boss auras alive for their complete status duration',()=>{
    const s=match('giantBrute');startAbility(s.player,3,s,0);
    expect(s.player.rage).toBeGreaterThan(4.5);
    expect(s.moveVfx![0].duration).toBeGreaterThanOrEqual(s.player.rage);
  });
  it('keeps damage, cooldowns, movement and knockback equal at low and high detail',()=>{
    const random=vi.spyOn(Math,'random').mockReturnValue(.5);
    try{for(const id of Object.keys(ALL_FIGHTERS) as FighterId[])for(let slot=0;slot<4;slot++){
      const states=['low','high'].map(quality=>{const s=match(id);s.settings={quality:quality as 'low'|'high',sound:false,reducedMotion:false};startAbility(s.player,slot,s,0);
        for(let frame=0;frame<180;frame++){s.ai.decisionTimer=1e6;s.ai.nextAction='wait';updateGame(s,emptyInput(),1/120);}
        return {hp:s.enemy.hp,playerHp:s.player.hp,x:s.player.x,y:s.player.y,vx:s.enemy.vx,vy:s.enemy.vy,cd:s.player.cooldowns,winner:s.winner};});
      expect(states[0]).toEqual(states[1]);
    }}finally{random.mockRestore();}
  });
  it('renders every effect with valid opacity, finite geometry, balanced state and no combat writes',()=>{
    const {context,calls,depth}=drawingContext(),spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
    try{for(const quality of ['low','high'] as const)for(const id of Object.keys(ALL_FIGHTERS) as FighterId[])for(let element=0;element<(id==='elementalist'?3:1);element++)for(let slot=0;slot<4;slot++){
      const s=match(id);s.settings={quality,sound:false,reducedMotion:false};s.player.element=element as 0|1|2;startAbility(s.player,slot,s,0);
      for(const now of [.01,.1,.28,.5,.8,1.3,1.8,1.95,2.2,3.5]){
        s.time=now;const before=JSON.stringify([s.player,s.enemy,s.projectiles,s.aoeZones,s.moveVfx]);
        drawFishingFloor(context,s,460);drawMoveUnderlays(context,s,460);drawMoveEffects(context,s,460);drawFishing(context,s,460);for(const p of s.projectiles)drawDetailedProjectile(context,p,460,now);for(const z of s.aoeZones)drawDetailedArea(context,z,460,now,quality==='low'?.5:1);drawEnergy(context,s,460);
        expect(depth()).toBe(0);expect(context.globalAlpha).toBe(1);expect(JSON.stringify([s.player,s.enemy,s.projectiles,s.aoeZones,s.moveVfx])).toBe(before);
      }
    }expect(calls()).toBeGreaterThan(10000);}finally{spy.mockRestore();}
  });
});
