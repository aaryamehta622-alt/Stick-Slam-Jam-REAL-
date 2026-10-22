import { BOSS_ORDER,type ClassId,type BossId } from './classes';
import { BOSS_REWARDS,getBossInfo,type Difficulty } from './reward-catalog';
import { createSaveId,DEFAULT_UNLOCKED,ProgressError,transactProgress } from './progress';
export interface ShopEntry {classId:ClassId;bossId:BossId;chance:number;price:number;difficulty:Difficulty;coinsPerWin:number}
const difficultyWeight:Record<Difficulty,number>={Easy:.85,Medium:1,Hard:1.25,Extreme:1.5};
const reference=BOSS_REWARDS.shadowAssassin;
// Anchor: 2,000 Ninja coins. Rarity grows sublinearly to keep the rarest class attainable.
// Boss payouts proxy the existing economy; all bosses are already accessible, so no gate is invented.
export const CLASS_SHOP:readonly ShopEntry[]=BOSS_ORDER.flatMap(bossId=>{
  const reward=BOSS_REWARDS[bossId],difficulty=getBossInfo(bossId).difficulty;
  if(!reward.classUnlock||DEFAULT_UNLOCKED.includes(reward.classUnlock))return [];
  const price=Math.round(2000*Math.pow(reference.classChance/reward.classChance,.6)*difficultyWeight[difficulty]*Math.pow(reward.currency/reference.currency,.25)/100)*100;
  return [{classId:reward.classUnlock,bossId,chance:reward.classChance,price,difficulty,coinsPerWin:reward.currency}];
}).sort((a,b)=>a.price-b.price);
export type PurchaseResult={ok:true;classId:ClassId;price:number}|{ok:false;message:string};
export async function purchaseClass(id:ClassId,confirmedPrice:number):Promise<PurchaseResult>{
  const entry=CLASS_SHOP.find(c=>c.classId===id);
  if(!entry)return {ok:false,message:'This class is not sold in the shop.'};
  if(confirmedPrice!==entry.price)return {ok:false,message:'The price changed. Review the current price before buying.'};
  const receiptId=createSaveId(),at=Date.now();
  try {
    await transactProgress(p=>{
      if(p.unlockedClasses.includes(id))throw new ProgressError('You already own this class. No coins were spent.');
      if(p.currency<entry.price)throw new ProgressError(`You need ${entry.price-p.currency} more coins. No coins were spent.`);
      p.currency-=entry.price;p.coinsSpent+=entry.price;p.unlockedClasses.push(id);
      p.purchases.push({id:receiptId,classId:id,price:entry.price,at});
    });
    return {ok:true,classId:id,price:entry.price};
  } catch(error){return {ok:false,message:error instanceof Error?error.message:'Purchase failed. No coins were spent.'};}
}
