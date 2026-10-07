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
function baseMap(p){
  if(!p?.stats)throw new Error("pokemon stats missing");
  return Array.isArray(p.stats)?Object.fromEntries(p.stats.map(x=>[x.stat.name,x.base_stat])):p.stats;
}
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
const introState={start:0,line:0,ended:false,raf:0,char:0,typeTime:0,typedLine:-1};
const introImages={};
function preloadIntroPokemon(){
  for(const n of ["psyduck","lotad"]){getPokemon(n).then(p=>{const im=new Image();im.src=p.sprite;introImages[n]=im})}
}
function drawIntro(timeNow=performance.now()){
  if(introState.ended)return;
  const c=$("introCanvas"),ctx=c.getContext("2d"),w=c.width,h=c.height,t=30;
  ctx.clearRect(0,0,w,h);
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#9ed1df");g.addColorStop(.48,"#cde5cf");g.addColorStop(.49,"#82ba70");g.addColorStop(1,"#6ca35e");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  drawGrassTexture(ctx,0,260,w,280,1.35);drawFlowers(ctx,40,270,w-80,240,0);
  drawPond(ctx,500,90,360,280);
  for(const [x,y,s] of [[65,90,1.15],[170,150,.9],[865,80,1.05],[775,390,.8],[340,95,.8]])drawTree(ctx,x,y,s,0);
  ctx.fillStyle="#d7bc83";ctx.beginPath();ctx.moveTo(0,370);ctx.quadraticCurveTo(280,300,505,350);ctx.quadraticCurveTo(700,410,960,320);ctx.lineTo(960,365);ctx.quadraticCurveTo(700,455,505,395);ctx.quadraticCurveTo(275,345,0,415);ctx.closePath();ctx.fill();
  // water Pokemon
  for(const [id,x,y,s] of [["psyduck",615,210,.55],["lotad",760,180,.5]]){const im=introImages[id];if(im?.complete)ctx.drawImage(im,x-40*s,y-40*s,80*s,80*s)}
  // player
  const p={x:220,y:355};ctx.fillStyle="#45515a";ctx.beginPath();ctx.ellipse(p.x,p.y+38,18,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f2c6a3";ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.fill();ctx.fillStyle="#284f88";ctx.fillRect(p.x-14,p.y-15,28,10);ctx.fillStyle="#f2f5f7";ctx.fillRect(p.x-12,p.y+11,24,27);ctx.fillStyle="#386aa5";ctx.fillRect(p.x-10,p.y+35,7,16);ctx.fillRect(p.x+3,p.y+35,7,16);
  // professor: walks from far bank into shallow water, then toward player
  const elapsed=Math.floor((performance.now()-introState.start)/ANIM_STEP)*ANIM_STEP;
  const p1=Math.min(1,elapsed/1800),p2=Math.min(1,Math.max(0,(elapsed-1800)/1300));
  const profX=780-(p1*115)-(p2*120),profY=110+(p1*85)+(p2*125),walk=Math.floor(elapsed/160)%2;
  ctx.fillStyle="#40505a";ctx.beginPath();ctx.ellipse(profX,profY+42,19,7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#2e343a";ctx.fillRect(profX-8,profY+28,7,18+(walk?3:0));ctx.fillRect(profX+1,profY+28,7,18+(walk?0:3));
  const inPond=profX>500&&profX<860&&profY>90&&profY<330;
  if(inPond){
    ctx.strokeStyle="#bce7ea";ctx.lineWidth=2;
    const rr=stepped([14,18,22,18,14,10],animFrame(elapsed));ctx.beginPath();ctx.ellipse(profX,profY+30,rr,rr*.38,0,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.ellipse(profX,profY+30,rr+10,rr*.48,0,0,Math.PI*2);ctx.stroke();
    if(Math.floor(elapsed/120)%3===0){ctx.fillStyle="#fff";ctx.fillRect(profX-18,profY+20,4,5);ctx.fillRect(profX+14,profY+18,4,5)}
  }
  ctx.fillStyle="#e9edf0";ctx.fillRect(profX-18,profY+4,36,29);ctx.fillStyle="#24303a";ctx.fillRect(profX-13,profY+27,26,5);
  ctx.fillStyle="#f0c8aa";ctx.beginPath();ctx.arc(profX,profY-4,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f1f3f4";ctx.fillRect(profX-12,profY-18,24,8);ctx.fillStyle="#7896aa";ctx.fillRect(profX+8,profY+2,7,18);
  ctx.fillStyle="#3e5f74";ctx.font="bold 17px sans-serif";ctx.fillText("湖畔の朝",28,34);
  if(elapsed>3100||introState.line>0){
    $("introSpeaker").textContent=introState.line===0?"？？？":"アサギ博士";
    if(introState.typedLine!==introState.line){introState.typedLine=introState.line;introState.char=0;introState.typeTime=timeNow}
    const target=INTRO_LINES[introState.line];
    if(introState.char<target.length && timeNow-introState.typeTime>42){introState.char++;introState.typeTime=timeNow}
    $("introText").textContent=target.slice(0,introState.char)+(introState.char<target.length?"▌":"");
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
  introState.start=performance.now();introState.line=0;introState.char=0;introState.typedLine=-1;introState.ended=false;show("introScreen");preloadIntroPokemon();drawIntro();
}
function introAdvance(){
  const elapsed=performance.now()-introState.start;
  if(elapsed<1800){introState.start-=1600;return}
  const target=INTRO_LINES[introState.line]||"";
  if(introState.char<target.length){introState.char=target.length;return}
  if(introState.line<INTRO_LINES.length-1){introState.line++;introState.typedLine=-1;return}
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

const TILE=30;
const terrainCache=new Map();

function seeded(x,y,s=0){
  const n=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;
  return n-Math.floor(n);
}
const ANIM_STEP=170;
function animFrame(time=performance.now()){return Math.floor(time/ANIM_STEP)%6;}
function stepped(arr,frame){return arr[frame%arr.length]}
function pxRect(ctx,x,y,w,h,fill){ctx.fillStyle=fill;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))}

function drawGrassTile(ctx,x,y,tileX,tileY,time=0){
  const r=seeded(tileX,tileY,11),frame=animFrame(time),sway=stepped([0,1,1,0,-1,-1],frame);
  pxRect(ctx,x,y,30,30,r<.18?"#6fa65a":r>.86?"#77ad60":"#73aa5d");
  pxRect(ctx,x,y,30,2,"#80b66a");pxRect(ctx,x+1,y+27,28,2,"#639550");
  const marks=[
    [4,18,1,5,"#4f8c4d"],[7,21,2,3,"#5d9950"],[12,12,1,5,"#4d8a49"],
    [18,19,2,5,"#4c8747"],[23,10,1,5,"#5f9a51"],[25,21,2,4,"#4a8545"]
  ];
  for(const [mx,my,mw,mh,col] of marks){
    const extra=((mx+my+tileX+tileY)&1)?sway:0;
    pxRect(ctx,x+mx+extra,y+my,mw,mh,col);
  }
  if(r>.67){pxRect(ctx,x+14+sway,y+22,2,3,"#497f47");pxRect(ctx,x+13+sway,y+21,4,2,"#568f4d")}
  if(r<.09){pxRect(ctx,x+3-sway,y+6,2,2,"#8fc77c");pxRect(ctx,x+25-sway,y+14,2,2,"#8fc77c")}
}
function drawPathTile(ctx,x,y,tileX,tileY,time=0){
  const r=seeded(tileX,tileY,21);
  pxRect(ctx,x,y,30,30,r>.72?"#d8bd82":r<.18?"#c9aa70":"#d2b57a");
  pxRect(ctx,x,y,30,2,"#e2ca94");
  pxRect(ctx,x+1,y+28,28,2,"#b7935e");
  const f=animFrame(time),tw=stepped([0,1,0,-1,0,1],f);
  for(let i=0;i<5;i++){
    const rx=3+Math.floor(seeded(tileX*7+i,tileY*11+i,31)*24);
    const ry=4+Math.floor(seeded(tileX*13+i,tileY*5+i,32)*21);
    const sz=seeded(i,tileY,tileX)>0.55?2:1;
    pxRect(ctx,x+rx+(i&1?tw:0),y+ry,sz,sz,seeded(i+3,tileY,tileX)>.5?"#b19462":"#e7d19a");
  }
}
function drawDirtTile(ctx,x,y,tileX,tileY,time=0){
  const r=seeded(tileX,tileY,42);
  pxRect(ctx,x,y,30,30,r>.6?"#a4815f":"#987657");
  pxRect(ctx,x,y,30,2,"#b89269");
  const f=animFrame(time),dust=stepped([0,0,1,1,0,-1],f);
  for(let i=0;i<7;i++){
    const rx=2+Math.floor(seeded(tileX+i,tileY-i,43)*25);
    const ry=4+Math.floor(seeded(tileX-i,tileY+i,44)*23);
    pxRect(ctx,x+rx+((i%3===0)?dust:0),y+ry,1+Math.floor(seeded(i,tileY,45)*2),1, i%2?"#7d604a":"#c0986f");
  }
}
function drawRockTile(ctx,x,y,tileX,tileY,time=0){
  const r=seeded(tileX,tileY,55);
  pxRect(ctx,x,y,30,30,r>.5?"#6a6670":"#625e68");
  pxRect(ctx,x,y,30,2,"#817b86");
  pxRect(ctx,x+1,y+28,28,2,"#4f4b54");
  const stones=[[4,5,9,5],[17,4,7,7],[8,16,6,6],[20,18,8,5]];
  const f=animFrame(time),gl=stepped([0,0,1,1,0,-1],f);
  for(let i=0;i<stones.length;i++){
    const st=stones[i],c=i%2?"#76717b":"#85808a";
    pxRect(ctx,x+st[0],y+st[1],st[2],st[3],c);
    pxRect(ctx,x+st[0]+2+((i===1)?gl:0),y+st[1]+1,Math.max(2,st[2]-4),2,"#96919a");
  }
}
function drawWaterTile(ctx,x,y,tileX,tileY,time=0){
  const r=seeded(tileX,tileY,63),frame=animFrame(time);
  const waveA=stepped([0,3,6,3,0,-3],frame),waveB=stepped([4,1,-2,1,4,7],frame);
  pxRect(ctx,x,y,30,30,r>.7?"#56aaba":r<.18?"#4b9baa":"#51a4b3");
  pxRect(ctx,x,y,30,2,"#67b9c2");pxRect(ctx,x+1,y+28,28,2,"#438994");
  pxRect(ctx,x+4+waveA/2,y+9,8,2,"#8ed1d2");
  pxRect(ctx,x+17-waveB/2,y+18,9,2,"#86ccd0");
  if(r<.25)pxRect(ctx,x+13+stepped([0,1,1,0,-1,-1],frame),y+4,3,2,"#71bec4");
}
function drawSnowTile(ctx,x,y,tileX,tileY,time=0){
  const r=seeded(tileX,tileY,77);
  pxRect(ctx,x,y,30,30,r>.45?"#dce7e4":"#d3e0dd");
  pxRect(ctx,x,y,30,2,"#edf5f1");
  const f=animFrame(time),snow=stepped([0,0,1,1,0,-1],f);
  for(let i=0;i<5;i++){
    const rx=2+Math.floor(seeded(tileX+i,tileY,78)*25),ry=4+Math.floor(seeded(tileX,tileY+i,79)*22);
    pxRect(ctx,x+rx+((i%2)?snow:0),y+ry,2,2,"#b9ccc8");
  }
}
function drawFlowerPatch(ctx,x,y,tileX,tileY,time=0){
  const r=seeded(tileX,tileY,91),frame=animFrame(time),bob=stepped([0,0,-1,-1,0,1],frame);
  if(r<.35)return;
  const col=r>.82?"#f3d663":r>.62?"#f0a4bc":"#e9eef0";
  pxRect(ctx,x+6,y+11+bob,2,8,"#4e8b4a");pxRect(ctx,x+5,y+10+bob,4,4,col);
  pxRect(ctx,x+11,y+18-bob,2,6,"#4e8b4a");pxRect(ctx,x+10,y+16-bob,4,4,col);
  if(r>.74){pxRect(ctx,x+21,y+8+bob,2,7,"#4e8b4a");pxRect(ctx,x+20,y+7+bob,4,4,col)}
}
function drawGrassTexture(ctx,x,y,w,h,dense=1,time=0){
  const sx=Math.floor(x/TILE),sy=Math.floor(y/TILE),ex=Math.ceil((x+w)/TILE),ey=Math.ceil((y+h)/TILE);
  for(let ty=sy;ty<ey;ty++)for(let tx=sx;tx<ex;tx++)drawGrassTile(ctx,tx*TILE,ty*TILE,tx,ty,time);
  if(dense>1)for(let ty=sy;ty<ey;ty++)for(let tx=sx;tx<ex;tx++)if(seeded(tx,ty,93)>.7)drawFlowerPatch(ctx,tx*TILE,ty*TILE,tx,ty,time);
}
function drawFlowers(ctx,x,y,w,h,time=0){
  const sx=Math.floor(x/TILE),sy=Math.floor(y/TILE),ex=Math.ceil((x+w)/TILE),ey=Math.ceil((y+h)/TILE);
  for(let ty=sy;ty<ey;ty++)for(let tx=sx;tx<ex;tx++)drawFlowerPatch(ctx,tx*TILE,ty*TILE,tx,ty,time);
}
function drawTree(ctx,x,y,scale=1,time=0){
  const s=scale,frame=animFrame(time),bob=stepped([0,0,-1,-1,0,1],frame);
  ctx.save();ctx.translate(Math.round(x),Math.round(y+bob));ctx.imageSmoothingEnabled=false;
  pxRect(ctx,-10*s,20*s,20*s,7*s,"#526a45");pxRect(ctx,-7*s,8*s,14*s,23*s,"#754e35");pxRect(ctx,-9*s,9*s,5*s,18*s,"#8d6040");
  ctx.fillStyle="#315f3d";ctx.beginPath();
  ctx.moveTo(-28*s,9*s);ctx.lineTo(-23*s,-14*s);ctx.lineTo(-11*s,-23*s);ctx.lineTo(0,-29*s);
  ctx.lineTo(15*s,-23*s);ctx.lineTo(25*s,-10*s);ctx.lineTo(28*s,7*s);ctx.lineTo(18*s,16*s);ctx.lineTo(-18*s,16*s);ctx.closePath();ctx.fill();
  ctx.fillStyle="#477e48";ctx.beginPath();
  ctx.moveTo(-22*s,4*s);ctx.lineTo(-17*s,-11*s);ctx.lineTo(-4*s,-19*s);ctx.lineTo(9*s,-19*s);
  ctx.lineTo(21*s,-8*s);ctx.lineTo(22*s,4*s);ctx.lineTo(12*s,11*s);ctx.lineTo(-14*s,11*s);ctx.closePath();ctx.fill();
  pxRect(ctx,-14*s,-8*s,7*s,5*s,stepped(["#6a9b55","#659753","#6a9b55","#6f9f57","#659753","#6a9b55"],frame));
  pxRect(ctx,7*s,-13*s,6*s,5*s,stepped(["#5d9250","#5a8d4d","#5d9250","#629651","#5a8d4d","#5d9250"],frame));
  ctx.restore();
}
function drawPond(ctx,x,y,w,h,time=0){
  // Pixel-stepped shoreline rather than a smooth vector oval.
  const cx=x+w/2,cy=y+h/2,rx=w/2,ry=h/2;
  const left=Math.floor((x-12)/TILE),right=Math.ceil((x+w+12)/TILE);
  const top=Math.floor((y-12)/TILE),bottom=Math.ceil((y+h+12)/TILE);
  for(let ty=top;ty<=bottom;ty++)for(let tx=left;tx<=right;tx++){
    const px=tx*TILE+TILE/2,py=ty*TILE+TILE/2;
    const q=((px-cx)*(px-cx))/(rx*rx)+((py-cy)*(py-cy))/(ry*ry);
    if(q<=1.08){
      if(q>1){drawGrassTile(ctx,tx*TILE,ty*TILE,tx,ty,time);pxRect(ctx,tx*TILE,ty*TILE+26,30,4,"#4d8147")}
      else drawWaterTile(ctx,tx*TILE,ty*TILE,tx,ty,time);
    }
  }
  // Reeds / shoreline highlights.
  for(let i=0;i<Math.max(8,Math.floor(w/35));i++){
    const px=x+18+i*31+(i%2)*5, py=y+h-5-(i%3)*4;
    if(((px-cx)*(px-cx))/(rx*rx)+((py-cy)*(py-cy))/(ry*ry)<1.06){
      const f=animFrame(time),rb=stepped([0,1,1,0,-1,-1],f);
      pxRect(ctx,px+rb,py-10,2,10,"#4c8246");
      pxRect(ctx,px+4+rb,py-7,2,7,"#5a914b");
    }
  }
}
function drawBuilding(ctx,x,y,label,type="house",time=0){
  const bx=x*TILE,by=y*TILE,w=150,h=120,frame=animFrame(time);
  const roof=type==="gym"?"#536f8c":type==="shop"?"#c35b45":type==="lab"?"#708da0":"#b55d4d";
  const wall=type==="gym"?"#d3dbe3":type==="shop"?"#efc989":type==="lab"?"#d9e5ea":"#e9d7bd";
  pxRect(ctx,bx+4,by+108,w-8,10,"#8b6f57");
  ctx.fillStyle="#633f3a";ctx.beginPath();ctx.moveTo(bx-6,by+27);ctx.lineTo(bx+75,by-10);ctx.lineTo(bx+w+6,by+27);ctx.closePath();ctx.fill();
  ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(bx,by+25);ctx.lineTo(bx+75,by);ctx.lineTo(bx+w,by+25);ctx.closePath();ctx.fill();
  for(let i=0;i<9;i++)pxRect(ctx,bx+18+i*15,by+18-Math.floor(Math.abs(4-i)*.9),11,3,i%2?"#8da0ad":"#6f8797");
  pxRect(ctx,bx+6,by+27,w-12,81,wall);pxRect(ctx,bx+6,by+27,w-12,4,"#f4eee4");
  const glass=stepped(["#b8e2e6","#d4f0ee","#b8e2e6","#d9f2f0","#b8e2e6","#d4f0ee"],frame);
  pxRect(ctx,bx+17,by+53,31,28,"#6b8f9f");pxRect(ctx,bx+21,by+57,23,20,glass);
  pxRect(ctx,bx+102,by+53,31,28,"#6b8f9f");pxRect(ctx,bx+106,by+57,23,20,glass);
  pxRect(ctx,bx+29,by+57,3,20,"#6b8f9f");pxRect(ctx,bx+17,by+65,31,3,"#6b8f9f");
  pxRect(ctx,bx+114,by+57,3,20,"#6b8f9f");pxRect(ctx,bx+102,by+65,31,3,"#6b8f9f");
  pxRect(ctx,bx+59,by+63,33,45,"#4d3a36");pxRect(ctx,bx+63,by+67,25,41,type==="gym"?"#65798b":"#9c654a");
  pxRect(ctx,bx+69,by+85,4,4,stepped(["#e4cc70","#f5df83","#e4cc70","#f7e48c","#e4cc70","#f5df83"],frame));
  pxRect(ctx,bx+54,by+107,43,5,"#c7bca7");
  pxRect(ctx,bx+48,by-1,54,17,"#f7f4ed");pxRect(ctx,bx+50,by+1,50,13,type==="lab"?"#dfeef3":"#fff");
  ctx.fillStyle="#273640";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText(label,bx+75,by+11);ctx.textAlign="left";
  if(type==="lab"||type==="house"){const puff=stepped([0,2,0,-1,0,2],frame);pxRect(ctx,bx+126+puff,by-18,5,5,"#d8dee0");if(frame%3===1)pxRect(ctx,bx+133+puff,by-24,4,4,"#e5e9e9")}
}
function townPondHit(tx,ty){
  const cx=20.2,cy=14.2,rx=4.3,ry=2.8;
  return ((tx-cx)*(tx-cx))/(rx*rx)+((ty-cy)*(ty-cy))/(ry*ry)<=1;
}
function waterAreaHit(tx,ty){
  const a=((tx-24.2)*(tx-24.2))/(5.8*5.8)+((ty-4.1)*(ty-4.1))/(3.2*3.2)<=1;
  const b=((tx-5.4)*(tx-5.4))/(4.9*4.9)+((ty-15.6)*(ty-15.6))/(3.1*3.1)<=1;
  return a||b;
}
function townPath(tx,ty){
  if(townPondHit(tx,ty))return false;
  if(ty>=8&&ty<=10)return true;
  if(tx>=13&&tx<=15)return true;
  if((tx>=3&&tx<=5&&ty>=5&&ty<=8)||(tx>=10&&tx<=12&&ty>=5&&ty<=8)||(tx>=19&&tx<=21&&ty>=5&&ty<=8))return true;
  if(tx>=17&&tx<=21&&ty>=10&&ty<=13)return true;
  return false;
}
function routePath(tx,ty){
  const center=10+Math.round(Math.sin(tx*.42)*1.5);
  return Math.abs(ty-center)<=1;
}
function terrainAt(a,tx,ty){
  if(a.bg==="cave")return"rock";
  if(a.bg==="mountain")return seeded(tx,ty,501)>.72?"dirt":"grass";
  if(a.bg==="water"&&waterAreaHit(tx,ty))return"water";
  if(a.bg==="route"&&routePath(tx,ty))return"path";
  if(a.bg==="town"&&townPath(tx,ty))return"path";
  return"grass";
}
function buildFieldStatic(a){
  const key=state.area+"|"+a.bg;
  if(terrainCache.has(key))return terrainCache.get(key);
  const layer=document.createElement("canvas");layer.width=900;layer.height=600;
  const ctx=layer.getContext("2d");ctx.imageSmoothingEnabled=false;
  for(let ty=0;ty<20;ty++)for(let tx=0;tx<30;tx++){
    const type=terrainAt(a,tx,ty),x=tx*TILE,y=ty*TILE;
    if(type==="grass")drawGrassTile(ctx,x,y,tx,ty,0);
    else if(type==="path")drawPathTile(ctx,x,y,tx,ty);
    else if(type==="dirt")drawDirtTile(ctx,x,y,tx,ty);
    else if(type==="rock")drawRockTile(ctx,x,y,tx,ty);
    else if(type==="water")drawWaterTile(ctx,x,y,tx,ty,0);
  }
  if(a.bg==="water"){drawPond(ctx,600,30,280,210,0);drawPond(ctx,55,335,240,150,0)}
  if(a.bg==="town")drawPond(ctx,485,345,250,145,0);
  terrainCache.set(key,layer);return layer;
}
function drawField(){
  const c=$("field"),ctx=c.getContext("2d"),w=c.width,h=c.height,t=TILE,a=AREA[state.area],now=performance.now(),time=Math.floor(now/ANIM_STEP)*ANIM_STEP;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);
  for(let ty=0;ty<20;ty++)for(let tx=0;tx<30;tx++){
    const type=terrainAt(a,tx,ty),x=tx*TILE,y=ty*TILE;
    if(type==="grass")drawGrassTile(ctx,x,y,tx,ty,time);
    else if(type==="path")drawPathTile(ctx,x,y,tx,ty,time);
    else if(type==="dirt")drawDirtTile(ctx,x,y,tx,ty,time);
    else if(type==="rock")drawRockTile(ctx,x,y,tx,ty,time);
    else if(type==="water")drawWaterTile(ctx,x,y,tx,ty,time);
  }
  // Dynamic water shimmer and shoreline glints.
  if(a.bg==="water"){drawPond(ctx,600,30,280,210,time);drawPond(ctx,55,335,240,150,time)}
  if(a.bg==="town")drawPond(ctx,485,345,250,145,time);

  if(a.bg==="route"){
    for(const [x,y,s] of [[3,3,1],[6,5,.85],[26,4,.9],[6,15,.95],[22,15,1],[27,12,.8]])drawTree(ctx,x*t+15,y*t+17,s,time);
    drawFlowers(ctx,0,0,w,h,time);
  }
  if(a.bg==="town"){
    drawBuilding(ctx,2,2,"ポケモンセンター","house",time);
    drawBuilding(ctx,9,2,"フレンドリィショップ","shop",time);
    drawBuilding(ctx,18,2,"ジム","gym",time);
    drawBuilding(ctx,17,11,"アサギ研究所","lab",time);
    for(const [x,y,s] of [[1,14,1],[5,16,.9],[27,15,.8],[28,6,.9],[16,4,.75],[15,17,.72],[25,11,.72]])drawTree(ctx,x*t+15,y*t+20,s,time);
    drawFlowers(ctx,0,0,w,h,time);
    drawNpc(ctx,18.3*t,10.2*t,"professor",time);drawNpc(ctx,22.2*t,12.8*t,"rival",time);
  }
  if(a.bg==="cave"){
    for(const [x,y] of [[3,5],[5,11],[22,5],[23,13],[11,16],[26,16]]){
      const px=x*t+15,py=y*t+15;
      pxRect(ctx,px-13,py-4,26,12,"#4f4b54");
      pxRect(ctx,px-8,py-10,17,9,"#85808a");
      pxRect(ctx,px-4,py-13,9,4,"#9a949c");
    }
  }
  if(a.bg==="mountain"){
    for(const [x,y,s] of [[3,15,50],[6,11,70],[24,15,55],[26,9,85],[15,4,90]]){
      ctx.fillStyle="#6d806a";ctx.beginPath();ctx.moveTo(x*t,y*t+30);ctx.lineTo((x+2)*t,(y-s/30)*t);ctx.lineTo((x+4)*t,y*t+30);ctx.closePath();ctx.fill();
      pxRect(ctx,(x+1.3)*t,(y-s/30)*t+20,8,5,"#a9b7a7");
    }
    for(const [x,y] of [[2,5],[6,5],[26,4],[27,16]])drawTree(ctx,x*t+15,y*t+18,.85,time);
  }
  // Edge border and area signs.
  pxRect(ctx,0,0,w,4,"#416348");pxRect(ctx,0,h-4,w,4,"#416348");pxRect(ctx,0,0,4,h,"#416348");pxRect(ctx,w-4,0,4,h,"#416348");
  ctx.fillStyle="#f9f5e9";ctx.font="bold 12px sans-serif";
  if(a.north!==null)ctx.fillText("↑ "+AREA[a.north].name,414,17);
  if(a.south!==null)ctx.fillText("↓ "+AREA[a.south].name,414,592);
  if(a.west!==null)ctx.fillText("← "+AREA[a.west].name,8,285);
  if(a.east!==null)ctx.fillText(AREA[a.east].name+" →",770,285);
  // Player shadow and sprite.
  const moveBob=stepped([0,1,0,-1],animFrame(time));
  const leg=stepped([0,2,0,-2],animFrame(time));
  const px=state.pos.x*t+15,py=state.pos.y*t+18+moveBob;
  pxRect(ctx,px-12,py+12,24,5,"#34433a");
  pxRect(ctx,px-7,py-18,14,7,"#315c9c");
  pxRect(ctx,px-8,py-11,16,12,"#f6d0ad");
  pxRect(ctx,px-7,py,14,16,"#e9f2f4");
  pxRect(ctx,px-7,py+13+leg,5,9,"#4772af");pxRect(ctx,px+2,py+13-leg,5,9,"#4772af");
  if(state.area===0){
    pxRect(ctx,17*t+12,12*t+8,24,20,"#5c6470");
    pxRect(ctx,17*t+14,12*t+10,20,15,"#dbe6e8");
    pxRect(ctx,17*t+2,12*t+40,45,12,"#f4f0df");
    ctx.fillStyle="#35444c";ctx.font="bold 10px sans-serif";ctx.fillText("研究所",17*t+8,12*t+50);
  }
}
function drawNpc(ctx,x,y,kind,time=0){
  const s=.9,frame=animFrame(time),step=stepped([0,1,0,-1,0,1],frame),blink=(frame===2||frame===3);
  pxRect(ctx,x-13*s,y+18*s,26*s,6*s,"#34423c");
  pxRect(ctx,x-9*s,y-1*s+step*.2,18*s,24*s,kind==="professor"?"#e8eef1":"#d6b09f");
  pxRect(ctx,x-8*s,y+8*s+step*.2,16*s,14*s,kind==="professor"?"#ffffff":"#2e477a");
  pxRect(ctx,x-8*s,y-17*s+step*.2,16*s,8*s,kind==="professor"?"#e8edf0":"#4b2d26");
  pxRect(ctx,x-7*s,y-9*s+step*.2,14*s,10*s,"#f2c6a5");
  if(!blink){
    pxRect(ctx,x-6*s,y-6*s,2*s,2*s,"#263238");pxRect(ctx,x+4*s,y-6*s,2*s,2*s,"#263238");
  }else{
    pxRect(ctx,x-6*s,y-5*s,3*s,1*s,"#263238");pxRect(ctx,x+3*s,y-5*s,3*s,1*s,"#263238");
  }
  if(kind==="professor"){
    pxRect(ctx,x+8*s,y-1*s+step*.2,5*s,15*s,"#6b7f90");pxRect(ctx,x-16*s,y+step*.2,7*s,13*s,"#ffffff");
  }else{
    const leg=frame%2?2:-1;
    pxRect(ctx,x-12*s,y+23*s+leg,6*s,8*s,"#334e7f");pxRect(ctx,x+6*s,y+23*s-leg,6*s,8*s,"#334e7f");
  }
}

let fieldAnimation=0,lastFieldFrame=0;
function renderField(){drawField()}
function animateField(time){
  if(state.screen!=="gameScreen"){fieldAnimation=0;return}
  if(time-lastFieldFrame>=ANIM_STEP){lastFieldFrame=time;drawField();renderPlayers()}
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
  if(state.battle)return;
  try{
    const e=await makeMon(name,level);
    state.dex.add(e.species);
    state.battle={wild:true,trainerName:"",enemyTeam:[e],enemyIndex:0,playerIndex:0,gym:false,league:false};
    show("battleScreen");
    await renderBattle();
    setBattleText("野生の"+e.nameJa+"が現れた！");
  }catch(e){
    const detail=e instanceof Error?e.message:String(e);
    globalThis.__gameErrors=globalThis.__gameErrors||[];
    globalThis.__gameErrors.push("startWild: "+detail);
    msg("野生のポケモンの準備に失敗した。");
  }
}
function startTrainer(name,team,gym,league){state.battle={wild:false,trainerName:name,enemyTeam:team,enemyIndex:0,playerIndex:0,gym:!!gym,league:!!league};show("battleScreen");renderBattle();setBattleText(name+"が勝負をしかけてきた！")}
async function startLeague(){const l=LEAGUE[state.leagueIndex];if(!l){state.storyComplete=true;msg("ポケモンリーグ制覇！ 君は新たなチャンピオンになった！");save();return}try{const team=[];for(const [n,lv] of l.team)team.push(await makeMon(n,lv,true));startTrainer(l.name,team,false,true)}catch{}}
function enemyMon(){return state.battle?.enemyTeam[state.battle.enemyIndex]}
function playerMon(){return state.party[state.battle?.playerIndex??0]}
let battleAnimation=0;
function animateBattleSprites(time){
  if(state.screen!=="battleScreen"){battleAnimation=0;return}
  const f=animFrame(time),bob=stepped([0,2,0,-2],f),tilt=stepped([0,0,-1,0],f);
  const e=$("enemySprite"),p=$("playerSprite");
  if(e)e.style.marginTop=bob+"px";
  if(p)p.style.marginTop=(-bob)+"px";
  if(e)e.style.transform="translateX("+tilt+"px)";
  if(p)p.style.transform="scaleX(-1) translateX("+(-tilt)+"px)";
  battleAnimation=requestAnimationFrame(animateBattleSprites);
}
function renderBattle(){ensureBattleAnimation();const e=enemyMon(),p=playerMon();if(!e||!p)return;$("battleKind").textContent=state.battle.wild?"野生のポケモン":state.battle.trainerName;$("enemyName").textContent=e.nameJa;$("enemyMeta").textContent="Lv."+e.level+"　"+e.types.join(" / ");$("enemySprite").src=e.sprite;$("playerSprite").src=p.sprite;$("playerMonName").textContent=p.nameJa;$("playerMonMeta").textContent="Lv."+p.level+"　"+p.types.join(" / ");updateBattleBars();buildMoves();buildSwitch();$("movePanel").classList.add("hidden");$("bagPanel").classList.add("hidden");$("switchPanel").classList.add("hidden");$("battleMenu").classList.remove("hidden")}
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
function ensureBattleAnimation(){if(!battleAnimation)battleAnimation=requestAnimationFrame(animateBattleSprites)}
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