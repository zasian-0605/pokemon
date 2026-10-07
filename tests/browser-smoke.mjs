import crypto from "node:crypto";

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function cdpPage(){
  const pages=await (await fetch("http://127.0.0.1:9222/json/list")).json();
  const p=pages.find(x=>x.type==="page");
  if(!p)throw new Error("Chromium page not found");
  const ws=new WebSocket(p.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error("CDP connect timeout")),5000);ws.addEventListener("open",()=>{clearTimeout(t);resolve()})});
  let id=0;
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const rid=++id;
    const timer=setTimeout(()=>reject(new Error("CDP timeout: "+method)),10000);
    const onmsg=e=>{
      const m=JSON.parse(e.data);
      if(m.id===rid){clearTimeout(timer);ws.removeEventListener("message",onmsg);resolve(m)}
    };
    ws.addEventListener("message",onmsg);
    ws.send(JSON.stringify({id:rid,method,params}));
  });
  const evalJS=async expression=>{
    const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    const out=r?.result?.result;
    if(out?.subtype==="error")throw new Error(out.description||"Runtime error");
    return out?.value;
  };
  return {send,evalJS,close:()=>ws.close()};
}

const p=await cdpPage();
await p.send("Page.enable");
await p.send("Runtime.enable");
await p.evalJS("(window.__e2eErrors=[] , window.addEventListener('error',e=>window.__e2eErrors.push(e.message||String(e.error))), window.addEventListener('unhandledrejection',e=>window.__e2eErrors.push(String(e.reason))), true)");
await p.send("Page.navigate",{url:"http://127.0.0.1:4173"});
await sleep(1500);

const title=await p.evalJS("document.title");
if(!title.includes("ポケットモンスター"))throw new Error("title screen did not load");

const newGame=await p.evalJS("!!document.getElementById('newGame')");
if(!newGame)throw new Error("new game button missing");
await p.evalJS("document.getElementById('newGame').click()");
await sleep(700);

const intro=await p.evalJS("!document.getElementById('introScreen').classList.contains('hidden')");
if(!intro)throw new Error("intro screen did not open");

const introHasCanvas=await p.evalJS("!!document.getElementById('introCanvas')");
if(!introHasCanvas)throw new Error("intro canvas missing");

// Advance the actual cutscene according to its typewriter behavior.
for(let i=0;i<24;i++){
  const done=await p.evalJS("!document.getElementById('starterScreen').classList.contains('hidden')");
  if(done)break;
  await p.evalJS("document.getElementById('introNext')?.click()");
  await sleep(260);
}
const starterVisible=await p.evalJS("!document.getElementById('starterScreen').classList.contains('hidden')");
if(!starterVisible)throw new Error("starter screen did not open after cutscene controls");
const starterCount=await p.evalJS("document.querySelectorAll('#starterGrid .starter-card').length");
if(starterCount<3)throw new Error("starter cards did not load: "+starterCount);

await p.evalJS("document.querySelector('#starterGrid .starter-card').click()");
let gameVisible=false;
for(let i=0;i<40;i++){
  gameVisible=await p.evalJS("!document.getElementById('gameScreen').classList.contains('hidden')");
  if(gameVisible)break;
  await sleep(500);
}
if(!gameVisible){
  const stateText=await p.evalJS("([...document.querySelectorAll('.screen')].map(x=>x.id+':'+x.className).join(' || '))");
  const partyText=await p.evalJS("document.getElementById('partyList')?.innerText||''");
  throw new Error("game screen did not open; screens="+stateText+" party="+partyText);
}

const computed=await p.evalJS("(()=>{const a=getComputedStyle(document.querySelector('.battle-card')||document.querySelector('.field-box'));return {display:a.display,border:a.borderRadius}})()");
if(!computed.border)throw new Error("current CSS did not apply to active game elements");

const frame1=await p.evalJS("document.getElementById('field').toDataURL('image/png')");
await sleep(220);
const frame2=await p.evalJS("document.getElementById('field').toDataURL('image/png')");
if(frame1===frame2)throw new Error("field animation frame did not change");

for(let i=0;i<12;i++){
  await p.evalJS("window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
  await sleep(90);
}
const frame3=await p.evalJS("document.getElementById('field').toDataURL('image/png')");
if(frame3===frame2)throw new Error("field did not redraw after movement");

const errList=await p.evalJS("window.__e2eErrors||[]");
if(errList.length)throw new Error("browser errors: "+JSON.stringify(errList));
console.log(JSON.stringify({title,intro,starterCount,gameVisible,computed,animated:true,moved:true,errCount:errList.length}));

p.close();