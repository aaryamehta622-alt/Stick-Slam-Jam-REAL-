import { describe,it,expect } from 'vitest';
import { createMatch,toWire,fromWire,validInput,clearEdges,normalizeCode } from '@/game/network-protocol';
import { emptyInput,updateGame } from '@/game/engine';
import { startAbility } from '@/game/abilities';
import { OnlineView } from './view';
import { CLASS_ORDER } from '@/game/classes';
describe('network simulation boundary',()=>{
  it('strictly validates input types and rejects injected combat values',()=>{
    expect(validInput(emptyInput())).toEqual(emptyInput());
    for(const bad of [null,[],{...emptyInput(),left:1},{...emptyInput(),damage:900},{...emptyInput(),abilities:[true]},{...emptyInput(),abilities:[1,false,false,false]}])expect(validInput(bad)).toBeNull();
    const input={...emptyInput(),left:true,heavyHeld:true,jump:true,attack:true,pickup:true,abilities:[true,false,false,false] as [boolean,boolean,boolean,boolean]};clearEdges(input);expect(input.left&&input.heavyHeld).toBe(true);expect(input.attack||input.jump||input.pickup||input.abilities.some(Boolean)).toBe(false);
    expect(normalizeCode('  aPplE ')).toBe('APPLE');
  });
  it('round-trips every class including statuses, hook targets, fish, projectile ownership and AOE Sets',()=>{
    for(const id of CLASS_ORDER){
      const s=createMatch(id,'fisherman');s.headless=true;startAbility(s.player,3,s,0);startAbility(s.enemy,1,s,0);
      for(let i=0;i<15;i++)updateGame(s,emptyInput(),1/120,emptyInput());
      const wire=structuredClone(toWire(s)),restored=fromWire(wire);
      expect(toWire(restored)).toEqual(wire);expect(restored.player.klass.id).toBe(id);
      for(const z of restored.aoeZones)expect(z.hit).toBeInstanceOf(Set);
      expect(JSON.stringify(wire)).not.toMatch(/particles|equipped|klass|presentation/);
    }
  });
  it('interpolation and prediction never mutate authoritative samples or invent damage',()=>{
    const s=createMatch('fisherman','mage');s.headless=true;startAbility(s.enemy,0,s,0);
    const packet={matchId:1,seq:10,at:Date.now(),ack:[1,1] as [number,number],state:structuredClone(toWire(s)),events:[]};
    const before=JSON.stringify(packet),view=new OnlineView();view.receive(packet);
    for(let i=0;i<30;i++)view.frame(1/60,{quality:'low',sound:false,reducedMotion:true},'player',{...emptyInput(),right:true},90,true);
    expect(JSON.stringify(packet)).toBe(before);expect(view.state!.enemy.hp).toBe(s.enemy.hp);
  });
  it('uses a second human input without running enemy AI',()=>{
    const s=createMatch('samurai','boxer');s.headless=true;
    for(let i=0;i<120;i++)updateGame(s,emptyInput(),1/120,{...emptyInput(),left:true});
    expect(s.enemy.x).toBeLessThan(600);expect(s.ai.decisionTimer).toBe(.4);expect(s.enemy.cooldowns).toEqual([0,0,0,0]);
  });
});
