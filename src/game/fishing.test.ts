import { describe, expect, it } from 'vitest';
import { createMatch } from './network-protocol';
import { emptyInput, updateGame, applyDamage } from './engine';
import { startAbility } from './abilities';
import { FISH, rollFish, pickupFish, throwFish, fishHit } from './fishing';
const setup = () => { const s = createMatch('fisherman', 'samurai'); s.headless = true; s.enemy.x = 535; s.player.x = 400; return s; };
function advance(s: ReturnType<typeof setup>, seconds: number) { for (let i = 0; i < seconds * 120; i++) updateGame(s, emptyInput(), 1/120, emptyInput()); }
describe('Fisherman combat in the shared engine', () => {
  it('uses the exact configurable weighted distribution', () => {
    const counts: Record<string,number> = {}; for (let i=0;i<10000;i++) {const fish=rollFish(()=>i/10000);counts[fish]=(counts[fish]??0)+1;}
    for (const [kind, fish] of Object.entries(FISH)) expect(counts[kind]).toBe(fish.weight*100);
  });
  it('requires a hook collision, reels and punches once', () => {
    const s=setup(); startAbility(s.player,0,s,0); advance(s,.24);
    expect(s.enemy.grabbedBy).toBe('player'); expect(s.enemy.x).toBeLessThan(535);
    advance(s,.8); expect(s.enemy.grabbedBy).toBeUndefined(); expect(s.enemy.hp).toBe(94); expect(s.enemy.vx).toBeGreaterThan(0);
    const hp=s.enemy.hp;advance(s,1);expect(s.enemy.hp).toBe(hp);
  });
  it('never grabs on a miss or through a block', () => {
    const s=setup();s.enemy.x=1100;startAbility(s.player,0,s,0);advance(s,1);expect(s.enemy.hp).toBe(s.enemy.maxHp);expect(s.enemy.grabbedBy).toBeUndefined();
    const b=setup();b.enemy.blocking=true;startAbility(b.player,0,b,0);
    const block={...emptyInput(),block:true};for(let i=0;i<100;i++)updateGame(b,emptyInput(),1/120,block);expect(b.enemy.grabbedBy).toBeUndefined();
  });
  it.each(Object.keys(FISH) as (keyof typeof FISH)[])('swings %s, drops one item, and cannot duplicate it', kind => {
    const s=setup();const entries=Object.entries(FISH);let weight=0;for(const [key,d] of entries){if(key===kind)break;weight+=d.weight;}
    s.random=()=>(weight+.1)/100;startAbility(s.player,1,s,0);advance(s,.75);expect(s.droppedFish).toHaveLength(1);expect(s.droppedFish![0].kind).toBe(kind);
    advance(s,.7);const d=s.droppedFish![0];s.player.x=d.x;s.player.y=0;s.player.attack=null;
    expect(pickupFish(s.player,s)).toBe(true);expect(pickupFish(s.player,s)).toBe(false);expect(s.droppedFish).toHaveLength(0);
    expect(throwFish(s.player,s,s.time)).toBe(true);expect(throwFish(s.player,s,s.time)).toBe(false);expect(s.projectiles.filter(p=>p.kind==='fish')).toHaveLength(1);
  });
  it('expires dropped fish after ten simulation seconds', () => {
    const s=setup();s.droppedFish=[{id:1,kind:'small',x:100,y:0,vy:0,expires:10}];advance(s,9.9);expect(s.droppedFish).toHaveLength(1);advance(s,.2);expect(s.droppedFish).toHaveLength(0);
  });
  it('applies capped poison and electric stun, and a heavier giant launch', () => {
    const s=setup();fishHit(s,s.player,s.enemy,'puffer',1);expect(s.enemy.poison?.remaining).toBe(9);advance(s,4);expect(s.enemy.hp).toBe(99);expect(s.enemy.poison).toBeUndefined();
    const e=setup();fishHit(e,e.player,e.enemy,'eel',1);expect(e.enemy.frozen).toBe(.25);
    const g=setup();fishHit(g,g.player,g.enemy,'giant',1);expect(g.enemy.vx).toBe(520);expect(g.enemy.vy).toBe(230);
  });
  it('heals only after consuming, clamps HP, and loses the heal when interrupted', () => {
    const s=setup();s.player.hp=105;startAbility(s.player,2,s,0);advance(s,1);expect(s.player.hp).toBe(105);advance(s,.2);expect(s.player.hp).toBe(110);
    const i=setup();i.player.hp=50;startAbility(i.player,2,i,0);advance(i,.5);applyDamage(i,i.enemy,i.player,{x:400,y:65},5,0,0);advance(i,2);expect(i.player.hp).toBe(45);expect(i.player.fishing).toBeUndefined();
  });
  it('telegraphs the beast at a fixed location, hits and launches, and allows escape', () => {
    const s=setup();startAbility(s.player,3,s,0);advance(s,1.6);expect(s.enemy.hp).toBe(115);advance(s,.6);expect(s.enemy.hp).toBe(79);expect(s.enemy.y).toBeGreaterThan(0);
    const d=setup();startAbility(d.player,3,d,0);d.enemy.x=1000;advance(d,3);expect(d.enemy.hp).toBe(115);expect(d.aoeZones).toHaveLength(0);
  });
  it('does not let a restrained fighter act, and releases it if the caster is interrupted', () => {
    const s=setup();startAbility(s.player,0,s,0);advance(s,.22);const x=s.enemy.x;
    const escape={...emptyInput(),right:true,abilities:[true,false,false,false] as [boolean,boolean,boolean,boolean]};updateGame(s,emptyInput(),1/120,escape);
    expect(s.enemy.cooldowns[0]).toBe(0);expect(s.enemy.x).toBeLessThan(x);
    applyDamage(s,s.enemy,s.player,{x:400,y:70},2,0,0);expect(s.enemy.grabbedBy).toBeUndefined();
  });
});
