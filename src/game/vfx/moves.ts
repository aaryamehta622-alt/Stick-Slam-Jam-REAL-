import type { GameState } from '../engine';
import type { MoveVFX } from '../vfx-types';
import { designFor, type EffectDesign } from './designs';
import { hexAlpha } from '../colors';
import { TAU, clamp, ease, noise, orb, stroke, beam, ring, star, crescent, seal, bolt, flame, crystal, shards, phantom, axe } from './geometry';

function liveDesign(v:MoveVFX,s:GameState):EffectDesign {
  const f=v.owner==='player'?s.player:s.enemy,design=designFor(v.ability,v.element,f.klass.category);
  if(v.ability==='heavy'&&f.classId==='elementalist'){
    const elemental=designFor('elementUlt',v.element,f.klass.category);
    return {...design,color:elemental.color,accent:elemental.accent};
  }
  return v.ability==='heavy'?{...design,color:f.klass.color}:design;
}
const detailFor=(s:GameState)=>s.settings?.quality==='low'?.5:s.settings?.quality==='medium'?.75:1;
export function drawMoveUnderlays(c:CanvasRenderingContext2D,s:GameState,ground:number){
  for(const v of s.moveVfx??[]){
    if(['fishHook','catchOfDay','freshCatch','seaBeast'].includes(v.ability))continue;
    const age=s.time-v.born;if(age<0||age>v.duration)continue;
    const f=v.owner==='player'?s.player:s.enemy,d=liveDesign(v,s),a=Math.min(1,age*16,(v.duration-age)*4);
    c.save();c.globalAlpha=a;
    orb(c,f.x,ground-f.y-65,90+d.power*28,d.color,.32);
    if(d.form==='blink'||d.form==='rift'){
      const t=clamp(age/(d.form==='rift'?Math.min(v.duration,1):.65)),r=(d.form==='rift'?66:48)*Math.sin(Math.PI*t);
      if(r>1){portal(c,v.x,ground-v.y-62,r,d,age,d.form==='blink');portal(c,v.castX??f.x,ground-(v.castY??f.y)-62,r,d,-age,d.form==='blink');}
    }
    if(f.klass.category==='mage'||d.power>=1.7||['parry','shield','armor','bulwark'].includes(d.form)){
      c.globalAlpha*=.55;seal(c,f.x,ground-2,44+d.power*18,d.color,age*.6,Math.round(12*detailFor(s)),.25);
    }
    c.restore();
  }
}

