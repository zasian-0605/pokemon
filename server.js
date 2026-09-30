import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();
const MAX_PLAYERS = 6;

app.get("/health", (_req,res)=>res.json({ok:true,game:"pokemon-wild-world",rooms:rooms.size,players:countPlayers()}));
app.get("/", (_req,res)=>res.sendFile(path.join(__dirname,"game.html")));
app.use(express.static(__dirname, { index: false }));

function countPlayers(){let n=0;for(const r of rooms.values())n+=r.players.size;return n}
function roomInfo(room){return {id:room.id,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y})),max:MAX_PLAYERS}}
function send(ws,msg){if(ws.readyState===1)ws.send(JSON.stringify(msg))}
function broadcast(room,msg,except=null){for(const p of room.players.values())if(p.ws!==except)send(p.ws,msg)}
function getOrCreateRoom(){for(const room of rooms.values())if(room.players.size<MAX_PLAYERS)return room;const id=crypto.randomBytes(3).toString("hex").toUpperCase();const room={id,players:new Map()};rooms.set(id,room);return room}
wss.on("connection",(ws)=>{
 let player=null,room=null;
 send(ws,{type:"hello",message:"オンラインサーバーに接続しました。"});
 ws.on("message",(raw)=>{
  let msg;try{msg=JSON.parse(raw.toString())}catch{return}
  if(msg.type==="join"){if(player)return;room=getOrCreateRoom();player={id:crypto.randomUUID(),name:String(msg.name||"プレイヤー").slice(0,16),x:50,y:75,ws};room.players.set(player.id,player);send(ws,{type:"joined",room:roomInfo(room),selfId:player.id});broadcast(room,{type:"player_joined",player:{id:player.id,name:player.name,x:player.x,y:player.y}},ws);return}
  if(!player||!room)return;
  if(msg.type==="move"){player.x=Math.max(0,Math.min(100,Number(msg.x)||0));player.y=Math.max(0,Math.min(100,Number(msg.y)||0));broadcast(room,{type:"player_moved",player:{id:player.id,x:player.x,y:player.y}},ws);return}
  if(msg.type==="chat"){const text=String(msg.text||"").replace(/[<>]/g,"").trim().slice(0,120);if(text)broadcast(room,{type:"chat",playerId:player.id,name:player.name,text},null);return}
  if(msg.type==="ping")send(ws,{type:"pong"});
 });
 ws.on("close",()=>{if(player&&room){room.players.delete(player.id);broadcast(room,{type:"player_left",playerId:player.id});if(room.players.size===0)rooms.delete(room.id)}});
});
const port=process.env.PORT||10000;
server.listen(port,"0.0.0.0",()=>console.log("server listening on "+port));
