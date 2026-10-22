import { fromWire, type MatchSnapshot, type Side } from '@/game/network-protocol';
import { castEffect, impact, updatePresentation } from '@/game/presentation';
import { stepFighter, type GameState, type InputState, emptyInput } from '@/game/engine';
import type { GameSettings } from '@/game/settings';
import { sfx } from '@/game/sfx';
export class OnlineView {
  samples:{packet:MatchSnapshot;received:number}[]=[];
  state?:GameState;
  matchId=-1;
  lastEvent=0;
  lastReceived=0;
  lastSeq=-1;
  predicted?:{x:number;y:number};
  receive(packet:MatchSnapshot){
    if(packet.matchId!==this.matchId){this.matchId=packet.matchId;this.samples=[];this.state=undefined;this.lastEvent=0;this.predicted=undefined;}
    this.lastReceived=performance.now();this.lastSeq=packet.seq;
    this.samples.push({packet,received:this.lastReceived});if(this.samples.length>8)this.samples.shift();
    if(!this.state)this.state=fromWire(packet.state);
    for(const event of packet.events){
      if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;
      if(event.type==='cast'){
        castEffect(this.state,event.move.owner==='player'?this.state.player:this.state.enemy,event.move,event.ultimate);
        if(event.move.ability==='fishHook'||event.move.ability==='catchOfDay'||event.move.ability==='freshCatch'||event.move.ability==='seaBeast')sfx.cast();else sfx.ability();
      }else{impact(this.state,event.x,event.y,event.dir,event.level,event.color,event.ability,event.element);if(event.ability==='freshCatch')sfx.heal();else if(event.level>=3)sfx.finisher();else sfx.punch();}
    }
  }
  frame(dt:number,settings:GameSettings,side:Side,input:InputState,rtt:number,canPredict:boolean){
    const latest=this.samples.at(-1);if(!latest||!this.state)return undefined;
    const now=performance.now(),target=latest.packet.at+(now-latest.received)-67;
    let a=this.samples[0],b=a;
    for(const sample of this.samples){if(sample.packet.at<=target)a=sample;if(sample.packet.at>=target){b=sample;break;}b=sample;}
    const span=b.packet.at-a.packet.at,blend=span>0?Math.max(0,Math.min(1,(target-a.packet.at)/span)):1;
    const presentation=this.state.presentation,base=fromWire(a.packet.state);
    base.presentation=presentation;base.settings=settings;
    base.time=a.packet.state.time+(b.packet.state.time-a.packet.state.time)*blend;
    for(const id of ['player','enemy'] as const){
      base[id].x=a.packet.state[id].x+(b.packet.state[id].x-a.packet.state[id].x)*blend;
      base[id].y=a.packet.state[id].y+(b.packet.state[id].y-a.packet.state[id].y)*blend;
    }
    if(canPredict&&now-this.lastReceived<250&&!base.winner){
      const latestState=fromWire(latest.packet.state),f=latestState[side];
      // Predict locomotion only. Hits, attacks, grabs, items, healing and random rolls always come from the server.
      const movement={...emptyInput(),left:input.left,right:input.right,block:input.block};
      const horizon=Math.min(.12,Math.max(0,(now-latest.received)/1000+rtt/2000));
      for(let t=0;t<horizon;t+=1/120)stepFighter(f,movement,latestState,Math.min(1/120,horizon-t),latestState.time+t);
      if(!this.predicted||Math.abs(this.predicted.x-f.x)>180)this.predicted={x:f.x,y:f.y};
      const follow=1-Math.exp(-dt*35);this.predicted.x+=(f.x-this.predicted.x)*follow;this.predicted.y+=(f.y-this.predicted.y)*follow;
      base[side].x=this.predicted.x;base[side].y=this.predicted.y;
    }else this.predicted=undefined;
    // Smooth authoritative projectile motion between 30 Hz snapshots.
    const ahead=Math.max(0,Math.min(.04,(target-a.packet.at)/1000));
    if(!base.hitPause)for(const p of base.projectiles){p.x+=p.vx*ahead;p.y+=p.vy*ahead;}
    updatePresentation(base,dt,base.hitPause<=0);this.state=base;return base;
  }
}
