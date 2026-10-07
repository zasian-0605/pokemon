const $=id=>document.getElementById(id);
const API="/api";
const VERSION=4;
const STARTERS=["bulbasaur","charmander","squirtle","chikorita","cyndaquil","totodile","treecko","torchic","mudkip"];
const AREA=[
 {name:"星見町",level:3,enc:["rattata","pidgey","sentret","zigzagoon"],bg:"town",north:null,south:1,west:null,east:2},
 {name:"1番道路",level:3,enc:["pidgey","rattata","caterpie","weedle","hoothoot","wurmple"],bg:"route",north:0,south:null,west:null,east:3},
 {name:"ミズホ湿原",level:7,enc:["psyduck","magikarp","wooper","lotad","marill"],bg:"water",north:4,south:null,west:0,east:null},
 {name:"クロガネ洞窟",level:10,enc:["zubat","geodude","onix","magnemite","makuhita"],bg:"cave",north:4,south:null,west:1,east:null},
 {name:"星巡り高原",level:15,enc:["eevee","growlithe","riolu","ralts","swablu","swinub"],bg:"mountain",north:null,south:2,west:null,east:null}
];
const GYMS=[
 {name:"岩峰ジム",leader:"ガンジ",badge:"いしのバッジ",need:0,team:[["geodude",8],["onix",10]]},
 {name:"水鏡ジム",leader:"ミナト",badge:"なみのバッジ",need:1,team:[["goldeen",14],["psyduck",15],["wartortle",17]]},
 {name:"電光ジム",leader:"ライカ",badge:"いなずまバッジ",need:2,team:[["magnemite",18],["pikachu",19],["luxio",21]]},
 {name:"星空ジム",leader:"ソラ",badge:"ほしのバッジ",need:3,team:[["togetic",24],["kirlia",25],["altaria",27]]}
];
const TRAINERS=[
 {name:"ライバル レン",team:["eevee","pikachu"],levels:[5,7]},
 {name:"研究員 アキ",team:["abra","magnemite"],levels:[8,9]},
 {name:"山男 タク",team:["geodude","machop"],levels:[10,11]}
];
const LEAGUE=[
 {name:"四天王 ハク",team:[["skarmory",35],["steelix",36],["metagross",38]]},
 {name:"四天王 ミナ",team:[["lapras",36],["starmie",37],["gyarados",39]]},
 {name:"四天王 ヨル",team:[["umbreon",37],["gengar",38],["absol",40]]},
 {name:"四天王 ソウ",team:[["dragonair",37],["flygon",39],["haxorus",41]]},
 {name:"チャンピオン レイ",team:[["lucario",40],["gardevoir",41],["tyranitar",42],["dragonite",44]]}
];
const state={version:VERSION,screen:"title",area:0,pos:{x:14,y:17},party:[],box:[],dex:new Set(),money:3000,badges:0,items:{potion:5,superpotion:2,pokeball:10},battle:null,leagueIndex:0,online:false,ws:null,selfId:null,players:new Map()};
const cache={pokemon:new Map(),move:new Map(),pokedex:null};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function show(screen){["titleScreen","introScreen","starterScreen","gameScreen","battleScreen"].forEach(id=>$(id).classList.add("hidden"));$(screen).classList.remove("hidden");state.screen=screen;if(screen==="gameScreen")ensureFieldAnimation()}
function msg(t){if(state.screen==="gameScreen")$("fieldMessage").textContent=t}
function setBattleText(t){if(state.screen==="battleScreen")$("battleText").textContent=t}
async function getPokemon(name){
  name=String(name).toLowerCase();if(cache.pokemon.has(name))return cache.pokemon.get(name);
  const r=await fetch(API+"/pokemon/"+encodeURIComponent(name));if(!r.ok)throw new Error("pokemon "+r.status);
  const p=await r.json();cache.pokemon.set(name,p);return p
}
async function getMove(name){
  name=String(name).toLowerCase();if(cache.move.has(name))return cache.move.get(name);
  const r=await fetch(API+"/move/"+encodeURIComponent(name));if(!r.ok)throw new Error("move "+r.status);
  const m=await r.json();cache.move.set(name,m);return m
}
function statCalc(base,level){return{hp:Math.floor(((base.hp*2+31)*level)/100)+level+10,attack:Math.floor(((base.attack*2+31)*level)/100)+5,defense:Math.floor(((base.defense*2+31)*level)/100)+5,spAttack:Math.floor(((base["special-attack"]*2+31)*level)/100)+5,spDefense:Math.floor(((base["special-defense"]*2+31)*level)/100)+5,speed:Math.floor(((base.speed*2+31)*level)/100)+5}}
function baseMap(p){return Object.fromEntries(p.stats.map(x=>[x.stat.name,x.base_stat]))}
async function chooseMoves(p,level){
  const candidates=p.moves.filter(x=>x.level<=level).sort((a,b)=>b.level-a.level);const names=[];
  for(const x of candidates){if(!names.includes(x.name))names.push(x.name);if(names.length>=4)break}
  if(!names.length)names.push("tackle");
  const out=[];for(const n of names){try{const m=await getMove(n);out.push({name:m.name,nameJa:m.nameJa,type:m.type,power:m.power,accuracy:m.accuracy,pp:m.pp,maxPp:m.pp,priority:m.priority,damageClass:m.damageClass,ailment:m.ailment,ailmentChance:m.ailmentChance,double:m.double,half:m.half,no:m.no})}catch{}}
  return out
}
async function makeMon(name,level,trainer=false){
  const p=await getPokemon(name),base=baseMap(p),s=statCalc(base,level),moves=await chooseMoves(p,level);
  return{uid:globalThis.crypto?.randomUUID?.()||("m"+Date.now()+Math.random()),species:p.name,name:p.name,nameJa:p.nameJa,level,exp:0,types:p.types,baseStats:base,baseExp:p.baseExp,captureRate:p.captureRate,isTrainer:trainer,sprite:p.sprite,stats:s,currentHp:s.hp,status:null,moves}
}
function serialize(){return{version:VERSION,area:state.area,pos:state.pos,party:state.party,box:state.box,dex:[...state.dex],money:state.money,badges:state.badges,items:state.items,leagueIndex:state.leagueIndex}}
function save(){try{localStorage.setItem("pokemon-star-journey-save",JSON.stringify(serialize()));return true}catch{return false}}
function load(){try{const x=JSON.parse(localStorage.getItem("pokemon-star-journey-save")||"null");if(!x?.party?.length||x.version!==VERSION)return false;if(!x.party.every(p=>p&&p.species&&p.stats&&Array.isArray(p.moves)))return false;Object.assign(state,x);state.dex=new Set(x.dex||[]);state.battle=null;state.ws=null;state.players=new Map();state.online=false;return true}catch{return false}}

