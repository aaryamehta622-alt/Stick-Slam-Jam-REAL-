export type Quality='low'|'medium'|'high';
export type Pixelation='subtle'|'moderate'|'strong';
export interface GameSettings {quality:Quality;reducedMotion:boolean;sound:boolean;pixelation?:Pixelation}
export const SETTINGS_KEY='stick-slam-settings-v1';
export const PARTICLE_BUDGET:Record<Quality,number>={low:160,medium:360,high:720};
export function normalizeSettings(value:unknown):GameSettings {
  const saved=value&&typeof value==='object'?value as Partial<GameSettings>:{};
  return {quality:['low','medium','high'].includes(saved.quality)?saved.quality:'high',
    reducedMotion:typeof saved.reducedMotion==='boolean'?saved.reducedMotion:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,
    sound:typeof saved.sound==='boolean'?saved.sound:true,pixelation:['subtle','moderate','strong'].includes(saved.pixelation)?saved.pixelation:'moderate'};
}
export function readSettings():GameSettings {
  for(const key of [SETTINGS_KEY,`${SETTINGS_KEY}:backup`]){try{const raw=localStorage.getItem(key);if(raw)return normalizeSettings(JSON.parse(raw));}catch{/* Try the last-good mirror. */}}
  return normalizeSettings({});
}
export function saveSettings(value:unknown):boolean {
  try{const data=JSON.stringify({version:2,...normalizeSettings(value)});localStorage.setItem(SETTINGS_KEY,data);try{localStorage.setItem(`${SETTINGS_KEY}:backup`,data);}catch{/* Main record committed. */}return true;}catch{return false;}
}