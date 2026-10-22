import { describe, it, expect, vi } from 'vitest';
import { makeFighter, startComboStep } from './types';
import { applyDamage, emptyInput, makeAI, resolveCombat, resolveProjectiles, stepFighter, updateGame, type GameState } from './engine';
import { startAbility, startHeavyAttack } from './abilities';
import { ParticlePool } from './particles';
import { effects, updatePresentation } from './presentation';
import { getProgress, rollBossReward, exportProgress, importProgress } from './rewards';
import { ALL_FIGHTERS, BOSS_ORDER, type FighterId } from './classes';
import { render } from './render';
vi.mock('./sfx', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
function match(): GameState { return { player: makeFighter('player','samurai',480,1), enemy: makeFighter('enemy','viking',550,-1), ai:makeAI(), time:0, hitPause:0, shake:0, shakeT:0, particles:[], projectiles:[], aoeZones:[], floats:[], winner:null, winTime:0, flashScreen:0, playerCombo:0, playerComboTimer:0, enemyCombo:0, enemyComboTimer:0, slowmo:0, globalTimeScale:1, arena:'dojo', bossMode:false }; }
describe('bounded presentation and combat regressions', () => {
  it('never exceeds pool capacity, reuses expired particle objects',()=>{
    const pool=new ParticlePool(32), objects=[...pool.particles];
    const emitter={x:0,y:20,color:'#fff',count:100,life:0.05};
    for(let n=0;n<500;n++){pool.emit(emitter);pool.update(0.05);expect(pool.active.length).toBeLessThanOrEqual(32);}
    expect(pool.particles.every((p,i)=>p===objects[i])).toBe(true);expect(pool.dropped).toBeGreaterThan(0);
  });
  it('uses elapsed time for drag and acceleration',()=>{
    const a=new ParticlePool(1),b=new ParticlePool(1);
    a.emit({x:100,y:500,color:'#fff',count:1,life:5});b.emit({x:100,y:500,color:'#fff',count:1,life:5});
    Object.assign(b.particles[0],a.particles[0]);
    for(let i=0;i<60;i++)a.update(1/60);for(let i=0;i<120;i++)b.update(1/120);
    expect(a.particles[0].vx).toBeCloseTo(b.particles[0].vx,6);expect(Math.abs(a.particles[0].y-b.particles[0].y)).toBeLessThan(3);
  });
  it('advances VFX during hitstop without advancing combat or cooldowns',()=>{
    const s=match();s.hitPause=0.1;s.player.cooldowns[0]=2;
    effects(s).pool.emit({x:20,y:50,color:'#fff',count:1});updateGame(s,emptyInput(),0.016);
    expect(s.time).toBe(0);expect(s.player.cooldowns[0]).toBe(2);expect(effects(s).pool.particles[0].age).toBeGreaterThan(0);
  });
  it('blocks attacks from the front, takes full hits from behind',()=>{
    const s=match();s.enemy.blocking=true;const hp=s.enemy.hp;
    applyDamage(s,s.player,s.enemy,{x:530,y:70},10,100,0);expect(hp-s.enemy.hp).toBeCloseTo(1.8);
    s.enemy.facing=1;const before=s.enemy.hp;applyDamage(s,s.player,s.enemy,{x:530,y:70},10,100,0);expect(before-s.enemy.hp).toBe(10);
  });
  it('resolves aerial hand hit points without double height',()=>{
    const s=match();s.player.y=150;s.enemy.y=150;s.player.onGround=s.enemy.onGround=false;
    startComboStep(s.player,0,0);s.time=0.075;const before=s.enemy.hp;resolveCombat(s);expect(s.enemy.hp).toBeLessThan(before);
  });
  it('awards counter and chip-damage knockouts',()=>{
    const s=match();s.player.hp=1;s.enemy.counterStance=1;
    applyDamage(s,s.player,s.enemy,{x:530,y:70},10,100,0);expect(s.winner).toBe('enemy');
    const b=match();b.enemy.hp=1;b.enemy.blocking=true;applyDamage(b,b.player,b.enemy,{x:530,y:70},10,100,0);expect(b.winner).toBe('player');
  });
  it('credits projectile hits to their owner and detects fast swept shots',()=>{
    const s=match();s.projectiles.push({id:1,x:680,y:70,prevX:400,prevY:70,vx:2000,vy:0,gravity:0,life:1,born:0,owner:'player',damage:15,knock:80,knockUp:0,kind:'bullet',color:'#fff',radius:4});
    resolveProjectiles(s);expect(s.playerCombo).toBe(1);expect(s.enemy.hp).toBe(s.enemy.maxHp-15);
  });
  it('buffers an early combo press until the cancel window',()=>{
    const s=match();startComboStep(s.player,0,0);s.player.attack!.hit=true;
    const input=emptyInput();input.attack=true;stepFighter(s.player,input,s,1/120,0.07);stepFighter(s.player,emptyInput(),s,1/120,0.11);
    expect(s.player.attack?.stepIdx).toBe(1);
  });
  it('keeps the camera inside arena bounds when fighters separate',()=>{
    const s=match();s.player.x=50;s.enemy.x=1150;
    for(let i=0;i<120;i++)updatePresentation(s,1/120,false);
    expect(effects(s).zoom).toBeGreaterThanOrEqual(1);expect(effects(s).cameraX).toBe(600);
  });
  it('casts ultimates only after acceptance and never alters combat when drawing settings change',()=>{
    const s=match();expect(startAbility(s.player,3,s,0)).toBe(true);expect(effects(s).cinematic?.label).toBe('Rapid Flurry');
    const hp=s.enemy.hp,cd=s.player.cooldowns[3];updatePresentation(s,0.02);expect(s.enemy.hp).toBe(hp);expect(s.player.cooldowns[3]).toBe(cd);
    s.settings={quality:'low',sound:false,reducedMotion:true};expect(startAbility(s.player,3,s,0)).toBe(false);
  });
  it('allows the Viking axe to be recalled before throw cooldown ends',()=>{
    const s=match();s.player=makeFighter('player','viking',400,1);
    expect(startAbility(s.player,0,s,0)).toBe(true);expect(s.player.axeOut).toBe(true);expect(startAbility(s.player,0,s,0.1)).toBe(true);
  });
  it('preserves original save keys and boss reward progression',async()=>{
    localStorage.clear();const before=getProgress();await rollBossReward('giantBrute');const after=getProgress();
    expect(after.currency).toBeGreaterThan(before.currency);expect(after.xp).toBeGreaterThan(before.xp);expect(after.unlockedClasses).toEqual(expect.arrayContaining(before.unlockedClasses));expect(localStorage.getItem('stickfight-progress-v1')).toBeTruthy();
  });
  it('round-trips backups and recovers malformed storage without losing defaults',async()=>{
    localStorage.clear();await rollBossReward('giantBrute');const original=getProgress(),json=exportProgress();
    localStorage.clear();await importProgress(json);expect(getProgress()).toMatchObject({currency:original.currency,xp:original.xp,unlockedClasses:original.unlockedClasses,cosmetics:original.cosmetics});
    localStorage.clear();localStorage.setItem('stickfight-progress-v1', '{"currency":"oops","equipped":null}');expect(getProgress().unlockedClasses).toContain('samurai');expect(getProgress().currency).toBe(0);
    await expect(importProgress('{"other":"data"}')).rejects.toThrow();
  });
  for (const boss of BOSS_ORDER) it(`${boss}: transitions to rage and berserk phases`,()=>{
    const s=match();s.enemy=makeFighter('enemy',boss,600,-1);s.enemy.hp=s.enemy.maxHp*0.4;
    stepFighter(s.enemy,null,s,1/120,1);expect(s.enemy.bossPhase).toBe(2);expect(s.enemy.rage).toBeGreaterThan(0);
    s.enemy.hp=s.enemy.maxHp*0.1;stepFighter(s.enemy,null,s,1/120,2);expect(s.enemy.bossPhase).toBe(3);expect(s.enemy.berserk).toBeGreaterThan(0);
  });
  it('renders every fighter ability at buildup, impact and recovery with finite geometry and no combat mutation',()=>{
    const gradient={addColorStop:()=>{}};
    const context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient}, {get(target,key){return key in target?target[key as keyof typeof target]:(...args:unknown[])=>{for(const n of args)if(typeof n==='number'&&!Number.isFinite(n))throw new Error('Non-finite canvas geometry');};}}) as unknown as CanvasRenderingContext2D;
    const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
    for(const id of Object.keys(ALL_FIGHTERS) as FighterId[])for(let element=0;element<(id==='elementalist'?3:1);element++)for(let slot=0;slot<5;slot++){
      const s=match();s.player=makeFighter('player',id,460,1);s.player.element=element as 0|1|2;
      if(slot===4)startHeavyAttack(s.player,1,s,0);else startAbility(s.player,slot,s,0);
      for(const time of [0.01,0.15,0.45,1.1]) {
        s.time=time;const before=JSON.stringify({player:s.player,enemy:s.enemy,projectiles:s.projectiles,areas:s.aoeZones});
        render({ctx:context,state:s,width:1200,height:540});
        expect(JSON.stringify({player:s.player,enemy:s.enemy,projectiles:s.projectiles,areas:s.aoeZones})).toBe(before);
      }
    }
    spy.mockRestore();
  });
});
