import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Client } from '@colyseus/sdk';
const port=2568,url=`http://127.0.0.1:${port}`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,message,timeout=5000){const end=Date.now()+timeout;while(Date.now()<end){if(check())return;await delay(15);}throw new Error(message);}
const input=()=>({left:false,right:false,jump:false,attack:false,dash:false,block:false,heavyHeld:false,heavyReleased:false,pickup:false,abilities:[false,false,false,false]});
function track(room){const t={room,lobby:null,snapshot:null,snapshots:[],notices:[],seq:0};room.onMessage('lobby',m=>t.lobby=m);room.onMessage('snapshot',m=>{t.snapshot=m;t.snapshots.push(m);if(t.snapshots.length>180)t.snapshots.shift();});room.onMessage('notice',m=>t.notices.push(m));room.onMessage('closed',()=>{});room.send('hello');return t;}
function send(t,patch={}){t.room.send('input',{seq:++t.seq,matchId:t.lobby.matchId,input:{...input(),...patch}});}
async function pulse(t,patch,ms=45){send(t,patch);await delay(ms);send(t);}
async function approach(t,range=105){const end=Date.now()+5000;while(Date.now()<end){const s=t.snapshot?.state;if(s&&Math.abs(s.enemy.x-s.player.x)<range){send(t);return;}send(t,{right:true});await delay(40);}throw Error('Could not approach target');}
async function moveTo(t,goal){const end=Date.now()+5000;while(Date.now()<end){const x=t.snapshot.state.player.x;if(Math.abs(x-goal)<18){send(t);return;}send(t,{left:x>goal,right:x<goal});await delay(35);}throw Error('Could not reach dropped fish');}

