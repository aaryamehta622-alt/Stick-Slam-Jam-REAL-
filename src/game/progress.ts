import { BOSS_ORDER, CLASS_ORDER, type BossId, type ClassId } from './classes';
import { COSMETICS, type CosmeticKind } from './reward-catalog';

// Keep the deployed v1 key. A release must never move players to an empty save.
export const PROGRESS_KEY = 'stickfight-progress-v1';
export const BACKUP_KEY = `${PROGRESS_KEY}:backup`;
export const RECOVERY_KEY = `${PROGRESS_KEY}:recovery`;
export const DEFAULT_UNLOCKED: readonly ClassId[] = ['fisherman','samurai','boxer','viking','archer','mage','lightning','fireMonk','stormMage'];
export interface PurchaseReceipt { id:string; classId:ClassId; price:number; at:number }
export interface Progress {
  schemaVersion:2; revision:number; updatedAt:number;
  unlockedClasses:ClassId[]; cosmetics:string[];
  equipped:{aura?:string;trail?:string;hitFx?:string;skin:Partial<Record<ClassId,string>>};
  currency:number; xp:number; selectedClass:ClassId;
  preferences:{arena:'dojo'|'rooftop'|'volcano';alternateWeapon:boolean;touchControls:boolean};
  bossWins:Partial<Record<BossId,number>>;
  coinsEarned:number; coinsSpent:number; purchases:PurchaseReceipt[]; claimedRewards:string[];
}
export type SaveKind='ready'|'saved'|'saving'|'pending'|'recovered'|'unavailable'|'corrupt';
export interface SaveStatus { kind:SaveKind; message:string; updatedAt:number; pending:number }
export class ProgressError extends Error {}
const listeners=new Set<()=>void>();
let storeVersion=0, saving=false, writeQueue:Promise<unknown>=Promise.resolve();
type Mutation=(p:Progress)=>unknown;
let pending:Mutation[]=[];
let readProblem:SaveKind='ready',problemText='';
let localId=0;
export function createSaveId(){return typeof crypto?.randomUUID==='function'?crypto.randomUUID():`local-${Date.now()}-${++localId}`;}
const integer=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?Math.min(v,1e12):fallback;
const timestamp=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:0;
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const unique=<T,>(a:T[])=>[...new Set(a)];
export function defaultProgress():Progress {
  return {schemaVersion:2,revision:0,updatedAt:0,unlockedClasses:[...DEFAULT_UNLOCKED],cosmetics:[],equipped:{skin:{}},currency:0,xp:0,selectedClass:'samurai',
    preferences:{arena:'dojo',alternateWeapon:false,touchControls:false},bossWins:{},coinsEarned:0,coinsSpent:0,purchases:[],claimedRewards:[]};
}
/** Accept legacy records and sanitize every persisted reference before it reaches gameplay. */
export function validateProgress(value:unknown):Progress {
  const raw=record(value),base=defaultProgress();
  if(typeof raw.schemaVersion==='number'&&raw.schemaVersion>2)throw new ProgressError('This save needs a newer game version. Your original data was kept.');
  if(!Array.isArray(raw.unlockedClasses)||!Array.isArray(raw.cosmetics))throw new ProgressError('The local save could not be read. Import a save backup to recover it.');
  for(const key of ['currency','xp'])if(raw[key]!==undefined&&(typeof raw[key]!=='number'||!Number.isSafeInteger(raw[key])||(raw[key] as number)<0||(raw[key] as number)>1e12))throw new ProgressError('The local save has an invalid balance or XP value. Its original data was kept.');
  base.unlockedClasses=unique([...base.unlockedClasses,...raw.unlockedClasses.filter((id):id is ClassId=>CLASS_ORDER.includes(id))]);
  base.cosmetics=unique(raw.cosmetics.filter((id):id is string=>typeof id==='string'&&COSMETICS.some(c=>c.id===id)));
  const equipped=record(raw.equipped),skins=record(equipped.skin);
  for(const kind of ['aura','trail','hitFx'] as const){const id=equipped[kind];if(typeof id==='string'&&base.cosmetics.includes(id)&&COSMETICS.some(c=>c.id===id&&c.kind===kind))base.equipped[kind]=id;}
  for(const klass of CLASS_ORDER){const id=skins[klass];if(typeof id==='string'&&base.cosmetics.includes(id)&&COSMETICS.some(c=>c.id===id&&c.kind==='skin'&&(!c.forClass||c.forClass===klass)))base.equipped.skin[klass]=id;}
  base.currency=integer(raw.currency);base.xp=integer(raw.xp);base.revision=integer(raw.revision);base.updatedAt=timestamp(raw.updatedAt);
  const receipts=Array.isArray(raw.purchases)?raw.purchases:[];
  for(const item of receipts){const r=record(item),id=r.classId;if(typeof id!=='string'||!CLASS_ORDER.includes(id as ClassId)||DEFAULT_UNLOCKED.includes(id as ClassId)||base.purchases.some(p=>p.classId===id))continue;
    if(typeof r.id!=='string'||!r.id||!integer(r.price))continue;
    base.purchases.push({id:r.id.slice(0,100),classId:id as ClassId,price:integer(r.price),at:timestamp(r.at)});
    if(!base.unlockedClasses.includes(id as ClassId))base.unlockedClasses.push(id as ClassId);
  }
  const receiptTotal=base.purchases.reduce((n,p)=>n+p.price,0);
  base.coinsSpent=Math.max(integer(raw.coinsSpent),receiptTotal);
  base.coinsEarned=Math.max(integer(raw.coinsEarned),base.currency+base.coinsSpent);
  base.selectedClass=base.unlockedClasses.includes(raw.selectedClass as ClassId)?raw.selectedClass as ClassId:'samurai';
  const prefs=record(raw.preferences);
  base.preferences={arena:['dojo','rooftop','volcano'].includes(prefs.arena as string)?prefs.arena as Progress['preferences']['arena']:'dojo',alternateWeapon:prefs.alternateWeapon===true,touchControls:prefs.touchControls===true};
  const wins=record(raw.bossWins);for(const boss of BOSS_ORDER)if(integer(wins[boss]))base.bossWins[boss]=integer(wins[boss]);
  base.claimedRewards=Array.isArray(raw.claimedRewards)?unique(raw.claimedRewards.filter((x):x is string=>typeof x==='string'&&x.length>0&&x.length<=100)).slice(-256):[];
  return base;
}
function parse(raw:string|null):Progress|null {if(!raw)return null;try{return validateProgress(JSON.parse(raw));}catch{return null;}}
function load():{progress:Progress;raw:string|null;canWrite:boolean;legacy:boolean;future?:boolean} {
  readProblem='ready';problemText='';
  try {
    const raw=localStorage.getItem(PROGRESS_KEY),backup=localStorage.getItem(BACKUP_KEY),valid=parse(raw);
    let newer=false;try{newer=!!raw&&JSON.parse(raw).schemaVersion>2;}catch{/* Malformed data is handled below. */}
    if(newer){readProblem='corrupt';problemText='This save needs a newer game version. Original data retained.';return {progress:parse(backup)??defaultProgress(),raw,canWrite:false,legacy:false,future:true};}
    if(valid){
      const legacy=JSON.parse(raw!).schemaVersion!==2,prior=parse(backup);
      // An already-open old release can still write its six-field v1 record after deployment.
      // Keep newer receipts/preferences and reconcile a stale pre-purchase balance from ownership.
      if(legacy&&prior&&JSON.parse(backup!).schemaVersion===2){
        const unaccounted=prior.purchases.filter(r=>!valid.unlockedClasses.includes(r.classId)).reduce((n,r)=>n+r.price,0);
        valid.currency=Math.max(0,valid.currency-unaccounted);
        valid.unlockedClasses=unique([...prior.unlockedClasses,...valid.unlockedClasses]);valid.cosmetics=unique([...prior.cosmetics,...valid.cosmetics]);
        valid.purchases=prior.purchases;valid.coinsSpent=prior.coinsSpent;valid.coinsEarned=Math.max(prior.coinsEarned,valid.currency+prior.coinsSpent);
        valid.xp=Math.max(valid.xp,prior.xp);valid.selectedClass=prior.selectedClass;valid.preferences=prior.preferences;valid.bossWins=prior.bossWins;valid.claimedRewards=prior.claimedRewards;valid.revision=prior.revision;
      }
      return {progress:valid,raw,canWrite:true,legacy};
    }
    const recovered=parse(backup);
    if(recovered){readProblem='recovered';problemText='Recovered your last good local save.';return {progress:recovered,raw,canWrite:true,legacy:true};}
    if(raw||backup){readProblem='corrupt';problemText='Save unreadable. Original data retained; import a backup to recover it.';return {progress:defaultProgress(),raw,canWrite:false,legacy:false};}
    return {progress:defaultProgress(),raw:null,canWrite:true,legacy:false};
  } catch {readProblem='unavailable';problemText='Browser storage is unavailable. Allow site storage, then retry saving.';return {progress:defaultProgress(),raw:null,canWrite:false,legacy:false};}
}
export function getProgress():Progress {
  const p=load().progress;for(const change of pending)change(p);return p;
}
export function getSaveStatus():SaveStatus {
  const p=getProgress();
  if(saving)return {kind:'saving',message:'Saving…',updatedAt:p.updatedAt,pending:pending.length};
  if(pending.length)return {kind:'pending',message:'Progress is not saved yet. Retry or export a backup before leaving.',updatedAt:p.updatedAt,pending:pending.length};
  return {kind:readProblem==='ready'?(p.updatedAt?'saved':'ready'):readProblem,message:problemText||(p.updatedAt?'Saved on this browser':'Local save ready'),updatedAt:p.updatedAt,pending:0};
}
function notify(){storeVersion++;for(const f of listeners)f();}
export const getProgressVersion=()=>storeVersion;
export function subscribeProgress(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===null||e.key===PROGRESS_KEY||e.key===BACKUP_KEY)notify();});

