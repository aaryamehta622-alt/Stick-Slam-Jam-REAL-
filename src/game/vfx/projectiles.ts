import { drawFish } from './fishing';
import type { Projectile } from '../engine';
import { designFor } from './designs';
import { TAU, orb, beam, ring, seal, star, bolt, flame, crystal, crescent, axe, noise } from './geometry';
import { hexAlpha } from '../colors';

export function drawDetailedProjectile(c:CanvasRenderingContext2D,p:Projectile,ground:number,now:number){
  if(now<p.born+(p.delay??0)||p.hit)return;
  const d=designFor(p.visualAbility??'light',p.visualElement),color=p.visualAbility&&p.visualAbility!=='heavy'?d.color:p.color,accent=d.accent;
  const age=now-p.born-(p.delay??0),r=Math.max(2,p.radius),tail=Math.min(250,Math.max(42,Math.hypot(p.vx,p.vy)*.1));
  c.save();c.translate(p.x,ground-p.y);c.rotate(Math.atan2(-p.vy,p.vx));c.lineCap='round';
  orb(c,0,0,r*4+14,color,.7);
  if(p.kind==='fish' && p.fish){
    drawFish(c,p.fish,0,0,age,1,Math.sin(age*6)*.3);
  }else if(p.kind==='hook'){
    c.strokeStyle='#edffff';c.lineWidth=3;c.beginPath();c.moveTo(-7,-9);c.lineTo(-7,5);c.bezierCurveTo(-7,18,10,18,10,3);c.lineTo(5,7);c.stroke();
    beam(c,-tail,0,-12,0,'#a8f2ff',1);
  }else if(p.kind==='arrow'){
    beam(c,-tail,0,18,0,color,3);c.fillStyle=accent;c.beginPath();c.moveTo(22,0);c.lineTo(9,-6);c.lineTo(11,0);c.lineTo(9,6);c.closePath();c.fill();
    for(let i=0;i<3;i++){const x=-25-i*11;beam(c,x-5,-5,x+3,0,color,1.5);beam(c,x-5,5,x+3,0,color,1.5);}
    for(let i=0;i<2;i++){c.save();c.globalAlpha=.35;const x=-age*90%30-i*45;ring(c,x,0,8,color,1,.8);c.restore();}
    for(let i=0;i<8;i++){const t=(age*2+i/8)%1;orb(c,-tail*t,Math.sin(t*TAU*2-age*8)*7*(1-t),3*(1-t)+1,color,.6);}
  }else if(p.kind==='ice'){
    beam(c,-tail,0,20,0,color,4);crystal(c,-r,0,r*3.3,r*.65,color,Math.PI/2);
    for(let i=0;i<5;i++){const t=(age*1.4+i*.2)%1;crystal(c,-20-t*tail,Math.sin(i*3)*13,9*(1-t),3*(1-t)+.5,color,Math.PI/2+t);}
    if(p.visualAbility==='arcaneFreeze'){
      seal(c,0,0,27,'#b1a0ff',-age,12);for(let i=0;i<4;i++){const a=i*TAU/4+age;beam(c,0,0,Math.cos(a)*23,Math.sin(a)*23,accent,1);}
    }else for(let i=0;i<3;i++)ring(c,-20-i*25,0,r*.8+i*3,color,1,.65);
  }else if(p.kind==='fire'||p.kind==='meteor'){
    c.save();c.scale(-1,1);
    for(let i=0;i<(p.kind==='meteor'?7:4);i++)flame(c,-r*.25,(i-2)*r*.17,tail*(.7+noise(i)*.55),r*(.55+noise(i)*.35),color,accent,age,i);
    c.restore();
    if(p.kind==='meteor'){
      const body=r*1.15;c.fillStyle='#3f1e25';c.strokeStyle=color;c.lineWidth=2;c.beginPath();
      for(let i=0;i<9;i++){const a=i*TAU/9,rr=body*(.82+noise(i)*.18);if(i){c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}else{c.moveTo(rr,0);}}c.closePath();c.fill();c.stroke();
      for(let i=0;i<5;i++){const a=i*TAU/5;beam(c,Math.cos(a)*body,Math.sin(a)*body,Math.cos(a+1)*body*.35,Math.sin(a+1)*body*.35,color,2);}
      crescent(c,0,0,r*1.4,-1.4,2.8,6,color,accent);orb(c,r*.6,0,r*.8,accent,.9);
      c.save();c.globalAlpha=.5;for(let i=0;i<4;i++){const t=(age*.9+i/4)%1;ring(c,-r-tail*t,0,r*(1+t*.6),color,1.5,.7);}c.restore();
    }else{
      orb(c,0,0,r*2.8,color,1);c.fillStyle=accent;c.beginPath();c.arc(0,0,r*.65,0,TAU);c.fill();
      crescent(c,0,0,r*1.2,age*5,4.4,5,color,accent);
      if(p.visualAbility==='fireball')ring(c,0,0,r*1.5,color,1.5,.45,age*4,age*4+TAU);
    }
  }else if(p.kind==='bolt'){
    if(p.visualElement===2||p.color==='#fff080'){
      bolt(c,-tail,0,r*2,0,color,now,4,4);star(c,0,0,r*1.6,accent,age*3);
    }else if(p.visualAbility==='focusBeam'||p.visualAbility==='heavy'){
      const length=p.visualAbility==='focusBeam'?400:220;
      beam(c,-length,0,r*2.5,0,color,r*1.1);beam(c,-length*.8,0,r*2,0,'#ffffff',3);
      for(let i=0;i<5;i++)ring(c,-20-i*48,0,r*(1.2+i*.1),color,2,.55);
      crescent(c,0,0,r*2,-1.4,2.8,5,color,accent);star(c,0,0,r*2,color);
    }else{
      beam(c,-tail,0,0,0,color,r*.55);seal(c,0,0,r*1.7,color,age*3,6);orb(c,0,0,r*2,accent,.9);
      for(let i=0;i<3;i++){const a=age*4+i*TAU/3;ring(c,Math.cos(a)*r,Math.sin(a)*r,r*1.2,color,1.2,.5,age,age+TAU);}
      if(p.visualAbility==='arcaneOrb'){
        c.fillStyle='#160e2d';c.beginPath();c.arc(0,0,r*.55,0,TAU);c.fill();
        for(let i=0;i<3;i++){const a=age*3+i*TAU/3;star(c,Math.cos(a)*r*1.8,Math.sin(a)*r*1.1,4,accent,a);}
      }
    }
  }else if(p.kind==='axe'){
    const turn=age*(p.spin??14);for(let i=0;i<3;i++)crescent(c,0,0,24+i*4,turn-i*.7,2.6,6-i,color,accent);
    axe(c,0,0,.45,turn,color,accent);beam(c,-tail*.5,0,-20,0,color,2);
    for(let i=0;i<4;i++){const a=turn+i*TAU/4;star(c,Math.cos(a)*32,Math.sin(a)*32,3,color,a);}
  }else if(p.kind==='bullet'){
    const piercing=p.visualAbility==='piercingBullet';
    beam(c,-tail*(piercing?1.4:1),0,r*2.4,0,color,piercing?7:3);c.fillStyle=accent;c.fillRect(-r,-r*.35,r*3,r*.7);
    if(piercing)for(let i=0;i<5;i++){const a=age*15+i;ring(c,-i*19,0,9,color,1.5,.75,a,a+4.2);}
    else{star(c,r*1.5,0,r*1.6,color,0);c.save();c.globalAlpha=.4;beam(c,-tail,-4,-tail*.2,-1,accent,.7);beam(c,-tail,4,-tail*.2,1,accent,.7);c.restore();}
  }else{
    // War Machine: finned missile, pulsing engine diamonds, and a long hot exhaust.
    c.save();c.scale(-1,1);flame(c,12,0,tail,12,'#ff7842','#fff1b1',age,1);c.restore();
    c.fillStyle='#3f4654';c.strokeStyle=accent;c.lineWidth=1.2;c.beginPath();c.moveTo(20,0);c.lineTo(8,-8);c.lineTo(-17,-8);c.lineTo(-17,8);c.lineTo(8,8);c.closePath();c.fill();c.stroke();
    c.fillStyle='#b7c0ce';c.beginPath();c.moveTo(-6,-8);c.lineTo(-21,-17);c.lineTo(-18,-5);c.moveTo(-6,8);c.lineTo(-21,17);c.lineTo(-18,5);c.fill();
    beam(c,-15,0,-28,0,color,7);for(let i=0;i<4;i++){c.save();c.globalAlpha=.8-i*.15;star(c,-29-i*14,0,5-i*.6,color,Math.PI/4);c.restore();}
  }
  c.restore();
}
