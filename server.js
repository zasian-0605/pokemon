import express from 'express';
import http from 'http';
import {WebSocketServer} from 'ws';
import crypto from 'crypto';
import path from 'path';
import {fileURLToPath} from 'url';
const __dirname=path.dirname(fileURLToPath(import.meta.url)),app=express(),server=http.createServer(app),wss=new WebSocketServer({server,maxPayload:4096});
const rooms=new Map(),MAX_PLAYERS=8;
app.get('/health',(_req,res)=>res.json({ok:true,game:'monster-veil',rooms:rooms.size,players:[...rooms.values()].reduce((n,r)=>n+r.players.size,0)}));
app.use(express.static(__dirname,{index:'index.html'}));
const clean=(v,n)=>String(v??'').replace(/[<>]/g,'').trim().slice(0,n),clamp=(n,a,b)=>Math.min(b,Math.max(a,Number.isFinite(n)?n:a));
const send=(ws,m)=>{if(ws.readyState===1)ws.send(JSON.stringify(m))};
function roomView(r){return{id:r.id,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y})),max:MAX_PLAYERS}}
function broadcast(r,m,skip){for(const p of r.players.values())if(p.id!==skip)send(p.ws,m)}
function getRoom(){const open=[...rooms.values()].sort((a,b)=>a.created-b.created).find(r=>r.players.size<MAX_PLAYERS);if(open)return open;const id=crypto.randomBytes(3).toString('hex').toUpperCase(),r={id,players:new Map(),created:Date.now()};rooms.set(id,r);return r}
wss.on('connection',ws=>{let self=null,r=null;ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}
if(m.type==='join'){if(self)return;r=getRoom();self={id:crypto.randomUUID(),name:clean(m.name,16)||'旅人',x:50,y:78,ws};r.players.set(self.id,self);send(ws,{type:'joined',selfId:self.id,room:roomView(r)});broadcast(r,{type:'player_joined',player:{id:self.id,name:self.name,x:self.x,y:self.y}},self.id);return}
if(!self||!r)return;
if(m.type==='move'){self.x=clamp(Number(m.x),2,98);self.y=clamp(Number(m.y),4,96);broadcast(r,{type:'player_moved',player:{id:self.id,x:self.x,y:self.y}},self.id)}
else if(m.type==='chat'){const text=clean(m.text,120);if(text)broadcast(r,{type:'chat',playerId:self.id,name:self.name,text})}
else if(m.type==='ping')send(ws,{type:'pong'})});
ws.on('close',()=>{if(!self||!r)return;r.players.delete(self.id);broadcast(r,{type:'player_left',playerId:self.id});if(!r.players.size)rooms.delete(r.id)})});
const port=Number(process.env.PORT)||10000;server.listen(port,'0.0.0.0',()=>console.log('Monster Veil listening on '+port));