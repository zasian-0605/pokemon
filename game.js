const $=id=>document.getElementById(id);
const API="/api";
const VERSION=3;
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
function show(screen){["titleScreen","starterScreen","gameScreen","battleScreen"].forEach(id=>$(id).classList.add("hidden"));$(screen).classList.remove("hidden");state.screen=screen}
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
function load(){try{const x=JSON.parse(localStorage.getItem("pokemon-star-journey-save")||"null");if(!x?.party?.length||x.version!==VERSION)return false;Object.assign(state,x);state.dex=new Set(x.dex||[]);state.battle=null;state.ws=null;state.players=new Map();state.online=false;return true}catch{return false}}
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
function drawBuilding(ctx,x,y,label){ctx.fillStyle="#ead7bf";ctx.fillRect(x*30,y*30,5*30,4*30);ctx.fillStyle="#b44d48";ctx.beginPath();ctx.moveTo(x*30-8,y*30);ctx.lineTo((x+2.5)*30,(y-1)*30);ctx.lineTo((x+5)*30+8,y*30);ctx.fill();ctx.fillStyle="#4a5560";ctx.font="12px sans-serif";ctx.fillText(label,x*30+9,y*30+70)}
function drawField(){const c=$("field"),ctx=c.getContext("2d"),w=c.width,h=c.height,t=30,a=AREA[state.area];ctx.clearRect(0,0,w,h);ctx.fillStyle={town:"#b6d889",route:"#8fc776",water:"#79b8cc",cave:"#615a67",mountain:"#a7c48b"}[a.bg];ctx.fillRect(0,0,w,h);
  for(let y=0;y<20;y++)for(let x=0;x<30;x++)if((x+y)%3===0){ctx.fillStyle=a.bg==="cave"?"#6c6572":"#a8d18f";ctx.fillRect(x*t,y*t,t,t)}
  if(a.bg!=="cave"){ctx.fillStyle="#d8bc82";ctx.fillRect(0,9*t,w,2*t);ctx.fillRect(14*t,0,2*t,h)}
  if(a.bg==="water"){ctx.fillStyle="#4c9cab";ctx.fillRect(20*t,0,10*t,7*t);ctx.fillStyle="#6ea85d";ctx.fillRect(0,13*t,10*t,7*t)}
  if(a.bg==="route")for(const [x,y] of [[3,3],[4,3],[3,4],[25,4],[26,4],[25,5],[6,15],[7,15],[6,16],[20,15],[21,15],[20,16]]){ctx.fillStyle="#55a451";ctx.fillRect(x*t,y*t,t*2,t*2)}
  if(a.bg==="town"){drawBuilding(ctx,2,2,"ポケモンセンター");drawBuilding(ctx,9,2,"フレンドリィショップ");drawBuilding(ctx,18,2,"ジム");ctx.fillStyle="#f4d36e";ctx.fillRect(0,16*t,4*t,4*t)}
  if(a.bg==="cave"){ctx.fillStyle="#403a45";ctx.fillRect(8*t,4*t,10*t,4*t);for(const [x,y] of [[3,5],[5,11],[22,5],[23,13],[11,16],[26,16]]){ctx.fillStyle="#89828d";ctx.beginPath();ctx.arc(x*t,y*t,16,0,Math.PI*2);ctx.fill()}}
  if(a.bg==="mountain")for(const [x,y,s] of [[3,15,50],[6,11,70],[24,15,55],[26,9,85],[15,4,90]]){ctx.fillStyle="#789a72";ctx.beginPath();ctx.moveTo(x*t,y*t);ctx.lineTo((x+2)*t,(y-s/30)*t);ctx.lineTo((x+4)*t,y*t);ctx.fill()}
  ctx.fillStyle="#fff";ctx.font="12px sans-serif";if(a.north!==null)ctx.fillText("↑ "+AREA[a.north].name,420,16);if(a.south!==null)ctx.fillText("↓ "+AREA[a.south].name,420,590);if(a.west!==null)ctx.fillText("← "+AREA[a.west].name,8,285);if(a.east!==null)ctx.fillText(AREA[a.east].name+" →",770,285);
  ctx.fillStyle="#3a6d4d";ctx.fillRect(state.pos.x*t+6,state.pos.y*t+6,18,18);ctx.fillStyle="#f7f7f7";ctx.fillRect(state.pos.x*t+9,state.pos.y*t+9,12,5)
}
function renderField(){drawField()}
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
    if(Math.abs(x-18)<=1&&Math.abs(y-12)<=1){await rival();return}
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
function gainExp(p,enemy,mult=1){const n=Math.max(1,Math.floor(enemy.baseExp*enemy.level/7*mult));p.exp+=n;return levelUp(p)}
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
  const defeated=enemyMon(),p=playerMon();gainExp(p,defeated,state.battle.wild?1:1.5);
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
  $("newGame").onclick=()=>show("starterScreen");$("loadGame").onclick=()=>{if(load()){show("gameScreen");renderAll();msg("セーブデータを読み込みました。")}else show("starterScreen")};$("saveButton").onclick=()=>{save();msg("セーブしました。")};
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
setupButtons();starterCards();