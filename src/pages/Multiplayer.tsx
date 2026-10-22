import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft,Copy,Radio,ShieldCheck,Swords,Users } from 'lucide-react';
import { CLASSES,CLASS_ORDER } from '@/game/classes';
import type { Lobby } from '@/game/network-protocol';
import { OnlineConnection,serverURL } from '@/multiplayer/connection';
import { OnlineView } from '@/multiplayer/view';
import { OnlineArena } from '@/components/OnlineArena';
import { FighterPortrait } from '@/components/FighterPortrait';
import { useProgress } from '@/hooks/use-progress';
import { unlockAudio } from '@/game/sfx';
import '@/multiplayer/online.css';
export default function Multiplayer(){
  const [url]=useState(()=>{try{return serverURL();}catch{return '';}}),[connection,setConnection]=useState(()=>url?new OnlineConnection(url):null);
  const [lobby,setLobby]=useState<Lobby|null>(null),[mode,setMode]=useState<'create'|'join'>('create'),[code,setCode]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false),[copied,setCopied]=useState(false);
  const view=useRef(new OnlineView()),progress=useProgress();
  const [winner,setWinner]=useState<'player'|'enemy'|null>(null);
  useEffect(()=>{
    if(!connection)return;
    connection.onLobby=setLobby;connection.onSnapshot=s=>{view.current.receive(s);setWinner(s.state.winner);};connection.onNotice=setNotice;connection.onConnection=setConnected;
    setBusy(true);void connection.restore().finally(()=>setBusy(false));
    return()=>connection.leave();
  },[connection]);
  const leave=()=>{connection?.leave();setLobby(null);setConnected(false);setNotice('');view.current=new OnlineView();setConnection(url?new OnlineConnection(url):null);};
  const connect=async()=>{if(!connection||busy)return;setBusy(true);setNotice('');unlockAudio();try{await connection.connect(mode,code);}catch(err){setNotice(err instanceof Error?err.message:'Could not connect. Try again.');}finally{setBusy(false);}};
  const me=lobby?.players.find(p=>p.sessionId===connection?.room?.sessionId),host=lobby?.host===connection?.room?.sessionId;
  const ready=lobby?.players.length===2&&lobby.players.every(p=>p.ready&&p.connected);
  const active=lobby&&lobby.phase!=='lobby';
  return <div className="site-shell online-page">
    <header className="site-header"><Link className="brand" to="/"><Swords size={23}/><span>STICK<span className="brand-accent">SLAM</span>JAM</span></Link><Link className="header-play" to="/"><ArrowLeft size={15}/> SINGLE PLAYER</Link></header>
    <main className="online-main">
      <div className="online-title"><div><span className="eyebrow"><Radio size={13}/> PRIVATE ONLINE / 1V1</span><h1>{active?'MAKE SOME WAVES.':lobby?'YOUR CORNER. YOUR CREW.':'SAME ARENA. ANYWHERE.'}</h1></div><span className="online-chip"><i className="signal-dot"/>{connected?'CONNECTED':'BRING A FRIEND'}</span></div>
      {notice&&<div className="online-notice" role="status">{notice}</div>}
      {!url&&<div className="online-setup"><Radio size={32}/><h2>Online server awaiting setup</h2><p>Single-player and Fisherman are ready to play. To open online rooms, deploy the included server to Render and set <code>VITE_MULTIPLAYER_SERVER_URL</code> in Netlify, then rebuild this same site.</p><Link className="play-button" to="/">PLAY SINGLE PLAYER →</Link></div>}
      {url&&!lobby&&<>
        <section className="online-entry"><div className="online-entry-copy"><span className="eyebrow">TWO PLAYERS. ONE CODE.</span><h2>Settle it<br/><em>stick to stick.</em></h2><p>Create a private arena and send the code to a friend. Pick your fighters. Ready up. Make an impact.</p><div className="online-feature"><ShieldCheck size={18}/><span>Server-judged hits. Shared combat. Full VFX.</span></div><div className="online-feature"><Users size={18}/><span>Works across devices and networks.</span></div></div>
          <form className="online-room-form" onSubmit={e=>{e.preventDefault();void connect();}}><div className="online-tabs"><button type="button" aria-pressed={mode==='create'} onClick={()=>{setMode('create');setNotice('');}}>CREATE ROOM</button><button type="button" aria-pressed={mode==='join'} onClick={()=>{setMode('join');setNotice('');}}>JOIN ROOM</button></div><label htmlFor="room-code">{mode==='create'?'YOUR ROOM CODE':'FRIEND’S ROOM CODE'}</label><input id="room-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={12} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={mode==='create'?'APPLE (OR LEAVE BLANK)':'ENTER CODE'} aria-describedby="code-help"/><p id="code-help">4–12 letters or numbers. {mode==='create'?'Leave blank for an automatic code.':'Codes are case-insensitive.'}</p><button className="play-button" disabled={busy} type="submit">{busy?'CONNECTING…':mode==='create'?'OPEN MY ARENA ↗':'JOIN THE FIGHT ↗'}</button><small>A sleeping backend can take a minute to wake up.</small></form></section>
      </>}
      {lobby&&connection&&<>
        <section className="online-room-bar"><div><span>ROOM CODE</span><strong>{lobby.code}</strong><button className="icon-button" aria-label="Copy room code" onClick={()=>{void navigator.clipboard.writeText(lobby.code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>setNotice(`Share this room code: ${lobby.code}`));}}><Copy size={16}/></button>{copied&&<small>Copied!</small>}</div><span>{host?'YOU ARE THE HOST':'FRIEND’S ARENA'}</span><button className="arena-button" onClick={leave}>{connected?'Leave Room':'Back to room codes'}</button></section>
        {!active?<>
          <section className="online-players">{(['player','enemy'] as const).map((side,i)=>{const p=lobby.players.find(p=>p.side===side),klass=p?CLASSES[p.classId]:null;return <article key={side} className={`online-player ${p?.ready?'is-ready':''}`}><span className="eyebrow">PLAYER {i+1} {p?.sessionId===lobby.host?' / HOST':''} {p?.sessionId===connection.room?.sessionId?' / YOU':''}</span>{klass?<><FighterPortrait fighter={klass}/><h2>{klass.name}</h2><span className="online-player-status">{!p!.connected?'RECONNECTING…':p!.ready?'✓ READY':'CHOOSING A FIGHTER'}</span></>:<><Users size={40}/><h2>OPEN CORNER</h2><p>Share {lobby.code} with a friend.</p></>}</article>;})}</section>
          <div className="online-select-heading"><h2>CHOOSE YOUR FIGHTER</h2><label>Arena <select aria-label="Online arena" disabled={!host||!connected} value={lobby.arena} onChange={e=>connection.send('arena',e.target.value)}><option value="dojo">Dojo</option><option value="rooftop">Rooftop</option><option value="volcano">Volcano</option></select></label></div>
          <div className="online-roster">{CLASS_ORDER.map(id=><button disabled={!connected} key={id} className={me?.classId===id?'selected':''} aria-pressed={me?.classId===id} onClick={()=>connection.send('select',id)}><FighterPortrait fighter={CLASSES[id]}/><strong>{CLASSES[id].name}</strong><small>{progress.unlockedClasses.includes(id)?'OWNED ON THIS DEVICE':'ONLINE GUEST PICK'}</small></button>)}</div>
          <div className="online-ready"><p>{lobby.players.length<2?'Waiting for your friend to join…':ready?'Both corners are ready. Host can start.':'Choose a fighter, then ready up.'}</p><button className="arena-button" disabled={!connected} aria-pressed={!!me?.ready} onClick={()=>connection.send('ready',!me?.ready)}>{me?.ready?'UNREADY':'I’M READY'}</button>{host&&<button className="play-button" disabled={!ready||!connected} onClick={()=>connection.send('start')}>START MATCH ↗</button>}</div>
        </>:<>
          <OnlineArena key={lobby.matchId} connection={connection} lobby={lobby} view={view.current}/>
          {lobby.phase==='results'&&<section className="online-results"><div><span className="eyebrow">ROUND COMPLETE</span><h2>{winner===me?.side?'YOU WIN.':'GOOD FIGHT.'}</h2><p>{lobby.note}</p></div><button className="play-button" disabled={!connected||lobby.players.length!==2||!!me?.rematch} onClick={()=>connection.send('rematch',true)}>{me?.rematch?'REMATCH REQUESTED':'REMATCH ↗'}</button><button className="arena-button" disabled={!connected} onClick={()=>connection.send('lobby')}>RETURN TO LOBBY</button></section>}
        </>}
      </>}
      <p className="online-policy"><ShieldCheck size={15}/><span><strong>Private-match roster:</strong> all 15 classes are available online as guest picks. Your owned classes are marked. Online picks do not unlock them in single-player. Browser-local saves cannot prove ownership securely, so online matches award no coins or XP. Your existing saves stay on this device.</span></p>
    </main>
  </div>;
}
