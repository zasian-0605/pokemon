const REMOTE_BASE = "https://pokeapi.co/api/v2";
const DATA_BASE = "./data";

const state = {
  source:"unavailable", pokemon:[], byId:new Map(), byName:new Map(),
  moves:new Map(), types:new Map(), species:new Map(), forms:[]
};

async function json(url){
  const r=await fetch(url);
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}
function addPokemon(p){
  if(!p)return;
  if(Number.isFinite(Number(p.id))) state.byId.set(Number(p.id),p);
  if(p.name) state.byName.set(String(p.name).toLowerCase(),p);
}
function statMap(list){
  const s={hp:1,attack:1,defense:1,spAtk:1,spDef:1,speed:1};
  for(const x of list||[]){
    const n=x.stat&&x.stat.name;
    if(n==="special-attack")s.spAtk=x.base_stat;
    else if(n==="special-defense")s.spDef=x.base_stat;
    else if(n in s)s[n]=x.base_stat;
  }
  return s;
}
function jp(names,fallback){
  for(const lang of ["ja-Hrkt","ja"]){
    const x=(names||[]).find(v=>v&&v.language&&v.language.name===lang);
    if(x&&x.name)return x.name;
  }
  return fallback;
}
async function loadLocal(){
  const files=await Promise.all([
    json(DATA_BASE+"/pokemon.json"),
    json(DATA_BASE+"/moves.json"),
    json(DATA_BASE+"/types.json"),
    json(DATA_BASE+"/species.json"),
    json(DATA_BASE+"/forms.json")
  ]);
  state.pokemon=Array.isArray(files[0])?files[0]:[];
  state.byId.clear();state.byName.clear();
  state.pokemon.forEach(addPokemon);
  state.moves=new Map(Object.entries(files[1]||{}));
  state.types=new Map(Object.entries(files[2]||{}));
  state.species=new Map(Object.entries(files[3]||{}));
  state.forms=Array.isArray(files[4])?files[4]:[];
  if(!state.pokemon.length)throw new Error("empty local pokemon dataset");
  state.source="local";
}
async function remotePokemon(idOrName){
  const raw=await json(REMOTE_BASE+"/pokemon/"+encodeURIComponent(String(idOrName)));
  let sp=null;
  try{if(raw.species&&raw.species.url)sp=await json(raw.species.url)}catch{}
  const p={
    id:raw.id,name:raw.name,jpName:jp(sp&&sp.names,raw.name),
    types:(raw.types||[]).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),
    abilities:(raw.abilities||[]).map(x=>x.ability.name),
    stats:statMap(raw.stats),
    isDefault:Boolean(raw.is_default),
    moves:(raw.moves||[]).map(x=>({name:x.move.name,levels:[]})),
    speciesInfo:{isLegendary:Boolean(sp&&sp.is_legendary),isMythical:Boolean(sp&&sp.is_mythical),
      generation:sp&&sp.generation?sp.generation.name:"",evolutionChainId:0}
  };
  addPokemon(p);return p;
}
async function remoteMove(idOrName){
  const raw=await json(REMOTE_BASE+"/move/"+encodeURIComponent(String(idOrName)));
  return {id:raw.id,name:raw.name,jpName:jp(raw.names,raw.name),type:raw.type&&raw.type.name||"normal",
    power:Number(raw.power)||0,accuracy:raw.accuracy==null?100:Number(raw.accuracy),
    pp:Number(raw.pp)||0,priority:Number(raw.priority)||0,
    damageClass:raw.damage_class&&raw.damage_class.name||"status"};
}
function multiplier(moveType,defenderTypes){
  const rel=state.types.get(moveType);if(!rel)return 1;
  let x=1;for(const t of defenderTypes||[]){
    if((rel.double||[]).includes(t))x*=2;
    if((rel.half||[]).includes(t))x*=.5;
    if((rel.no||[]).includes(t))x=0;
  }return x;
}
const PokeData={
  state,
  async init(){
    try{await loadLocal()}
    catch{
      state.source="remote";
      try{
        const list=await json(REMOTE_BASE+"/pokemon?limit=2000");
        state.pokemon=list.results||[];
        state.byId.clear();state.byName.clear();
        state.pokemon.forEach((x,i)=>{x.id=i+1;addPokemon(x)});
        await Promise.all(["bulbasaur","charmander","squirtle"].map(remotePokemon));
      }catch{state.source="unavailable"}
    }
    return state;
  },
  async get(idOrName){return (Number.isFinite(Number(idOrName))?state.byId.get(Number(idOrName)):state.byName.get(String(idOrName).toLowerCase()))||await remotePokemon(idOrName)},
  async move(idOrName){return state.moves.get(String(idOrName).toLowerCase())||await remoteMove(idOrName)},
  multiplier,
  random(filter){
    const pool=state.pokemon.filter(p=>p&&p.name&&(!filter||filter(p)));
    return pool.length?pool[Math.floor(Math.random()*pool.length)]:null;
  },
  movesFor(p,level){
    const out=[],seen=new Set();
    for(const m of p&&p.moves||[]){
      if(!m||!m.name||seen.has(m.name))continue;
      if(m.levels&&m.levels.length&&Math.min(...m.levels)>level)continue;
      const local=state.moves.get(m.name);
      if(local&&Number(local.power)<=0)continue;
      seen.add(m.name);out.push(m.name);if(out.length===4)break;
    }
    return out.length?out:["tackle","quick-attack","bite","scratch"];
  }
};
window.PokeData=PokeData;
