import type { EffectForm } from './designs';
import { TAU,clamp,ease,noise,orb,beam,ring,star,crescent,bolt,crystal,shards,flame } from './geometry';
export interface ImpactVFX { born:number;life:number;x:number;y:number;dir:number;color:string;accent:string;form:EffectForm;power:number;seed:number }

export function drawImpactBursts(c:CanvasRenderingContext2D,bursts:readonly ImpactVFX[],now:number,ground:number,detail=1){
  for(const b of bursts){
    const age=now-b.born,t=clamp(age/b.life);if(age<0||t>=1)continue;
    const fade=Math.pow(1-t,1.4),r=(14+ease(t)*40)*b.power,x=b.x,y=ground-b.y;
    c.save();c.globalAlpha=fade;
    orb(c,x,y,(45+25*b.power)*Math.max(.2,1-t),b.color,.65);
    if(t<.35)star(c,x,y,(12+20*b.power)*(1-t/.35),b.accent,b.seed,6);
    switch(b.form){
      case 'cut':case 'drawcut':case 'stabs':case 'barrage':case 'axe':case 'guillotine':case 'clones':case 'deathmark':
        for(let i=0;i<3;i++)crescent(c,x,y,r*(.7+i*.25),b.seed+i*1.6+t,1.7,Math.max(1,(7-i)*fade),b.color,b.accent,i%2?.65:1);
        for(let i=0;i<Math.round(6*detail);i++){const a=noise(i+b.seed)*TAU;beam(c,x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3,x+Math.cos(a)*r*1.5,y+Math.sin(a)*r*1.5,b.color,1.5*fade);}break;
      case 'electric':case 'chain':
        for(let i=0;i<Math.round(5*detail);i++){const a=i*TAU/5;bolt(c,x,y,x+Math.cos(a)*r*1.6,y+Math.sin(a)*r,b.color,age+i+b.seed,2.4*fade,1);}ring(c,x,y,r,b.accent,2*fade);break;
      case 'frost':case 'clock':
        for(let i=0;i<Math.round(9*detail);i++){const a=i*TAU/9,rr=r*.6;crystal(c,x+Math.cos(a)*rr,y+Math.sin(a)*rr,20*fade+5,5*fade+1,b.color,a+Math.PI/2);}ring(c,x,y,r,b.color,2*fade);shards(c,x,y,r*1.4,age,b.color,8);break;
      case 'fire':case 'dragon':case 'meteor':case 'heat':
        for(let i=0;i<Math.round(7*detail);i++){const a=i*TAU/7;c.save();c.translate(x,y);c.rotate(a);flame(c,8,0,r*1.5,14*fade,b.color,b.accent,age,i);c.restore();}ring(c,x,y,r,b.color,3*fade);break;
      case 'void':case 'cosmos':case 'nova':case 'rift':case 'phase':
        for(let i=0;i<4;i++)crescent(c,x,y,r*(.6+i*.18),age*(i%2?5:-5)+i,Math.PI*1.6,6*fade,b.color,b.accent,.8);shards(c,x,y,r*1.6,age,b.color,12,b.seed);break;
      case 'rail':case 'snipe':case 'muzzle':case 'volley':
        beam(c,x-b.dir*r*1.3,y,x+b.dir*r*1.3,y,b.color,5*fade);ring(c,x,y,r,b.color,2*fade,.65);star(c,x,y,18*fade,b.accent,Math.PI/4);break;
      default:
        ring(c,x,y,r,b.color,3*fade,.75);ring(c,x,y,r*1.3,b.accent,1.5*fade,.6);
        for(let i=0;i<Math.round(6*detail);i++){const a=i*TAU/6;beam(c,x+Math.cos(a)*r*.45,y+Math.sin(a)*r*.45,x+Math.cos(a)*r*1.5,y+Math.sin(a)*r*1.15,b.color,2*fade);}
    }
    c.restore();
  }
}
