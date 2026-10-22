import { useEffect,useState } from 'react';
import { Link,useLocation } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Swords, Volume2, VolumeX, SlidersHorizontal, Zap } from 'lucide-react';
import { StickFightGame } from '@/components/StickFightGame';
import { ClassSelect } from '@/components/ClassSelect';
import { ArenaPreview } from '@/components/ArenaPreview';
import { ClassId, BossId, BOSSES } from '@/game/classes';
import { ArenaId } from '@/game/engine';
import { rollBossReward, DropResult } from '@/game/rewards';
import { RewardModal } from '@/components/RewardModal';
import { readSettings, saveSettings, type GameSettings } from '@/game/settings';
import { setSoundEnabled, unlockAudio } from '@/game/sfx';
import { SaveTools } from '@/components/SaveTools';
import { SaveStatus } from '@/components/SaveStatus';
import { useProgress } from '@/hooks/use-progress';
import { getProgress,selectClass,savePreferences } from '@/game/progress';

const Index = () => {
  const progress=useProgress(),location=useLocation();
  const [playerClass,setPlayerClass]=useState<ClassId>(()=>getProgress().selectedClass);
  const [enemyClass,setEnemyClass]=useState<ClassId|BossId>('ninja');
  const [arena,setArena]=useState<ArenaId>(()=>getProgress().preferences.arena);
  const [phase,setPhase]=useState<'landing'|'select'|'fight'>(()=>location.state?.screen==='select'?'select':'landing');
  const [matchKey,setMatchKey]=useState(0),[bossMode,setBossMode]=useState(false),[useAltWeapon,setUseAltWeapon]=useState(()=>getProgress().preferences.alternateWeapon);
  const [reward,setReward]=useState<DropResult|null>(null),[rewardBoss,setRewardBoss]=useState<BossId|null>(null);
  const [settings,setSettings]=useState(readSettings),[settingsOpen,setSettingsOpen]=useState(false);
  const [saveError,setSaveError]=useState('');
  useEffect(()=>{setPlayerClass(progress.selectedClass);setArena(progress.preferences.arena);setUseAltWeapon(progress.preferences.alternateWeapon);},[progress.selectedClass,progress.preferences.arena,progress.preferences.alternateWeapon]);
  const changeSettings=(next:GameSettings)=>{setSettings(next);setSaveError(saveSettings(next)?'':'Settings could not be saved. Allow browser site storage and try again.');setSoundEnabled(next.sound);};
  const chooseClass=(id:ClassId)=>{if(id!==playerClass)setUseAltWeapon(false);setPlayerClass(id);void selectClass(id).catch(err=>setSaveError(err.message));};
  const chooseArena=(value:ArenaId)=>{setArena(value);void savePreferences({arena:value});};
  const chooseWeapon=(value:boolean)=>{setUseAltWeapon(value);void savePreferences({alternateWeapon:value});};
  const bossWin=(claimId:string)=>{if(bossMode&&BOSSES[enemyClass as BossId]){const boss=enemyClass as BossId;void rollBossReward(boss,claimId).then(result=>{if(!result.alreadyClaimed){setRewardBoss(boss);setReward(result);}}).catch(err=>setSaveError(err.message));}};
  const startFight=(enemy:ClassId|BossId,ar:ArenaId,boss:boolean,alt:boolean)=>{
    setEnemyClass(enemy);setArena(ar);setBossMode(boss);setUseAltWeapon(alt);setMatchKey(k=>k+1);setPhase('fight');
    setSoundEnabled(settings.sound);unlockAudio();window.scrollTo({top:0,behavior:'instant'});
  };
  const play=()=>{setPhase('select');unlockAudio();window.scrollTo({top:0,behavior:'instant'});};
  return <div className="site-shell">
    <header className="site-header">
      <button className="brand" onClick={()=>setPhase('landing')} aria-label="Stick Slam Jam home"><Swords size={23}/><span>STICK<span className="brand-accent">SLAM</span>JAM<span className="brand-dot">✦</span></span></button>
      <nav aria-label="Main navigation"><Link className="header-caption" to="/showcase">ABILITY SHOWCASE ↗</Link><Link className="header-shop" to="/shop">CLASS SHOP <span>{progress.currency.toLocaleString()} C</span></Link>
        <button className="icon-button" aria-label={settings.sound?'Mute sound':'Enable sound'} onClick={()=>changeSettings({...settings,sound:!settings.sound})}>{settings.sound?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>
        {phase!=='fight'&&<button className="icon-button" onClick={()=>setSettingsOpen(v=>!v)} aria-label="Graphics and accessibility settings" aria-expanded={settingsOpen}><SlidersHorizontal size={17}/></button>}
        {phase==='landing'?<button className="header-play" onClick={play}>ENTER THE ARENA <ArrowUpRight size={16}/></button>:<button className="header-play" onClick={()=>setPhase(phase==='fight'?'select':'landing')}>← {phase==='fight'?'FIGHTER SELECT':'HOME'}</button>}
      </nav>
    </header>
    {settingsOpen&&phase!=='fight'&&<section className="settings-panel" aria-label="Game settings">
      <label>Effects quality <select aria-label="Effects quality" value={settings.quality} onChange={e=>changeSettings({...settings,quality:e.target.value as GameSettings['quality']})}><option value="high">High · 720 particles</option><option value="medium">Medium · 360 particles</option><option value="low">Low · 160 particles</option></select></label>
      <label>Character pixelation <select aria-label="Character pixelation" value={settings.pixelation??'moderate'} onChange={e=>changeSettings({...settings,pixelation:e.target.value as GameSettings['pixelation']})}><option value="subtle">Subtle</option><option value="moderate">Moderate</option><option value="strong">Strong</option></select></label>
      <label><input type="checkbox" checked={settings.reducedMotion} onChange={e=>changeSettings({...settings,reducedMotion:e.target.checked})}/> Reduced motion · no shake, flashes, or camera zoom</label>
      <span>Saved automatically on this device. Change quality between matches.</span>
    </section>}
    {saveError&&<p className="profile-error" role="alert">{saveError}</p>}
    <main>
      {phase==='landing'?<>
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="signal-dot"/> BROWSER BRAWLER / NO DOWNLOADS</div>
          <h1>SMALL STICKS.<br/><span>HUGE</span><br/><em>IMPACT.</em></h1><p>Find your fighter. Break their guard.<br/>Turn one perfect combo into a work of art.</p>
          <button className="play-button" onClick={play}>PLAY NOW <ArrowUpRight size={25}/></button><Link className="play-button online-menu-button" to="/multiplayer">MULTIPLAYER <Swords size={19}/></Link><Link className="hero-shop-link" to="/shop">BROWSE THE CLASS SHOP →</Link><div className="hero-note"><kbd>W A S D</kbd> + mouse <span>or touch to throw down</span></div></div>
          <div className="hero-art"><div className="arena-live"><span className="signal-dot"/> LIVE ENGINE DEMO <span>01 / NEON ROOFTOP</span></div><ArenaPreview settings={settings}/>
            <div className="hero-stamp"><Zap size={20}/><span>EVERY HIT.<br/><strong>FELT.</strong></span></div><div className="demo-caption"><span>SAMURAI <i>×</i> FIRE MONK</span><span>REAL COMBAT. REAL-TIME VFX.</span></div></div>
        </section>
        <section className="game-facts" aria-label="Game features"><div><strong>15</strong><span>FIGHTING STYLES</span></div><div><strong>08</strong><span>BOSS CHALLENGES</span></div><div><strong>03</strong><span>DISTINCT ARENAS</span></div><p>ONE MORE ROUND.<br/><span>You know you want to.</span></p></section>
        <section className="how-to"><div><span className="eyebrow">GET IN. GO ALL OUT.</span><h2>A little technique.<br/>A lot of trouble.</h2></div><ol><li><span>01</span><div><h3>Pick your signature.</h3><p>Blade, bow, fists, or fire. Nine fighters are ready from the start. Win boss drops or save coins in the Class Shop to unlock six more.</p></div></li><li><span>02</span><div><h3>Make it a combo.</h3><p>Chain light hits, hold a heavy to crack their guard, then spend an ability for the finish.</p></div></li><li><span>03</span><div><h3>Earn your legend.</h3><p>Challenge eight bosses for new fighters, auras, trails, and skins. Your rewards save on this browser.</p></div></li></ol></section>
        <section className="last-call"><span>YOUR NEXT GREAT COMBO STARTS HERE.</span><button onClick={play}>LET’S MAKE AN IMPACT <ArrowRight size={22}/></button></section>
      </>:phase==='select'?<div className="selection-wrap"><div className="selection-heading"><div><span className="eyebrow">THE ROSTER / 15 FIGHTERS</span><h1>MAKE YOUR MARK.</h1></div><span>Pick a style. Own the arena.</span></div><ClassSelect key={matchKey} selected={playerClass} onSelect={chooseClass} arena={arena} onArenaChange={chooseArena} onStart={startFight} useAltWeapon={useAltWeapon} onAltWeaponChange={chooseWeapon}/><SaveTools onImport={()=>{setMatchKey(k=>k+1);setSettings(readSettings());}}/><ControlsBar/></div>:<div className="fight-wrap"><div className="match-heading"><span><i className="signal-dot"/> {bossMode?'BOSS CHALLENGE':'VERSUS'} / {arena.toUpperCase()}</span><span>1—4 ABILITIES · P PAUSE · R REMATCH</span></div><div className="game-viewport"><StickFightGame key={matchKey} settings={settings} playerClass={playerClass} enemyClass={enemyClass} arena={arena} bossMode={bossMode} useAltWeapon={useAltWeapon} onExit={()=>setPhase('select')} onPlayerWin={bossWin}/></div><ControlsBar/></div>}
    </main>
    <div className="site-save-status"><SaveStatus/></div><footer className="site-footer"><span>STICK SLAM JAM <span className="brand-accent">/</span> ALL FIGHT. ALL FEEL.</span><span>Browser play · Local saves · No account needed</span></footer>
    {reward&&<RewardModal result={reward} bossId={rewardBoss??undefined} onClose={()=>{setReward(null);setRewardBoss(null);}}/>}
  </div>;
};
const ControlsBar=()=> <div className="controls-bar">{[['A / D','MOVE'],['W / SPACE','JUMP'],['LMB / J','LIGHT'],['RMB / K','HOLD HEAVY'],['1 2 3 4','ABILITIES'],['SHIFT / L','DASH'],['F / S','BLOCK'],['E','PICK UP FISH']].map(([key,label])=><div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div>;
export default Index;
