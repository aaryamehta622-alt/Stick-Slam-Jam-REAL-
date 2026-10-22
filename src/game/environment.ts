import type { ArenaId } from './engine';

// Deterministic procedural scenery: zero downloads and no random geometry flicker.
export function drawEnvironment(c: CanvasRenderingContext2D, arena: ArenaId, time: number, ground: number, cameraX = 600) {
  const parallax = (cameraX-600)*0.12;
  c.save(); c.translate(-parallax,0);
  if (arena === 'dojo') {
    const light=c.createRadialGradient(600,260,20,600,260,620);
    light.addColorStop(0,'#252a45'); light.addColorStop(1,'#0a0c19'); c.fillStyle=light; c.fillRect(-50,0,1300,ground);
    // Moon through paper windows, timber frame, and warm hanging lanterns.
    c.fillStyle='#a4d5ec'; c.globalAlpha=0.12; c.beginPath(); c.arc(600,225,93,0,Math.PI*2); c.fill(); c.globalAlpha=1;
    for(let i=0;i<9;i++) {
      const x=85+i*130; c.fillStyle='rgba(141,172,221,0.045)'; c.fillRect(x,150,110,240);
      c.strokeStyle='#31354b'; c.lineWidth=2; c.strokeRect(x,150,110,240);
      c.beginPath(); c.moveTo(x+55,150); c.lineTo(x+55,390); c.moveTo(x,230); c.lineTo(x+110,230); c.moveTo(x,310); c.lineTo(x+110,310); c.stroke();
    }
    c.fillStyle='#111522'; c.fillRect(0,125,1200,12); c.fillRect(0,391,1200,20);
    for (const x of [90,1110]) {
      const g=c.createRadialGradient(x,219,4,x,219,150); g.addColorStop(0,'rgba(255,175,80,0.18)');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-150,69,300,300);
      c.fillStyle='#e7ab62';c.fillRect(x-10,198,20,35);c.fillStyle='#4e352b';c.fillRect(x-13,195,26,4);c.fillRect(x-13,232,26,4);
      c.strokeStyle='#886649';c.beginPath();c.moveTo(x,137);c.lineTo(x,195);c.stroke();
    }
  } else if (arena === 'rooftop') {
    c.fillStyle='#18243c';c.beginPath();c.arc(940,170,56,0,Math.PI*2);c.fill();c.fillStyle='#8da6c6';c.beginPath();c.arc(940,170,43,0,Math.PI*2);c.fill();
    for(let layer=0;layer<3;layer++) for(let i=0;i<18;i++) {
      const x=i*87-layer*24+parallax*(1-layer*0.3), h=70+(i*53+layer*37)%170;
      c.fillStyle=['#12192e','#19203a','#202440'][layer];c.fillRect(x,ground-h,70,h);
      for(let r=0;r<7;r++)for(let col=0;col<4;col++)if((i+r+col)%3===0){c.fillStyle=layer===2?'#4c4267':'#293c59';c.fillRect(x+9+col*14,ground-h+12+r*19,4,7);}
    }
    c.fillStyle='#36384b';c.fillRect(0,ground-43,1200,4);c.fillStyle='#1a1e2b';c.fillRect(0,ground-39,1200,8);
    for(let x=35;x<1200;x+=95){c.fillStyle='#414252';c.fillRect(x,ground-41,5,41);}
  } else {
    const glow=c.createRadialGradient(590,420,20,590,420,500);glow.addColorStop(0,'#743024');glow.addColorStop(1,'transparent');c.fillStyle=glow;c.fillRect(0,0,1200,ground);
    for(let i=0;i<7;i++){const x=i*220-80;c.fillStyle=i%2?'#27151e':'#1b131b';c.beginPath();c.moveTo(x,ground);c.lineTo(x+120,160+i%3*45);c.lineTo(x+270,ground);c.fill();}
    c.strokeStyle='#f47635';c.lineWidth=3;
    for(let i=0;i<12;i++){const x=i*106;c.beginPath();c.moveTo(x,ground+20);c.lineTo(x+23,ground+35);c.lineTo(x+7,ground+56);c.lineTo(x+58,540);c.stroke();}
  }
  c.restore();
  c.fillStyle=arena==='dojo'?'#242026':arena==='rooftop'?'#20212c':'#251218';c.fillRect(0,ground,1200,80);
  c.strokeStyle=arena==='dojo'?'#403337':arena==='volcano'?'#633126':'#353543';c.lineWidth=1;
  // Quiet, stepped floor tiles keep the characters and high-resolution effects in focus.
  for(let row=0;row<5;row++){
    const yy=ground+row*18;c.beginPath();c.moveTo(0,yy);c.lineTo(1200,yy);c.stroke();
    for(let x=(row%2)*85;x<1200;x+=170){c.beginPath();c.moveTo(x,yy);c.lineTo(x,yy+18);c.stroke();}
  }
  if(arena==='volcano')for(let i=0;i<10;i++){const x=i*137;c.strokeStyle='#b8502c';c.lineWidth=2;c.beginPath();c.moveTo(x,ground+4);c.lineTo(x+15,ground+23);c.lineTo(x-3,ground+44);c.lineTo(x+31,540);c.stroke();}
  c.save();c.globalCompositeOperation='lighter';
  for(let i=0;i<28;i++) {
    const x=(i*97+time*(arena==='volcano'?17:5))%1200;
    const y=150+((i*73-time*(arena==='volcano'?35:9))%270+270)%270;
    c.globalAlpha=0.12+Math.sin(time+i)*0.08;c.fillStyle=arena==='volcano'?'#ffad52':'#a9caff';c.fillRect(x,y,2,i%3?2:4);
  }c.restore();
}
