import { beforeEach,describe,expect,it,vi } from 'vitest';
import { BACKUP_KEY,PROGRESS_KEY,RECOVERY_KEY,defaultProgress,equipCosmetic,flushProgress,getProgress,getSaveStatus,savePreferences,selectClass,validateProgress } from './progress';
import { exportProgress,importProgress,rollBossReward,recoverPendingRewards,REWARD_JOURNAL_PREFIX } from './rewards';
import { CLASS_SHOP,purchaseClass } from './shop';
import { BOSS_REWARDS } from './reward-catalog';
import { readSettings,saveSettings,SETTINGS_KEY } from './settings';
const seed=(coins=5000)=>localStorage.setItem(PROGRESS_KEY,JSON.stringify({...defaultProgress(),currency:coins,coinsEarned:coins}));
beforeEach(async()=>{vi.restoreAllMocks();await flushProgress();localStorage.clear();});
describe('durable progression and class shop',()=>{
  it('migrates a real v1 record without removing unlocks, coins, XP or equipment',async()=>{
    const legacy={unlockedClasses:['samurai','ninja'],cosmetics:['aura-fire','skin-ninja-void'],currency:1234,xp:450,equipped:{aura:'aura-fire',skin:{ninja:'skin-ninja-void'}}};
    localStorage.setItem(PROGRESS_KEY,JSON.stringify(legacy));await flushProgress();const p=getProgress();
    expect(p.schemaVersion).toBe(2);expect(p.currency).toBe(1234);expect(p.xp).toBe(450);expect(p.unlockedClasses).toContain('ninja');expect(p.equipped.skin.ninja).toBe('skin-ninja-void');expect(localStorage.getItem(BACKUP_KEY)).toBeTruthy();
  });
  it('keeps 1,000 earned coins after repeated independent reads',async()=>{
    for(let i=0;i<20;i++)await rollBossReward('giantBrute',`brute-${i}`);
    expect(getProgress().currency).toBe(1000);expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).currency).toBe(1000);expect(getProgress().bossWins.giantBrute).toBe(20);
  });
  it('atomically spends 2,000 from 5,000 and persists Ninja and the 3,000 balance',async()=>{
    seed();expect(await purchaseClass('ninja',2000)).toMatchObject({ok:true,price:2000});
    const disk=validateProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY)!));expect(disk.currency).toBe(3000);expect(disk.unlockedClasses).toContain('ninja');expect(disk.purchases).toHaveLength(1);expect(disk.coinsSpent).toBe(2000);
  });
  it('serializes duplicate and simultaneous different-class purchases without a negative balance',async()=>{
    seed(3000);const results=await Promise.all([purchaseClass('ninja',2000),purchaseClass('ninja',2000),purchaseClass('sniper',2200)]);
    expect(results.filter(r=>r.ok)).toHaveLength(1);expect(getProgress().currency).toBe(1000);expect(getProgress().purchases).toHaveLength(1);
  });
  it('rejects insufficient coins, starters, unknown IDs, and stale confirmed prices',async()=>{
    seed(1999);for(const [id,price] of [['ninja',2000],['samurai',1],['missing',1],['ninja',1900]] as const)expect((await purchaseClass(id as 'ninja',price)).ok).toBe(false);
    expect(getProgress().currency).toBe(1999);expect(getProgress().purchases).toHaveLength(0);
  });
  it('never spends coins or grants a purchase when the main storage write fails',async()=>{
    seed();const old=localStorage.getItem(PROGRESS_KEY);const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError');});
    expect((await purchaseClass('ninja',2000)).ok).toBe(false);expect(localStorage.getItem(PROGRESS_KEY)).toBe(old);expect(getProgress().currency).toBe(5000);expect(getProgress().unlockedClasses).not.toContain('ninja');spy.mockRestore();
  });
  it('retains a failed reward in memory and saves it once when storage recovers',async()=>{
    seed(0);const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError');});
    const reward=await rollBossReward('giantBrute','retryable-win');expect(reward.saved).toBe(false);expect(getProgress().currency).toBe(50);expect(getSaveStatus().kind).toBe('pending');expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).currency).toBe(0);
    spy.mockRestore();expect(await flushProgress()).toBe(true);await flushProgress();expect(getProgress().currency).toBe(50);expect(getSaveStatus().pending).toBe(0);
  });
  it('deduplicates a boss win claim even when two callbacks race',async()=>{
    await Promise.all([rollBossReward('giantBrute','one-win'),rollBossReward('giantBrute','one-win')]);expect(getProgress().currency).toBe(50);expect(getProgress().bossWins.giantBrute).toBe(1);
  });
  it('replays a winning-frame journal after an interrupted tab without duplicating the reward',async()=>{
    const key=REWARD_JOURNAL_PREFIX+'interrupted-win';localStorage.setItem(key,JSON.stringify({boss:'shadowAssassin',claimId:'interrupted-win',rolls:[0,.9,.5]}));
    await recoverPendingRewards();expect(getProgress().currency).toBe(80);expect(getProgress().unlockedClasses).toContain('ninja');expect(localStorage.getItem(key)).toBeNull();await recoverPendingRewards();expect(getProgress().bossWins.shadowAssassin).toBe(1);
  });
  it('preserves real timestamps and recovers a damaged balance from the good mirror',async()=>{
    seed();await purchaseClass('ninja',2000);expect(Math.abs(getProgress().updatedAt-Date.now())).toBeLessThan(1000);const damaged=JSON.parse(localStorage.getItem(PROGRESS_KEY)!);damaged.currency='broken';localStorage.setItem(PROGRESS_KEY,JSON.stringify(damaged));expect(getProgress().currency).toBe(3000);expect(getSaveStatus().kind).toBe('recovered');
  });
  it('keeps the original class drop probabilities and grants the same ownership as a purchase',async()=>{
    expect(Object.values(BOSS_REWARDS).map(r=>r.classChance)).toEqual([0,.18,.15,.05,.20,.18,.12,.15]);
    vi.spyOn(Math,'random').mockReturnValue(0);const drop=await rollBossReward('shadowAssassin');expect(drop.classUnlocked).toBe('ninja');expect(getProgress().unlockedClasses).toContain('ninja');expect((await purchaseClass('ninja',2000)).ok).toBe(false);
  });
  it('keeps the existing +50 coin duplicate class rule after buying a class',async()=>{
    seed();await purchaseClass('ninja',2000);vi.spyOn(Math,'random').mockReturnValue(0);const drop=await rollBossReward('shadowAssassin');expect(drop.alreadyOwned).toBe(true);expect(drop.currency).toBe(130);expect(getProgress().currency).toBe(3130);expect(getProgress().unlockedClasses.filter(c=>c==='ninja')).toHaveLength(1);
  });
  it('recovers a corrupt primary from its last-good mirror and preserves the corrupt text',async()=>{
    seed();await purchaseClass('ninja',2000);localStorage.setItem(PROGRESS_KEY,'{broken');expect(getProgress().currency).toBe(3000);expect(getSaveStatus().kind).toBe('recovered');await flushProgress();expect(localStorage.getItem(RECOVERY_KEY)).toBe('{broken');expect(getProgress().unlockedClasses).toContain('ninja');
  });
  it('does not overwrite an unreadable save or a save from a future release',async()=>{
    for(const raw of ['{broken',JSON.stringify({...defaultProgress(),schemaVersion:99,currency:9999})]){localStorage.clear();localStorage.setItem(PROGRESS_KEY,raw);expect((await purchaseClass('ninja',2000)).ok).toBe(false);await flushProgress();expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);}
  });
  it('does not replace a future primary with an older backup',async()=>{
    seed();localStorage.setItem(BACKUP_KEY,localStorage.getItem(PROGRESS_KEY)!);const raw=JSON.stringify({...defaultProgress(),schemaVersion:99});localStorage.setItem(PROGRESS_KEY,raw);expect(await flushProgress()).toBe(false);await expect(importProgress(JSON.stringify(defaultProgress()))).rejects.toThrow();expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
  });
  it('does not refund spending when the same pre-purchase backup is imported repeatedly',async()=>{
    seed();const before=exportProgress();await purchaseClass('ninja',2000);await importProgress(before);await importProgress(before);expect(getProgress().currency).toBe(3000);expect(getProgress().purchases).toHaveLength(1);expect(getProgress().unlockedClasses).toContain('ninja');
  });
  it('retains a new purchase when an old open v1 tab writes a stale reward record',async()=>{
    seed();const oldTabRead=getProgress();await purchaseClass('ninja',2000);
    localStorage.setItem(PROGRESS_KEY,JSON.stringify({unlockedClasses:oldTabRead.unlockedClasses,cosmetics:[],equipped:{},currency:5080,xp:150}));
    await flushProgress();expect(getProgress().currency).toBe(3080);expect(getProgress().unlockedClasses).toContain('ninja');expect(getProgress().purchases).toHaveLength(1);expect(getProgress().coinsSpent).toBe(2000);
  });
  it('keeps selected class and preferences when an old backup never contained them',async()=>{
    seed();await purchaseClass('ninja',2000);await selectClass('ninja');await savePreferences({arena:'volcano',alternateWeapon:true});await selectClass('ninja');
    await importProgress(JSON.stringify({unlockedClasses:['samurai'],cosmetics:[],currency:5000,xp:0}));
    expect(getProgress().selectedClass).toBe('ninja');expect(getProgress().preferences).toMatchObject({arena:'volcano',alternateWeapon:true});expect(getProgress().currency).toBe(3000);
  });
  it('restores purchases, selected class, equipment, boss wins and settings from a new backup',async()=>{
    seed();await purchaseClass('ninja',2000);await selectClass('ninja');await savePreferences({arena:'volcano',alternateWeapon:true,touchControls:true});vi.spyOn(Math,'random').mockReturnValue(0);await rollBossReward('shadowAssassin');await equipCosmetic('trail','trail-shadow');saveSettings({quality:'medium',sound:false,pixelation:'strong',reducedMotion:true});
    const original=getProgress(),backup=exportProgress();localStorage.clear();await importProgress(backup);const restored=getProgress();expect(restored).toMatchObject({currency:original.currency,xp:original.xp,selectedClass:'ninja',preferences:original.preferences,bossWins:original.bossWins,purchases:original.purchases,equipped:original.equipped});expect(readSettings()).toMatchObject({quality:'medium',pixelation:'strong',sound:false});
  });
  it('rejects invalid imports and unknown or unowned equipment without erasing a valid save',async()=>{
    seed();await expect(importProgress('{"bad":true}')).rejects.toThrow();await expect(equipCosmetic('aura','aura-fire')).rejects.toThrow();expect(getProgress().currency).toBe(5000);
  });
  it('prices only the six locked classes from existing rarity, difficulty and payout data',()=>{
    expect(CLASS_SHOP.map(e=>[e.classId,e.price])).toEqual([['ninja',2000],['sniper',2200],['gladiator',2400],['assassin',2500],['executioner',3500],['elementalist',7200]]);expect(CLASS_SHOP.every(e=>!defaultProgress().unlockedClasses.includes(e.classId))).toBe(true);
  });
  it('preserves old graphics settings and defaults pixelation to moderate',()=>{
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({quality:'low',sound:false,reducedMotion:true}));expect(readSettings()).toEqual({quality:'low',sound:false,reducedMotion:true,pixelation:'moderate'});
  });
});
