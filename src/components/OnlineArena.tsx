import { useEffect,useRef,useState } from 'react';
import { render } from '@/game/render';
import { emptyInput,type InputState } from '@/game/engine';
import { clearEdges,type Lobby,type MatchSnapshot,type Side } from '@/game/network-protocol';
import { OnlineConnection } from '@/multiplayer/connection';
import { OnlineView } from '@/multiplayer/view';
import { readSettings } from '@/game/settings';
import { unlockAudio,setSoundEnabled } from '@/game/sfx';
import { MobileControls } from './MobileControls';
import { useIsMobile } from '@/hooks/use-mobile';
export function OnlineArena({connection,lobby,view}:{connection:OnlineConnection;lobby:Lobby;view:OnlineView}){
  const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),input=useRef<InputState>(emptyInput()),seq=useRef(0);
  const [touch,setTouch]=useState(false),mobile=useIsMobile(),[hud,setHud]=useState({hp:0,enemyHp:0,rtt:0,fps:60,stale:false,held:'',fish:''});
  const side:Side=lobby.players.find(p=>p.sessionId===connection.room?.sessionId)?.side??'player';
  const settings=useRef(readSettings());const live=useRef(lobby);live.current=lobby;
  useEffect(()=>{
    const held=new Set<string>();
    const keys:Record<string,keyof InputState|number>={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyF:'block',KeyS:'block',ArrowDown:'block',KeyK:'heavyHeld',KeyW:'jump',Space:'jump',ArrowUp:'jump',KeyJ:'attack',ShiftLeft:'dash',ShiftRight:'dash',KeyL:'dash',KeyE:'pickup',Digit1:0,Digit2:1,Digit3:2,Digit4:3,Numpad1:0,Numpad2:1,Numpad3:2,Numpad4:3};
    const onKey=(e:KeyboardEvent,down:boolean)=>{
      if(down&&(e.target as HTMLElement)?.closest('input,select,textarea,button'))return;
      const key=keys[e.code];if(key===undefined)return;e.preventDefault();if(down&&held.has(e.code))return;unlockAudio();
      if(down)held.add(e.code);else held.delete(e.code);
      if(typeof key==='number'){if(down)input.current.abilities[key]=true;}
      else if(key==='left'||key==='right'||key==='block'||key==='heavyHeld'){
        if(key==='heavyHeld'&&!down)input.current.heavyReleased=true;
        input.current[key]=down;
      }else if(down)(input.current[key] as boolean)=true;
    };
    const down=(e:KeyboardEvent)=>onKey(e,true),up=(e:KeyboardEvent)=>onKey(e,false);
    const reset=()=>{held.clear();input.current=emptyInput();connection.send('input',{seq:++seq.current,matchId:live.current.matchId,input:input.current});};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
    setSoundEnabled(settings.current.sound);
    return()=>{reset();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);};
  },[connection]);
  useEffect(()=>{input.current=emptyInput();},[lobby.phase,lobby.matchId,connection.connected]);
  useEffect(()=>{
    let raf=0,last=performance.now(),sendAt=0,uiAt=0,fps=60;
    const loop=(now:number)=>{
      const dt=Math.min(.05,(now-last)/1000);last=now;fps+=(1/Math.max(.001,dt)-fps)*.04;
      if(now-sendAt>=1000/50){sendAt=now;
        if(live.current.phase==='fight'&&connection.connected){connection.send('input',{seq:++seq.current,matchId:live.current.matchId,input:input.current});clearEdges(input.current);}
      }
      const canPredict=connection.connected&&live.current.phase==='fight'&&live.current.players.every(p=>p.connected);
      const state=view.frame(dt,settings.current,side,input.current,connection.rtt,canPredict);
      const c=canvas.current,cont=container.current;
      if(state&&c&&cont){
        const dpr=Math.min(2,devicePixelRatio||1),w=cont.clientWidth,h=cont.clientHeight;
        if(c.width!==Math.floor(w*dpr)||c.height!==Math.floor(h*dpr)){c.width=Math.floor(w*dpr);c.height=Math.floor(h*dpr);}
        render({ctx:c.getContext('2d')!,state,width:c.width,height:c.height});
        if(now-uiAt>150){uiAt=now;const f=state[side];setHud({hp:Math.round(state.player.hp),enemyHp:Math.round(state.enemy.hp),rtt:connection.rtt,fps:Math.round(fps),stale:now-view.lastReceived>1500,held:f.heldFish??'',fish:f.fishing?.fish??''});}
      }
      raf=requestAnimationFrame(loop);
    };raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);
  },[connection,view,side]);
  const me=lobby.players.find(p=>p.side===side);
  return <>
    <div className="online-fight-meta"><span>YOU ARE {side==='player'?'PLAYER 1 · LEFT':'PLAYER 2 · RIGHT'}</span><span>{hud.rtt} ms · {hud.fps} FPS · {lobby.code}</span><button onClick={()=>setTouch(v=>!v)} aria-pressed={touch}>Touch controls</button></div>
    <div className="online-canvas" ref={container}>
      <canvas ref={canvas} aria-label="Online combat arena" tabIndex={0} onContextMenu={e=>e.preventDefault()}
        onPointerDown={e=>{if(e.pointerType==='touch')return;unlockAudio();e.currentTarget.focus();if(e.button===0)input.current.attack=true;if(e.button===2)input.current.heavyHeld=true;e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerUp={e=>{if(e.button===2){input.current.heavyReleased=true;input.current.heavyHeld=false;}}}
        onPointerCancel={()=>{input.current=emptyInput();}}/>
      {lobby.phase==='countdown'&&<div className="online-countdown" role="status">{lobby.countdown||'FIGHT!'}<small>GET READY</small></div>}
      {(!connection.connected||lobby.players.some(p=>!p.connected)||hud.stale)&&lobby.phase==='fight'&&<div className="online-countdown"><strong>CONNECTION PAUSED</strong><small>{lobby.note||'Waiting for the server…'}</small></div>}
      {(touch||mobile)&&<MobileControls fishing={me?.classId==='fisherman'} onHold={(key,down)=>{unlockAudio();if(key==='heavy'){if(!down)input.current.heavyReleased=true;input.current.heavyHeld=down;}else input.current[key]=down;}}
        onPress={key=>{unlockAudio();if(key.startsWith('ability'))input.current.abilities[Number(key.at(-1))-1]=true;else(input.current[key] as boolean)=true;}}/>}
    </div>
    <p className="online-controls">A/D move · W jump · J / click light · K / right click hold heavy · 1–4 abilities · Shift dash · F block · E pick up fish</p>
    <p className="sr-only" role="status">Player 1 HP {hud.hp}. Player 2 HP {hud.enemyHp}. {hud.fish&&`Catch: ${hud.fish}.`} {hud.held&&`Holding ${hud.held}.`}</p>
  </>;
}
