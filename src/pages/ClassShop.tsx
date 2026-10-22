import { useRef,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { CLASSES,BOSSES,type ClassId } from '@/game/classes';
import { CLASS_SHOP,purchaseClass,type ShopEntry } from '@/game/shop';
import { formatChance,getClassRatings } from '@/game/reward-catalog';
import { selectClass } from '@/game/progress';
import { useProgress } from '@/hooks/use-progress';
import { FighterPortrait } from '@/components/FighterPortrait';
import { SaveStatus } from '@/components/SaveStatus';
import { SaveTools } from '@/components/SaveTools';
import { Dialog,DialogContent,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
const coins=(n:number)=>n.toLocaleString('en-US');
export default function ClassShop(){
  const progress=useProgress(),navigate=useNavigate();
  const [inspect,setInspect]=useState<ShopEntry|null>(null),[confirm,setConfirm]=useState<ShopEntry|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const inFlight=useRef(false),owned=(id:ClassId)=>progress.unlockedClasses.includes(id);
  const buy=async()=>{
    if(!confirm||inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('');
    try{const result=await purchaseClass(confirm.classId,confirm.price);
      if(result.ok===true){setMessage(`${CLASSES[result.classId].name} unlocked permanently. ${coins(result.price)} coins spent.`);setConfirm(null);}
      else setMessage(result.message);
    }finally{inFlight.current=false;setBusy(false);}
  };
  const play=async(id:ClassId)=>{await selectClass(id);navigate('/',{state:{screen:'select'}});};
  return <div className="shop-page">
    <header className="shop-header"><Link to="/">← STICK SLAM JAM</Link><Link to="/showcase">ABILITY SHOWCASE ↗</Link><div className="coin-wallet" aria-label="Current coin balance"><span>COINS</span><strong>{coins(progress.currency)}</strong></div></header>
    <main className="shop-main">
      <div className="shop-title"><div><span className="eyebrow">THE CLASS SHOP / EARN IT YOUR WAY</span><h1>YOUR NEXT<br/><em>SIGNATURE.</em></h1></div><div><p>Chase the drop. Or save for the guarantee.<br/>One purchase. Yours to keep.</p><span className="shop-earned-only">EARNED COINS ONLY · NO REAL MONEY</span></div></div>
      <div className="shop-explainer"><span>01 <b>WIN COINS</b> Defeat bosses for coins and XP.</span><span>02 <b>PICK A STYLE</b> Inspect its moves before buying.</span><span>03 <b>KEEP IT</b> Unlocks save on this browser.</span></div>
      <div role="status" className="shop-message">{message}</div>
      <section className="shop-grid" aria-label="Classes available for purchase">
        {CLASS_SHOP.map(entry=>{const fighter=CLASSES[entry.classId],has=owned(entry.classId),short=entry.price-progress.currency;
          return <article className={`shop-card ${has?'is-owned':''}`} key={entry.classId} style={{'--fighter-color':fighter.color} as React.CSSProperties} aria-label={`${fighter.name} shop card`}>
            <div className="shop-card-art"><span className="shop-card-category">{fighter.category.toUpperCase()}</span><FighterPortrait fighter={fighter}/><span className="shop-card-rarity">{entry.classId==='elementalist'?'LEGENDARY':'EPIC'}</span><div className="shop-pixel-floor"/></div>
            <div className="shop-card-body"><div className="shop-card-heading"><h2>{fighter.name}</h2>{has&&<span className="owned-tag">OWNED ✓</span>}</div><p className="shop-class-blurb">{fighter.blurb}</p>
              <dl className="shop-source"><div><dt>BOSS</dt><dd>{BOSSES[entry.bossId].name}</dd></div><div><dt>DROP CHANCE</dt><dd>{formatChance(entry.chance)} <span>· {entry.difficulty}</span></dd></div></dl>
              <div className="shop-price"><span>{coins(entry.price)} <small>COINS</small></span><button onClick={()=>setInspect(entry)} aria-label={`Inspect ${fighter.name}`}>INSPECT ↗</button></div>
              {has?<button className="shop-buy owned" onClick={()=>void play(entry.classId)}>PLAY THIS CLASS →</button>:<button className="shop-buy" disabled={short>0} onClick={()=>{setMessage('');setConfirm(entry);}} aria-label={`Buy ${fighter.name} for ${coins(entry.price)} coins`}>{short>0?`${coins(short)} MORE COINS TO GO`:'BUY CLASS →'}</button>}
            </div>
          </article>;
        })}
      </section>
      <section className="shop-notes"><div><h2>THE DROP STILL COUNTS.</h2><p>Boss drop chances are unchanged. Buying or finding a class grants the same permanent unlock. A duplicate class drop still awards the existing 50-coin bonus.</p></div><div><h2>BUILT FOR THE LONG GAME.</h2><p>Prices follow boss difficulty, drop rarity and existing coin rewards. Ninja is 2,000 coins; the rarest class, Elementalist, is 7,200. Your eight starter classes stay free.</p></div></section>
      <SaveStatus/><SaveTools onImport={()=>setMessage('Save imported. Your ownership and coin balance are up to date.')}/>
      <footer className="shop-footer"><Link to="/">← BACK TO THE ARENA</Link><span>{progress.purchases.length} CLASSES PURCHASED · {Object.values(progress.bossWins).reduce((n,w)=>n+(w??0),0)} BOSS WINS</span></footer>
    </main>
    <Dialog open={!!inspect} onOpenChange={open=>{if(!open)setInspect(null);}}><DialogContent className="class-detail-dialog">{inspect&&<>
      <DialogTitle>{CLASSES[inspect.classId].name}</DialogTitle><DialogDescription>{CLASSES[inspect.classId].blurb} Unlock from {BOSSES[inspect.bossId].name} ({formatChance(inspect.chance)}) or buy for {coins(inspect.price)} earned coins.</DialogDescription>
      <div className="inspect-portrait"><FighterPortrait fighter={CLASSES[inspect.classId]}/></div>
      <dl className="inspect-stats"><div><dt>HEALTH</dt><dd>{CLASSES[inspect.classId].hp}</dd></div><div><dt>SPEED</dt><dd>{getClassRatings(inspect.classId).speed}</dd></div><div><dt>MASTERY</dt><dd>{getClassRatings(inspect.classId).difficulty}</dd></div></dl>
      <ol className="inspect-abilities">{CLASSES[inspect.classId].abilities.map((a,i)=><li key={a.id}><kbd>{i+1}</kbd><span>{a.name}</span><small>{a.cooldown}s COOLDOWN</small></li>)}</ol>
      <Link className="shop-preview-link" to={`/showcase?fighter=${inspect.classId}`}>TRY EVERY ABILITY IN THE SHOWCASE ↗</Link>
    </>}</DialogContent></Dialog>
    <Dialog open={!!confirm} onOpenChange={open=>{if(!open&&!busy)setConfirm(null);}}><DialogContent className="purchase-dialog" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}}>{confirm&&<>
      <DialogTitle>UNLOCK {CLASSES[confirm.classId].name}?</DialogTitle><DialogDescription>Spend {coins(confirm.price)} earned coins to permanently unlock this class in your browser save.</DialogDescription>
      <dl className="purchase-math"><div><dt>YOUR BALANCE</dt><dd>{coins(progress.currency)}</dd></div><div><dt>CLASS PRICE</dt><dd>−{coins(confirm.price)}</dd></div><div><dt>AFTER PURCHASE</dt><dd>{coins(Math.max(0,progress.currency-confirm.price))}</dd></div></dl>
      {message&&<p role="alert">{message}</p>}
      <DialogFooter><button className="shop-cancel" disabled={busy} onClick={()=>setConfirm(null)}>CANCEL</button><button className="shop-buy" disabled={busy||owned(confirm.classId)||progress.currency<confirm.price} onClick={()=>void buy()}>{busy?'SAVING…':owned(confirm.classId)?'ALREADY OWNED':`CONFIRM · ${coins(confirm.price)} COINS`}</button></DialogFooter>
    </>}</DialogContent></Dialog>
  </div>;
}
