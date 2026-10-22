import { hexAlpha } from '../colors';
import { glow } from '../particles';
export const TAU=Math.PI*2;
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
export const ease=(n:number)=>1-Math.pow(1-clamp(n),3);
export const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function orb(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha=1){
  if(r<=0||alpha<=0)return;c.save();c.globalCompositeOperation='lighter';c.globalAlpha*=alpha;
  c.drawImage(glow(color),x-r,y-r,r*2,r*2);c.restore();
}
export function stroke(c:CanvasRenderingContext2D,draw:()=>void,color:string,width=3,core=true){
  c.save();const alpha=c.globalAlpha;c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
  c.globalAlpha=alpha*0.12;c.strokeStyle=color;c.lineWidth=width*5;draw();c.stroke();
  c.globalAlpha=alpha*0.45;c.lineWidth=width*2;draw();c.stroke();
  c.globalAlpha=alpha;c.lineWidth=width;c.strokeStyle=color;draw();c.stroke();
  if(core){c.strokeStyle='#f5ffff';c.lineWidth=Math.max(.65,width*.2);draw();c.stroke();}c.restore();
}
export function beam(c:CanvasRenderingContext2D,x:number,y:number,tx:number,ty:number,color:string,width=3){
  stroke(c,()=>{c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);},color,width);
}
export function ring(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,width=2,flat=1,start=0,end=TAU){
  if(r<=0)return;stroke(c,()=>{c.beginPath();c.ellipse(x,y,r,Math.max(.1,r*flat),0,start,end);},color,width,false);
}
export function star(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,rotation=0,spokes=4){
  c.save();c.translate(x,y);c.rotate(rotation);orb(c,0,0,r*2,color,.7);c.fillStyle='#fffbe8';c.beginPath();
  for(let i=0;i<spokes*2;i++){const a=i*Math.PI/spokes,rr=i%2?r*.12:r;if(i){c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}else{c.moveTo(rr,0);}}c.closePath();c.fill();c.restore();
}
// Filled tapered ribbon: broad colored body, sharp white leading edge, and separated ghost arc.
export function crescent(c:CanvasRenderingContext2D,x:number,y:number,r:number,start:number,sweep:number,width:number,color:string,accent='#ffffff',tilt=1){
  if(r<=0||width<=0)return;c.save();c.translate(x,y);c.scale(1,tilt);
  const path=(offset:number)=>{c.beginPath();for(let i=0;i<=24;i++){const t=i/24,a=start+sweep*t,rr=r+offset+Math.sin(t*Math.PI)*width*.5;if(i){c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}else{c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}}for(let i=24;i>=0;i--){const t=i/24,a=start+sweep*t,rr=r+offset-Math.sin(t*Math.PI)*width*.5;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();};
  const alpha=c.globalAlpha;c.globalCompositeOperation='lighter';c.globalAlpha=alpha*.16;path(0);c.fillStyle=color;c.fill();c.lineWidth=width*.7;c.strokeStyle=color;c.stroke();
  c.globalAlpha=alpha;const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,hexAlpha(color,.1));g.addColorStop(.35,color);g.addColorStop(.72,accent);g.addColorStop(1,hexAlpha(color,.15));c.fillStyle=g;path(0);c.fill();
  c.strokeStyle=accent;c.lineWidth=1.2;c.beginPath();for(let i=0;i<=24;i++){const t=i/24,a=start+sweep*t,rr=r+Math.sin(t*Math.PI)*width*.42;if(i){c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}else{c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}}c.stroke();
  c.globalAlpha=alpha*.3;c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.arc(0,0,r+width*.9,start,start+sweep);c.stroke();c.restore();
}
export function seal(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,time:number,detail=12,flat=1){
  c.save();c.translate(x,y);c.scale(1,flat);ring(c,0,0,r,color,1.5);ring(c,0,0,r*.79,color,1);
  c.rotate(time);c.strokeStyle=color;c.lineWidth=1.1;c.beginPath();
  for(let i=0;i<6;i++){const a=i*TAU/6;if(i){c.lineTo(Math.cos(a)*r*.66,Math.sin(a)*r*.66);}else{c.moveTo(r*.66,0);}}c.closePath();c.stroke();
  c.beginPath();for(let i=0;i<3;i++){const a=i*TAU/3-Math.PI/2;if(i){c.lineTo(Math.cos(a)*r*.58,Math.sin(a)*r*.58);}else{c.moveTo(Math.cos(a)*r*.58,Math.sin(a)*r*.58);}}c.closePath();c.stroke();
  for(let i=0;i<detail;i++){const a=i*TAU/detail;c.save();c.rotate(a);c.translate(r*.9,0);c.beginPath();c.moveTo(-3,-4);c.lineTo(3,-1);c.lineTo(-2,3);c.lineTo(3,5);c.moveTo(-4,0);c.lineTo(4,0);c.stroke();c.restore();}
  c.restore();
}
export function bolt(c:CanvasRenderingContext2D,x:number,y:number,tx:number,ty:number,color:string,time:number,width=3,branches=3){
  const dx=tx-x,dy=ty-y,length=Math.hypot(dx,dy)||1,seed=Math.floor(time*18),wob=Math.min(23,length*.09);
  const draw=()=>{c.beginPath();for(let i=0;i<=16;i++){const t=i/16,offset=i===0||i===16?0:(noise(i+seed*.73)-.5)*wob*2,xx=x+dx*t-dy/length*offset,yy=y+dy*t+dx/length*offset;if(i){c.lineTo(xx,yy);}else{c.moveTo(xx,yy);}}};
  stroke(c,draw,color,width);
  for(let i=0;i<branches;i++){const t=(i+1)/(branches+1),xx=x+dx*t,yy=y+dy*t,sign=i%2?1:-1;stroke(c,()=>{c.beginPath();c.moveTo(xx,yy);c.lineTo(xx-dy/length*22*sign,yy+dx/length*22*sign);c.lineTo(xx-dy/length*45*sign+dx*.08,yy+dx/length*45*sign+dy*.08);},color,width*.35,false);}
}
export function flame(c:CanvasRenderingContext2D,x:number,y:number,length:number,width:number,color:string,accent:string,time:number,seed=0){
  c.save();c.translate(x,y);const g=c.createLinearGradient(0,0,length,0);g.addColorStop(0,accent);g.addColorStop(.25,color);g.addColorStop(1,hexAlpha(color,0));
  c.globalCompositeOperation='lighter';c.globalAlpha*=.58;c.fillStyle=g;c.beginPath();
  for(let side=0;side<2;side++)for(let i=0;i<=24;i++){const t=side?1-i/24:i/24,xx=t*length,mid=Math.sin(t*10-time*16+seed)*width*.25*t,envelope=Math.pow(Math.max(0,Math.sin(t*Math.PI)),.65)*Math.pow(1-t,.3),yy=mid+(side?-1:1)*width*envelope*(.8+Math.sin(t*23-time*21+seed)*.22);if(side===0&&i===0)c.moveTo(xx,yy);else c.lineTo(xx,yy);}c.closePath();c.fill();
  c.globalAlpha*=.65;c.strokeStyle=accent;c.lineWidth=1.4;c.beginPath();for(let i=0;i<20;i++){const t=i/19,yy=Math.sin(t*10-time*16+seed)*width*.25*t;if(i){c.lineTo(t*length,yy);}else{c.moveTo(0,0);}}c.stroke();c.restore();
}
export function crystal(c:CanvasRenderingContext2D,x:number,y:number,length:number,width:number,color:string,angle=0){
  c.save();c.translate(x,y);c.rotate(angle);const g=c.createLinearGradient(-width,0,width,0);g.addColorStop(0,hexAlpha(color,.2));g.addColorStop(.48,color);g.addColorStop(.5,'#edffff');g.addColorStop(.66,color);g.addColorStop(1,hexAlpha(color,.25));c.fillStyle=g;
  c.beginPath();c.moveTo(0,-length);c.lineTo(width,-length*.55);c.lineTo(width*.7,0);c.lineTo(-width*.6,0);c.lineTo(-width,-length*.5);c.closePath();c.fill();c.strokeStyle='#dfffff';c.lineWidth=1;c.stroke();c.beginPath();c.moveTo(0,-length);c.lineTo(0,0);c.moveTo(-width,-length*.5);c.lineTo(0,-length*.35);c.lineTo(width,-length*.55);c.stroke();c.restore();
}
export function shards(c:CanvasRenderingContext2D,x:number,y:number,r:number,time:number,color:string,count=12,seed=0){
  c.save();for(let i=0;i<count;i++){const a=i*TAU/count+seed,rr=r*(.5+noise(i+seed)*.5),xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr*.65;c.save();c.translate(xx,yy);c.rotate(a+time);c.fillStyle=hexAlpha(color,.3+noise(i)*.6);c.beginPath();c.moveTo(0,-4-noise(i)*9);c.lineTo(4,0);c.lineTo(0,5);c.lineTo(-2,0);c.fill();c.restore();}c.restore();
}
export function phantom(c:CanvasRenderingContext2D,x:number,y:number,color:string,dir:number,phase:number,alpha=.4,weapon=true){
  c.save();c.translate(x,y);c.scale(dir,1);c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=5;c.lineCap='round';
  c.beginPath();c.arc(0,-103,11,0,TAU);c.stroke();c.beginPath();c.moveTo(0,-90);c.lineTo(-5,-48);c.lineTo(-22,0);c.moveTo(-5,-48);c.lineTo(21,-2);c.moveTo(0,-81);c.lineTo(-20,-64);c.lineTo(-10,-47);c.moveTo(0,-81);c.lineTo(24,-76);c.lineTo(48+phase*22,-88);c.stroke();
  if(weapon)beam(c,48+phase*22,-88,81+phase*28,-110,color,2);c.restore();
}
export function axe(c:CanvasRenderingContext2D,x:number,y:number,size:number,angle:number,color:string,accent:string,sword=false){
  c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);beam(c,0,32,0,-56,color,4);
  c.fillStyle=hexAlpha(color,.35);c.strokeStyle=accent;c.lineWidth=1.5;
  c.beginPath();if(sword){c.moveTo(0,-111);c.lineTo(11,-77);c.lineTo(8,-35);c.lineTo(-8,-35);c.lineTo(-11,-77);}else{c.moveTo(0,-74);c.quadraticCurveTo(24,-77,42,-55);c.lineTo(36,-21);c.quadraticCurveTo(15,-39,0,-28);c.lineTo(-15,-35);c.lineTo(-15,-65);}c.closePath();c.fill();c.stroke();
  if(sword)beam(c,-19,-32,19,-32,accent,3);else beam(c,37,-54,33,-26,accent,3);c.restore();
}