function punch(c:CanvasRenderingContext2D,reach:number,phase:number,color:string,accent:string,power:number){
  const end=25+ease(phase)*reach;
  c.save();c.globalAlpha*=Math.sin(Math.PI*clamp(phase))*.7+.2;
  stroke(c,()=>{c.beginPath();c.moveTo(8,13);c.bezierCurveTo(end*.5,-17,end*.65,24,end,0);},color,5*power);
  c.fillStyle=accent;c.beginPath();c.moveTo(end-13,-9);c.lineTo(end+8,-9);c.quadraticCurveTo(end+16,-7,end+13,0);c.lineTo(end+9,9);c.lineTo(end-14,7);c.closePath();c.fill();
  for(let i=0;i<3;i++)beam(c,end-7+i*5,-7,end-7+i*5,1,color,.8);
  crescent(c,end+5,0,17+phase*22,-1.25,2.5,3*power,color,accent,.8);
  for(let i=0;i<3;i++)beam(c,8,-19+i*18,end-25,-12+i*12,color,1);
  c.restore();
}
function portal(c:CanvasRenderingContext2D,x:number,y:number,r:number,d:EffectDesign,t:number,shadow=false){
  c.save();c.translate(x,y);c.scale(.48,1);orb(c,0,0,r*1.8,d.color,.7);
  c.fillStyle=shadow?'#060913':'#110d25';c.beginPath();c.arc(0,0,r*.82,0,TAU);c.fill();
  seal(c,0,0,r,d.color,t*2,12);ring(c,0,0,r*.64,d.accent,1.5);
  for(let i=0;i<8;i++){const a=i*TAU/8+t*1.4;crystal(c,Math.cos(a)*r,Math.sin(a)*r,8,3,d.accent,a+Math.PI/2);}
  c.restore();
}
function smoke(c:CanvasRenderingContext2D,x:number,y:number,d:EffectDesign,t:number,progress:number,count:number){
  c.save();for(let i=0;i<count;i++){
    const a=noise(i*7)*TAU,r=(18+noise(i)*65)*ease(progress),xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r*.7-t*9;
    c.globalAlpha=.1*(1-progress);orb(c,xx,yy,38+progress*40,d.color,.7);c.fillStyle=i%3?'#152a30':'#36504f';c.beginPath();c.arc(xx,yy,14+progress*22,0,TAU);c.fill();
    c.globalAlpha=(1-progress)*.5;crystal(c,xx+Math.sin(t*4+i)*12,yy,9,2,d.color,a+t);
  }c.restore();
}
function aura(c:CanvasRenderingContext2D,x:number,y:number,d:EffectDesign,t:number,count:number,electric=false){
  c.save();orb(c,x,y-58,120,d.color,.65);
  for(let i=0;i<count;i++){
    const a=i*TAU/count+t*.5,xx=x+Math.cos(a)*45,yy=y-58+Math.sin(a)*63;
    if(electric)bolt(c,xx,yy,x+Math.cos(a+.8)*57,y-58+Math.sin(a+.8)*72,d.color,t+i,2,1);
    else{c.save();c.translate(xx,yy);c.rotate(-Math.PI/2+Math.sin(a)*.3);flame(c,0,0,45+noise(i)*35,12,d.color,d.accent,t,i);c.restore();}
  }
  seal(c,x,y-2,64,d.color,t,10,.28);c.restore();
}