const INTRO_LINES=[
 "？？？「待ってくれ！」",
 "博士「私はアサギ博士。ここでポケモンの暮らしを研究しているんだ。」",
 "博士「この池には、たくさんのポケモンが水を飲みに来る。ほら、あそこにも。」",
 "博士「君もポケモンといっしょに旅をしてみないかい？」",
 "博士「研究所に相棒を用意してある。君にぴったりの1匹を選ぼう。」"
];
const introState={start:0,line:0,ended:false};
const introImages={};
function preloadIntroPokemon(){
  for(const n of ["psyduck","lotad"]){getPokemon(n).then(p=>{const im=new Image();im.src=p.sprite;introImages[n]=im})}
}
function drawIntro(){
  if(introState.ended)return;
  const c=$("introCanvas"),ctx=c.getContext("2d"),w=c.width,h=c.height,t=30;
  ctx.clearRect(0,0,w,h);
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#9ed1df");g.addColorStop(.48,"#cde5cf");g.addColorStop(.49,"#82ba70");g.addColorStop(1,"#6ca35e");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  drawGrassTexture(ctx,0,260,w,280,1.35);drawFlowers(ctx,40,270,w-80,240);
  drawPond(ctx,500,90,360,280);
  for(const [x,y,s] of [[65,90,1.15],[170,150,.9],[865,80,1.05],[775,390,.8],[340,95,.8]])drawTree(ctx,x,y,s);
  ctx.fillStyle="#d7bc83";ctx.beginPath();ctx.moveTo(0,370);ctx.quadraticCurveTo(280,300,505,350);ctx.quadraticCurveTo(700,410,960,320);ctx.lineTo(960,365);ctx.quadraticCurveTo(700,455,505,395);ctx.quadraticCurveTo(275,345,0,415);ctx.closePath();ctx.fill();
  // water Pokemon
  for(const [id,x,y,s] of [["psyduck",615,210,.55],["lotad",760,180,.5]]){const im=introImages[id];if(im?.complete)ctx.drawImage(im,x-40*s,y-40*s,80*s,80*s)}
  // player
  const p={x:220,y:355};ctx.fillStyle="#45515a";ctx.beginPath();ctx.ellipse(p.x,p.y+38,18,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f2c6a3";ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.fill();ctx.fillStyle="#284f88";ctx.fillRect(p.x-14,p.y-15,28,10);ctx.fillStyle="#f2f5f7";ctx.fillRect(p.x-12,p.y+11,24,27);ctx.fillStyle="#386aa5";ctx.fillRect(p.x-10,p.y+35,7,16);ctx.fillRect(p.x+3,p.y+35,7,16);
  // professor: walks from far bank into shallow water, then toward player
  const elapsed=performance.now()-introState.start;
  const p1=Math.min(1,elapsed/1800),p2=Math.min(1,Math.max(0,(elapsed-1800)/1300));
  const profX=780-(p1*115)-(p2*120),profY=110+(p1*85)+(p2*125),walk=Math.floor(elapsed/160)%2;
  ctx.fillStyle="#40505a";ctx.beginPath();ctx.ellipse(profX,profY+42,19,7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#2e343a";ctx.fillRect(profX-8,profY+28,7,18+(walk?3:0));ctx.fillRect(profX+1,profY+28,7,18+(walk?0:3));
  ctx.fillStyle="#e9edf0";ctx.fillRect(profX-18,profY+4,36,29);ctx.fillStyle="#24303a";ctx.fillRect(profX-13,profY+27,26,5);
  ctx.fillStyle="#f0c8aa";ctx.beginPath();ctx.arc(profX,profY-4,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f1f3f4";ctx.fillRect(profX-12,profY-18,24,8);ctx.fillStyle="#7896aa";ctx.fillRect(profX+8,profY+2,7,18);
  ctx.fillStyle="#3e5f74";ctx.font="bold 17px sans-serif";ctx.fillText("湖畔の朝",28,34);
  if(elapsed>3100||introState.line>0){
    $("introSpeaker").textContent=introState.line===0?"？？？": "アサギ博士";
    $("introText").textContent=INTRO_LINES[introState.line];
    $("introNext").textContent=introState.line>=INTRO_LINES.length-1?"相棒を選ぶ":"つぎへ";
  }else{
    $("introSpeaker").textContent="ナレーション";
    $("introText").textContent="池のそばで、博士を待っている……";
    $("introNext").textContent="待つ";
  }
  introState.raf=requestAnimationFrame(drawIntro);
}
function startIntro(){
  if(introState.raf)cancelAnimationFrame(introState.raf);
  introState.start=performance.now();introState.line=0;introState.ended=false;show("introScreen");preloadIntroPokemon();drawIntro();
}
function introAdvance(){
  const elapsed=performance.now()-introState.start;
  if(elapsed<1800){introState.start-=1600;return}
  if(introState.line<INTRO_LINES.length-1){introState.line++;return}
  introState.ended=true;if(introState.raf)cancelAnimationFrame(introState.raf);show("starterScreen");
}
function skipIntro(){introState.ended=true;if(introState.raf)cancelAnimationFrame(introState.raf);show("starterScreen")}
async function starterCards(){
  const box=$("starterGrid");box.innerHTML="";
  for(const id of STARTERS){try{const p=await getPokemon(id);const b=document.createElement("button");b.className="starter-card";b.innerHTML="<img src='"+p.sprite+"' alt=''><h3>"+p.nameJa+"</h3><span class='type'>"+p.types.join(" / ")+"</span><p class='muted'>"+p.name+"</p>";b.onclick=()=>startNew(id);box.appendChild(b)}catch{}}
}
async function startNew(starter){
  try{state.area=0;state.pos={x:14,y:17};state.badges=0;state.money=3000;state.items={potion:5,superpotion:2,pokeball:10};state.box=[];state.dex=new Set();state.battle=null;state.leagueIndex=0;
    const p=await makeMon(starter,5);state.party=[p];state.dex.add(p.species);show("gameScreen");renderAll();msg(p.nameJa+"といっしょに旅に出よう！");save();
  }catch{show("starterScreen")}
}
function renderInfo(){$("placeName").textContent=AREA[state.area].name;$("badgeCount").textContent="バッジ "+state.badges;$("badgeText").textContent=state.badges;$("money").textContent=state.money.toLocaleString()+"円";$("dexCount").textContent=state.dex.size;$("partySize").textContent=state.party.length+" / 6";$("storyProgress").style.width=(state.badges/4*100)+"%"}
function renderParty(){
  const box=$("partyList");box.innerHTML="";
  state.party.forEach((p,i)=>{const d=document.createElement("div");d.className="party-item";const ratio=Math.max(0,p.currentHp/p.stats.hp)*100;d.innerHTML="<div class='ball'></div><div><div class='party-name'>"+p.nameJa+"</div><div class='party-meta'>Lv."+p.level+"　"+p.types.join(" / ")+(p.status?"　"+p.status:"")+"</div><div class='bar'><span style='width:"+ratio+"%'></span></div></div><div class='party-meta'>"+p.currentHp+"/"+p.stats.hp+"</div>";d.onclick=()=>showMonInfo(i);box.appendChild(d)})
}
function showMonInfo(i){const p=state.party[i];if(!p)return;$("dialogContent").innerHTML="<h2>"+p.nameJa+"</h2><p>"+p.species+"　Lv."+p.level+"</p><p>タイプ："+p.types.join(" / ")+"</p><p>HP "+p.currentHp+" / "+p.stats.hp+"</p><p>技："+p.moves.map(m=>m.nameJa||m.name).join(" / ")+"</p>";$("dialogModal").classList.remove("hidden")}
function seeded(x,y,s=0){const n=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return n-Math.floor(n)}
function drawGrassTexture(ctx,x,y,w,h,dense=1,time=0){
  ctx.fillStyle="#73ae61";ctx.fillRect(x,y,w,h);
  const step=14;
  for(let yy=y+2;yy<y+h;yy+=step)for(let xx=x+2;xx<x+w;xx+=step){
    const r=seeded(xx,yy,w+h);
    if(r<.78){
      const sway=Math.sin(time/430+xx*.018+yy*.009)*1.7;const lean=(r-.39)*7+sway;ctx.strokeStyle=r<.2?"#4f9650":"#5fa155";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(xx,yy+9);ctx.lineTo(xx+lean,yy+2);ctx.stroke();
      if(dense>1&&r>.62){ctx.beginPath();ctx.moveTo(xx+3,yy+9);ctx.lineTo(xx+7,yy+3);ctx.stroke()}
    }
  }
}
function drawFlowers(ctx,x,y,w,h){
  for(let yy=y+12;yy<y+h-5;yy+=28)for(let xx=x+12;xx<x+w-5;xx+=31){
    const r=seeded(xx,yy,91);if(r>.62){ctx.fillStyle=r>.82?"#f5dd75":"#f0a0b3";ctx.fillRect(xx,yy,4,4);ctx.fillStyle="#e9ecbc";ctx.fillRect(xx+1,yy+4,2,5)}
  }
}
function drawTree(ctx,x,y,scale=1){
  ctx.fillStyle="#55784e";ctx.fillRect(x-5*scale,y+12*scale,10*scale,20*scale);
  ctx.fillStyle="#39754b";ctx.beginPath();ctx.arc(x,y,25*scale,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#4d8d54";ctx.beginPath();ctx.arc(x-17*scale,y+9*scale,18*scale,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+16*scale,y+9*scale,20*scale,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#659d5b";ctx.beginPath();ctx.arc(x-7*scale,y-10*scale,13*scale,0,Math.PI*2);ctx.fill();
}
function drawPond(ctx,x,y,w,h,time=0){
  ctx.fillStyle="#477c59";ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2+9,h/2+8,0,0,Math.PI*2);ctx.fill();
  const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,"#79c6d4");g.addColorStop(1,"#4c9cad");ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#a1dae0";ctx.lineWidth=2;
  for(let i=0;i<5;i++){const yy=y+22+i*24+Math.sin(time/900+i)*2;ctx.beginPath();ctx.moveTo(x+40+i*11,yy);ctx.quadraticCurveTo(x+w/2,yy-5-Math.sin(time/700+i)*2,x+w-55-i*8,yy);ctx.stroke()}
  ctx.fillStyle="#78aa59";for(let i=0;i<8;i++){const px=x+25+i*42;const py=y+h-10-(i%3)*5;ctx.beginPath();ctx.ellipse(px,py,12,4,.2,0,Math.PI*2);ctx.fill()}
}
function drawBuilding(ctx,x,y,label,type="house"){
  const body=type==="shop"?"#f2c98c":type==="gym"?"#cad8e4":type==="lab"?"#dbe8ef":"#efddc4";
  ctx.fillStyle="#7d4e3e";ctx.fillRect(x*30,y*30,150,30);ctx.fillStyle=body;ctx.fillRect(x*30,y*30+16,150,104);
  ctx.fillStyle=type==="gym"?"#607d9a":"#c65a4e";ctx.beginPath();ctx.moveTo(x*30-10,y*30+16);ctx.lineTo((x+2.5)*30,(y-1)*30);ctx.lineTo((x+5)*30+10,y*30+16);ctx.closePath();ctx.fill();
  ctx.fillStyle="#57443b";ctx.fillRect(x*30+60,y*30+67,30,53);ctx.fillStyle="#7fc9dc";ctx.fillRect(x*30+16,y*30+58,27,27);ctx.fillRect(x*30+108,y*30+58,27,27);
  ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText(label,x*30+75,y*30+145);ctx.textAlign="left";
}
function drawField(){
  const c=$("field"),ctx=c.getContext("2d"),w=c.width,h=c.height,t=30,a=AREA[state.area],time=performance.now();
  ctx.clearRect(0,0,w,h);
  drawGrassTexture(ctx,0,0,w,h,1,time);
  if(a.bg==="cave"){
    ctx.fillStyle="#5c5662";ctx.fillRect(0,0,w,h);for(let y=0;y<h;y+=18)for(let x=0;x<w;x+=18){const r=seeded(x,y,55);ctx.fillStyle=r>.5?"#68616e":"#625b67";ctx.fillRect(x,y,18,18);if(r>.76){ctx.fillStyle="#85808a";ctx.fillRect(x+5,y+4,7,3)}}
  }
  if(a.bg==="water"){drawGrassTexture(ctx,0,0,w,h,1,time);drawPond(ctx,600,30,280,210,time);drawPond(ctx,55,335,240,150,time)}
  ctx.fillStyle="#d7bc83";ctx.fillRect(0,9*t,w,2*t);ctx.fillRect(14*t,0,2*t,h);
  for(let x=0;x<w;x+=16){ctx.fillStyle=x%32===0?"#c7a96f":"#dfc791";ctx.fillRect(x,9*t,8,3);ctx.fillRect(x,10*t+7,6,2)}
  if(a.bg==="route"){for(const [x,y] of [[3,3],[4,3],[3,4],[25,4],[26,4],[25,5],[6,15],[7,15],[6,16],[20,15],[21,15],[20,16]])drawTree(ctx,x*t+28,y*t+26,.8);drawFlowers(ctx,0,0,w,h)}
  if(a.bg==="town"){
    drawBuilding(ctx,2,2,"ポケモンセンター","house");
    drawBuilding(ctx,9,2,"フレンドリィショップ","shop");
    drawBuilding(ctx,18,2,"ジム","gym");
    drawBuilding(ctx,17,11,"アサギ研究所","lab");
    drawPond(ctx,485,345,250,145,time);
    for(const [x,y,s] of [[1,14,1],[5,16,.9],[26,15,.8],[28,6,.9],[16,4,.75],[15,17,.72],[25,11,.72]])drawTree(ctx,x*t+15,y*t+20,s);
    drawFlowers(ctx,0,0,w,h);
    // Professor and rival are visible NPCs near the laboratory.
    drawNpc(ctx,18.3*t,10.2*t,"professor");drawNpc(ctx,22.2*t,12.8*t,"rival");
  }
  if(a.bg==="cave"){for(const [x,y] of [[3,5],[5,11],[22,5],[23,13],[11,16],[26,16]]){ctx.fillStyle="#817a87";ctx.beginPath();ctx.arc(x*t,y*t,16,0,Math.PI*2);ctx.fill();ctx.fillStyle="#aaa3ad";ctx.fillRect(x*t-3,y*t-9,6,5)}}
  if(a.bg==="mountain"){
    for(const [x,y,s] of [[3,15,50],[6,11,70],[24,15,55],[26,9,85],[15,4,90]]){ctx.fillStyle="#789a72";ctx.beginPath();ctx.moveTo(x*t,y*t);ctx.lineTo((x+2)*t,(y-s/30)*t);ctx.lineTo((x+4)*t,y*t);ctx.closePath();ctx.fill()}
    for(const [x,y] of [[2,5],[6,5],[26,4],[27,16]])drawTree(ctx,x*t+15,y*t+18,.85);
  }
  ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";if(a.north!==null)ctx.fillText("↑ "+AREA[a.north].name,420,16);if(a.south!==null)ctx.fillText("↓ "+AREA[a.south].name,420,590);if(a.west!==null)ctx.fillText("← "+AREA[a.west].name,8,285);if(a.east!==null)ctx.fillText(AREA[a.east].name+" →",770,285);
  // player
  const px=state.pos.x*t+15,py=state.pos.y*t+18;ctx.fillStyle="#29323a";ctx.beginPath();ctx.ellipse(px,py+15,13,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f6d0ad";ctx.beginPath();ctx.arc(px,py-8,8,0,Math.PI*2);ctx.fill();ctx.fillStyle="#315c9c";ctx.fillRect(px-9,py-18,18,7);ctx.fillStyle="#e9f2f4";ctx.fillRect(px-7,py,14,16);ctx.fillStyle="#4772af";ctx.fillRect(px-7,py+13,5,9);ctx.fillRect(px+2,py+13,5,9);
  if(state.area===0){ctx.fillStyle="#5c6470";ctx.fillRect(17*t+12,12*t+8,24,20);ctx.fillStyle="#fff";ctx.font="10px sans-serif";ctx.fillText("研究所",17*t+2,12*t+40)}
}
function drawNpc(ctx,x,y,kind){
  const s=.82;ctx.fillStyle="#3d4d55";ctx.beginPath();ctx.ellipse(x,y+25*s,12*s,5*s,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=kind==="professor"?"#eef2f4":"#d6b0a0";ctx.fillRect(x-10*s,y-1*s,20*s,25*s);
  ctx.fillStyle=kind==="professor"?"#ffffff":"#2c4479";ctx.fillRect(x-9*s,y+8*s,18*s,14*s);
  ctx.fillStyle="#f2c6a5";ctx.beginPath();ctx.arc(x,y-9*s,8*s,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=kind==="professor"?"#e8edf0":"#4e2c25";ctx.fillRect(x-9*s,y-17*s,18*s,6*s);
  if(kind==="professor"){ctx.fillStyle="#6b7f90";ctx.fillRect(x+7*s,y-2*s,5*s,13*s);ctx.fillStyle="#ffffff";ctx.fillRect(x-15*s,y+1*s,7*s,12*s)}
}
let fieldAnimation=0,lastFieldFrame=0;
function renderField(){drawField()}
function animateField(time){
  if(state.screen!=="gameScreen"){fieldAnimation=0;return}
  if(time-lastFieldFrame>90){lastFieldFrame=time;drawField();renderPlayers()}
  fieldAnimation=requestAnimationFrame(animateField)
}
function ensureFieldAnimation(){if(!fieldAnimation)fieldAnimation=requestAnimationFrame(animateField)}
function renderPlayers(){if(!state.players)return;const c=$("field"),ctx=c.getContext("2d");for(const p of state.players.values()){if(p.id===state.selfId)continue;ctx.fillStyle="#5d63a8";ctx.fillRect(p.x/100*c.width-8,p.y/100*c.height-11,16,22)}}
function renderAll(){renderInfo();renderParty();renderField();renderPlayers()}
function blocked(x,y){if(x<0||x>29||y<0||y>19)return false;if(AREA[state.area].bg==="water"&&x>=20&&y<7)return true;if(state.area===0&&((x>=2&&x<7&&y>=2&&y<6)||(x>=9&&x<14&&y>=2&&y<6)||(x>=18&&x<23&&y>=2&&y<6)))return true;return false}
function grassHere(){const x=state.pos.x,y=state.pos.y;return(state.area===1&&((x<10&&y<8)||(x>19&&y>12)))||(state.area===2&&x<10&&y>12)||(state.area===3&&x>18&&y>9)||(state.area===4&&x<12&&y>10)}
function exitAllowed(from,to){if(from===0&&to===2&&state.badges<1)return false;if(from===1&&to===3&&state.badges<1)return false;if(from===2&&to===4&&state.badges<2)return false;if(from===3&&to===4&&state.badges<3)return false;return true}
async function changeArea(to,dir){if(!exitAllowed(state.area,to)){msg("この道にはジムバッジが必要だ。");return false}state.area=to;state.pos=dir==="north"?{x:14,y:18}:dir==="south"?{x:14,y:1}:dir==="east"?{x:1,y:9}:{x:28,y:9};renderAll();msg(AREA[to].name+"へ。");return true}
async function move(dx,dy){
  if(state.screen!=="gameScreen"||state.battle)return;let nx=state.pos.x+dx,ny=state.pos.y+dy,a=AREA[state.area];
  if(nx<0){if(a.west!==null)return changeArea(a.west,"west");nx=0}if(nx>29){if(a.east!==null)return changeArea(a.east,"east");nx=29}
  if(ny<0){if(a.north!==null)return changeArea(a.north,"north");ny=0}if(ny>19){if(a.south!==null)return changeArea(a.south,"south");ny=19}
  if(blocked(nx,ny))return;state.pos={x:nx,y:ny};renderAll();
  if(state.online&&state.ws?.readyState===1)state.ws.send(JSON.stringify({type:"move",x:state.pos.x/29*100,y:state.pos.y/19*100}));
  if(grassHere()&&Math.random()<.18){const list=AREA[state.area].enc,n=list[Math.floor(Math.random()*list.length)];await startWild(n,Math.max(2,AREA[state.area].level+Math.floor(Math.random()*3)))}
}
function healParty(){for(const p of state.party){p.currentHp=p.stats.hp;p.status=null;p.moves.forEach(m=>m.pp=m.maxPp)}save();renderParty()}
function shop(){const html="<h2>フレンドリィショップ</h2><div class='bag-row'><span>キズぐすり　100円</span><button id='buyPotion'>買う</button></div><div class='bag-row'><span>モンスターボール　200円</span><button id='buyBall'>買う</button></div><p>所持金 "+state.money.toLocaleString()+"円</p>";$("dialogContent").innerHTML=html;$("dialogModal").classList.remove("hidden");$("buyPotion").onclick=()=>{if(state.money>=100){state.money-=100;state.items.potion++;shop()}};$("buyBall").onclick=()=>{if(state.money>=200){state.money-=200;state.items.pokeball++;shop()}}}
async function interact(){
  if(state.screen!=="gameScreen"||state.battle)return;
  if(state.area===0){const x=state.pos.x,y=state.pos.y;
    if(x>=2&&x<=6&&y>=6&&y<=7){healParty();msg("ポケモンセンターで回復した！");return}
    if(x>=9&&x<=13&&y>=6&&y<=7){shop();return}
    if(x>=18&&x<=22&&y>=6&&y<=7){await challengeGym();return}
    if(x>=17&&x<=21&&y>=15&&y<=17){$("dialogContent").innerHTML="<h2>アサギ博士の研究所</h2><p>博士「ここではポケモンの生態と、トレーナーとの絆について研究しているんだ。」</p><p>博士「池にいるポケモンも観察してみると面白いよ。」</p>";$("dialogModal").classList.remove("hidden");return}
    if(Math.abs(x-22)<=1&&Math.abs(y-13)<=1){await rival();return}
  }
  if(state.area===4&&state.badges===4&&Math.abs(state.pos.x-15)<=2&&Math.abs(state.pos.y-9)<=2){await startLeague();return}
  msg("ここには何もないようだ。")
}
async function challengeGym(){
  const g=GYMS[state.badges];if(!g){msg("4つのバッジを集めた！ 高原の中央からポケモンリーグへ進める。");return}
  try{const team=[];for(const [n,l] of g.team)team.push(await makeMon(n,l,true));startTrainer(g.name+"リーダー "+g.leader,team,true,false)}catch{msg("ジムの読み込みに失敗した。")}
}
async function rival(){try{const team=[];for(let i=0;i<TRAINERS[0].team.length;i++)team.push(await makeMon(TRAINERS[0].team[i],TRAINERS[0].levels[i],true));startTrainer(TRAINERS[0].name,team,false,false)}catch{}}
async function startWild(name,level){
  if(state.battle)return;try{const e=await makeMon(name,level);state.dex.add(e.species);state.battle={wild:true,trainerName:"",enemyTeam:[e],enemyIndex:0,playerIndex:0,gym:false,league:false};show("battleScreen");await renderBattle();setBattleText("野生の"+e.nameJa+"が現れた！");}catch{msg("野生のポケモンとの接続に失敗した。")}
}
function startTrainer(name,team,gym,league){state.battle={wild:false,trainerName:name,enemyTeam:team,enemyIndex:0,playerIndex:0,gym:!!gym,league:!!league};show("battleScreen");renderBattle();setBattleText(name+"が勝負をしかけてきた！")}
async function startLeague(){const l=LEAGUE[state.leagueIndex];if(!l){state.storyComplete=true;msg("ポケモンリーグ制覇！ 君は新たなチャンピオンになった！");save();return}try{const team=[];for(const [n,lv] of l.team)team.push(await makeMon(n,lv,true));startTrainer(l.name,team,false,true)}catch{}}
function enemyMon(){return state.battle?.enemyTeam[state.battle.enemyIndex]}
function playerMon(){return state.party[state.battle?.playerIndex??0]}
async function renderBattle(){const e=enemyMon(),p=playerMon();if(!e||!p)return;$("battleKind").textContent=state.battle.wild?"野生のポケモン":state.battle.trainerName;$("enemyName").textContent=e.nameJa;$("enemyMeta").textContent="Lv."+e.level+"　"+e.types.join(" / ");$("enemySprite").src=e.sprite;$("playerSprite").src=p.sprite;$("playerMonName").textContent=p.nameJa;$("playerMonMeta").textContent="Lv."+p.level+"　"+p.types.join(" / ");updateBattleBars();buildMoves();buildSwitch();$("movePanel").classList.add("hidden");$("bagPanel").classList.add("hidden");$("switchPanel").classList.add("hidden");$("battleMenu").classList.remove("hidden")}
function updateBattleBars(){const e=enemyMon(),p=playerMon();$("enemyHpBar").style.width=100*e.currentHp/e.stats.hp+"%";$("enemyHpText").textContent=e.currentHp+" / "+e.stats.hp;$("playerHpBar").style.width=100*p.currentHp/p.stats.hp+"%";$("playerHpText").textContent=p.currentHp+" / "+p.stats.hp}
function buildMoves(){const box=$("movePanel");box.innerHTML="";const p=playerMon();p.moves.forEach((m,i)=>{const b=document.createElement("button");b.textContent=(m.nameJa||m.name)+"  "+m.pp+"/"+m.maxPp;b.disabled=m.pp<=0;b.onclick=()=>turn(i);box.appendChild(b)})}
function buildSwitch(){const box=$("switchPanel");box.innerHTML="";state.party.forEach((p,i)=>{const b=document.createElement("button");b.textContent=p.nameJa+" Lv."+p.level;b.disabled=i===state.battle?.playerIndex||p.currentHp<=0;b.onclick=()=>switchPokemon(i);box.appendChild(b)});const back=document.createElement("button");back.textContent="もどる";back.onclick=()=>{$("switchPanel").classList.add("hidden");$("battleMenu").classList.remove("hidden")};box.appendChild(back)}
function fightMenu(){$("movePanel").classList.toggle("hidden");$("bagPanel").classList.add("hidden");$("switchPanel").classList.add("hidden")}
function bagMenu(){$("bagPanel").innerHTML="<button data-bag='potion'>キズぐすり ×"+state.items.potion+"</button><button data-bag='super'>すごいキズぐすり ×"+state.items.superpotion+"</button><button data-bag='ball' "+(!state.battle?.wild?"disabled":"")+">モンスターボール ×"+state.items.pokeball+"</button><button data-bag='back'>もどる</button>";$("bagPanel").classList.remove("hidden");$("movePanel").classList.add("hidden");$("switchPanel").classList.add("hidden");$("bagPanel").querySelectorAll("button").forEach(b=>b.onclick=()=>useBag(b.dataset.bag))}
function pokemonMenu(){$("switchPanel").classList.remove("hidden");$("bagPanel").classList.add("hidden");$("movePanel").classList.add("hidden");$("battleMenu").classList.add("hidden")}
async function useBag(item){
  if(item==="back"){hideSubPanels();return}const p=playerMon();
  if(item==="potion"){if(state.items.potion<=0)return;state.items.potion--;p.currentHp=Math.min(p.stats.hp,p.currentHp+20);setBattleText("キズぐすりを使った！");await enemyTurn()}
  else if(item==="super"){if(state.items.superpotion<=0)return;state.items.superpotion--;p.currentHp=Math.min(p.stats.hp,p.currentHp+50);setBattleText("すごいキズぐすりを使った！");await enemyTurn()}
  else if(item==="ball"){await throwBall()}
}
async function switchPokemon(i){if(!state.battle||i===state.battle.playerIndex)return;state.battle.playerIndex=i;hideSubPanels();await renderBattle();setBattleText("いけ！ "+playerMon().nameJa+"！");await enemyTurn()}
function hideSubPanels(){$("movePanel").classList.add("hidden");$("bagPanel").classList.add("hidden");$("switchPanel").classList.add("hidden");$("battleMenu").classList.remove("hidden")}
function effective(move,types){let x=1;for(const t of types){if(move.no.includes(t))return 0;if(move.double.includes(t))x*=2;if(move.half.includes(t))x*=.5}return x}
function canAct(p){if(p.status==="paralysis"&&Math.random()<.25)return false;if(p.status==="sleep"||p.status==="freeze"){if(Math.random()<.3){p.status=null;return true}return false}return true}
async function damage(attacker,defender,move){
  if(move.pp<=0)return{ok:false,text:"しかしPPが足りない！"};move.pp--;
  if(!canAct(attacker))return{ok:false,text:attacker.nameJa+"は"+attacker.status+"で動けない！"};
  if(Math.random()*100>move.accuracy)return{ok:false,text:attacker.nameJa+"の"+(move.nameJa||move.name)+"は外れた！"};
  const mult=effective(move,defender.types),crit=Math.random()<1/24?1.5:1;
  if(move.power===0){if(move.ailment!=="none"&&Math.random()*100<Math.max(1,move.ailmentChance)&&defender.status===null)defender.status=move.ailment;return{ok:true,damage:0,text:(move.nameJa||move.name)+"！"}}
  let A=move.damageClass==="special"?attacker.stats.spAttack:attacker.stats.attack;
  if(attacker.status==="burn"&&move.damageClass==="physical")A=Math.floor(A/2);
  let D=move.damageClass==="special"?defender.stats.spDefense:defender.stats.defense;
  let d=Math.floor(Math.floor(Math.floor((2*attacker.level/5+2)*move.power*A/D)/50)+2);
  if(attacker.types.includes(move.type))d=Math.floor(d*1.5);d=Math.floor(d*mult);d=Math.floor(d*crit);d=Math.floor(d*(85+Math.floor(Math.random()*16))/100);d=Math.max(1,d);defender.currentHp=Math.max(0,defender.currentHp-d);
  if(move.ailment!=="none"&&Math.random()*100<move.ailmentChance&&defender.currentHp>0&&defender.status===null)defender.status=move.ailment;
  return{ok:true,damage:d,crit:crit>1,mult,text:(move.nameJa||move.name)+"！ "+d+"ダメージ！"+(crit>1?"　急所に当たった！":"")+(mult===0?"　しかし効かなかった！":mult>1?"　効果はばつぐんだ！":mult<1?"　効果はいまひとつだ……":"")};
}
function endStatus(p){if(p.currentHp<=0)return "";let d=0;if(p.status==="poison"||p.status==="badly-poisoned")d=Math.max(1,Math.floor(p.stats.hp/8));else if(p.status==="burn")d=Math.max(1,Math.floor(p.stats.hp/16));if(d){p.currentHp=Math.max(0,p.currentHp-d);return p.nameJa+"は"+p.status+"のダメージを受けた。"}return ""}
async function turn(i){
  if(!state.battle)return;const p=playerMon(),e=enemyMon(),pm=p.moves[i],em=e.moves[Math.floor(Math.random()*e.moves.length)];$("movePanel").classList.add("hidden");
  const first=(pm.priority>em.priority)||(pm.priority===em.priority&&p.stats.speed>=e.stats.speed);
  let text="";
  if(first){
    const r=await damage(p,e,pm);text=r.text;setBattleText(text);updateBattleBars();if(e.currentHp<=0){await afterEnemyFaint();return}
    const r2=await damage(e,p,em);text+=" "+r2.text;setBattleText(text);updateBattleBars();if(p.currentHp<=0){await forcedSwitch();return}
  }else{
    const r2=await damage(e,p,em);text=r2.text;setBattleText(text);updateBattleBars();if(p.currentHp<=0){await forcedSwitch();return}
    const r=await damage(p,e,pm);text+=" "+r.text;setBattleText(text);updateBattleBars();if(e.currentHp<=0){await afterEnemyFaint();return}
  }
  const s1=endStatus(p),s2=endStatus(e);if(s1||s2)setBattleText(text+" "+[s1,s2].filter(Boolean).join(" "));updateBattleBars();
  if(e.currentHp<=0){await afterEnemyFaint();return}if(p.currentHp<=0){await forcedSwitch();return}buildMoves()
}
async function enemyTurn(){
  if(!state.battle)return;const p=playerMon(),e=enemyMon(),m=e.moves[Math.floor(Math.random()*e.moves.length)],r=await damage(e,p,m);setBattleText(r.text);updateBattleBars();if(p.currentHp<=0){await forcedSwitch();return}const s=endStatus(p);if(s)setBattleText(r.text+" "+s);updateBattleBars()
}
async function forcedSwitch(){const alive=state.party.some((p,i)=>p.currentHp>0&&i!==state.battle.playerIndex);if(!alive){state.battle=null;show("gameScreen");healParty();msg("手持ちが全員ひんしになった。ポケモンセンターへ戻った。");renderAll();return}buildSwitch();pokemonMenu();setBattleText("次のポケモンを選んでください。")}
async function gainExp(p,enemy,mult=1){const n=Math.max(1,Math.floor(enemy.baseExp*enemy.level/7*mult));p.exp+=n;return levelUp(p)}
async function levelUp(p){
  while(p.exp>=p.level**3-((p.level-1)**3)){const need=p.level**3-((p.level-1)**3);p.exp-=need;p.level++;const old=p.stats.hp;p.stats=statCalc(p.baseStats,p.level);p.currentHp+=p.stats.hp-old;setBattleText(p.nameJa+"はレベル"+p.level+"になった！");try{await tryEvolution(p)}catch{}}
  return true
}
async function tryEvolution(p){
  const d=await getPokemon(p.species);const chain=d.evolutionChain||[];const idx=chain.findIndex(x=>x.name===p.species);if(idx<0)return;
  const next=chain.slice(idx+1).find(x=>(x.details||[]).some(v=>v.trigger?.name==="level-up"&&v.min_level&&v.min_level<=p.level));
  if(!next)return;
  const oldRatio=p.currentHp/p.stats.hp,newMon=await makeMon(next.name,p.level,p.isTrainer);newMon.uid=p.uid;newMon.exp=p.exp;newMon.currentHp=Math.max(1,Math.round(newMon.stats.hp*oldRatio));Object.assign(p,newMon);state.dex.add(p.species);setBattleText("おめでとう！ "+p.nameJa+"に進化した！")
}
async function afterEnemyFaint(){
  const defeated=enemyMon(),p=playerMon();await gainExp(p,defeated,state.battle.wild?1:1.5);
  if(state.battle.enemyIndex<state.battle.enemyTeam.length-1){state.battle.enemyIndex++;await renderBattle();setBattleText(state.battle.trainerName+"は"+enemyMon().nameJa+"を繰り出した！");return}
  if(state.battle.gym){const g=GYMS[state.badges];state.badges++;state.money+=2400;save();state.battle=null;show("gameScreen");renderAll();msg("ジムバッジ「"+g.badge+"」を手に入れた！")}
  else if(state.battle.league){state.leagueIndex++;state.battle=null;show("gameScreen");renderAll();if(state.leagueIndex<LEAGUE.length)msg("勝利！ 次の四天王へ進もう。");else{state.storyComplete=true;msg("ポケモンリーグ制覇！ 新たなチャンピオンになった！");}save()}
  else{state.money+=500;save();state.battle=null;show("gameScreen");renderAll();msg("勝利！ "+defeated.nameJa+"との戦いに勝った。")}
}
async function throwBall(){
  if(!state.battle?.wild||state.items.pokeball<=0)return;state.items.pokeball--;const e=enemyMon(),chance=Math.min(.95,Math.max(.03,((3*e.stats.hp-2*e.currentHp)*e.captureRate)/(3*e.stats.hp*255)));
  if(Math.random()<chance){if(state.party.length<6)state.party.push(e);else state.box.push(e);state.dex.add(e.species);save();state.battle=null;show("gameScreen");renderAll();msg(e.nameJa+"をつかまえた！")}
  else{setBattleText("カチッ……！　ボールから出てしまった！");await enemyTurn()}
}
function runAway(){
  if(!state.battle?.wild){setBattleText("トレーナー戦では逃げられない！");return}
  const p=playerMon(),e=enemyMon(),chance=Math.min(.95,.5+p.stats.speed/(Math.max(1,e.stats.speed)*2));
  if(Math.random()<chance){state.battle=null;show("gameScreen");renderAll();msg("うまく逃げ切れた！")}else{setBattleText("逃げられない！");enemyTurn()}
}
async function openDex(){
  if(!cache.pokedex){try{cache.pokedex=await(await fetch(API+"/pokedex")).json()}catch{cache.pokedex=[]}}
  const seen=[...state.dex];let html="<h2>ポケモンずかん</h2><p>見つけたポケモン："+seen.length+"匹</p><div class='dex-grid'>";
  for(const item of cache.pokedex||[])if(seen.includes(item.name)){const p=cache.pokemon.get(item.name);html+="<div class='dex-card'><img src='"+(p?.sprite||"")+"' alt=''><div><b>"+(p?.nameJa||item.name)+"</b><div class='muted'>#"+item.id+"　"+item.name+"</div></div></div>"}
  html+="</div>";$("dialogContent").innerHTML=html;$("dialogModal").classList.remove("hidden")
}
function buildBagModal(){$("dialogContent").innerHTML="<h2>バッグ</h2><div class='bag-row'><span>キズぐすり</span><b>"+state.items.potion+"</b></div><div class='bag-row'><span>すごいキズぐすり</span><b>"+state.items.superpotion+"</b></div><div class='bag-row'><span>モンスターボール</span><b>"+state.items.pokeball+"</b></div><div class='bag-row'><span>ボックス</span><b>"+state.box.length+"</b></div>";$("dialogModal").classList.remove("hidden")}
function openMap(){let html="<h2>マップ</h2>";AREA.forEach((a,i)=>html+="<p>"+(i===state.area?"▶ ":"")+(i<=state.badges+1?a.name:a.name+"（未開放）")+"</p>");$("dialogContent").innerHTML=html;$("dialogModal").classList.remove("hidden")}
function setupButtons(){
  $("newGame").onclick=startIntro;$("introNext").onclick=introAdvance;$("skipIntro").onclick=skipIntro;$("loadGame").onclick=()=>{if(load()){show("gameScreen");renderAll();msg("セーブデータを読み込みました。")}else show("starterScreen")};$("saveButton").onclick=()=>{save();msg("セーブしました。")};
  $("menuButton").onclick=()=>$("menuModal").classList.remove("hidden");$("menuClose").onclick=()=>$("menuModal").classList.add("hidden");$("dialogClose").onclick=()=>$("dialogModal").classList.add("hidden");
  $("pokedexButton").onclick=()=>{$("menuModal").classList.add("hidden");openDex()};$("partyButton").onclick=()=>{$("menuModal").classList.add("hidden");$("dialogContent").innerHTML="<h2>手持ち</h2>"+state.party.map((p,i)=>"<p>"+(i+1)+"　"+p.nameJa+" Lv."+p.level+"　HP "+p.currentHp+"/"+p.stats.hp+"</p>").join("");$("dialogModal").classList.remove("hidden")};$("bagButton").onclick=()=>{$("menuModal").classList.add("hidden");buildBagModal()};$("mapButton").onclick=()=>{$("menuModal").classList.add("hidden");openMap()};
  document.querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>{const d=b.dataset.dir;move(d==="left"?-1:d==="right"?1:0,d==="up"?-1:d==="down"?1:0)});
  document.addEventListener("keydown",e=>{if(["INPUT","TEXTAREA"].includes(e.target.tagName))return;const k=e.key.toLowerCase();if(state.screen==="gameScreen"){if(k==="w"||e.key==="ArrowUp")move(0,-1);else if(k==="s"||e.key==="ArrowDown")move(0,1);else if(k==="a"||e.key==="ArrowLeft")move(-1,0);else if(k==="d"||e.key==="ArrowRight")move(1,0);else if(k==="e"||e.key==="enter")interact();else if(k==="b")buildBagModal()}else if(state.screen==="battleScreen"){if(k==="1")fightMenu();else if(k==="2")bagMenu();else if(k==="3")pokemonMenu();else if(k==="4")runAway()}});
  document.querySelectorAll("[data-battle]").forEach(b=>b.onclick=()=>{const a=b.dataset.battle;if(a==="fight")fightMenu();else if(a==="bag")bagMenu();else if(a==="pokemon")pokemonMenu();else if(a==="run")runAway()});
}
function onlineConnect(){
  if(state.online){state.ws?.close();return}
  try{const ws=new WebSocket((location.protocol==="https:"?"wss":"ws")+"://"+location.host);state.ws=ws;$("onlineState").textContent="接続中…";
    ws.onopen=()=>{state.online=true;$("onlineButton").textContent="切断";ws.send(JSON.stringify({type:"join",name:"旅人"}))};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==="joined"){state.selfId=m.selfId;state.players=new Map(m.room.players.map(p=>[p.id,p]));$("roomText").textContent="ルーム "+m.room.id+" / "+m.room.players.length+"人";chat("システム：オンライン接続")}else if(m.type==="player_joined"){state.players.set(m.player.id,m.player);renderField();renderPlayers()}else if(m.type==="player_moved"){const p=state.players.get(m.player.id);if(p){p.x=m.player.x;p.y=m.player.y;renderField();renderPlayers()}}else if(m.type==="player_left"){state.players.delete(m.playerId);renderField();renderPlayers()}else if(m.type==="chat")chat(m.name+"："+m.text)};
    ws.onclose=()=>{state.online=false;state.ws=null;state.players.clear();$("onlineState").textContent="オフライン";$("onlineButton").textContent="オンライン";$("roomText").textContent="";renderField()};
    ws.onerror=()=>{$("onlineState").textContent="接続エラー"}
  }catch{$("onlineState").textContent="オンライン利用不可"}
}
function chat(t){const d=document.createElement("div");d.textContent=t;$("chatLog").appendChild(d);$("chatLog").scrollTop=$("chatLog").scrollHeight}
$("onlineButton").onclick=onlineConnect;$("chatSend").onclick=()=>{const t=$("chatInput").value.trim();if(t&&state.ws?.readyState===1){state.ws.send(JSON.stringify({type:"chat",text:t}));$("chatInput").value=""}};$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("chatSend").click()});
setupButtons();starterCards();preloadIntroPokemon();