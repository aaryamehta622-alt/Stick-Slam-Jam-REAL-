import { Room, ServerError, type Client } from '@colyseus/core';
import { randomInt } from 'node:crypto';
import { CLASSES, type ClassId } from '../../src/game/classes';
import { emptyInput, updateGame, type GameState, type InputState } from '../../src/game/engine';
import { CODE_PATTERN, PROTOCOL_VERSION, normalizeCode, createMatch, toWire, validInput, clearEdges,
  type Lobby, type LobbyPlayer, type MatchSnapshot } from '../../src/game/network-protocol';

// Atomic, process-local code registry. Deploy ONE instance; never scale this registry horizontally.
const codes = new Map<string, BattleRoom>();
interface Controls { seq: number; applied: number; input: InputState; last: number; tokens: number; refill: number }
export class BattleRoom extends Room {
  maxClients = 2;
  maxMessagesPerSecond = 100;
  lobby!: Lobby;
  game?: GameState;
  controls = new Map<string, Controls>();
  tick = 0;
  countdownEnd = 0;
  activity = Date.now();
  paused = false;
  closing = false;
  onCreate(options: {code?: unknown; protocol?: unknown}) {
    if (options.protocol !== PROTOCOL_VERSION) throw new ServerError(400, 'Please refresh the game to update its multiplayer version.');
    if (options.code !== undefined && typeof options.code !== 'string') throw new ServerError(400, 'Invalid room code.');
    let code = normalizeCode((options.code as string) ?? '');
    if (code && !CODE_PATTERN.test(code)) throw new ServerError(400, 'Use 4–12 letters and numbers for the room code.');
    if (code && codes.has(code)) throw new ServerError(409, 'That code is already in use. Choose another.');
    if (codes.size >= 100) throw new ServerError(503, 'The server is busy. Try again shortly.');
    if (!code) do { code = Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join(''); } while (codes.has(code));
    codes.set(code,this); this.roomId = code;
    this.setPrivate(true);
    this.lobby = {code, host:'', arena:'dojo', phase:'lobby', players:[], countdown:0, matchId:0, note:''};
    this.onMessage('hello', client => this.sendCurrent(client));
    this.onMessage('ping', (client, stamp) => { if (typeof stamp === 'number' && Number.isFinite(stamp)) client.send('pong',stamp); });
    this.onMessage('select', (client, classId) => {
      if (!this.actionAllowed(client) || this.lobby.phase !== 'lobby') return;
      if (typeof classId !== 'string' || !Object.hasOwn(CLASSES,classId)) return this.reject(client,'Unknown playable class.');
      const player=this.player(client); if (!player) return;
      player.classId=classId as ClassId; player.ready=false; this.changed();
    });
    this.onMessage('arena', (client, arena) => {
      if (!this.actionAllowed(client) || client.sessionId !== this.lobby.host || this.lobby.phase !== 'lobby') return;
      if (!['dojo','rooftop','volcano'].includes(arena)) return this.reject(client,'Unknown arena.');
      this.lobby.arena=arena;this.lobby.players.forEach(p=>p.ready=false);this.changed();
    });
    this.onMessage('ready', (client, ready) => {
      if (!this.actionAllowed(client) || this.lobby.phase !== 'lobby' || typeof ready !== 'boolean') return;
      const player=this.player(client);if(player)player.ready=ready;this.changed();
    });
    this.onMessage('start', client => {
      if (!this.actionAllowed(client)) return;
      if (client.sessionId!==this.lobby.host || this.lobby.phase!=='lobby' || !this.both(p=>p.ready&&p.connected)) return this.reject(client,'Both players must be connected and ready.');
      this.startMatch();
    });
    this.onMessage('input', (client, packet) => this.receiveInput(client,packet));
    this.onMessage('rematch', (client, value) => {
      if (!this.actionAllowed(client) || this.lobby.phase!=='results' || value!==true) return;
      const player=this.player(client);if(player)player.rematch=true;
      if(this.both(p=>p.rematch&&p.connected))this.startMatch();else this.changed();
    });
    this.onMessage('lobby', client => {
      if (!this.actionAllowed(client) || !['results','lobby'].includes(this.lobby.phase)) return;
      this.game=undefined;this.lobby.phase='lobby';this.lobby.note='Choose a class and ready up for another round.';
      this.lobby.players.forEach(p=>{p.ready=false;p.rematch=false;});this.clearControls();this.changed();
    });
    this.onMessage('*', (client) => this.reject(client,'Unsupported action. Only validated inputs control combat.'));
    this.setFixedTimestep(ctx => this.step(ctx.dt),120);
    this.clock.setInterval(()=>{
      if(Date.now()-this.activity>15*60*1000){this.broadcast('closed','Room expired after 15 minutes without activity.');void this.disconnect();}
    },10000);
  }
  onAuth(_client: Client, options: {protocol?:unknown}) {
    if(options?.protocol!==PROTOCOL_VERSION)throw new ServerError(400,'Please refresh the game to update its multiplayer version.');
    if(this.lobby.phase!=='lobby'||this.lobby.players.length>=2)throw new ServerError(409,'This room is full or already playing.');
    return true;
  }
  onJoin(client: Client) {
    if(!this.lobby.host)this.lobby.host=client.sessionId;
    const side=this.lobby.players.some(p=>p.side==='player')?'enemy':'player';
    this.lobby.players.push({sessionId:client.sessionId,side,classId:'fisherman',ready:false,connected:true,rematch:false});
    this.controls.set(client.sessionId,{seq:-1,applied:-1,input:emptyInput(),last:0,tokens:12,refill:Date.now()});
    this.changed();
  }
  onDrop(client: Client) {
    const player=this.player(client);if(!player)return;
    player.connected=false;player.ready=false;this.clearControls();this.paused=true;
    this.lobby.note='Connection lost. Match paused for up to 20 seconds while your friend reconnects.';
    this.allowReconnection(client,20);this.changed();
  }
  onReconnect(client: Client) {
    const player=this.player(client);if(!player)return;
    player.connected=true;this.clearControls();
    const controls=this.controls.get(client.sessionId);if(controls){controls.seq=-1;controls.applied=-1;}
    if(this.both(p=>p.connected)) {
      this.paused=false;this.lobby.note='Reconnected. Controls cleared; round resumes.';
      if(this.lobby.phase==='countdown')this.countdownEnd=Date.now()+3000;
    }
    this.changed();this.sendCurrent(client);
  }
  onLeave(client: Client) {
    if(this.closing)return;
    const player=this.player(client);if(!player)return;
    if(client.sessionId===this.lobby.host){this.closing=true;this.broadcast('closed','The host left. This room has closed.');void this.disconnect();return;}
    this.lobby.players=this.lobby.players.filter(p=>p.sessionId!==client.sessionId);this.controls.delete(client.sessionId);this.clearControls();this.paused=false;
    if(this.game&&['countdown','fight'].includes(this.lobby.phase)){
      this.game.winner='player';this.game.winTime=this.game.time;this.lobby.phase='results';this.lobby.note='Your friend disconnected. Player 1 wins by forfeit.';
    }else this.lobby.note='Player 2 left. Share the code to invite another friend.';
    this.changed();this.snapshot();
  }
  onDispose(){if(codes.get(this.lobby?.code)===this)codes.delete(this.lobby.code);}
  player(client: Client){return this.lobby.players.find(p=>p.sessionId===client.sessionId);}
  both(check:(p:LobbyPlayer)=>boolean){return this.lobby.players.length===2&&this.lobby.players.every(check);}
  reject(client:Client,message:string){client.send('notice',message);}
  actionAllowed(client:Client){
    const control=this.controls.get(client.sessionId);if(!control)return false;
    const now=Date.now();control.tokens=Math.min(12,control.tokens+(now-control.refill)*.005);control.refill=now;
    if(control.tokens<1)return false;control.tokens--;return true;
  }
  changed(){this.activity=Date.now();this.broadcast('lobby',this.lobby);}
  clearControls(resetSequence=false){for(const c of this.controls.values()){c.input=emptyInput();c.last=0;if(resetSequence){c.seq=-1;c.applied=-1;}} }
  startMatch(){
    const p=this.lobby.players.find(p=>p.side==='player')!,e=this.lobby.players.find(p=>p.side==='enemy')!;
    this.game=createMatch(p.classId,e.classId,this.lobby.arena);this.game.headless=true;this.game.random=()=>randomInt(0x1000000)/0x1000000;
    this.clearControls(true);this.lobby.matchId++;this.lobby.phase='countdown';this.lobby.countdown=3;this.lobby.note='';
    this.lobby.players.forEach(p=>p.rematch=false);this.countdownEnd=Date.now()+3000;this.paused=false;this.tick=0;
    this.changed();this.snapshot();
  }
  receiveInput(client:Client, packet:unknown){
    if(!packet||typeof packet!=='object'||Array.isArray(packet))return this.reject(client,'Invalid input.');
    const data=packet as {seq?:number;input?:unknown;matchId?:number};
    if(Object.keys(data).some(k=>!['seq','input','matchId'].includes(k))||!Number.isSafeInteger(data.seq)||data.seq! < 0||data.seq! > 2147483647)return this.reject(client,'Invalid input sequence.');
    const control=this.controls.get(client.sessionId),input=validInput(data.input);
    if(!control||!input)return this.reject(client,'Invalid controls.');
    if(this.paused||this.lobby.phase!=='fight'||data.matchId!==this.lobby.matchId)return;
    if(data.seq!<=control.seq)return; // WebSocket ordering plus monotonic sequence: duplicate actions cannot replay.
    control.seq=data.seq!;
    const old=control.input;
    control.input={...input,attack:old.attack||input.attack,jump:old.jump||input.jump,dash:old.dash||input.dash,
      pickup:old.pickup||input.pickup,heavyReleased:old.heavyReleased||input.heavyReleased,
      abilities:input.abilities.map((b,i)=>b||old.abilities[i]) as InputState['abilities']};
    control.last=Date.now();this.activity=Date.now();
  }
  step(dt:number){
    if(this.paused)return;
    if(this.lobby.phase==='countdown'){
      const left=Math.max(0,Math.ceil((this.countdownEnd-Date.now())/1000));
      if(left!==this.lobby.countdown){this.lobby.countdown=left;this.changed();}
      if(left===0){this.lobby.phase='fight';this.changed();}
    }
    if(this.game&&this.lobby.phase==='fight'){
      const inputs=(['player','enemy'] as const).map(side=>{
        const player=this.lobby.players.find(p=>p.side===side),c=player?this.controls.get(player.sessionId):undefined;
        if(!c||!player?.connected||Date.now()-c.last>250){if(c)c.input=emptyInput();return emptyInput();}
        return c.input;
      });
      const consuming=this.game.hitPause<=0;
      updateGame(this.game,inputs[0],dt,inputs[1]);
      if(consuming)for(const c of this.controls.values()){clearEdges(c.input);c.applied=c.seq;}
      if(this.game.winner){this.lobby.phase='results';this.lobby.note='Round complete. Both players can vote for a rematch.';this.clearControls();this.changed();}
    }
    if(this.game&&++this.tick%4===0)this.snapshot(); // 120 Hz combat, 30 Hz MessagePack snapshots.
  }
  sendCurrent(client:Client){client.send('lobby',this.lobby);if(this.game)client.send('snapshot',this.packet([]));}
  packet(events:NonNullable<GameState['networkEvents']>):MatchSnapshot{
    const ack=(['player','enemy'] as const).map(side=>{const p=this.lobby.players.find(p=>p.side===side);return p?this.controls.get(p.sessionId)?.applied??-1:-1;}) as [number,number];
    return {matchId:this.lobby.matchId,seq:this.tick,at:Date.now(),ack,state:toWire(this.game!),events};
  }
  snapshot(){if(!this.game)return;const events=this.game.networkEvents??[];this.broadcast('snapshot',this.packet(events));this.game.networkEvents=[];}
}
