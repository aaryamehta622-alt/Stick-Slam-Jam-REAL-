import type { AOEZone } from '../engine';
import { designFor } from './designs';
import { hexAlpha } from '../colors';
import { TAU,clamp,ease,noise,orb,beam,ring,seal,star,crescent,bolt,flame,crystal,shards,phantom } from './geometry';

export function drawDetailedArea(c:CanvasRenderingContext2D,z:AOEZone,ground:number,now:number,detail=1){
  if(z.kind==='sea')return; // Authored liquid-floor telegraph and creature are drawn by fishing.ts.
  const age=now-z.born;if(age<0||age>z.delay+z.life)return;
  const waiting=age<z.delay,p=clamp(waiting?age/Math.max(.01,z.delay):(age-z.delay)/z.life);
  const d=designFor(z.visualAbility??'heavy',z.visualElement),color=z.visualAbility&&z.visualAbility!=='heavy'?d.color:z.color,accent=d.accent,r=z.radius;
  const lightning=['lightningChain','stormSummon'].includes(z.visualAbility??'')||(z.visualElement===2&&['elementUlt','heavy'].includes(z.visualAbility??''));
  const ice=z.visualElement===1&&z.visualAbility==='elementUlt';
  c.save();c.translate(z.x,ground-z.y);c.lineCap='round';c.lineJoin='round';
  if(waiting){
    c.globalAlpha=.3+p*.5;c.fillStyle=hexAlpha(color,.1);c.beginPath();c.ellipse(0,-2,r,Math.max(8,r*.13),0,0,TAU);c.fill();
    seal(c,0,-2,r,color,-age*.5,Math.round(12*detail),.14);ring(c,0,-2,r*.84,accent,2,.14,-Math.PI/2,-Math.PI/2+TAU*p);
    for(let i=0;i<4;i++){const x=(i-1.5)*r*.46;beam(c,x-6,-20,x,-29,color,1.5);beam(c,x,-29,x+6,-20,color,1.5);}
    c.font='800 10px ui-monospace,monospace';c.textAlign='center';c.fillStyle=accent;c.fillText(z.owner==='enemy'?'DANGER':'TARGET',0,-40);
    if(z.delay>.25){c.globalAlpha*=.25;beam(c,0,-40,0,-240,color,1);orb(c,0,-240,45,color,.5);}
    c.restore();return;
  }
  c.globalAlpha=Math.min(1,(1-p)*2.5);const fade=1-p;
  orb(c,0,-25,r*1.4,color,.45);ring(c,0,-2,r*(.4+ease(p)*.6),color,3,.17);
  if(lightning){
    const forks=z.visualAbility==='stormSummon'?3:2;
    for(let i=0;i<forks;i++){const x=(i-(forks-1)/2)*r*.45;bolt(c,x-30,-320,x,-7,color,now+i,4.5,4);star(c,x,-8,20*fade,accent,i);}
    for(let i=-1;i<=1;i+=2)bolt(c,0,-15,i*r,-5,color,now+i,2.5,3);
    seal(c,0,-3,r*.8,color,now,8,.2);
  }else if(ice){
    const count=Math.max(5,Math.round(11*detail));
    for(let i=0;i<count;i++){const x=(i-(count-1)/2)*r*1.55/count,h=(45+noise(i)*90)*Math.sin(Math.PI*Math.min(1,p*1.4));crystal(c,x,Math.sin(i)*7,h,8+noise(i)*7,color,(noise(i)-.5)*.55);}
    for(let i=0;i<6;i++){const a=i*TAU/6;beam(c,0,-3,Math.cos(a)*r,Math.sin(a)*r*.15,color,2);}
    shards(c,0,-65,r*.9,now,color,Math.round(14*detail));
  }else if(z.kind==='fire'){
    const count=Math.max(5,Math.round(13*detail));
    for(let i=0;i<count;i++){const x=(i-(count-1)/2)*r*1.7/count,h=(60+noise(i)*80)*(.6+fade*.4);c.save();c.translate(x,-3);c.rotate(-Math.PI/2+(noise(i)-.5)*.2);flame(c,0,0,h,(10+noise(i)*12)*fade,color,accent,now,i);c.restore();}
    for(let i=0;i<4;i++)crescent(c,0,-5,r*(.45+i*.16),now*(i%2?-3:3)+i,Math.PI*1.5,4*fade,color,accent,.17);
  }else if(z.kind==='phantom'){
    for(let i=0;i<3;i++){const side=i%2?-1:1,xx=(i-1)*r*.5;phantom(c,xx+side*(1-ease(p))*35,-2,color,-side,p,.65*fade);crescent(c,xx,-65,60+i*12,-2+i+p*4,2.2,13*fade,color,accent,i%2?1:-.8);}
    star(c,0,-70,22*fade,color,p*Math.PI/2);
  }else if(z.kind==='smoke'){
    for(let i=0;i<Math.round(12*detail);i++){const a=i*2.4,rr=(.2+p*.6)*r;c.fillStyle=i%2?'#20343b':'#19212f';c.globalAlpha=fade*.2;c.beginPath();c.arc(Math.cos(a)*rr,-36+Math.sin(a)*rr*.3-p*20,25+p*30,0,TAU);c.fill();}
    c.globalAlpha=fade*.3;ring(c,0,-7,r*.7,color,2,.23);shards(c,0,-30,r,now,color,8,1);
  }else if(z.kind==='void'||z.kind==='nova'){
    const collapse=z.kind==='void',rr=r*(collapse?.8-ease(p)*.45:.25+ease(p)*.7);
    orb(c,0,-65,rr*1.9,color,.8);
    if(collapse){c.fillStyle='#060810';c.beginPath();c.ellipse(0,-65,rr*.65,rr*.55,0,0,TAU);c.fill();}
    for(let i=0;i<5;i++)crescent(c,0,-65,rr*(.6+i*.11),now*(i%2?-2:2)+i,Math.PI*1.5,(7-i*.7)*fade,color,accent,.8);
    seal(c,0,-65,rr*.9,color,-now,12);shards(c,0,-65,rr*1.4,-now,color,Math.round(18*detail),3);
    if(z.visualAbility==='arcaneSupernova'){
      for(let i=0;i<12;i++){const a=i*TAU/12+now*.15,inner=rr*.6,outer=rr*(1.1+noise(i)*.5);beam(c,Math.cos(a)*inner,-65+Math.sin(a)*inner,Math.cos(a)*outer,-65+Math.sin(a)*outer,color,2*fade);}
      star(c,0,-65,45*fade,accent,Math.PI/4,8);
    }
    if(z.visualAbility==='elementalNova')for(let i=0;i<8;i++){const a=i*TAU/8,col=i%2?'#8cecff':'#ff8a52';crystal(c,Math.cos(a)*rr*.6,-5+Math.sin(a)*rr*.1,60*fade,10,col,a*.2);}
  }else{
    const count=Math.max(6,Math.round(14*detail));
    // Cracks are procedural visual geometry, never collision terrain.
    for(let i=0;i<count;i++){
      const a=i*TAU/count,reach=r*ease(p)*(.6+noise(i)*.4),xx=Math.cos(a)*reach,yy=Math.sin(a)*reach*.18;
      c.save();c.globalAlpha=fade;beam(c,0,0,xx*.4,yy*.6,color,1.4);beam(c,xx*.4,yy*.6,xx*.55,yy-6,accent,1);beam(c,xx*.55,yy-6,xx,yy,color,1.3);
      const lift=Math.sin(Math.PI*p)*(20+noise(i)*65);c.fillStyle=i%2?'#6c5c60':'#433d49';c.strokeStyle=color;c.lineWidth=.8;
      c.beginPath();c.moveTo(xx-7,yy-lift);c.lineTo(xx-3,yy-lift-12-noise(i)*12);c.lineTo(xx+7,yy-lift-8);c.lineTo(xx+9,yy-lift+2);c.closePath();c.fill();c.stroke();c.restore();
    }
    for(let i=0;i<3;i++)ring(c,0,0,r*(.2+ease(clamp(p-i*.08))*.8),i===1?accent:color,3-i*.6,.16+i*.035);
    if(z.visualAbility==='titanCataclysm'){for(let i=0;i<5;i++)crystal(c,(i-2)*r*.3,0,80*Math.sin(Math.PI*p)+20,15,color,(i-2)*.12);}
  }
  c.restore();
}
