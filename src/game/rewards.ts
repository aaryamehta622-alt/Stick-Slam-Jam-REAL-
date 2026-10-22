import { COSMETICS,BOSS_REWARDS,type DropResult,type Rarity } from './reward-catalog';
import type { BossId,ClassId } from './classes';
import { createSaveId,getProgress,mergeProgress,transactProgress,validateProgress } from './progress';
import { readSettings,saveSettings } from './settings';
export * from './reward-catalog';
export * from './progress';
export function isClassUnlocked(id:ClassId){return getProgress().unlockedClasses.includes(id);}
export function getEquippedFor(klass:ClassId){
  const p=getProgress(),find=(id?:string)=>COSMETICS.find(c=>c.id===id);
  return {aura:find(p.equipped.aura),trail:find(p.equipped.trail),hitFx:find(p.equipped.hitFx),skin:find(p.equipped.skin[klass])};
}
export function exportProgress(){return JSON.stringify({game:'stick-slam-jam',version:2,progress:getProgress(),settings:readSettings()},null,2);}
export async function importProgress(json:string){
  const parsed=JSON.parse(json);
  if(parsed?.game==='stick-slam-jam'&&![1,2].includes(parsed.version))throw new Error('This backup needs a newer game version.');
  const raw=parsed?.game==='stick-slam-jam'?parsed.progress:parsed;
  const imported=validateProgress(raw);await mergeProgress(imported,{selection:typeof raw.selectedClass==='string',preferences:!!raw.preferences&&typeof raw.preferences==='object'});
  if(parsed?.settings&&!saveSettings(parsed.settings))throw new Error('Progress imported, but browser storage could not save the graphics/audio settings.');
}
export const REWARD_JOURNAL_PREFIX='stickfight-progress-v1:reward:';
interface RewardJournal {boss:BossId;claimId:string;rolls:[number,number,number]}
function journal(value:unknown):RewardJournal|null{
  const j=value as RewardJournal;
  return j&&Object.prototype.hasOwnProperty.call(BOSS_REWARDS,j.boss)&&typeof j.claimId==='string'&&j.claimId.length>0&&j.claimId.length<=100&&Array.isArray(j.rolls)&&j.rolls.length===3&&j.rolls.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<1)?j:null;
}
/** Journal synchronously at the winning frame, then commit under the cross-tab write lock. */
export async function rollBossReward(boss:BossId,claimId=createSaveId()):Promise<DropResult>{
  const cfg=BOSS_REWARDS[boss];if(!cfg)throw new Error('Unknown boss.');
  const key=REWARD_JOURNAL_PREFIX+claimId;
  let pendingWin:RewardJournal|null=null;
  try{pendingWin=journal(JSON.parse(localStorage.getItem(key)??'null'));}catch{/* A fresh journal will be attempted. */}
  if(pendingWin?.boss!==boss||pendingWin.claimId!==claimId)pendingWin={boss,claimId,rolls:[Math.random(),Math.random(),Math.random()]};
  try{localStorage.setItem(key,JSON.stringify(pendingWin));}catch{/* The pending in-memory operation still supports retry/export. */}
  const [classRoll,extraRoll,cosmeticRoll]=pendingWin.rolls;
  const transaction=await transactProgress(p=>{
    if(p.claimedRewards.includes(claimId))return {currency:0,xp:0,rarity:'common' as Rarity,alreadyClaimed:true};
    const result:DropResult={currency:cfg.currency,xp:cfg.xp,rarity:'common'};
    if(cfg.classUnlock&&cfg.classChance>0&&classRoll<cfg.classChance){
      if(!p.unlockedClasses.includes(cfg.classUnlock)){p.unlockedClasses.push(cfg.classUnlock);result.classUnlocked=cfg.classUnlock;result.rarity=cfg.classUnlock==='elementalist'?'legendary':'epic';}
      else{result.currency+=50;result.alreadyOwned=true;}
    }
    const wantCosmetic=!result.classUnlocked||extraRoll<.35;
    if(wantCosmetic&&cfg.cosmeticPool.length){
      const unowned=cfg.cosmeticPool.filter(id=>!p.cosmetics.includes(id)),pool=unowned.length?unowned:cfg.cosmeticPool;
      const cosmetic=COSMETICS.find(c=>c.id===pool[Math.min(pool.length-1,Math.floor(cosmeticRoll*pool.length))]);
      if(cosmetic){if(!p.cosmetics.includes(cosmetic.id))p.cosmetics.push(cosmetic.id);result.cosmetic=cosmetic;
        const order:Rarity[]=['common','rare','epic','legendary'];if(order.indexOf(cosmetic.rarity)>order.indexOf(result.rarity))result.rarity=cosmetic.rarity;}
    }
    p.currency+=result.currency;p.coinsEarned+=result.currency;p.xp+=result.xp;
    p.bossWins[boss]=(p.bossWins[boss]??0)+1;p.claimedRewards.push(claimId);p.claimedRewards=p.claimedRewards.slice(-256);
    return result;
  },{queueOnFailure:true});
  if(transaction.saved)try{localStorage.removeItem(key);}catch{/* Replaying this journal is idempotent. */}
  return {...transaction.value,saved:transaction.saved};
}
export async function recoverPendingRewards(){
  const wins:RewardJournal[]=[];
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(REWARD_JOURNAL_PREFIX))continue;try{const win=journal(JSON.parse(localStorage.getItem(key)!));if(win&&key===REWARD_JOURNAL_PREFIX+win.claimId)wins.push(win);}catch{/* Preserve unreadable recovery data. */}}}catch{return;}
  for(const win of wins)await rollBossReward(win.boss,win.claimId);
}
