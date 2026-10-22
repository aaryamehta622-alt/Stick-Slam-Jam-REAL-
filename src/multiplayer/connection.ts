import { Client, type Room } from '@colyseus/sdk';
import { PROTOCOL_VERSION, normalizeCode, CODE_PATTERN, type Lobby, type MatchSnapshot } from '@/game/network-protocol';

export function serverURL(value = import.meta.env.VITE_MULTIPLAYER_SERVER_URL): string {
  const raw=value?.trim() || (import.meta.env.DEV ? 'http://127.0.0.1:2567' : '');
  if(!raw)return '';
  const url=new URL(raw);
  if(!['http:','https:','ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Use the multiplayer server origin without a path.');
  if(window.location.protocol==='https:'&&['http:','ws:'].includes(url.protocol))throw new Error('The multiplayer server must use HTTPS or WSS.');
  url.protocol=url.protocol==='wss:'?'https:':url.protocol==='ws:'?'http:':url.protocol;
  return url.origin;
}
const tokenKey='stick-slam-online-session-v1';
export class OnlineConnection {
  client:Client;
  room:Room|null=null;
  connected=false;
  rtt=0;
  onLobby:(l:Lobby)=>void=()=>{};
  onSnapshot:(s:MatchSnapshot)=>void=()=>{};
  onNotice:(s:string)=>void=()=>{};
  onConnection:(connected:boolean)=>void=()=>{};
  ping?:ReturnType<typeof setInterval>;
  closed=false;
  constructor(readonly url:string){this.client=new Client(url);}
  saveToken(){try{if(this.room)sessionStorage.setItem(tokenKey,JSON.stringify({url:this.url,token:this.room.reconnectionToken,at:Date.now()}));}catch{}}
  clearToken(){try{sessionStorage.removeItem(tokenKey);}catch{}}
  async restore():Promise<boolean>{
    let saved:{url:string;token:string;at:number};try{saved=JSON.parse(sessionStorage.getItem(tokenKey)??'null');}catch{return false;}
    if(!saved||saved.url!==this.url||Date.now()-saved.at>30*60*1000)return false;
    try{const room=await this.client.reconnect(saved.token);this.attach(room);return true;}catch{this.clearToken();this.onNotice('The previous room is no longer available. Create or join a room again.');return false;}
  }
  async connect(mode:'create'|'join',code:string){
    const normalized=normalizeCode(code);
    if((mode==='join'||normalized)&&!CODE_PATTERN.test(normalized))throw new Error('Enter 4–12 letters and numbers.');
    try{
      const options={protocol:PROTOCOL_VERSION};
      const room=mode==='create'?await this.client.create('battle',{...options,code:normalized}):await this.client.joinById(normalized,options);
      this.attach(room);
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      if(/not found|not available|invalid room|no rooms/i.test(message))throw new Error('Room not found. Check the code or ask your friend to create it again.');
      if(/locked|full|maxClients/i.test(message))throw new Error('This room is full or already playing.');
      if(/fetch|network|connection|timeout/i.test(message))throw new Error('Could not reach the multiplayer server. A sleeping server may take a minute to wake; try again shortly.');
      throw error;
    }
  }
  attach(room:Room){
    if(this.closed){void room.leave();return;}
    this.room=room;this.connected=true;this.saveToken();
    // Never replay buffered old movement after a network outage.
    room.reconnection.maxEnqueuedMessages=0;room.reconnection.maxRetries=8;room.reconnection.maxDelay=2500;room.reconnection.minUptime=0;
    room.onMessage('lobby',(l:Lobby)=>{this.saveToken();this.onLobby(l);});
    room.onMessage('snapshot',(s:MatchSnapshot)=>this.onSnapshot(s));
    room.onMessage('notice',(s:string)=>this.onNotice(s));
    room.onMessage('closed',(s:string)=>{this.closed=true;this.onNotice(s);this.connected=false;this.clearToken();if(this.ping)clearInterval(this.ping);this.onConnection(false);});
    room.onMessage('pong',(stamp:number)=>{this.rtt=Math.max(0,Math.round(performance.now()-stamp));});
    room.onDrop(()=>{if(this.closed)return;this.connected=false;this.onConnection(false);this.onNotice('Connection interrupted. Reconnecting for up to 20 seconds…');});
    room.onReconnect(()=>{this.connected=true;this.saveToken();this.onConnection(true);room.send('hello');});
    room.onLeave((_code,reason)=>{if(this.closed)return;this.connected=false;if(this.ping)clearInterval(this.ping);this.clearToken();this.onConnection(false);this.onNotice(reason||'Room connection ended. Create or join a room again.');});
    room.onError((_code,message)=>this.onNotice(message||'The multiplayer server reported an error.'));
    this.onConnection(true);room.send('hello');
    this.ping=setInterval(()=>{if(this.connected){room.send('ping',performance.now());this.saveToken();}},2000);
  }
  send(type:string,value?:unknown){if(this.connected)this.room?.send(type,value);}
  leave(){this.closed=true;this.connected=false;if(this.ping)clearInterval(this.ping);this.clearToken();void this.room?.leave();this.room=null;}
}
