import { useEffect, useRef } from 'react';
import { emptyInput, makeAI, updateGame, type GameState } from '@/game/engine';
import { makeFighter } from '@/game/types';
import { render } from '@/game/render';
import { setSoundEnabled } from '@/game/sfx';
import type { GameSettings } from '@/game/settings';

// Live attract mode uses the playable game's engine, fighter geometry, and VFX.
export function ArenaPreview({ settings }: { settings: GameSettings }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    setSoundEnabled(false);
    const s: GameState = { player: makeFighter('player', 'samurai', 495, 1), enemy: makeFighter('enemy', 'fireMonk', 630, -1),
      ai: makeAI(), time: 0, hitPause: 0, shake: 0, shakeT: 0, particles: [], projectiles: [], aoeZones: [], floats: [],
      winner: null, winTime: 0, flashScreen: 0, playerCombo: 0, playerComboTimer: 0, enemyCombo: 0, enemyComboTimer: 0,
      slowmo: 0, globalTimeScale: 1, arena: 'rooftop', bossMode: false, settings };
    let raf=0,last=performance.now(),acc=0,cycle=0;
    const tick=(now:number)=>{
      const elapsed=Math.min(0.05,(now-last)/1000);last=now;
      if (!document.hidden && !settings.reducedMotion) {
        acc+=elapsed;
        while(acc>=1/120){
          const input=emptyInput(),dx=s.enemy.x-s.player.x;
          if (!s.player.attack) s.player.facing=dx>=0?1:-1;
          if (Math.abs(dx)>115) {input.left=dx<0;input.right=dx>0;}
          cycle+=1/120;
          if(cycle>0.7) {input.attack=true;if(cycle>1.5){input.abilities[Math.floor(s.time/3)%2===0?1:3]=true;cycle=0;}}
          updateGame(s,input,1/120);s.player.hp=s.player.maxHp;s.enemy.hp=s.enemy.maxHp;s.winner=null;acc-=1/120;
          if (s.time > 12 || s.player.x < 330 || s.player.x > 870 || s.enemy.x < 330 || s.enemy.x > 870) {
            s.player=makeFighter('player','samurai',495,1);s.enemy=makeFighter('enemy','fireMonk',630,-1);
            s.ai=makeAI();s.time=0;s.hitPause=0;s.slowmo=0;s.presentation=undefined;s.moveVfx=[];
            s.projectiles=[];s.aoeZones=[];s.particles=[];s.floats=[];cycle=0;
          }
        }
      }
      const c=canvas.current;if(c){const ctx=c.getContext('2d');if(ctx)render({ctx,state:s,width:1200,height:540,preview:true});}
      raf=requestAnimationFrame(tick);
    };raf=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(raf);setSoundEnabled(settings.sound);};
  },[settings]);
  return <canvas ref={canvas} width={1200} height={540} className="preview-canvas" role="img" aria-label="Live engine demo: Samurai versus Fire Monk on the neon rooftop" />;
}
