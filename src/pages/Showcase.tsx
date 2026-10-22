import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { ALL_FIGHTERS,CLASS_ORDER,BOSS_ORDER,type FighterId } from '@/game/classes';
import { emptyInput,makeAI,updateGame,type GameState,type ArenaId } from '@/game/engine';
import { makeFighter } from '@/game/types';
import { startAbility,startHeavyAttack } from '@/game/abilities';
import { render } from '@/game/render';
import { readSettings,type Quality,type Pixelation } from '@/game/settings';
import { setSoundEnabled } from '@/game/sfx';
import { designFor } from '@/game/vfx/designs';

function scene(id:FighterId,arena:ArenaId,element:0|1|2,quality:Quality,slot:number,pixelation:Pixelation):GameState {
  const player=makeFighter('player',id,440,1);player.element=element;
  const design=designFor(slot===4?'heavy':player.klass.abilities[slot].id,element,player.klass.category);
  const close=id==='fisherman'&&slot===1||['cut','drawcut','barrage','stabs','punch','uppercut','axe','guillotine','shield','electric'].includes(design.form);
  return {player,enemy:makeFighter('enemy','boxer',close?560:710,-1),ai:makeAI(),time:0,hitPause:0,shake:0,shakeT:0,
    particles:[],projectiles:[],aoeZones:[],floats:[],winner:null,winTime:0,flashScreen:0,playerCombo:0,playerComboTimer:0,enemyCombo:0,enemyComboTimer:0,
    slowmo:0,globalTimeScale:1,arena,bossMode:false,settings:{...readSettings(),quality,pixelation,sound:false}};
}
export default function Showcase(){
  const [params]=useSearchParams();
  const [fighter,setFighter]=useState<FighterId>(()=>Object.prototype.hasOwnProperty.call(ALL_FIGHTERS,params.get('fighter')??'')?params.get('fighter') as FighterId:'samurai'),[arena,setArena]=useState<ArenaId>('rooftop'),[element,setElement]=useState<0|1|2>(0),[quality,setQuality]=useState<Quality>(()=>readSettings().quality);
  const [pixelation,setPixelation]=useState<Pixelation>(()=>readSettings().pixelation??'moderate');
  const [slot,setSlot]=useState(3),[paused,setPaused]=useState(false),[repeat,setRepeat]=useState(true),[slow,setSlow]=useState(false);
  const [stats,setStats]=useState({fps:60,particles:0,seconds:0});
  const canvas=useRef<HTMLCanvasElement>(null),state=useRef<GameState|null>(null),step=useRef(false);
  const activeSlot=useRef(3);
  const selected=ALL_FIGHTERS[fighter];
  const cast=useCallback((index:number)=>{
    const s=scene(fighter,arena,element,quality,index,pixelation);state.current=s;
    if(index===4)startHeavyAttack(s.player,1,s,0);else startAbility(s.player,index,s,0);
    activeSlot.current=index;setSlot(index);setPaused(false);
  },[fighter,arena,element,quality,pixelation]);
  useEffect(()=>{setSoundEnabled(false);cast(activeSlot.current);return()=>setSoundEnabled(readSettings().sound);},[cast]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.repeat)return;
      if((e.target as HTMLElement).closest('select,input'))return;
      if(e.code.startsWith('Digit')){const n=Number(e.code.slice(-1));if(n>=1&&n<=5){e.preventDefault();cast(n-1);}}
      if(e.code==='KeyP'){e.preventDefault();setPaused(p=>!p);}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[cast]);
  useEffect(()=>{
    let raf=0,last=performance.now(),acc=0,ui=0,frames=0,elapsed=0;
    const loop=(now:number)=>{
      const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;elapsed+=dt;frames++;
      const s=state.current;
      if(s){
        if(!paused||step.current){acc+=step.current?1/60:dt*(slow?.35:1);step.current=false;
          while(acc>=1/120){
            // This isolated training partner is passive; no saves or rewards are read/written.
            s.enemy.hitstun=10;s.ai.nextAction='wait';s.ai.decisionTimer=1e6;
            updateGame(s,emptyInput(),1/120);s.player.hp=s.player.maxHp;s.enemy.hp=s.enemy.maxHp;s.winner=null;acc-=1/120;
          }
          const lastEffect=Math.max(1.7,...(s.moveVfx??[]).map(v=>v.duration+1));
          if(repeat&&s.time>lastEffect)cast(slot);
        }
        const c=canvas.current;if(c){
          const dpr=Math.min(2,window.devicePixelRatio||1),width=c.clientWidth,height=c.clientHeight;
          if(c.width!==Math.round(width*dpr)||c.height!==Math.round(height*dpr)){c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);}
          const ctx=c.getContext('2d');if(ctx){ctx.setTransform(dpr,0,0,dpr,0,0);render({ctx,state:s,width,height,preview:true});}
        }
        ui+=dt;if(ui>.2){setStats({fps:Math.round(frames/Math.max(.001,elapsed)),particles:(s.presentation?.pool.active.length??0)+s.particles.length,seconds:s.time});ui=0;frames=0;elapsed=0;}
      }
      raf=requestAnimationFrame(loop);
    };raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);
  },[paused,repeat,slow,cast,slot]);
  return <div className="showcase-page">
    <header className="showcase-header"><Link to="/">← STICK SLAM JAM</Link><span>ABILITY SHOWCASE</span><span>15 FIGHTERS / 8 BOSSES</span></header>
    <main><div className="showcase-title"><div><span className="eyebrow">EVERY STYLE. EVERY SPECIAL.</span><h1>POWER, IN MOTION.</h1></div><p>Preview every ability. Pause the action.<br/>Your progression stays untouched.</p></div>
      <div className="showcase-toolbar">
        <label>Fighter <select aria-label="Showcase fighter" value={fighter} onChange={e=>setFighter(e.target.value as FighterId)}><optgroup label="PLAYABLE FIGHTERS">{CLASS_ORDER.map(id=><option key={id} value={id}>{ALL_FIGHTERS[id].name}</option>)}</optgroup><optgroup label="BOSSES">{BOSS_ORDER.map(id=><option key={id} value={id}>{ALL_FIGHTERS[id].name}</option>)}</optgroup></select></label>
        <label>Arena <select aria-label="Preview arena" value={arena} onChange={e=>setArena(e.target.value as ArenaId)}><option value="rooftop">Neon rooftop</option><option value="dojo">Moonlit dojo</option><option value="volcano">Volcanic rift</option></select></label>
        {fighter==='elementalist'&&<label>Element <select aria-label="Preview element" value={element} onChange={e=>setElement(Number(e.target.value) as 0|1|2)}><option value="0">Fire</option><option value="1">Ice</option><option value="2">Lightning</option></select></label>}
        <label>Detail <select aria-label="Preview detail" value={quality} onChange={e=>setQuality(e.target.value as Quality)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <label>Pixels <select aria-label="Preview pixelation" value={pixelation} onChange={e=>setPixelation(e.target.value as Pixelation)}><option value="subtle">Subtle</option><option value="moderate">Moderate</option><option value="strong">Strong</option></select></label>
        <label><input type="checkbox" checked={slow} onChange={e=>setSlow(e.target.checked)}/> Slow motion</label>
        <label><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/> Repeat</label>
      </div>
      <div className="showcase-stage"><canvas ref={canvas} role="img" aria-label={`${selected.name} ability preview`} /><div className="showcase-stage-label" style={{color:selected.color}}>{selected.isBoss?'BOSS / ':''}{selected.name} <span>VS TRAINING PARTNER</span></div><div className="showcase-stats" aria-label="Preview performance">{stats.fps} FPS · {stats.particles} PARTICLES · {stats.seconds.toFixed(2)}s</div></div>
      <div className="showcase-actions">{selected.abilities.map((a,i)=><button key={a.id} onClick={()=>cast(i)} aria-pressed={slot===i} style={{borderColor:slot===i?selected.color:undefined}}><kbd>{i+1}</kbd><span>{a.name}</span><small>{i===3?'ULTIMATE':'CAST'}</small></button>)}<button onClick={()=>cast(4)} aria-pressed={slot===4}><kbd>5</kbd><span>Charged heavy</span><small>MAX POWER</small></button></div>
      <div className="showcase-playback"><button onClick={()=>setPaused(p=>!p)}>{paused?'Resume':'Pause'}</button><button onClick={()=>{setPaused(true);step.current=true;}}>Step frame</button><button onClick={()=>cast(slot)}>Replay ability</button><span>1–4 specials · 5 heavy · P pause</span></div>
    </main>
  </div>;
}