test('real Colyseus server and independent clients',async t=>{
  const child=spawn(process.execPath,['server/dist/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
  const rooms=[];
  t.after(()=>{for(const r of rooms){r.reconnection.enabled=false;r.connection.close(4000);}child.kill();});
  await until(()=>logs.includes('listening'),'Backend did not start: '+logs);
  const health=await fetch(url+'/health');assert.equal(health.status,200);
  assert.equal((await fetch(url+'/health',{headers:{Origin:'https://evil.invalid'}})).status,403);
  const a=new Client(url),b=new Client(url),c=new Client(url);
  let p1,p2;
  await t.test('custom code, duplicate rejection, validation, case-insensitive join and full rooms',async()=>{
    await assert.rejects(()=>a.create('battle',{code:'BAD!',protocol:1}),/4–12/);
    const first=await a.create('battle',{code:'apple',protocol:1});rooms.push(first);p1=track(first);assert.equal(first.roomId,'APPLE');
    await assert.rejects(()=>c.create('battle',{code:'Apple',protocol:1}),/already in use/);
    await assert.rejects(()=>c.joinById('MISSING',{protocol:1}));
    const second=await b.joinById('APPLE',{protocol:1});rooms.push(second);p2=track(second);
    await until(()=>p1.lobby?.players.length===2&&p2.lobby?.players.length===2,'Both lobbies must contain two players');
    await assert.rejects(()=>c.joinById('APPLE',{protocol:1}));
  });
  await t.test('independent selection, ready reset and synchronized countdown',async()=>{
    p1.room.send('ready',true);await until(()=>p1.lobby.players[0].ready,'Host ready');
    p1.room.send('select','samurai');await until(()=>p1.lobby.players[0].classId==='samurai','Select Samurai');assert.equal(p1.lobby.players[0].ready,false);
    p2.room.send('start');await delay(70);assert.equal(p1.lobby.phase,'lobby');
    p1.room.send('select','fisherman');await until(()=>p1.lobby.players[0].classId==='fisherman','Select Fisherman');
    p1.room.send('ready',true);p2.room.send('ready',true);await until(()=>p1.lobby.players.every(p=>p.ready),'Both ready');
    p1.room.send('start');await until(()=>p1.lobby.phase==='countdown'&&p2.lobby.phase==='countdown','Shared countdown');assert.equal(p1.snapshot.state.player.hp,110);
    await until(()=>p1.lobby.phase==='fight'&&p2.lobby.phase==='fight','Fight starts');
  });
  await t.test('real hook hits, shared pull/punch, authoritative health and cooldown enforcement',async()=>{
    await pulse(p1,{abilities:[true,false,false,false]});
    await until(()=>p2.snapshot.state.enemy.grabbedBy==='player','Remote client sees hook grab');
    await until(()=>p1.snapshot.state.enemy.hp===89&&p2.snapshot.state.enemy.hp===89,'Both see punch damage');
    const cd=p1.snapshot.state.player.cooldowns[0];await pulse(p1,{abilities:[true,false,false,false]});await delay(80);
    assert.ok(p1.snapshot.state.player.cooldowns[0]<=cd);assert.equal(p2.snapshot.state.enemy.hp,89);
    assert.equal(p1.snapshot.state.moveVfx.filter(m=>m.ability==='fishHook').length,1);
    assert.ok(p1.snapshot.events.every(e=>!('particles'in e)));
  });
  await t.test('server fish roll, item spawn, pickup and thrown fish agree on both clients',async()=>{
    await until(()=>!p1.snapshot.state.player.attack&&p1.snapshot.state.enemy.hitstun<=0,'Hook recovery ends');
    await approach(p1);await delay(200);await pulse(p1,{abilities:[false,true,false,false]});
    await until(()=>p1.snapshot.state.player.fishing?.fish,'Host sees fish result');
    const fish=p1.snapshot.state.player.fishing.fish;
    await until(()=>p2.snapshot.state.player.fishing?.fish===fish,'Peer sees the same random fish');
    await until(()=>p1.snapshot.state.droppedFish.length===1&&p2.snapshot.state.droppedFish.length===1,'Shared dropped item');
    assert.equal(p1.snapshot.state.droppedFish[0].kind,fish);
    const itemX=p1.snapshot.state.droppedFish[0].x;
    await delay(900);await moveTo(p1,itemX);await pulse(p1,{pickup:true});
    await until(()=>p1.snapshot.state.player.heldFish===fish&&p2.snapshot.state.player.heldFish===fish,'Pickup synchronizes');
    const hp=p1.snapshot.state.enemy.hp;await pulse(p1,{attack:true});
    await until(()=>p1.snapshot.state.player.heldFish===undefined&&p2.snapshot.state.enemy.hp<hp,'Throw consumed and hits peer');
    assert.equal(p1.snapshot.state.droppedFish.length,0);
    const peerPacket=p2.snapshots.find(s=>s.seq===p1.snapshot.seq);if(peerPacket)assert.deepEqual(peerPacket.state,p1.snapshot.state);
  });
  await t.test('rejects fake damage, malformed inputs, duplicate sequences and stale inputs',async()=>{
    await until(()=>!p1.snapshot.state.enemy.poison,'Finite poison finishes');
    const hp=p1.snapshot.state.enemy.hp;
    p1.room.send('damage',{damage:99999,currency:9999});
    p1.room.send('input',{seq:++p1.seq,matchId:p1.lobby.matchId,input:{...input(),left:9000}});
    const old=p1.seq;send(p1);p1.room.send('input',{seq:old,matchId:p1.lobby.matchId,input:{...input(),abilities:[false,false,false,true]}});
    await until(()=>p1.notices.length>=2,'Invalid actions receive rejection notices');assert.equal(p1.snapshot.state.enemy.hp,hp);
    send(p1,{left:true});await delay(850);const x=p1.snapshot.state.player.x;await delay(300);assert.ok(Math.abs(p1.snapshot.state.player.x-x)<2,'Lost input lease stops movement');
  });
  await t.test('victory and rematch are authoritative and require both votes',async()=>{
    // Use real abilities and light attacks to finish the opponent; no test damage endpoint exists.
    for(let i=0;i<150&&p1.lobby.phase==='fight';i++){
      const s=p1.snapshot.state;const dx=s.enemy.x-s.player.x;
      send(p1,{left:dx<-85,right:dx>85,attack:i%3===0,abilities:[i%7===0,i%11===0,false,i===0]});await delay(65);
    }
    await until(()=>p1.lobby.phase==='results'&&p2.lobby.phase==='results'&&p1.snapshot.state.winner&&p2.snapshot.state.winner,'Shared victory',6000);
    assert.equal(p1.snapshot.state.winner,p2.snapshot.state.winner);assert.equal(p1.snapshot.state.enemy.hp,0);
    p1.room.send('rematch',true);await delay(120);assert.equal(p1.lobby.phase,'results');
    p2.room.send('rematch',true);await until(()=>p1.lobby.phase==='countdown'&&p1.lobby.matchId===2,'Two-vote rematch');
    assert.equal(p1.snapshot.state.player.hp,110);assert.equal(p1.snapshot.state.enemy.hp,110);
  });
  await t.test('abnormal disconnect clears controls, pauses, and reconnects the reserved seat',async()=>{
    await until(()=>p1.lobby.phase==='fight','Rematch begins');
    p1.seq=0;const initial=p1.snapshot.state.player.x;await pulse(p1,{right:true},120);
    await until(()=>p1.snapshot.state.player.x>initial+15,'New round accepts a fresh input sequence');
    const token=p2.room.reconnectionToken;p2.room.reconnection.enabled=false;
    p2.room.connection.close(1000);
    await until(()=>p1.lobby.players.some(p=>!p.connected),'Peer sees reconnect grace');
    const resumed=await b.reconnect(token);rooms.push(resumed);p2=track(resumed);
    await until(()=>p1.lobby.players.every(p=>p.connected)&&p2.lobby?.phase==='fight','Peer reconnects and receives current lobby');
    assert.equal(p2.room.sessionId,p1.lobby.players.find(p=>p.side==='enemy').sessionId);
    const x=p1.snapshot.state.enemy.x;await pulse(p2,{left:true},130);
    await until(()=>p1.snapshot.state.enemy.x<x-15,'Refreshed client can control its reserved fighter');
  });
  await t.test('Fresh Catch healing and the sea creature synchronize through real inputs',async()=>{
    await pulse(p2,{abilities:[true,false,false,false]});
    await until(()=>p1.snapshot.state.player.hp===89&&p2.snapshot.state.player.hp===89,'Guest hook damages host');
    await until(()=>!p2.snapshot.state.enemy.attack&&p1.snapshot.state.player.hitstun<=0,'Hook recovery and stun end');
    await pulse(p1,{abilities:[false,false,true,false]});
    await until(()=>p1.snapshot.state.player.hp===107&&p2.snapshot.state.player.hp===107,'Both see completed heal');
    await until(()=>!p1.snapshot.state.player.attack,'Heal recovery ends');
    await pulse(p1,{abilities:[false,false,false,true]});
    await until(()=>p1.snapshot.state.aoeZones.some(z=>z.kind==='sea')&&p2.snapshot.state.aoeZones.some(z=>z.kind==='sea'),'Both see beast warning');
    await until(()=>p1.snapshot.state.enemy.hp===74&&p2.snapshot.state.enemy.hp===74,'Creature damage shared');
    await until(()=>p1.snapshot.state.enemy.y>20&&p2.snapshot.state.enemy.y>20,'Creature launch shared');
  });
  await t.test('guest leaving returns a forfeit result and host leaving closes the room',async()=>{
    await until(()=>p1.lobby.phase==='fight','Countdown after reconnect');await p2.room.leave();
    await until(()=>p1.lobby.phase==='results','Forfeit result');assert.equal(p1.lobby.players.length,1);
    p1.room.send('lobby');await until(()=>p1.lobby.phase==='lobby','Return to lobby');
    await p1.room.leave();await delay(120);await assert.rejects(()=>c.joinById('APPLE',{protocol:1}));
  });
  assert.ok(!/uncaught|ReferenceError|TypeError/.test(logs),logs);
});
