const $=id=>document.getElementById(id),API="/api",SAVE="pokemon-star-v3",VERSION=8;
const STARTERS=["bulbasaur","charmander","squirtle"],ENCOUNTERS=["pidgey","rattata","caterpie","pikachu"];
const NAMES={bulbasaur:"フシギダネ",charmander:"ヒトカゲ",squirtle:"ゼニガメ",pidgey:"ポッポ",rattata:"コラッタ",caterpie:"キャタピー",pikachu:"ピカチュウ",oddish:"ナゾノクサ"};
const TYPE_JA={normal:"ノーマル",fire:"ほのお",water:"みず",electric:"でんき",grass:"くさ",ice:"こおり",fighting:"かくとう",poison:"どく",ground:"じめん",flying:"ひこう",psychic:"エスパー",bug:"むし",rock:"いわ",ghost:"ゴースト",dragon:"ドラゴン",dark:"あく",steel:"はがね",fairy:"フェアリー"};
const state={screen:"title",area:"town",x:10,y:11,dir:"down",party:[],box:[],money:3000,badges:0,dex:new Set(),items:{potion:5,pokeball:10},battle:null,event:null,online:false,ws:null,selfId:null,players:new Map()};
const cache=new Map(),imgCache=new Map();let raf=0,lastStep=0,frame=0;
const TILE=32,COLS=20,ROWS=15;
const MAPS={
 town:{name:"星見町",tiles:[
"####################","#tttttttttttttttttt#","#tttttt....tttttttt#","#ttttt......ttttttt#","#tt....gggggg....tt#","#tt....gg..gg....tt#","#......gg..gg......#","#......gg..gg......#","#......gggggg......#","#..................#","#....~~~~..........#","#....~~~~..........#","#..................#","#..................#","####################"]},
 route:{name:"1番道路",tiles:[
"####################","#..gggg....gggg....#","#..gggg....gggg....#","#..gggg....gggg....#","#..gggg....gggg....#","#..................#","#..gggg....gggg....#","#..gggg....gggg....#","#..................#","#..gggg......gggg..#","#..gggg......gggg..#","#..................#","#..................#","#..................#","####################"]},
 lake:{name:"ミズホ湿原",tiles:[
"####################","#gggggggg~~~~ggggg#","#gggggg~~~~~~ggggg#","#gggg~~~~~~~~~~ggg#","#gggg~~~~~~~~~~ggg#","#gggggg~~~~~~ggggg#","#gggggggg~~~~ggggg#","#..................#","#..gggggg....gggg..#","#..gggggg....gggg..#","#..................#","#..................#","#..................#","#..................#","####################"]}};
function tileAt(x,y){const m=MAPS[state.area]||MAPS.town;return m.tiles[y]?.[x]||"#"}function solid(t){return "#t~".includes(t)}
function walkable(x,y){const t=tileAt(x,y);return !solid(t)}
function stepDir(dx,dy){
 if(state.screen!=="world"||state.event)return;
 state.dir=dy<0?"up":dy>0?"down":dx<0?"left":"right";
 let nx=state.x+dx,ny=state.y+dy;
 if(state.area==="town"&&dy<0&&state.y===1){state.area="route";state.x=10;state.y=13;say("1番道路へ出た！");renderWorld();return}
 if(state.area==="route"&&dy>0&&state.y===13){state.area="town";state.x=10;state.y=2;say("星見町へ戻った。");renderWorld();return}
 if(!walkable(nx,ny)){say("そこには進めない。");return}
 state.x=nx;state.y=ny;state.frame=(state.frame||0)+1;renderWorld();sendOnlineMove();
 if(state.area==="route"&&tileAt(nx,ny)==="g"&&Math.random()<.16)setTimeout(()=>wildEncounter(),80)
}
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.add("hidden"));$(id).classList.remove("hidden");state.screen=id==="world"?"world":id}
function say(t){$("mapText").textContent=t}
function jp(name,fallback){return NAMES[name]||fallback||name}
async function pokemon(name){if(cache.has(name))return cache.get(name);const r=await fetch(API+"/pokemon/"+name);if(!r.ok)throw Error("pokemon");const p=await r.json();cache.set(name,p);return p}
async function moveData(name){const k="m:"+name;if(cache.has(k))return cache.get(k);const r=await fetch(API+"/move/"+name);if(!r.ok)throw Error("move");const m=await r.json();cache.set(k,m);return m}
function sprite(p,back=false){return "/api/sprite/"+p.id+(back?"?back=1":"")}
function statsFromBase(b,l){return{hp:Math.floor((2*b.hp*l)/100)+l+10,attack:Math.floor((2*b.attack*l)/100)+5,defense:Math.floor((2*b.defense*l)/100)+5,spAttack:Math.floor((2*b["special-attack"]*l)/100)+5,spDefense:Math.floor((2*b["special-defense"]*l)/100)+5,speed:Math.floor((2*b.speed*l)/100)+5}}function stats(p,l){const b=Array.isArray(p.stats)?Object.fromEntries(p.stats.map(x=>[x.stat.name,x.base_stat])):p.stats;return statsFromBase(b,l)}
async function makeMon(name,lvl){const p=await pokemon(name);const st=stats(p,lvl);const levelMoves=[...p.moves].filter(x=>x.level<=lvl).sort((a,b)=>b.level-a.level);const moves=[];for(const q of levelMoves){if(moves.some(m=>m.name===q.name))continue;try{const m=await moveData(q.name);if(moves.length<4)moves.push({name:m.name,nameJa:m.nameJa,type:m.type,power:m.power,accuracy:m.accuracy,pp:m.pp,maxPp:m.pp,damageClass:m.damageClass,ailment:m.ailment,ailmentChance:m.ailmentChance,double:m.double,half:m.half,no:m.no})}catch{}}if(!moves.length)moves.push({name:"tackle",nameJa:"たいあたり",type:"normal",power:40,accuracy:100,pp:35,maxPp:35,damageClass:"physical",ailment:"none",ailmentChance:0,double:[],half:[],no:[]});const baseStats=Array.isArray(p.stats)?Object.fromEntries(p.stats.map(x=>[x.stat.name,x.base_stat])):p.stats;return{species:p.name,id:p.id,nameJa:p.nameJa||jp(name),types:p.types,abilities:p.abilities,baseStats,baseExp:p.baseExp||0,captureRate:p.captureRate??45,level:lvl,exp:0,stats:st,currentHp:st.hp,moves,sprite:sprite(p),backSprite:sprite(p,true)}}
async function starterList(){const box=$("starterList");box.innerHTML="";for(const n of STARTERS){const p=await pokemon(n);const b=document.createElement("button");b.className="starter-card";b.innerHTML='<img src="'+sprite(p)+'"><b>'+jp(n,p.nameJa)+'</b><span>'+p.types.join(" / ")+"</span>";b.onclick=()=>newGame(n);box.appendChild(b)}}
async function newGame(starter){state.area="town";state.x=10;state.y=11;state.money=3000;state.badges=0;state.items={potion:5,pokeball:10};state.dex=new Set();state.box=[];state.party=[await makeMon(starter,5)];state.dex.add(starter);save();show("world");renderWorld();say(jp(starter)+"といっしょに旅に出よう！")}
function save(){localStorage.setItem(SAVE,JSON.stringify({version:VERSION,area:state.area,x:state.x,y:state.y,dir:state.dir,party:state.party,box:state.box,money:state.money,badges:state.badges,items:state.items,dex:[...state.dex]}));say("セーブした。")}
async function load(){const s=JSON.parse(localStorage.getItem(SAVE)||"null");if(!s||s.version!==VERSION)return false;Object.assign(state,s);state.dex=new Set(s.dex||[]);show("world");renderWorld();say("つづきから再開した。");return true}
function px(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function grass(ctx,x,y,f){const sway=[0,1,0,-1,0,1][f%6];for(let i=0;i<6;i++){const xx=x+3+(i*7)%26,yy=y+18-(i%3)*3;px(ctx,xx+sway,yy,2,10,"#397e4b");px(ctx,xx+2+sway,yy-4,2,9,"#5eaa59");px(ctx,xx+4+sway,yy-7,2,6,"#91c96b")}}
function tile(ctx,t,x,y,f){
 const seed=(x*19+y*37)%7;
 if(t==="#"){px(ctx,x,y,32,32,"#244a38");px(ctx,x+2,y+3,28,27,"#356c43");px(ctx,x+4,y+1,24,7,"#3d7e49");px(ctx,x+7,y+5,5,5,"#559653");px(ctx,x+18,y+10,7,4,"#447f49");px(ctx,x+3,y+18,8,5,"#2b5d3b");px(ctx,x+22,y+23,7,4,"#47824a");px(ctx,x,y+29,32,3,"#214630");return}
 if(t==="."){px(ctx,x,y,32,32,"#cbb884");px(ctx,x,y+28,32,4,"#b29c6b");px(ctx,x+4+seed,y+7+(seed%4),3,2,"#e5d39d");px(ctx,x+21-seed,y+17+(seed%3),3,2,"#a88f61");px(ctx,x+12,y+24-(seed%3),2,2,"#d9c692");if(seed%3===0)px(ctx,x+27,y+5,2,2,"#b7a16e");return}
 if(t==="g"){px(ctx,x,y,32,32,"#5a9d55");px(ctx,x+2,y+2,28,28,"#70b35d");px(ctx,x+2,y+25,28,5,"#66a956");px(ctx,x+6+seed,y+6+(seed%4),2,2,"#97ca69");px(ctx,x+22-seed,y+24-(seed%3),2,2,"#4c954f");grass(ctx,x,y,f);return}
 if(t==="~"){px(ctx,x,y,32,32,"#438fae");px(ctx,x+1,y+2,30,27,"#58aec0");px(ctx,x+3,y+7+(f%4),12,2,"#a4d9d4");px(ctx,x+19,y+11+((f+2)%5),10,2,"#83cbd0");px(ctx,x+8,y+20-((f+1)%4),18,2,"#3d91ad");px(ctx,x+2,y+29,30,2,"#6ec3cb");return}
 if(t==="t"){px(ctx,x,y,32,32,"#4e8c4a");px(ctx,x+6,y+3,20,21,"#245d3c");px(ctx,x+3,y+8,26,17,"#2e7042");px(ctx,x+7,y+5,18,13,"#347d45");px(ctx,x+9,y+2,14,7,"#4c9550");px(ctx,x+7,y+8,4,3,"#65a958");px(ctx,x+20,y+14,4,3,"#438a49");px(ctx,x+12,y+22,8,10,"#765239");px(ctx,x+14,y+24,4,8,"#8b6845");return}
}
function drawHouse(ctx,x,y){px(ctx,x+4,y+12,88,52,"#694638");px(ctx,x+8,y+15,80,49,"#d9c99e");px(ctx,x+12,y+19,72,45,"#e8d9b4");
 px(ctx,x-5,y+12,106,8,"#613d3b");px(ctx,x+2,y+6,92,8,"#74423d");px(ctx,x+10,y,76,8,"#8c4a40");px(ctx,x+20,y-7,56,8,"#a95646");px(ctx,x+31,y-14,34,8,"#a95646");px(ctx,x+43,y-19,11,7,"#a95646");
 px(ctx,x+8,y+12,80,4,"#f0bd70");px(ctx,x+14,y+8,8,4,"#c76c51");px(ctx,x+72,y+8,8,4,"#c76c51");
 px(ctx,x+11,y+25,21,18,"#79513c");px(ctx,x+14,y+28,15,12,"#8dd0d0");px(ctx,x+20,y+28,3,12,"#e7d9b4");px(ctx,x+14,y+33,15,3,"#e7d9b4");
 px(ctx,x+64,y+25,21,18,"#79513c");px(ctx,x+67,y+28,15,12,"#8dd0d0");px(ctx,x+73,y+28,3,12,"#e7d9b4");px(ctx,x+67,y+33,15,3,"#e7d9b4");
 px(ctx,x+39,y+38,19,26,"#694638");px(ctx,x+42,y+42,13,22,"#52624f");px(ctx,x+51,y+51,2,2,"#e9ca79");px(ctx,x+4,y+62,88,2,"#b79d72")}
function drawCharacter(ctx,src,x,y,flip=false){let im=imgCache.get(src);if(!im){im=new Image();im.src=src;imgCache.set(src,im)}px(ctx,x+7,y+34,18,4,"#33453d");if(im.complete){ctx.save();if(flip){ctx.translate(x+32,0);ctx.scale(-1,1);ctx.drawImage(im,0,y-6,32,40)}else ctx.drawImage(im,x,y-6,32,40);ctx.restore()}}
function drawPlayer(ctx,x,y,f){const dir=state.dir||"down";const src=dir==="up"?"/assets/trainer-back.svg":dir==="left"||dir==="right"?"/assets/trainer-side.svg":"/assets/trainer-front.svg";drawCharacter(ctx,src,x,y,dir==="right")}
function drawNpc(ctx,x,y,f){drawCharacter(ctx,"/assets/researcher.svg",x,y)}
function drawOnlinePlayer(ctx,x,y,f){drawCharacter(ctx,"/assets/trainer-side.svg",x,y)}
function renderWorld(){const c=$("map"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);const f=frame%6,m=MAPS[state.area];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)tile(ctx,tileAt(x,y),x*TILE,y*TILE,f);if(state.area==="town"){drawHouse(ctx,32,42);drawHouse(ctx,480,42);drawNpc(ctx,13*TILE,5*TILE,f);drawNpc(ctx,4*TILE,9*TILE,f)}if(state.area==="lake"){drawNpc(ctx,13*TILE,7*TILE,f)}state.players.forEach(pl=>{if(pl.id===state.selfId)return;if(pl.area!==state.area)return;drawOnlinePlayer(ctx,Math.round(pl.x/100*COLS*TILE)-16,Math.round(pl.y/100*ROWS*TILE)-32,f)});drawPlayer(ctx,state.x*TILE,state.y*TILE,f);$("place").textContent=m.name;$("money").textContent=state.money+"円";$("badges").textContent="バッジ "+state.badges;renderParty()}
function renderParty(){const b=$("party");b.innerHTML=state.party.map(p=>'<div class="party-mini"><img src="'+p.sprite+'"><span>'+p.nameJa+' Lv.'+p.level+'<br>HP '+p.currentHp+'/'+p.stats.hp+'</span></div>').join("")}
function onlineMessage(m){const el=$("onlineInfo");if(!el)return;if(m){el.textContent=m;el.classList.add("online")}else{el.textContent="オフライン";el.classList.remove("online")}}
function sendOnlineMove(){if(!state.ws||state.ws.readyState!==1||state.screen!=="world")return;state.ws.send(JSON.stringify({type:"move",x:(state.x+.5)/COLS*100,y:(state.y+.5)/ROWS*100,area:state.area}))}
function connectOnline(){if(state.ws&&state.ws.readyState<=1)return;const proto=location.protocol==="https:"?"wss":"ws";state.ws=new WebSocket(proto+"://"+location.host);state.ws.addEventListener("open",()=>state.ws.send(JSON.stringify({type:"join",name:"旅人"})));state.ws.addEventListener("message",e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==="joined"){state.online=true;state.selfId=m.selfId;state.players=new Map((m.room?.players||[]).map(p=>[p.id,{...p,area:"town"}]));onlineMessage("オンライン "+(m.room?.players?.length||1)+"/8");sendOnlineMove()}else if(m.type==="player_joined"){state.players.set(m.player.id,{...m.player,area:"town"});onlineMessage("オンライン "+state.players.size+"/8")}else if(m.type==="player_moved"){const p=state.players.get(m.player.id)||{};state.players.set(m.player.id,{...p,...m.player,area:p.area||"town"});onlineMessage("オンライン "+state.players.size+"/8")}else if(m.type==="player_left"){state.players.delete(m.playerId);onlineMessage("オンライン "+state.players.size+"/8")}});state.ws.addEventListener("close",()=>{state.online=false;state.ws=null;state.players.clear();onlineMessage()});state.ws.addEventListener("error",()=>onlineMessage("接続できません"))}

