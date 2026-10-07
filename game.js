const $=id=>document.getElementById(id);
const API="/api";
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
const state={screen:"title",area:0,pos:{x:14,y:17},party:[],box:[],dex:new Set(),money:3000,badges:0,items:{potion:5,superpotion:2,pokeball:10},battle:null,online:false,ws:null,selfId:null,players:new Map()};
const cache={pokemon:new Map(),move:new Map(),pokedex:null};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function show(screen){["titleScreen","starterScreen","gameScreen","battleScreen"].forEach(id=>$(id).classList.add("hidden"));$(screen).classList.remove("hidden");state.screen=screen}
function msg(t){if(state.screen==="gameScreen")$("fieldMessage").textContent=t;if(state.screen==="battleScreen")$("battleText").textContent=t}
function setBattleText(t){$("battleText").textContent=t}
function jp(name,f){return name||f}
async function getPokemon(name){
  name=String(name).toLowerCase();
  if(cache.pokemon.has(name))return cache.pokemon.get(name);
  const r=await fetch(API+"/pokemon/"+encodeURIComponent(name));
  if(!r.ok)throw new Error("pokemon "+r.status);
  const p=await r.json();cache.pokemon.set(name,p);return p;
}
async function getMove(name){
  name=String(name).toLowerCase();
  if(cache.move.has(name))return cache.move.get(name);
  const r=await fetch(API+"/move/"+encodeURIComponent(name));
  if(!r.ok)throw new Error("move "+r.status);
  const m=await r.json();cache.move.set(name,m);return m;
}
function statCalc(base,level){return{hp:Math.floor(((base.hp*2+31)*level)/100)+level+10,attack:Math.floor(((base.attack*2+31)*level)/100)+5,defense:Math.floor(((base.defense*2+31)*level)/100)+5,spAttack:Math.floor(((base["special-attack"]*2+31)*level)/100)+5,spDefense:Math.floor(((base["special-defense"]*2+31)*level)/100)+5,speed:Math.floor(((base.speed*2+31)*level)/100)+5}}
function baseMap(p){return Object.fromEntries(p.stats.map(x=>[x.stat.name,x.base_stat]))}
async function chooseMoves(p,level){
  const candidates=p.moves.filter(x=>x.level<=level).sort((a,b)=>b.level-a.level);
  const names=[];for(const x of candidates){if(!names.includes(x.name))names.push(x.name);if(names.length>=4)break}
  if(!names.length)names.push("tackle");
  const out=[];for(const n of names){try{const m=await getMove(n);out.push({name:m.name,nameJa:m.nameJa,type:m.type,power:m.power,accuracy:m.accuracy,pp:m.pp,maxPp:m.pp,priority:m.priority,damageClass:m.damageClass,ailment:m.ailment,ailmentChance:m.ailmentChance})}catch{}}
  return out;
}
async function makeMon(name,level,trainer=false){
  const p=await getPokemon(name);
  const base=baseMap(p),s=statCalc(base,level),moves=await chooseMoves(p,level);
  return {uid:(globalThis.crypto?.randomUUID?.()||("m"+Date.now()+Math.random())),species:p.name,name:p.name,nameJa:p.nameJa,level,exp:0,types:p.types,baseExp:p.baseExp,captureRate:p.captureRate,isTrainer:trainer,sprite:p.sprite,stats:s,currentHp:s.hp,status:null,moves};
}
function cleanMon(m){return {...m,stats:{...m.stats},moves:m.moves.map(x=>({...x}))}}
async function starterCards(){
  const box=$("starterGrid");box.innerHTML="";
  for(const id of STARTERS){
    try{const p=await getPokemon(id);const b=document.createElement("button");b.className="starter-card";b.innerHTML="<img src='"+p.sprite+"' alt=''><h3>"+p.nameJa+"</h3><span class='type'>"+p.types.join(" / ")+"</span><p class='muted'>"+p.name+"</p>";b.onclick=async()=>startNew(id);box.appendChild(b)}catch(e){}
  }
}
async function startNew(starter){
  try{
    state.area=0;state.pos={x:14,y:17};state.badges=0;state.money=3000;state.items={potion:5,superpotion:2,pokeball:10};state.box=[];state.dex=new Set();state.battle=null;
    const p=await makeMon(starter,5);state.party=[p];state.dex.add(p.species);show("gameScreen");renderAll();msg(p.nameJa+"といっしょに旅に出よう！");
    save();
  }catch{show("starterScreen");}
}
function serialize(){return{...state,dex:[...state.dex],ws:null,players:[]}}
function save(){try{localStorage.setItem("pokemon-star-journey-save",JSON.stringify(serialize()));return true}catch{return false}}
function load(){
  try{const x=JSON.parse(localStorage.getItem("pokemon-star-journey-save")||"null");if(!x?.party?.length)return false;Object.assign(state,x);state.dex=new Set(x.dex||[]);state.ws=null;state.players=new Map();state.battle=null;state.online=false;return true}catch{return false}
}
function renderAll(){renderField();renderParty();renderInfo();renderPlayers()}
function renderInfo(){$("placeName").textContent=AREA[state.area].name;$("badgeCount").textContent="バッジ "+state.badges;$("badgeText").textContent=state.badges;$("money").textContent=state.money.toLocaleString()+"円";$("dexCount").textContent=state.dex.size;$("partySize").textContent=state.party.length+" / 6";$("storyProgress").style.width=(state.badges/4*100)+"%"}
function renderParty(){
  const box=$("partyList");box.innerHTML="";
  state.party.forEach((p,i)=>{const d=document.createElement("div");d.className="party-item";const ratio=Math.max(0,p.currentHp/p.stats.hp)*100;d.innerHTML="<div class='ball'></div><div><div class='party-name'>"+(p.nameJa||p.species)+"</div><div class='party-meta'>Lv."+p.level+"　"+p.types.join(" / ")+(p.status?"　"+p.status:"")+"</div><div class='bar'><span style='width:"+ratio+"%'></span></div></div><div class='party-meta'>"+p.currentHp+"/"+p.stats.hp+"</div>";d.onclick=()=>showMonInfo(i);box.appendChild(d)})
}
function showMonInfo(i){
  const p=state.party[i];if(!p)return;
  $("dialogContent").innerHTML="<h2>"+p.nameJa+"</h2><p>"+p.species+"　Lv."+p.level+"</p><p>タイプ："+p.types.join(" / ")+"</p><p>HP "+p.currentHp+" / "+p.stats.hp+"</p><p>技："+p.moves.map(m=>m.nameJa||m.name).join(" / ")+"</p>";
  $("dialogModal").classList.remove("hidden");
}
function drawField(){
  const c=$("field"),ctx=c.getContext("2d"),w=c.width,h=c.height,t=30;
  const area=AREA[state.area];
  ctx.clearRect(0,0,w,h);
  const colors={town:"#b6d889",route:"#8fc776",water:"#79b8cc",cave:"#615a67",mountain:"#a7c48b"};
  ctx.fillStyle=colors[area.bg];ctx.fillRect(0,0,w,h);
  for(let y=0;y<20;y++)for(let x=0;x<30;x++){if((x+y)%3===0){ctx.fillStyle=area.bg==="cave"?"#6c6572":"#a8d18f";ctx.fillRect(x*t,y*t,t,t)}}
  if(area.bg!=="cave"){ctx.fillStyle="#d8bc82";ctx.fillRect(0,9*t,w,2*t);ctx.fillRect(14*t,0,2*t,h)}
  if(area.bg==="water"){ctx.fillStyle="#4c9cab";ctx.fillRect(20*t,0,10*t,7*t);ctx.fillStyle="#6ea85d";ctx.fillRect(0,13*t,10*t,7*t)}
  if(area.bg==="route"){for(const [x,y] of [[3,3],[4,3],[3,4],[25,4],[26,4],[25,5],[6,15],[7,15],[6,16],[20,15],[21,15],[20,16]]){ctx.fillStyle="#55a451";ctx.fillRect(x*t,y*t,t*2,t*2)}}
  if(area.bg==="town"){drawBuilding(ctx,2,2,"ポケモンセンター");drawBuilding(ctx,9,2,"フレンドリィショップ");drawBuilding(ctx,18,2,"ジム");ctx.fillStyle="#f4d36e";ctx.fillRect(0,16*t,4*t,4*t)}
  if(area.bg==="cave"){ctx.fillStyle="#403a45";ctx.fillRect(8*t,4*t,10*t,4*t);for(const [x,y] of [[3,5],[5,11],[22,5],[23,13],[11,16],[26,16]]){ctx.fillStyle="#89828d";ctx.beginPath();ctx.arc(x*t,y*t,16,0,Math.PI*2);ctx.fill()}}
  if(area.bg==="mountain"){for(const [x,y,s] of [[3,15,50],[6,11,70],[24,15,55],[26,9,85],[15,4,90]]){ctx.fillStyle="#789a72";ctx.beginPath();ctx.moveTo(x*t,y*t);ctx.lineTo((x+2)*t,(y-s/30)*t);ctx.lineTo((x+4)*t,y*t);ctx.fill()}}
  drawExitSigns(ctx);
  ctx.fillStyle="#3a6d4d";ctx.fillRect(state.pos.x*t+6,state.pos.y*t+6,18,18);ctx.fillStyle="#f7f7f7";ctx.fillRect(state.pos.x*t+9,state.pos.y*t+9,12,5);
}
function drawBuilding(ctx,x,y,label){ctx.fillStyle="#ead7bf";ctx.fillRect(x*30,y*30,5*30,4*30);ctx.fillStyle="#b44d48";ctx.beginPath();ctx.moveTo(x*30-8,y*30);ctx.lineTo((x+2.5)*30,(y-1)*30);ctx.lineTo((x+5)*30+8,y*30);ctx.fill();ctx.fillStyle="#4a5560";ctx.font="12px sans-serif";ctx.fillText(label,x*30+9,y*30+70)}
function drawExitSigns(ctx){ctx.fillStyle="#fff";ctx.font="12px sans-serif";const a=AREA[state.area];if(a.north!==null)ctx.fillText("↑ "+AREA[a.north].name,420,16);if(a.south!==null)ctx.fillText("↓ "+AREA[a.south].name,420,590);if(a.west!==null)ctx.fillText("← "+AREA[a.west].name,8,285);if(a.east!==null)ctx.fillText(AREA[a.east].name+" →",770,285)}
function renderField(){drawField()}
function renderPlayers(){const canvas=$("field"),ctx=canvas.getContext("2d");if(!state.players)return;for(const p of state.players.values()){if(p.id===state.selfId)continue;ctx.fillStyle="#5d63a8";ctx.fillRect(p.x/100*canvas.width-8,p.y/100*canvas.height-11,16,22)}}
function blocked(x,y){if(x<0||x>29||y<0||y>19)return false;if(AREA[state.area].bg==="water"&&(x>=20&&y<7))return true;if(state.area===0&&((x>=2&&x<7&&y>=2&&y<6)||(x>=9&&x<14&&y>=2&&y<6)||(x>=18&&x<23&&y>=2&&y<6)))return true;return false}
function grassHere(){const x=state.pos.x,y=state.pos.y;return state.area===1&&((x<10&&y<8)||(x>19&&y>12))||state.area===2&&x<10&&y>12||state.area===3&&(x>18&&y>9)||state.area===4&&(x<12&&y>10)}
async function move(dx,dy){
  if(state.screen!=="gameScreen"||state.battle)return;
  let nx=state.pos.x+dx,ny=state.pos.y+dy;
  const a=AREA[state.area];
  if(nx<0){if(a.west!==null){state.area=a.west;state.pos={x:28,y:9};renderAll();msg(AREA[state.area].name+"へ。");return}nx=0}
  if(nx>29){if(a.east!==null){state.area=a.east;state.pos={x:1,y:9};renderAll();msg(AREA[state.area].name+"へ。");return}nx=29}
  if(ny<0){if(a.north!==null){state.area=a.north;state.pos={x:14,y:18};renderAll();msg(AREA[state.area].name+"へ。");return}ny=0}
  if(ny>19){if(a.south!==null){state.area=a.south;state.pos={x:14,y:1};renderAll();msg(AREA[state.area].name+"へ。");return}ny=19}
  if(blocked(nx,ny))return;
  state.pos={x:nx,y:ny};renderAll();if(state.online&&state.ws?.readyState===1)state.ws.send(JSON.stringify({type:"move",x:state.pos.x/29*100,y:state.pos.y/19*100}));
  if(grassHere()&&Math.random()<.18){const list=AREA[state.area].enc;const n=list[Math.floor(Math.random()*list.length)];await startWild(n,Math.max(2,AREA[state.area].level+Math.floor(Math.random()*3)))}
}
async function interact(){
  if(state.screen!=="gameScreen"||state.battle)return;
  if(state.area===0){
    const x=state.pos.x,y=state.pos.y;
    if(x>=2&&x<=6&&y>=6&&y<=7){healParty();msg("ポケモンたちは元気いっぱいになった！");return}
    if(x>=9&&x<=13&&y>=6&&y<=7){shop();return}
    if(x>=18&&x<=22&&y>=6&&y<=7){challengeGym();return}
    if(Math.abs(x-18)<=1&&Math.abs(y-12)<=1){rival();return}
  }
  msg("ここには何もないようだ。");
}
function healParty(){for(const p of state.party){p.currentHp=p.stats.hp;p.status=null;p.moves.forEach(m=>m.pp=m.maxPp)};save();renderParty()}
function shop(){
  $("dialogContent").innerHTML="<h2>フレンドリィショップ</h2><div class='bag-row'><span>キズぐすり　100円</span><button id='buyPotion'>買う</button></div><div class='bag-row'><span>スーパーボール　600円</span><button id='buyBall'>買う</button></div><p>所持金 "+state.money.toLocaleString()+"円</p>";
  $("dialogModal").classList.remove("hidden");
  $("buyPotion").onclick=()=>{if(state.money>=100){state.money-=100;state.items.potion++;shop()}};
  $("buyBall").onclick=()=>{if(state.money>=600){state.money-=600;state.items.pokeball++;shop()}};
}
async function challengeGym(){
  const g=GYMS[state.badges];if(!g){msg("ポケモンリーグへの道が開いている！");return}
  if(state.badges<g.need){msg("まだ挑戦できるジムがない。");return}
  state.battle=null;try{const team=[];for(const [n,l] of g.team)team.push(await makeMon(n,l,true));startTrainer(g.name+"リーダー "+g.leader,team,true)}catch{msg("ジムの読み込みに失敗した。")}
}
async function rival(){
  try{const team=[];for(let i=0;i<TRAINERS[0].team.length;i++)team.push(await makeMon(TRAINERS[0].team[i],TRAINERS[0].levels[i],true));startTrainer(TRAINERS[0].name,team,false)}catch{}
}
async function startWild(name,level){
  if(state.battle)return;
  try{const e=await makeMon(name,level);state.dex.add(e.species);state.battle={wild:true,trainerName:"",enemyTeam:[e],enemyIndex:0,playerIndex:0};show("battleScreen");await renderBattle();setBattleText("野生の"+e.nameJa+"が現れた！");}catch{msg("野生のポケモンとの接続に失敗した。")}
}
function startTrainer(name,team,gym){state.battle={wild:false,trainerName:name,enemyTeam:team,enemyIndex:0,playerIndex:0,gym};show("battleScreen");renderBattle();setBattleText(name+"が勝負をしかけてきた！")}
function enemyMon(){return state.battle?.enemyTeam[state.battle.enemyIndex]}
function playerMon(){return state.party[state.battle?.playerIndex??0]}
async function renderBattle(){
  const e=enemyMon(),p=playerMon();if(!e||!p)return;
  $("battleKind").textContent=state.battle.wild?"野生のポケモン":state.battle.trainerName;
  $("enemyName").textContent=e.nameJa;$("enemyMeta").textContent="Lv."+e.level+"　"+e.types.join(" / ");
  $("enemySprite").src=e.sprite;$("playerSprite").src=p.sprite;
  $("playerMonName").textContent=p.nameJa;$("playerMonMeta").textContent="Lv."+p.level+"　"+p.types.join(" / ");
  updateBattleBars();buildMoves();buildSwitch();
}
function updateBattleBars(){const e=enemyMon(),p=playerMon();$("enemyHpBar").style.width=100*e.currentHp/e.stats.hp+"%";$("enemyHpText").textContent=e.currentHp+" / "+e.stats.hp;$("playerHpBar").style.width=100*p.currentHp/p.stats.hp+"%";$("playerHpText").textContent=p.currentHp+" / "+p.stats.hp}
function buildMoves(){const box=$("movePanel");box.innerHTML="";const p=playerMon();p.moves.forEach((m,i)=>{const b=document.createElement("button");b.textContent=(m.nameJa||m.name)+"  "+m.pp+"/"+m.maxPp;b.disabled=m.pp<=0;b.onclick=()=>turn(i);box.appendChild(b)});}
function buildSwitch(){const box=$("switchPanel");box.innerHTML="";state.party.forEach((p,i)=>{const b=document.createElement("button");b.textContent=p.nameJa+" Lv."+p.level;b.disabled=i===state.battle?.playerIndex||p.currentHp<=0;b.onclick=()=>switchPokemon(i);box.appendChild(b)});const back=document.createElement("button");back.textContent="もどる";back.onclick=()=>{$("switchPanel").classList.add("hidden");$("battleMenu").classList.remove("hidden")};box.appendChild(back)}
function fightMenu(){$("movePanel").classList.toggle("hidden");$("bagPanel").classList.add("hidden");$("switchPanel").classList.add("hidden")}
function bagMenu(){$("bagPanel").innerHTML="<button data-bag='potion'>キズぐすり ×"+state.items.potion+"</button><button data-bag='super'>すごいキズぐすり ×"+state.items.superpotion+"</button><button data-bag='ball'>モンスターボール ×"+state.items.pokeball+"</button><button data-bag='back'>もどる</button>";$("bagPanel").classList.remove("hidden");$("movePanel").classList.add("hidden");$("switchPanel").classList.add("hidden");$("bagPanel").querySelectorAll("button").forEach(b=>b.onclick=()=>useBag(b.dataset.bag))}
function pokemonMenu(){$("switchPanel").classList.remove("hidden");$("bagPanel").classList.add("hidden");$("movePanel").classList.add("hidden");$("battleMenu").classList.add("hidden")}
async function useBag(item){
  if(item==="back"){$("bagPanel").classList.add("hidden");$("battleMenu").classList.remove("hidden");return}
  const p=playerMon();
  if(item==="potion"){if(state.items.potion<=0)return;state.items.potion--;p.currentHp=Math.min(p.stats.hp,p.currentHp+20);setBattleText("キズぐすりを使った！");finishPlayerAction()}
  else if(item==="super"){if(state.items.superpotion<=0)return;state.items.superpotion--;p.currentHp=Math.min(p.stats.hp,p.currentHp+50);setBattleText("すごいキズぐすりを使った！");finishPlayerAction()}
  else if(item==="ball"){await throwBall()}
}
async function switchPokemon(i){if(!state.battle||i===state.battle.playerIndex)return;state.battle.playerIndex=i;hideSubPanels();await renderBattle();setBattleText("いけ！ "+playerMon().nameJa+"！");enemyTurn()}
function hideSubPanels(){$("movePanel").classList.add("hidden");$("bagPanel").classList.add("hidden");$("switchPanel").classList.add("hidden");$("battleMenu").classList.remove("hidden")}
function effective(move,types){let x=1;for(const t of types){if(move.no.includes(t))return 0;if(move.double.includes(t))x*=2;if(move.half.includes(t))x*=.5}return x}
async function damage(attacker,defender,move){
  if(move.pp<=0)return{ok:false,text:"しかしPPが足りない！"};move.pp--;
  if(Math.random()*100>move.accuracy)return{ok:false,text:attacker.nameJa+"の"+(move.nameJa||move.name)+"は外れた！"};
  const mult=effective(move,defender.types),crit=Math.random()<1/24?1.5:1;
  if(move.power===0){if(move.ailment!=="none"&&Math.random()*100<Math.max(1,move.ailmentChance)){defender.status=move.ailment}return{ok:true,damage:0,text:(move.nameJa||move.name)+"！"}}
  const A=move.damageClass==="special"?attacker.stats.spAttack:attacker.stats.attack,D=move.damageClass==="special"?defender.stats.spDefense:defender.stats.defense;
  let d=Math.floor(Math.floor(Math.floor((2*attacker.level/5+2)*move.power*A/D)/50)+2);
  if(attacker.types.includes(move.type))d=Math.floor(d*1.5);d=Math.floor(d*mult);d=Math.floor(d*crit);d=Math.floor(d*(85+Math.floor(Math.random()*16))/100);d=Math.max(1,d);
  defender.currentHp=Math.max(0,defender.currentHp-d);
  if(move.ailment!=="none"&&Math.random()*100<move.ailmentChance&&defender.currentHp>0&&defender.status===null)defender.status=move.ailment;
  return{ok:true,damage:d,crit:crit>1,mult,text:(move.nameJa||move.name)+"！ "+d+"ダメージ！"+(crit>1?"　急所に当たった！":"")+(mult===0?"　しかし効かなかった！":mult>1?"　効果はばつぐんだ！":mult<1?"　効果はいまひとつだ……":"")};
}
async function turn(i){
  if(!state.battle)return;
  $("movePanel").classList.add("hidden");
  const p=playerMon(),e=enemyMon(),move=p.moves[i];const enemyMove=e.moves[Math.floor(Math.random()*e.moves.length)];
  const playerFirst=(move.priority>enemyMove.priority)||(move.priority===enemyMove.priority&&p.stats.speed>=e.stats.speed);
  if(playerFirst){const r=await damage(p,e,move);setBattleText(r.text);updateBattleBars();if(e.currentHp<=0){await afterEnemyFaint();return}await statusTick(p,e);if(e.currentHp<=0){await afterEnemyFaint();return}await damageEnemyAndContinue(e,p,enemyMove)}
  else{await damageEnemyAndContinue(e,p,enemyMove);if(p.currentHp<=0)return;const r=await damage(p,e,move);setBattleText(r.text);updateBattleBars();if(e.currentHp<=0){await afterEnemyFaint();return}await statusTick(p,e)}
}
async function damageEnemyAndContinue(e,p,m){
  const r=await damage(e,p,m);setBattleText(r.text);updateBattleBars();await statusTick(e,p);
  if(p.currentHp<=0){await forcedSwitch();return}
}
async function statusTick(source,target){
  for(const x of [source]){
    if(x.status==="poison"||x.status==="badly-poisoned"){const d=Math.max(1,Math.floor(x.stats.hp/8));x.currentHp=Math.max(0,x.currentHp-d)}
    else if(x.status==="burn"){const d=Math.max(1,Math.floor(x.stats.hp/16));x.currentHp=Math.max(0,x.currentHp-d)}
  }
  updateBattleBars();
}
async function afterEnemyFaint(){
  const e=enemyMon(),p=playerMon();gainExp(p,e,state.battle.wild?1:1.5);
  if(state.battle.enemyIndex<state.battle.enemyTeam.length-1){state.battle.enemyIndex++;await renderBattle();setBattleText(state.battle.trainerName+"は"+enemyMon().nameJa+"を繰り出した！");return}
  if(state.battle.gym){state.badges=Math.min(4,state.badges+1);state.money+=2400;save();msg("ジムバッジ「"+GYMS[state.badges-1].badge+"」を手に入れた！");}
  else{state.money+=500;save();msg("勝利！ "+e.nameJa+"との戦いに勝った。")}
  state.battle=null;show("gameScreen");renderAll();
}
async function forcedSwitch(){
  const alive=state.party.some((p,i)=>p.currentHp>0&&i!==state.battle.playerIndex);
  if(!alive){state.battle=null;show("gameScreen");healParty();msg("ポケモンたちを回復して町へ戻った。");return}
  await renderBattle();pokemonMenu();setBattleText("次のポケモンを選んでください。");
}
function gainExp(p,enemy,mult=1){
  const n=Math.max(1,Math.floor(enemy.baseExp*enemy.level/7*mult));p.exp+=n;
  while(p.exp>=p.level**3-((p.level-1)**3)){const need=p.level**3-((p.level-1)**3);p.exp-=need;p.level++;const old=p.stats.hp;p.stats=statCalc({hp:p.stats.hp-0,attack:p.stats.attack,defense:p.stats.defense,"special-attack":p.stats.spAttack,"special-defense":p.stats.spDefense,speed:p.stats.speed},p.level);p.stats=statCalc(getBaseFallback(p),p.level);p.currentHp+=p.stats.hp-old;msg(p.nameJa+"はレベル"+p.level+"になった！")}
}
function getBaseFallback(p){return{hp:Math.max(1,Math.floor(p.stats.hp/((p.level-1)*.02+2))),attack:Math.max(1,Math.floor(p.stats.attack/((p.level-1)*.02+2))),defense:Math.max(1,Math.floor(p.stats.defense/((p.level-1)*.02+2))),"special-attack":Math.max(1,Math.floor(p.stats.spAttack/((p.level-1)*.02+2))),"special-defense":Math.max(1,Math.floor(p.stats.spDefense/((p.level-1)*.02+2))),speed:Math.max(1,Math.floor(p.stats.speed/((p.level-1)*.02+2)))}}
async function throwBall(){
  if(!state.battle?.wild||state.items.pokeball<=0)return;
  state.items.pokeball--;const e=enemyMon(),chance=Math.min(.95,Math.max(.03,((3*e.stats.hp-2*e.currentHp)*e.captureRate)/(3*e.stats.hp)/255));
  if(Math.random()<chance){if(state.party.length<6)state.party.push(e);else state.box.push(e);state.dex.add(e.species);save();state.battle=null;show("gameScreen");renderAll();msg(e.nameJa+"をつかまえた！");}
  else{setBattleText("カチッ……！　ボールから出てしまった！");await enemyTurn()}
}
async function enemyTurn(){const p=playerMon(),e=enemyMon();const m=e.moves[Math.floor(Math.random()*e.moves.length)];await damageEnemyAndContinue(e,p,m);renderBattle()}
function runAway(){if(!state.battle?.wild)return setBattleText("トレーナー戦では逃げられない！");const chance=Math.min(.95,.5+p.stats.speed/(eSpeed(enemyMon())*2));if(Math.random()<chance){state.battle=null;show("gameScreen");renderAll();msg("うまく逃げ切れた！")}else{setBattleText("逃げられない！");enemyTurn()}}
function eSpeed(e){return Math.max(1,e.stats.speed)}
function buildBagModal(){
  let html="<h2>バッグ</h2><div class='bag-row'><span>キズぐすり</span><b>"+state.items.potion+"</b></div><div class='bag-row'><span>すごいキズぐすり</span><b>"+state.items.superpotion+"</b></div><div class='bag-row'><span>モンスターボール</span><b>"+state.items.pokeball+"</b></div>";
  $("dialogContent").innerHTML=html;$("dialogModal").classList.remove("hidden");
}
async function openDex(){
  if(!cache.pokedex){try{cache.pokedex=await (await fetch(API+"/pokedex")).json()}catch{cache.pokedex=[]}}
  const seen=[...state.dex];let html="<h2>ポケモンずかん</h2><p>見つけたポケモン： "+seen.length+" 匹</p><input id='dexSearch' class='dex-search' placeholder='名前で検索'>";
  html+="<div class='dex-grid'>";for(const name of (cache.pokedex||[])){const on=seen.includes(name.name);if(on){const p=cache.pokemon.get(name.name);html+="<div class='dex-card'><img src='"+(p?.sprite||"")+"' alt=''><div><b>"+(p?.nameJa||name.name)+"</b><div class='muted'>#"+name.id+"</div></div></div>"}}
  html+="</div>";$("dialogContent").innerHTML=html;$("dialogModal").classList.remove("hidden");
}
function openMap(){let html="<h2>マップ</h2>";AREA.forEach((a,i)=>html+="<p>"+(i===state.area?"▶ ":"")+a.name+(i<=state.badges+1?"":"（未開放）")+"</p>");$("dialogContent").innerHTML=html;$("dialogModal").classList.remove("hidden")}
function switchOutside(i){const p=state.party[i];if(!p||p.currentHp<=0)return;state.party.splice(i,1);state.party.unshift(p);save();renderParty();msg(p.nameJa+"を先頭にした。")}
function setupButtons(){
  $("newGame").onclick=()=>show("starterScreen");
  $("loadGame").onclick=()=>{if(load()){show("gameScreen");renderAll();msg("セーブデータを読み込みました。")}else show("starterScreen")};
  $("saveButton").onclick=()=>{save();msg("セーブしました。")};
  $("menuButton").onclick=()=>$("menuModal").classList.remove("hidden");
  $("menuClose").onclick=()=>$("menuModal").classList.add("hidden");
  $("dialogClose").onclick=()=>$("dialogModal").classList.add("hidden");
  $("pokedexButton").onclick=()=>{ $("menuModal").classList.add("hidden");openDex() };
  $("partyButton").onclick=()=>{ $("menuModal").classList.add("hidden");renderParty();$("dialogContent").innerHTML="<h2>手持ち</h2>"+state.party.map((p,i)=>"<p>"+(i+1)+"　"+p.nameJa+" Lv."+p.level+"　HP "+p.currentHp+"/"+p.stats.hp+"</p>").join("");$("dialogModal").classList.remove("hidden") };
  $("bagButton").onclick=()=>{$("menuModal").classList.add("hidden");buildBagModal()};
  $("mapButton").onclick=()=>{$("menuModal").classList.add("hidden");openMap()};
  document.querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>{const d=b.dataset.dir;move(d==="left"?-1:d==="right"?1:0,d==="up"?-1:d==="down"?1:0)});
  document.addEventListener("keydown",e=>{
    if(["INPUT","TEXTAREA"].includes(e.target.tagName))return;const k=e.key.toLowerCase();
    if(state.screen==="gameScreen"){if(k==="w"||e.key==="ArrowUp")move(0,-1);else if(k==="s"||e.key==="ArrowDown")move(0,1);else if(k==="a"||e.key==="ArrowLeft")move(-1,0);else if(k==="d"||e.key==="ArrowRight")move(1,0);else if(k==="e"||e.key==="enter")interact();else if(k==="b")buildBagModal();else if(k==="p"){renderParty();}}
    else if(state.screen==="battleScreen"){if(k==="1")fightMenu();else if(k==="2")bagMenu();else if(k==="3")pokemonMenu();else if(k==="4")runAway()}
  });
  document.querySelectorAll("[data-battle]").forEach(b=>b.onclick=()=>{const a=b.dataset.battle;if(a==="fight")fightMenu();else if(a==="bag")bagMenu();else if(a==="pokemon")pokemonMenu();else if(a==="run")runAway()});
}
function onlineConnect(){
  if(state.online){state.ws?.close();return}
  try{
    const ws=new WebSocket((location.protocol==="https:"?"wss":"ws")+"://"+location.host);state.ws=ws;$("onlineState").textContent="接続中…";
    ws.onopen=()=>{state.online=true;$("onlineButton").textContent="切断";ws.send(JSON.stringify({type:"join",name:"旅人"}))};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}
      if(m.type==="joined"){state.selfId=m.selfId;state.players=new Map(m.room.players.map(p=>[p.id,p]));$("roomText").textContent="ルーム "+m.room.id+" / "+m.room.players.length+"人";chat("システム：オンライン接続")}
      else if(m.type==="player_joined"){state.players.set(m.player.id,m.player);renderField()}
      else if(m.type==="player_moved"){const p=state.players.get(m.player.id);if(p){p.x=m.player.x;p.y=m.player.y;renderField()}}
      else if(m.type==="player_left"){state.players.delete(m.playerId);renderField()}
      else if(m.type==="chat")chat(m.name+"："+m.text)
    };
    ws.onclose=()=>{state.online=false;state.ws=null;state.players.clear();$("onlineState").textContent="オフライン";$("onlineButton").textContent="オンライン";$("roomText").textContent="";renderField()};
    ws.onerror=()=>{$("onlineState").textContent="接続エラー"};
  }catch{$("onlineState").textContent="オンライン利用不可"}
}
function chat(t){const d=document.createElement("div");d.textContent=t;$("chatLog").appendChild(d);$("chatLog").scrollTop=$("chatLog").scrollHeight}
$("onlineButton").onclick=onlineConnect;$("chatSend").onclick=()=>{const t=$("chatInput").value.trim();if(t&&state.ws?.readyState===1){state.ws.send(JSON.stringify({type:"chat",text:t}));$("chatInput").value=""}};$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("chatSend").click()});
setupButtons();starterCards();