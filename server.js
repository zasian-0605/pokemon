import express from "express";
import http from "http";
import {WebSocketServer} from "ws";
import crypto from "crypto";

const app=express();
const server=http.createServer(app);
const wss=new WebSocketServer({server,maxPayload:8192});
const cache=new Map();
const rooms=new Map();
const MAX_PLAYERS=8;
const POKE="https://pokeapi.co/api/v2";

async function j(url){
  if(cache.has(url)) return cache.get(url);
  const r=await fetch(url);
  if(!r.ok) throw new Error("PokeAPI HTTP "+r.status);
  const v=await r.json();
  cache.set(url,v);
  return v;
}
const jp=(names,f)=>((names||[]).find(x=>x.language?.name==="ja-Hrkt")?.name)||((names||[]).find(x=>x.language?.name==="ja")?.name)||f;
const safe=(v,n)=>String(v??"").replace(/[<>]/g,"").trim().slice(0,n);
const types=a=>(a||[]).sort((x,y)=>x.slot-y.slot).map(x=>x.type.name);
const stats=a=>Object.fromEntries((a||[]).map(x=>[x.stat.name,x.base_stat]));
function chainNext(node,out=[]){
  if(!node) return out;
  out.push({name:node.species.name,details:node.evolution_details||[]});
  for(const n of node.evolves_to||[]) chainNext(n,out);
  return out;
}
async function pokemonData(name){
  const p=await j(POKE+"/pokemon/"+encodeURIComponent(name));
  const s=await j(p.species.url);
  const moves=(p.moves||[]).map(m=>{
    const ds=(m.version_group_details||[]).filter(v=>v.move_learn_method?.name==="level-up");
    const levels=ds.map(v=>v.level_learned_at).filter(Number.isFinite);
    return {name:m.move.name,level:levels.length?Math.min(...levels):0};
  }).filter((m,i,a)=>a.findIndex(x=>x.name===m.name)===i);
  const chain=s.evolution_chain?.url?await j(s.evolution_chain.url):null;
  return {
    id:p.id,name:p.name,nameJa:jp(s.names,p.name),species:s.name,
    types:types(p.types),stats:stats(p.stats),abilities:(p.abilities||[]).map(x=>x.ability.name),
    baseExp:p.base_experience||0,weight:p.weight||0,height:p.height||0,
    moves,sprite:"/api/sprite/"+p.id,
    captureRate:s.capture_rate??45,isLegendary:!!s.is_legendary,isMythical:!!s.is_mythical,
    evolutionChain:chainNext(chain?.chain).map(x=>({name:x.name,details:x.details})).filter((x,i,a)=>a.findIndex(y=>y.name===x.name)===i)
  };
}
app.get("/health",(_req,res)=>res.json({ok:true,game:"pokemon-star-journey",rooms:rooms.size,players:[...rooms.values()].reduce((n,r)=>n+r.players.size,0)}));
app.get("/api/pokedex",async(_req,res)=>{
  try{
    const data=await j(POKE+"/pokemon?limit=2000");
    const list=(data.results||[]).map((x,i)=>({id:i+1,name:x.name}));
    res.json(list);
  }catch(e){res.status(502).json({error:e.message})}
});
app.get("/api/pokemon/:name",async(req,res)=>{
  try{res.json(await pokemonData(req.params.name))}catch(e){res.status(502).json({error:e.message})}
});
app.get("/api/move/:name",async(req,res)=>{
  try{
    const m=await j(POKE+"/move/"+encodeURIComponent(req.params.name));
    const rel=await j(m.type.url);
    res.json({
      id:m.id,name:m.name,nameJa:jp(m.names,m.name),type:m.type.name,power:m.power||0,accuracy:m.accuracy??100,
      pp:m.pp||5,priority:m.priority||0,damageClass:m.damage_class?.name||"status",
      ailment:m.meta?.ailment?.name||"none",ailmentChance:m.meta?.ailment_chance||0,
      category:m.meta?.category?.name||"damage",flinchChance:m.meta?.flinch_chance||0,
      double:rel.damage_relations.double_damage_to.map(x=>x.name),
      half:rel.damage_relations.half_damage_to.map(x=>x.name),
      no:rel.damage_relations.no_damage_to.map(x=>x.name)
    });
  }catch(e){res.status(502).json({error:e.message})}
});
app.get("/api/sprite/:id",async(req,res)=>{
  try{
    const pose=req.query.back==="1"?"back/":"";
    const r=await fetch("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/"+pose+encodeURIComponent(req.params.id)+".png");
    if(!r.ok) throw new Error("sprite HTTP "+r.status);
    res.set("Cache-Control","public,max-age=86400").type("png").send(Buffer.from(await r.arrayBuffer()));
  }catch{res.status(404).end()}
});
app.use(express.static(".",{index:"index.html"}));

function roomView(r){return{id:r.id,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y})),max:MAX_PLAYERS}}
const send=(ws,m)=>{if(ws.readyState===1)ws.send(JSON.stringify(m))};
function broadcast(r,m,skip){for(const p of r.players.values())if(p.id!==skip)send(p.ws,m)}
function getRoom(){
  const open=[...rooms.values()].sort((a,b)=>a.created-b.created).find(r=>r.players.size<MAX_PLAYERS);
  if(open)return open;
  const id=crypto.randomBytes(3).toString("hex").toUpperCase(),r={id,players:new Map(),created:Date.now()};
  rooms.set(id,r);return r;
}
wss.on("connection",ws=>{
  let self=null,room=null;
  ws.on("message",raw=>{
    let m;try{m=JSON.parse(raw.toString())}catch{return}
    if(m.type==="join"){
      if(self)return;
      room=getRoom();self={id:crypto.randomUUID(),name:safe(m.name,16)||"旅人",x:50,y:80,ws};
      room.players.set(self.id,self);
      send(ws,{type:"joined",selfId:self.id,room:roomView(room)});
      broadcast(room,{type:"player_joined",player:{id:self.id,name:self.name,x:self.x,y:self.y}},self.id);return;
    }
    if(!self||!room)return;
    if(m.type==="move"){
      self.x=Math.min(98,Math.max(2,Number(m.x)||50));self.y=Math.min(96,Math.max(4,Number(m.y)||80));
      broadcast(room,{type:"player_moved",player:{id:self.id,x:self.x,y:self.y}},self.id);
    }else if(m.type==="chat"){
      const text=safe(m.text,120);if(text)broadcast(room,{type:"chat",playerId:self.id,name:self.name,text});
    }else if(m.type==="ping")send(ws,{type:"pong"});
  });
  ws.on("close",()=>{
    if(!self||!room)return;
    room.players.delete(self.id);broadcast(room,{type:"player_left",playerId:self.id});
    if(room.players.size===0)rooms.delete(room.id);
  });
});
const port=Number(process.env.PORT)||10000;
server.listen(port,"0.0.0.0",()=>console.log("Pokémon Star Journey listening on "+port));