function anim(){frame++;if(state.screen==="world")renderWorld();if(state.screen==="battle")drawBattle();raf=requestAnimationFrame(anim)}
function introDraw(){const c=$("scene"),ctx=c.getContext("2d"),f=frame%6;ctx.fillStyle="#8dcbd5";ctx.fillRect(0,0,640,170);ctx.fillStyle="#74aa5d";ctx.fillRect(0,170,640,190);ctx.fillStyle="#62aebd";ctx.fillRect(340,85,240,150);for(let i=0;i<35;i++){px(ctx,(i*83)%640,180+(i*37)%160,2,7,"#43894b")}px(ctx,440,42,48,75,"#e7edf0");px(ctx,452,28,24,18,"#eee");px(ctx,457,53,14,8,"#eac1a5");px(ctx,454,76,20,40,"#fff");drawPlayer(ctx,175,215,f);const p=imgCache.get("psyduck");if(p?.complete)ctx.drawImage(p,250,105,80,80);const l=imgCache.get("lotad");if(l?.complete)ctx.drawImage(l,470,135,70,70)}
const LINES=[["？？？","……ここは、ポケモンたちが集まる池。"],["アサギ博士","待ってくれ！ 君に話があるんだ。"],["アサギ博士","私はポケモンの暮らしを研究している。"],["アサギ博士","この地方では、まだ知られていないポケモンの生態がある。"],["アサギ博士","研究所に3匹のポケモンを用意してある。"],["アサギ博士","さあ、君の相棒を選んでくれ。"]];
let line=0,char=0,lastType=0;
function cutsceneStart(){show("cutscene");line=0;char=0;lastType=performance.now();for(const n of ["psyduck","lotad"])pokemon(n).then(p=>{const im=new Image();im.src=sprite(p);imgCache.set(n,im)})}
function cutsceneLoop(){introDraw();const now=performance.now();const target=LINES[line][1];if(char<target.length&&now-lastType>55){char++;lastType=now}$("speaker").textContent=LINES[line][0];$("text").textContent=target.slice(0,char);requestAnimationFrame(cutsceneLoop)}
function advance(){const target=LINES[line][1];if(char<target.length){char=target.length;return}if(line<LINES.length-1){line++;char=0;lastType=performance.now();return}show("starter");starterList()}
async function wildEncounter(){if(state.screen!=="world"||state.battle)return;const name=ENCOUNTERS[Math.floor(Math.random()*ENCOUNTERS.length)];const enemy=await makeMon(name,4+state.badges*3);state.dex.add(name);state.battle={enemy,turn:"player"};show("battle");setBattle("野生の"+enemy.nameJa+"が現れた！")}
function setBattle(t){$("battleMessage").textContent=t;renderBattleUI()}
function renderBattleUI(){const b=state.battle;if(!b)return;const p=state.party[0],e=b.enemy;$("enemyName").textContent=e.nameJa;$("enemyLevel").textContent="Lv."+e.level;$("playerName").textContent=p.nameJa;$("playerLevel").textContent="Lv."+p.level;$("enemyHP").style.width=Math.max(0,e.currentHp/e.stats.hp*100)+"%";$("playerHP").style.width=Math.max(0,p.currentHp/p.stats.hp*100)+"%"}
function drawBattle(){const c=$("battleCanvas"),ctx=c.getContext("2d");ctx.clearRect(0,0,960,540);const f=frame%6;ctx.fillStyle="#a8d1dd";ctx.fillRect(0,0,960,290);ctx.fillStyle="#80b765";ctx.fillRect(0,290,960,250);ctx.fillStyle="#6c9957";ctx.beginPath();ctx.ellipse(730,285,190,50,0,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(260,470,260,65,0,0,7);ctx.fill();const e=state.battle?.enemy,p=state.party[0];if(e)drawSprite(ctx,e.sprite,650,145,220,220,f);if(p)drawSprite(ctx,p.backSprite||p.sprite,100,290,260,260,f)}
function drawSprite(ctx,src,x,y,w,h,f){let im=imgCache.get(src);if(!im){im=new Image();im.src=src;imgCache.set(src,im)}if(im.complete)ctx.drawImage(im,x,y+(f%2),w,h)}
function firstAlive(){return state.party.findIndex(p=>p.currentHp>0)}
function effectiveness(move,defender){let mult=1;for(const t of defender.types||[]){if((move.no||[]).includes(t))mult*=0;else if((move.double||[]).includes(t))mult*=2;else if((move.half||[]).includes(t))mult*=.5}return mult}
function calcDamage(attacker,defender,move){if(move.damageClass==="status"||!move.power)return{damage:0,mult:1,critical:false};const atk=move.damageClass==="special"?attacker.stats.spAttack:attacker.stats.attack;const def=move.damageClass==="special"?defender.stats.spDefense:defender.stats.defense;const critical=Math.random()<1/24;const critMult=critical?2:1;const stab=(attacker.types||[]).includes(move.type)?1.5:1;const mult=effectiveness(move,defender);const rand=.85+Math.random()*.15;const base=Math.floor((((2*attacker.level/5+2)*move.power*atk/def)/50)+2);return{damage:mult===0?0:Math.max(1,Math.floor(base*critMult*stab*mult*rand)),mult,critical}}
async function attack(move){
 const b=state.battle;if(!b)return;const p=state.party[0],e=b.enemy;
 if(move.pp<=0){setBattle("その技のPPがない！");return}
 move.pp--;const hit=Math.random()*100<=move.accuracy;
 if(!hit){setBattle(p.nameJa+"の"+move.nameJa+"！ しかし、こうげきは外れた！");setTimeout(enemyTurn,650);return}
 if(move.damageClass==="status"||!move.power){setBattle(p.nameJa+"の"+move.nameJa+"！");setTimeout(enemyTurn,650);return}
 const r=calcDamage(p,e,move);e.currentHp=Math.max(0,e.currentHp-r.damage);
 let text=p.nameJa+"の"+move.nameJa+"！ "+(r.damage?"こうげき！":"こうかがない！");
 if(r.critical)text+=" 急所に当たった！";
 if(r.mult===0)text+=" 効果がないようだ。";else if(r.mult>=2)text+=" 効果はばつぐんだ！";else if(r.mult<1)text+=" 効果はいまひとつのようだ。";
 setBattle(text);
 if(e.currentHp<=0){gainExp(p,e).then(()=>{setTimeout(()=>{state.battle=null;show("world");say("野生の"+e.nameJa+"を倒した！");save()},1100)});return}
 setTimeout(enemyTurn,750)
}
async function enemyTurn(){
 const b=state.battle;if(!b)return;const p=state.party[0],e=b.enemy;
 const alive=firstAlive();if(alive<0)return;
 const usable=e.moves.find(m=>m.pp>0)||e.moves[0];if(usable.pp>0)usable.pp--;
 const hit=Math.random()*100<=usable.accuracy;
 if(!hit){setBattle("野生の"+e.nameJa+"の"+usable.nameJa+"！ しかし、こうげきは外れた！");return}
 if(usable.damageClass==="status"||!usable.power){setBattle("野生の"+e.nameJa+"の"+usable.nameJa+"！");return}
 const r=calcDamage(e,p,usable);p.currentHp=Math.max(0,p.currentHp-r.damage);
 let text="野生の"+e.nameJa+"の"+usable.nameJa+"！";
 if(r.critical)text+=" 急所に当たった！";if(r.mult===0)text+=" 効果がない！";else if(r.mult>=2)text+=" 効果はばつぐんだ！";else if(r.mult<1)text+=" 効果はいまひとつのようだ！";
 setBattle(text);
 if(p.currentHp<=0){setTimeout(()=>{p.currentHp=p.stats.hp;state.battle=null;show("world");say("目の前がまっくらになった…… ポケモンセンターへ戻った。");save()},1000)}
}
async function gainExp(p,e){const gained=Math.max(1,Math.floor((e.baseExp||20)*e.level/7));p.exp=(p.exp||0)+gained;let leveled=false;while(p.exp>=p.level*p.level*10){p.exp-=p.level*p.level*10;const oldHp=p.stats.hp;p.level++;p.stats=statsFromBase(p.baseStats,p.level);p.currentHp=Math.min(p.stats.hp,p.currentHp+(p.stats.hp-oldHp));leveled=true}if(leveled){const chain=p.evolutionChain||[];const at=chain.findIndex(x=>x.name===p.species);const next=at>=0?chain[at+1]:null;const req=next?.details?.find(d=>Number.isFinite(d.min_level))?.min_level;if(next&&req&&p.level>=req){try{const oldExp=p.exp,oldUid=p.uid||("m"+Date.now());const evo=await makeMon(next.name,p.level);Object.assign(p,evo,{uid:oldUid,exp:oldExp});setBattle(p.nameJa+"は "+evo.nameJa+" に進化した！");return}catch{}}setBattle(p.nameJa+"は Lv."+p.level+" に上がった！")}else setBattle(p.nameJa+"は "+gained+" の経験値を得た！")}
function captureChance(mon){const hp=Math.max(0,mon.currentHp/mon.stats.hp),rate=Math.max(1,mon.captureRate||45);return Math.min(.95,(1-hp)*rate/255+.08)}
function tryCatch(){const b=state.battle;if(!b||state.items.pokeball<=0)return false;state.items.pokeball--;const e=b.enemy;if(Math.random()<captureChance(e)){const toParty=state.party.length<6;if(toParty)state.party.push(e);else state.box.push(e);state.battle=null;show("world");say(e.nameJa+"をつかまえた！ "+(toParty?"てもちに加えた。":"ボックスに送った。"));save();return true}setBattle("ボールから出てしまった！");setTimeout(enemyTurn,750);return false}
function showMoves(){const box=$("moves");box.classList.remove("hidden");$("battleCommands").classList.add("hidden");box.innerHTML=state.party[0].moves.map((m,i)=>'<button data-move="'+i+'" '+(m.pp<=0?"disabled":"")+'>'+m.nameJa+'<br><small>'+TYPE_JA[m.type]+' '+m.pp+'/'+m.maxPp+' PP</small></button>').join("")+'<button data-back="1">もどる</button>';box.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{if(b.dataset.back){box.classList.add("hidden");$("battleCommands").classList.remove("hidden");return}const m=state.party[0].moves[+b.dataset.move];box.classList.add("hidden");$("battleCommands").classList.remove("hidden");attack(m)})}
function menuOpen(){ $("menuPanel").classList.remove("hidden");$("menuInfo").textContent="図鑑 "+state.dex.size+"匹 / バッジ "+state.badges}
document.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(state.screen==="world"){if(k==="arrowup"||k==="w")stepDir(0,-1);else if(k==="arrowdown"||k==="s")stepDir(0,1);else if(k==="arrowleft"||k==="a")stepDir(-1,0);else if(k==="arrowright"||k==="d")stepDir(1,0);else if(k==="e"||k==="enter"){
  const t=tileAt(state.x,state.y);
  const ahead={up:[state.x,state.y-1],down:[state.x,state.y+1],left:[state.x-1,state.y],right:[state.x+1,state.y]}[state.dir];
  const at=tileAt(...ahead);
  if(state.area==="town"&&at==="~"){say("小さな池だ。ポケモンの気配がする。")}
  else if(state.area==="town"&&state.x>=2&&state.x<=4&&state.y>=2&&state.y<=3)say("ポケモンセンター。やすませていこう。")
  else if(state.area==="town"&&state.x>=15&&state.y<=4)say("アサギ博士の研究所。ポケモンの研究資料が並んでいる。")
  else if(t==="~")say("水面がきらきら光っている。")
  else if(t==="g"||at==="g")say("草むらだ。野生のポケモンが潜んでいるかもしれない。")
  else if(at==="#"||at==="t")say("道具や建物の一部が見える。")
  else say("周囲を調べた。");
}else if(k==="escape")menuOpen()}else if(state.screen==="cutscene"&&(k==="enter"||k==="a"||e.key===" ")){advance()}else if(state.screen==="battle"&&e.key==="Escape"){show("world");state.battle=null}});
$("online").onclick=connectOnline;document.querySelectorAll("[data-touch]").forEach(b=>b.addEventListener("click",()=>{const d=b.dataset.touch;stepDir(d==="up"?0:d==="down"?0:d==="left"?-1:1,d==="up"?-1:d==="down"?1:0)}));
$("start").onclick=cutsceneStart;$("sceneNext").onclick=advance;$("sceneSkip").onclick=()=>{show("starter");starterList()};$("continue").onclick=()=>load().then(ok=>{if(!ok)cutsceneStart()});$("save").onclick=save;$("menu").onclick=menuOpen;$("closeMenu").onclick=()=>$("menuPanel").classList.add("hidden");$("closeMenu2").onclick=()=>$("menuPanel").classList.add("hidden");$("heal").onclick=()=>{state.party.forEach(p=>p.currentHp=p.stats.hp);$("menuPanel").classList.add("hidden");say("ポケモンの体力が回復した！")};$("dex").onclick=()=>{$("menuInfo").textContent=[...state.dex].map(n=>jp(n)).join("、")||"まだ登録されていない。"};document.querySelectorAll("[data-cmd]").forEach(b=>b.onclick=()=>{const c=b.dataset.cmd;if(c==="fight")showMoves();else if(c==="run"){state.battle=null;show("world");say("うまく逃げ切れた！")}else if(c==="bag"){$("bag").classList.remove("hidden");$("battleCommands").classList.add("hidden")}else if(c==="pokemon"){const alive=state.party.findIndex(p=>p.currentHp>0);if(alive>0){state.party.unshift(state.party.splice(alive,1)[0]);renderBattleUI();setBattle("ポケモンを入れ替えた！")}}});$("bag").querySelector('[data-item="back"]').onclick=()=>{$("bag").classList.add("hidden");$("battleCommands").classList.remove("hidden")};$("bag").querySelector('[data-item="potion"]').onclick=()=>{if(state.items.potion<=0){setBattle("キズぐすりがない！");return}state.items.potion--;const p=state.party[0];p.currentHp=Math.min(p.stats.hp,p.currentHp+20);setBattle("キズぐすりを使った！");$("bag").classList.add("hidden");$("battleCommands").classList.remove("hidden");setTimeout(enemyTurn,600)};$("bag").querySelector('[data-item="pokeball"]').onclick=()=>{if(state.battle?.enemy&&state.items.pokeball>0)tryCatch()};window.addEventListener("load",()=>{starterList();raf=requestAnimationFrame(anim);cutsceneLoop()});