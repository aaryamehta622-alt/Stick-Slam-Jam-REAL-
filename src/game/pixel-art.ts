import type { GameState } from './engine';
import type { Fighter } from './types';
import { computeJoints } from './stick';
import type { Pixelation } from './settings';
import { drawEnvironment } from './environment';
export const CHARACTER_PIXEL_SIZE:Record<Pixelation,number>={subtle:1.35,moderate:2,strong:3};

/** Visual pose sampling only. Collision continues to use computeJoints at exact simulation time. */
export function computeVisualJoints(f:Fighter,now:number){
  let sample=now;
  if(f.attack){
    const a=f.attack,t=Math.max(0,now-a.startTime);
    const begin=t<a.activeStart?0:t<a.activeEnd?a.activeStart:a.activeEnd;
    const finish=t<a.activeStart?a.activeStart:t<a.activeEnd?a.activeEnd:a.duration;
    // Keep anticipation, contact and recovery boundaries exact; hold poses inside each phase.
    const frames=t<a.activeStart?3:t<a.activeEnd?4:5,span=Math.max(.001,finish-begin);
    const stepped=Math.floor(Math.max(0,t-begin)/span*frames)/frames;
    sample=a.startTime+begin+Math.min(1,stepped)*span;
  }
  const phase=Math.floor(f.walkPhase/(Math.PI/5))*(Math.PI/5);
  const visual={...f,walkPhase:phase};
  const joints=computeJoints(visual,sample);
  if(f.classId==='fisherman'&&f.fishing){
    const age=now-f.fishing.born,sea=f.fishing.ability==='seaBeast';
    const lean=sea?-f.facing*(10+Math.sin(age*32)*2):f.facing*4;
    for(const key of ['head','neck','shoulderL','shoulderR'] as const)joints[key][0]+=lean;
    joints.handR=[f.facing*23,f.y+78];joints.elbowR=[f.facing*10+lean,f.y+66];
    joints.handL=[f.facing*11,f.y+75];joints.elbowL=[-f.facing*8+lean,f.y+66];
    if(f.fishing.ability==='freshCatch'&&age>1.08)joints.handL=[joints.head[0]+f.facing*9,joints.head[1]-4];
  }
  // Root motion and jump height remain smooth. Only local pose coordinates snap.
  for(const point of Object.values(joints)){point[0]=Math.round(point[0]*2)/2;point[1]=Math.round((point[1]-f.y)*2)/2+f.y;}
  return joints;
}
let actorCanvas:HTMLCanvasElement|null=null,environmentCanvas:HTMLCanvasElement|null=null;
export function drawPixelCharacters(out:CanvasRenderingContext2D,state:GameState,ground:number,paint:(c:CanvasRenderingContext2D,f:Fighter,ground:number,time:number)=>void){
  const pixel=CHARACTER_PIXEL_SIZE[state.settings?.pixelation??'moderate'];
  actorCanvas??=document.createElement('canvas');const width=Math.ceil(1200/pixel),height=Math.ceil(540/pixel);
  if(actorCanvas.width!==width||actorCanvas.height!==height){actorCanvas.width=width;actorCanvas.height=height;}
  const c=actorCanvas.getContext('2d');if(!c)return;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,height);c.setTransform(1/pixel,0,0,1/pixel,0,0);
  paint(c,state.player,ground,state.time);paint(c,state.enemy,ground,state.time);
  out.save();out.imageSmoothingEnabled=false;out.drawImage(actorCanvas,0,0,width,height,0,0,width*pixel,height*pixel);out.restore();
}
export function drawRetroEnvironment(out:CanvasRenderingContext2D,state:GameState,ground:number,cameraX?:number){
  const pixel=2;environmentCanvas??=document.createElement('canvas');
  if(environmentCanvas.width!==600||environmentCanvas.height!==270){environmentCanvas.width=600;environmentCanvas.height=270;}
  const c=environmentCanvas.getContext('2d');if(!c)return;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,600,270);c.setTransform(1/pixel,0,0,1/pixel,0,0);
  drawEnvironment(c,state.arena,state.time,ground,cameraX);
  out.save();out.imageSmoothingEnabled=false;out.drawImage(environmentCanvas,0,0,600,270,0,0,1200,540);out.restore();
}