export function drawMoveEffects(c:CanvasRenderingContext2D,s:GameState,ground:number){
  const detail=detailFor(s);
  for(const v of s.moveVfx??[]){
    if(['fishHook','catchOfDay','freshCatch','seaBeast'].includes(v.ability))continue;
    const age=s.time-v.born;if(age<0||age>v.duration)continue;
    const f=v.owner==='player'?s.player:s.enemy,d=liveDesign(v,s);
    const color=d.color,accent=d.accent,power=d.power,count=Math.max(2,Math.round(d.count*detail));
    const p=clamp(age/v.duration),alpha=Math.min(1,age*24,(v.duration-age)*5);
    const begin=v.activeStart??.05,end=v.activeEnd??.38,phase=clamp((age-begin)/Math.max(.06,end-begin));
    const attacking=age<end+.2,reach=v.reach??100;
    const x=f.x,y=ground-f.y,dir=v.facing,tx=v.endX,ty=ground-v.endY;
    const destX=v.castX??x,destY=ground-(v.castY??f.y);
    c.save();c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';
    switch(d.form){
      case 'cut': case 'drawcut': case 'barrage': case 'stabs': case 'axe': case 'guillotine': {
        if(d.form==='axe'&&v.ability==='axeThrow'){
          if(age<.4){c.save();c.translate(x,y-72);c.scale(dir,1);crescent(c,10,0,68,-2.5+age*5,2,13,color,accent);c.restore();}break;
        }
        if(!attacking&&d.form!=='guillotine')break;
        c.save();c.translate(x,y-75);c.scale(dir,1);
        const fade=1-clamp((age-end)/.2);c.globalAlpha*=fade;
        if(d.form==='cut'){
          const wind=age<begin?age/Math.max(.01,begin):1;
          crescent(c,12,4,reach*.9,-2.2+phase*2,1.8*wind,14*power,color,accent,.86);
          if(phase>.25)star(c,20+Math.cos(-.4+phase)*reach,Math.sin(-.4+phase)*reach*.7,8,color,phase);
        }else if(d.form==='drawcut'){
          const travel=Math.max(100,Math.abs(x-v.x));
          beam(c,-travel+15,-2,reach*1.4,0,color,7*power);
          crescent(c,reach*.3,0,reach*.85,-1.8+phase,2.5,20*power,color,accent,.65);
          for(let i=0;i<count;i++){c.globalAlpha=alpha*.3;beam(c,-travel,-28+i*14,reach-25,-21+i*10,accent,.8);}
        }else if(d.form==='barrage'||d.form==='stabs'){
          for(let i=0;i<count;i++){
            const local=(age*8-i*.14)%1;if(local<0)continue;
            const a=-2.5+noise(i)*3.2,yy=(noise(i*3)-.5)*110;
            c.globalAlpha=alpha*(1-local)*fade;
            if(d.form==='stabs'){c.save();c.translate(20,yy);c.rotate((i%2?1:-1)*.4);beam(c,0,0,50+reach*ease(local),0,color,3.5);star(c,50+reach*ease(local),0,8,color,Math.PI/4);c.restore();}
            else crescent(c,35,yy*.4,reach*(.65+noise(i)*.5),a+local*2,1.5,6+power*4,color,accent,i%2?1:-.75);
          }
        }else if(d.form==='axe'){
          crescent(c,16,0,reach,-2.6+phase*2.5,2.3,24*power,color,accent,.85);
          c.globalAlpha*=.6;axe(c,40+phase*40,-20,1.05*power,-1.4+phase*2.5,color,accent);
        }else{
          c.globalAlpha=alpha*(age<begin?.4:Math.max(0,1-(age-begin)*2));
          const drop=ease((age-begin+.15)/.4);
          axe(c,reach*.7,-145+drop*170,power*.95,-.4+drop*.5,color,accent,d.signature.includes('blade')||d.signature.includes('verdict'));
          if(age>begin){crescent(c,reach*.65,68,30+(age-begin)*220,Math.PI,Math.PI,15,color,accent,.35);beam(c,reach*.65,-125,reach*.65,78,color,7*power);}
        }
        c.restore();break;
      }
      case 'punch': case 'uppercut': {
        if(!attacking)break;c.save();c.translate(x,y-77);c.scale(dir,1);
        if(d.form==='uppercut'){
          for(let i=0;i<3;i++)crescent(c,28,-12,48+i*11,.9-phase*2,1.8,9-i*2,color,accent);
          c.save();c.translate(15,-phase*55);c.rotate(-phase*1.5);punch(c,reach*.6,phase,color,accent,1.4);c.restore();
          flame(c,22,0,110,18,color,accent,age);
        }else for(let i=0;i<count;i++){
          const cycle=count>4?(age*9+i*.17)%1:clamp(phase*count-i*.65);
          if(cycle<=0||cycle>=1)continue;c.save();c.translate(0,(i-(count-1)/2)*Math.min(14,75/count));
          c.globalAlpha*=count>4?.75:1;punch(c,reach,cycle,color,accent,Math.min(1.5,power));c.restore();
        }
        c.restore();break;
      }
      case 'blink': case 'rift': {
        const life=d.form==='rift'?Math.min(v.duration,1):.65,t=clamp(age/life),r=(d.form==='rift'?66:48)*Math.sin(Math.PI*t);
        if(r<1)break;c.save();c.globalAlpha*=1-t*.6;
        ring(c,destX,destY-62,r,color,1,.48);
        for(let i=1;i<=3;i++){c.globalAlpha=alpha*(1-t)*.22;phantom(c,v.x+(destX-v.x)*i/4,ground-v.y+(destY-(ground-v.y))*i/4,color,dir,t,.6);}
        if(d.signature.includes('tear')||d.form==='rift'){beam(c,v.x,ground-v.y-62,destX,destY-62,color,2);shards(c,destX,destY-62,80,age,color,count,2);}
        if(v.ability==='teleportStab'||v.ability==='shadowBlink'||v.ability==='rogueShadowStep'){
          c.save();c.translate(destX+dir*35,destY-70);c.scale(dir,1);crescent(c,0,0,80,-1+age*4,2.1,12,color,accent);c.restore();
        }c.restore();break;
      }
      case 'smoke': smoke(c,v.x,ground-v.y-60,d,age,p,count);break;
      case 'dash': case 'flip': {
        const t=clamp(age/.65);if(t>=1)break;c.save();c.globalAlpha*=1-t;
        for(let i=1;i<=Math.min(6,count);i++)phantom(c,x-dir*i*25,y+(d.form==='flip'?i*5:0),color,dir,Math.sin(age*10),.28*(1-i/8),false);
        if(d.signature==='light-speed'||d.signature==='thunder-lance'||(v.ability==='elementMobility'&&v.element===2)){
          for(let i=0;i<3;i++)bolt(c,v.x,ground-v.y-30-i*22,x-dir*10,y-30-i*22,color,age+i,2,2);
        }else if(v.ability==='fireDash'||(v.ability==='elementMobility'&&v.element===0)){
          c.save();c.translate(x,y-38);c.scale(-dir,1);for(let i=0;i<3;i++)flame(c,0,(i-1)*18,Math.min(270,80+Math.abs(x-v.x)),23,color,accent,age,i);c.restore();
        }else if(d.form==='flip'){
          crescent(c,x,y-45,48,-2+age*10,3,8,color,accent);shards(c,x,y-45,60,age,color,count,4);
        }else for(let i=0;i<count;i++){const yy=y-15-noise(i)*95;beam(c,v.x-dir*30,yy,x-dir*8,yy+Math.sin(i)*8,color,i%3?1:3);}
        if(d.signature==='juggernaut'){c.save();c.translate(x+dir*35,y-60);c.scale(dir,1);crescent(c,0,0,80,-1.4,2.8,18,color,accent,.9);c.restore();}
        c.restore();break;
      }
      case 'clones': {
        for(let i=0;i<count;i++){
          const t=clamp((age-.08-i*.14)/.38);if(t<=0||t>=1)continue;
          const side=i%2?1:-1,xx=tx+side*(100-t*70),yy=ty-((i%3)*12);
          phantom(c,xx,yy,color,-side,t,.7*(1-t));
          crescent(c,tx,ty-65,70+i*5,-2+i*.8+t*3,1.9,12,color,accent,i%2?1:-1);
          star(c,tx+Math.sin(i)*25,ty-65+Math.cos(i)*20,18*(1-t),color,i);
        }break;
      }
      case 'parry': case 'shield': case 'armor': case 'bulwark': case 'heat': {
        const r=48+power*9,pulse=1+Math.sin(age*5)*.025;
        c.save();c.translate(x,y-63);c.scale(pulse,pulse);
        if(d.form==='parry'){
          seal(c,dir*23,0,r,color,age,8,.65);axe(c,dir*23,0,.57,dir*.65,color,accent,true);
          crescent(c,dir*23,0,r+7,-1.4+age,1.6,8,color,accent);
        }else if(d.form==='armor'||d.form==='bulwark'){
          for(let i=0;i<count;i++){const a=i*TAU/count+age*.35,xx=Math.cos(a)*r,yy=Math.sin(a)*r*.9;c.save();c.translate(xx,yy);c.rotate(a);c.fillStyle=hexAlpha(color,.27);c.strokeStyle=accent;c.lineWidth=1.5;c.beginPath();c.moveTo(-13,-17);c.lineTo(12,-12);c.lineTo(17,11);c.lineTo(-8,20);c.lineTo(-17,3);c.closePath();c.fill();c.stroke();c.restore();}
          ring(c,0,0,r+4,color,2,.95);
        }else if(d.form==='heat'){
          for(let i=0;i<count;i++){const a=i*TAU/count+age*.5;c.save();c.rotate(a);flame(c,r*.65,0,50,11,color,accent,age,i);c.restore();}
          ring(c,0,0,r,color,3);crescent(c,0,0,r*.8,age*3,3,10,color,accent);
        }else{
          c.save();c.scale(dir,1);c.fillStyle=hexAlpha(color,.08);c.strokeStyle=color;c.lineWidth=2;
          c.beginPath();c.moveTo(16,-51);c.quadraticCurveTo(62,-36,55,19);c.lineTo(31,46);c.lineTo(9,19);c.closePath();c.fill();c.stroke();
          if(d.signature==='hex-dome'){
            for(let row=-2;row<=2;row++)for(let col=0;col<3;col++){const hx=21+col*13,hy=row*17+(col%2)*8;c.beginPath();for(let k=0;k<6;k++){const a=k*TAU/6;if(k){c.lineTo(hx+Math.cos(a)*8,hy+Math.sin(a)*8);}else{c.moveTo(hx+8,hy);}}c.closePath();c.stroke();}
            ring(c,0,0,76,color,2,1,-1.4,1.4);
          }else {beam(c,31,-31,31,22,accent,3);beam(c,18,-4,45,-4,color,3);crescent(c,5,0,64,-1.5,3,12,color,accent);}
          c.restore();
        }
        c.restore();break;
      }
      case 'rage': case 'berserk': {
        const electric=d.signature==='thunder-god';aura(c,x,y,d,age,count,electric);
        if(d.form==='berserk'){
          if(electric){ring(c,x,y-116,61,color,3,.4);for(let i=0;i<4;i++){const a=i*TAU/4+age;bolt(c,x+Math.cos(a)*60,y-65+Math.sin(a)*70,x+Math.cos(a+.4)*90,y-65+Math.sin(a+.4)*95,color,age+i,2,1);}}
          else{c.save();c.globalAlpha*=.5;stroke(c,()=>{c.beginPath();c.moveTo(x-25,y-105);c.quadraticCurveTo(x-66,y-170,x-30,y-150);c.moveTo(x+25,y-105);c.quadraticCurveTo(x+66,y-170,x+30,y-150);},accent,5);c.restore();}
        }else if(d.signature==='war-cry'||d.signature==='laurel-crown'){
          for(let i=0;i<3;i++){const t=(age*.9+i/3)%1;c.save();c.globalAlpha*=1-t;ring(c,x,y-83,20+t*180,color,4,.75);c.restore();}
          if(d.signature==='laurel-crown')for(let i=0;i<8;i++){const a=Math.PI+i*Math.PI/7;crystal(c,x+Math.cos(a)*55,y-92+Math.sin(a)*40,16,4,accent,a);}
        }break;
      }
      case 'hook': {
        const target=v.owner==='player'?s.enemy:s.player,ex=target.x,ey=ground-target.y-70;
        const length=Math.hypot(ex-x,ey-(y-70)),links=Math.min(32,Math.max(6,Math.ceil(length/12)));
        beam(c,x+dir*25,y-72,ex,ey,color,1.4);
        for(let i=0;i<links;i++){const t=i/links,xx=x+(ex-x)*t,yy=y-72+(ey-(y-72))*t;ring(c,xx,yy,5,i%2?accent:color,1.4,i%2?.4:1);}
        crescent(c,ex,ey,18,-2,3.8,7,color,accent);star(c,ex,ey,10,accent,age);break;
      }
      case 'electric': case 'chain': {
        if(v.ability==='elementUlt'&&v.element===2){seal(c,tx,ground-4,100,color,-age,12,.25);break;}
        if(v.ability==='lightningChain'){bolt(c,x+dir*25,y-85,tx,ty-70,color,age,4,5);seal(c,tx,ty-70,35,color,age*3,6);}
        else if(attacking){
          const ex=x+dir*(reach+25);for(let i=0;i<Math.min(4,count);i++)bolt(c,x,y-75+(i-1.5)*13,ex,y-70+Math.sin(age*14+i)*22,color,age+i,3,2);
          ring(c,ex,y-70,25+phase*22,color,2,.8);star(c,ex,y-70,13,color,age);
        }break;
      }
      case 'muzzle': case 'volley': case 'snipe': case 'rail': case 'spell': case 'cosmos': case 'frost': {
        if(v.ability==='elementUlt'&&v.element===1){seal(c,tx,ground,120,color,age,12,.28);break;}
        const t=clamp(age/.4);if(t>=1)break;c.save();c.translate(x+dir*36,y-86);c.scale(dir,1);c.globalAlpha*=1-t;
        if(d.form==='spell'||d.form==='cosmos'||d.form==='frost'){
          seal(c,0,0,24+ease(t)*30,color,age*2,8);orb(c,0,0,60,color,.6);
          if(d.form==='frost')for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);crystal(c,0,-26,23,4,color);c.restore();}
          else for(let i=0;i<3;i++)ring(c,0,0,22+i*7,i===1?accent:color,1,i%2?.35:1,age*2+i,age*2+i+Math.PI*1.6);
        }else{
          star(c,10,0,25*power*(1-t),color,age*2,4);
          for(let i=0;i<Math.min(6,count);i++){const angle=(i-(Math.min(6,count)-1)/2)*.12;beam(c,0,0,90*Math.cos(angle),90*Math.sin(angle),color,i%2?1:2);}
          if(d.form==='rail'){for(let i=0;i<4;i++)ring(c,20+i*18,0,12-i*2,color,2,.6);beam(c,-25,0,125,0,accent,3);}
          if(d.form==='snipe'){ring(c,25,0,28,color,1);for(let i=0;i<4;i++){const a=i*TAU/4;beam(c,25+Math.cos(a)*32,Math.sin(a)*32,25+Math.cos(a)*41,Math.sin(a)*41,color,1);}}
        }c.restore();break;
      }
      case 'slam': case 'cataclysm': {
        if(age<begin){crescent(c,x,y-65,90,-2.8+phase,2.2,9,color,accent);}
        else{const t=clamp((age-begin)/.65);if(t>=1)break;const ex=v.x+dir*(v.ability==='groundSlam'||v.ability==='bruteSlam'||v.ability==='titanQuake'?0:60);
          c.save();c.globalAlpha*=1-t;for(let i=0;i<3;i++)ring(c,ex,ground,30+ease(t)*(80+i*55)*power,color,3-i*.6,.2+i*.035);
          for(let i=0;i<count;i++){const a=i*TAU/count,rr=ease(t)*100*power,xx=ex+Math.cos(a)*rr,yy=ground+Math.sin(a)*rr*.17;crystal(c,xx,yy,(1-t)*(25+noise(i)*45),6+noise(i)*5,color,(noise(i)-.5)*.9);}
          c.restore();}break;
      }
      case 'fire': case 'dragon': {
        const life=d.form==='dragon'?Math.min(v.duration,1):.5,t=clamp(age/life);if(t>=1)break;
        c.save();c.translate(x+dir*15,y-70);c.scale(dir,1);c.globalAlpha*=Math.min(1,(1-t)*3);
        if(d.form==='dragon'){
          const length=80+ease(t)*235;
          for(let i=0;i<5;i++)flame(c,0,(i-2)*13,length,17+Math.sin(age*7+i)*3,color,accent,age,i);
          for(let i=0;i<6;i++){const sx=length*(.12+i*.1),sy=Math.sin(age*8-i*.55)*8;c.fillStyle=hexAlpha(color,.65);c.strokeStyle=accent;c.lineWidth=1;c.beginPath();c.moveTo(sx-12,sy-14);c.quadraticCurveTo(sx-9,sy-43,sx+5,sy-46);c.lineTo(sx+12,sy-11);c.closePath();c.fill();c.stroke();}
          const hx=length*.79,hy=Math.sin(age*8)*12;orb(c,hx,hy,70,color,.65);
          c.fillStyle='#7f2c15';c.strokeStyle=accent;c.lineWidth=2;c.beginPath();c.moveTo(hx-30,hy-8);c.lineTo(hx-9,hy-30);c.lineTo(hx+20,hy-20);c.lineTo(hx+48,hy-2);c.lineTo(hx+22,hy+12);c.lineTo(hx+42,hy+26);c.lineTo(hx+3,hy+20);c.lineTo(hx-24,hy+5);c.closePath();c.fill();c.stroke();
          beam(c,hx-9,hy-26,hx-27,hy-61,accent,3);beam(c,hx+4,hy-25,hx+10,hy-56,color,3);star(c,hx+13,hy-13,5,'#ffffff');
          c.fillStyle=accent;for(let i=0;i<3;i++){c.beginPath();c.moveTo(hx+25+i*6,hy+3+i*.4);c.lineTo(hx+27+i*6,hy+11+i*.4);c.lineTo(hx+30+i*6,hy+4+i*.4);c.fill();}
          stroke(c,()=>{c.beginPath();c.moveTo(hx+29,hy-12);c.bezierCurveTo(hx+72,hy-36,hx+58,hy-56,hx+87,hy-38);},color,1.4);
          for(let i=0;i<4;i++)flame(c,hx+35,hy+(i-1.5)*10,90,11,color,accent,age,i+3);
        }else{for(let i=0;i<3;i++)flame(c,0,(i-1)*15,100+power*25,18,color,accent,age,i);punch(c,85,t,color,accent,1);}
        c.restore();break;
      }
      case 'cyclone': {
        const ex=v.ability==='windBlast'?x+dir*100:tx,h=v.ability==='windBlast'?115:235;
        for(let i=0;i<Math.min(10,count);i++){const yy=ground-i*h/Math.min(10,count),rr=22+i*7; crescent(c,ex+Math.sin(age*7+i*.3)*13,yy,rr,age*7+i*.4,Math.PI*1.6,6,color,accent,.23);}
        if(v.ability==='stormSummon'){orb(c,ex,ground-h,100,color,.4);bolt(c,ex-35,ground-h,ex,ground-5,color,age,3,3);}break;
      }
      case 'rain': case 'meteor': case 'artillery': {
        const rr=d.form==='rain'?125:d.form==='artillery'?145:90;
        seal(c,tx,ground-2,rr,color,-age*.5,12,.21);
        if(d.form==='artillery'){
          for(let i=0;i<3;i++){const xx=tx+(i-1)*90;ring(c,xx,ground-8,34,color,1.5,.22);beam(c,xx,ground-240,xx,ground-25,color,.7);}
        }else if(d.form==='rain'){
          c.save();c.globalAlpha*=.5;seal(c,tx,ground-290,110,color,age,12,.24);for(let i=0;i<4;i++){const xx=tx+(i-1.5)*50;beam(c,xx+20,ground-270,xx,ground-80,color,1);}c.restore();
        }else{orb(c,tx,ground-260,100,color,.35);beam(c,tx,ground-260,tx,ground-20,color,1);ring(c,tx,ground-280,53,color,2,.35);}
        break;
      }
      case 'void': case 'deathmark': case 'nova': case 'phase': case 'clock': {
        const centered=['elementalNova','phaseSwap','elementSwap','arcaneSupernova'].includes(v.ability)||v.ability==='heavy';
        const ex=centered?x:tx,ey=(centered?y:ty)-65;
        if(d.form==='phase'){
          for(let i=0;i<2;i++){const a=age*2+i*Math.PI,xx=ex+Math.cos(a)*52,yy=ey+Math.sin(a)*43,col=i?'#8ee9ff':'#ff8b63';orb(c,xx,yy,58,col,.9);seal(c,xx,yy,20,col,-a,6);crescent(c,ex,ey,55,a,2.2,7,col,'#ffffff');}
          seal(c,ex,ey,76,color,age*.4,12);break;
        }
        if(d.form==='deathmark'){
          seal(c,ex,ey,60,color,-age*2,12);crescent(c,ex,ey,75,-2,2.3,10,color,accent);crescent(c,ex,ey,75,1.15,2.3,10,color,accent);
          // A mask and crossing execution daggers distinguish Deathmark from a generic nova.
          c.fillStyle=hexAlpha(color,.3);c.strokeStyle=accent;c.lineWidth=1.5;c.beginPath();c.moveTo(ex-19,ey-18);c.quadraticCurveTo(ex,ey-35,ex+19,ey-18);c.lineTo(ex+15,ey+6);c.lineTo(ex+5,ey+18);c.lineTo(ex-6,ey+18);c.lineTo(ex-15,ey+6);c.closePath();c.fill();c.stroke();
          for(const side of [-1,1]){beam(c,ex+side*5,ey-6,ex+side*13,ey-10,color,3);beam(c,ex-side*48,ey+45,ex+side*43,ey-42,accent,2);}
          break;
        }
        if(d.form==='clock'){
          seal(c,ex,ey,77,color,0,12);for(let i=0;i<12;i++){const a=i*TAU/12;beam(c,ex+Math.cos(a)*62,ey+Math.sin(a)*62,ex+Math.cos(a)*71,ey+Math.sin(a)*71,accent,i%3?1:3);}
          beam(c,ex,ey,ex+Math.cos(-age*4)*51,ey+Math.sin(-age*4)*51,accent,2);beam(c,ex,ey,ex+Math.cos(age)*34,ey+Math.sin(age)*34,color,3);shards(c,ex,ey,110,age,color,12,5);break;
        }
        const rr=34+Math.sin(Math.min(1,p)*Math.PI)*55;
        if(d.form==='void'){
          orb(c,ex,ey,rr*2.5,color,.45);
          for(let i=0;i<4;i++)crescent(c,ex,ey,rr+i*9,age*(i%2?-2:2)+i,Math.PI*1.35,6+i,color,accent,.7+i*.1);
          shards(c,ex,ey,rr*1.7,-age,color,count,3);
        }else{seal(c,ex,ey,rr,color,-age,12);for(let i=0;i<6;i++){const a=i*TAU/6+age;orb(c,ex+Math.cos(a)*rr,ey+Math.sin(a)*rr,17, i%2?accent:color,.6);}ring(c,ex,ey,rr*1.3,accent,2);}
        break;
      }
    }
    c.restore();
  }
  // Everyday attacks stay lean; the ability choreography gets the visual budget.
  for(const f of [s.player,s.enemy]){
    const a=f.attack;if(a&&!a.isAbility&&s.time-a.startTime>=a.activeStart&&s.time-a.startTime<=a.activeEnd){
      c.save();c.globalAlpha=.65;c.translate(f.x,ground-f.y-77);c.scale(f.facing,1);
      crescent(c,15,a.kind==='kick'?26:0,a.reach*.72,-1.4,2,5,f.klass.color,'#ffffff',.8);c.restore();
    }
    if(f.heavyCharging){const q=clamp(s.time-f.heavyChargeStart);c.save();c.globalAlpha=.4+q*.4;
      seal(c,f.x,ground-f.y-65,35+q*24,f.klass.color,-s.time*2,8);orb(c,f.x,ground-f.y-65,80+q*30,f.klass.color,.4);
      for(let i=0;i<6;i++){const a=i*TAU/6+s.time*2,r=85-((s.time*95+i*13)%55);beam(c,f.x+Math.cos(a)*r,ground-f.y-65+Math.sin(a)*r,f.x+Math.cos(a)*(r-12),ground-f.y-65+Math.sin(a)*(r-12),f.klass.color,1.5);}c.restore();
    }
  }
}