function write(p:Progress,previousRaw:string|null,repair=false){
  // setItem is atomic: debit, ownership, and receipt commit in ONE record.
  // A failed main write never changes the durable balance or ownership.
  if(repair&&previousRaw&&!parse(previousRaw))localStorage.setItem(RECOVERY_KEY,previousRaw);
  const data=JSON.stringify({...p,schemaVersion:2,revision:p.revision+1,updatedAt:Date.now()});
  localStorage.setItem(PROGRESS_KEY,data);
  // Independent last-good mirror. Failure here does not roll back a committed main record.
  try{localStorage.setItem(BACKUP_KEY,data);}catch{/* Main record remains durable. */}
}
async function locked<T>(task:()=>T):Promise<T>{
  const run=()=>typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(`${PROGRESS_KEY}:write`,task):Promise.resolve().then(task);
  const result=writeQueue.then(run,run);writeQueue=result.catch(()=>{});return result;
}
export async function transactProgress<T>(change:(p:Progress)=>T,options:{queueOnFailure?:boolean;repair?:boolean}={}):Promise<{value:T;saved:boolean}>{
  return locked(()=>{
    saving=true;notify();
    const disk=load(),p=disk.progress;for(const item of pending)item(p);
    let value:T;
    try {value=change(p);}catch(error){saving=false;notify();throw error;}
    try {
      if(disk.future||!disk.canWrite&&!options.repair)throw new ProgressError(problemText||'Unable to save. No coins were spent.');
      write(p,disk.raw,options.repair||readProblem==='recovered');pending=[];saving=false;notify();return {value,saved:true};
    } catch(error) {
      if(options.queueOnFailure){pending.push(change);saving=false;notify();return {value,saved:false};}
      saving=false;notify();throw error instanceof ProgressError?error:new ProgressError('Could not save this transaction. No coins were spent. Check browser storage and retry.');
    }
  });
}
export async function flushProgress():Promise<boolean>{
  return locked(()=>{
    const disk=load();if(!pending.length&&!disk.legacy)return disk.canWrite;
    if(!disk.canWrite)return false;
    const p=disk.progress;for(const change of pending)change(p);
    try{write(p,disk.raw,readProblem==='recovered');pending=[];notify();return true;}catch{notify();return false;}
  });
}
export function startAutosave(){
  void flushProgress();const timer=window.setInterval(()=>{void flushProgress();},30000);
  const save=()=>{if(document.visibilityState==='hidden')void flushProgress();};document.addEventListener('visibilitychange',save);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',save);};
}
export async function selectClass(id:ClassId){return transactProgress(p=>{if(!p.unlockedClasses.includes(id))throw new ProgressError('Unlock this class first.');if(p.selectedClass!==id)p.preferences.alternateWeapon=false;p.selectedClass=id;},{queueOnFailure:true});}
export async function savePreferences(prefs:Partial<Progress['preferences']>){return transactProgress(p=>{p.preferences={...p.preferences,...prefs};},{queueOnFailure:true});}
export async function equipCosmetic(kind:CosmeticKind,id:string|null,klass?:ClassId){
  return transactProgress(p=>{
    if(id&&!p.cosmetics.includes(id))throw new ProgressError('Earn this cosmetic before equipping it.');
    if(id&&!COSMETICS.some(c=>c.id===id&&c.kind===kind&&(kind!=='skin'||!c.forClass||c.forClass===klass)))throw new ProgressError('This cosmetic does not match the fighter or slot.');
    if(kind==='skin'){if(!klass)return;if(id)p.equipped.skin[klass]=id;else delete p.equipped.skin[klass];}
    else if(id)p.equipped[kind]=id;else delete p.equipped[kind];
  },{queueOnFailure:true});
}
export async function mergeProgress(imported:Progress,options:{selection?:boolean;preferences?:boolean}={selection:true,preferences:true}){
  return transactProgress(current=>{
    current.unlockedClasses=unique([...current.unlockedClasses,...imported.unlockedClasses]);current.cosmetics=unique([...current.cosmetics,...imported.cosmetics]);
    current.equipped={...current.equipped,...imported.equipped,skin:{...current.equipped.skin,...imported.equipped.skin}};
    for(const receipt of imported.purchases)if(!current.purchases.some(r=>r.classId===receipt.classId))current.purchases.push(receipt);
    current.coinsSpent=Math.max(current.coinsSpent,imported.coinsSpent,current.purchases.reduce((n,r)=>n+r.price,0));
    current.coinsEarned=Math.max(current.coinsEarned,imported.coinsEarned);
    current.currency=Math.max(0,current.coinsEarned-current.coinsSpent);current.xp=Math.max(current.xp,imported.xp);
    for(const boss of BOSS_ORDER)current.bossWins[boss]=Math.max(current.bossWins[boss]??0,imported.bossWins[boss]??0);
    if(options.selection)current.selectedClass=imported.selectedClass;
    if(options.preferences)current.preferences=imported.preferences;
    current.claimedRewards=unique([...current.claimedRewards,...imported.claimedRewards]).slice(-256);
  },{repair:true});
}
