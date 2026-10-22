import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { defineServer, defineRoom } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BattleRoom } from './BattleRoom';

const production=process.env.NODE_ENV==='production';
const origins=new Set((process.env.ALLOWED_ORIGINS??(production?'':'http://localhost:8080,http://127.0.0.1:8080')).split(',').map(s=>s.trim()).filter(Boolean));
if(!origins.size)throw new Error('ALLOWED_ORIGINS must contain your exact Netlify HTTPS origin.');
for(const origin of origins){const url=new URL(origin);if(url.origin!==origin||(production&&url.protocol!=='https:'))throw new Error('Invalid ALLOWED_ORIGINS entry. Use exact origins, without paths or trailing slashes.');}
const app=express();app.disable('x-powered-by');
// Bound memory and HTTP matchmaking spam. One Render instance; no exposed room directory.
const attempts=new Map<string,{count:number;reset:number}>();
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(origin&&!origins.has(origin)){res.status(403).json({error:'Frontend origin is not allowed.'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS'){res.sendStatus(204);return;}
  if(req.url.startsWith('/matchmake')){
    // Render's trusted proxy appends the connecting IP. Ignore any preceding client-supplied values.
    const forwarded=req.headers['x-forwarded-for'];
    const ip=production&&typeof forwarded==='string'?forwarded.split(',').at(-1)!.trim():req.socket.remoteAddress??'unknown';
    const now=Date.now();let limit=attempts.get(ip);
    if(!limit||now>limit.reset){limit={count:0,reset:now+60000};attempts.set(ip,limit);}
    if(++limit.count>35){res.status(429).json({error:'Too many room requests. Wait a minute.'});return;}
    if(attempts.size>5000)for(const [key,v] of attempts)if(v.reset<now)attempts.delete(key);
  }
  next();
});
app.get('/health',(_req,res)=>res.json({ok:true,service:'stick-slam-jam',protocol:1}));
const http=createServer(app);
const server=defineServer({greet:false,transport:new WebSocketTransport({server:http,pingInterval:3000,pingMaxRetries:2,maxPayload:2048,
  verifyClient: info=>!info.origin||origins.has(info.origin)}),rooms:{battle:defineRoom(BattleRoom)}});
const port=Number(process.env.PORT??2567);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
await server.listen(port,'0.0.0.0');
console.log(`Stick Slam Jam multiplayer listening on ${port}. Single-instance private 1v1 service.`);
