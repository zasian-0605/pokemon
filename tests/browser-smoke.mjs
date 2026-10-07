const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function page(){const ps=await(await fetch("http://127.0.0.1:9222/json/list")).json(),p=ps.find(x=>x.type==="page");if(!p)throw Error("no page");const ws=new WebSocket(p.webSocketDebuggerUrl);await new Promise((a,b)=>{ws.onopen=a;ws.onerror=b});let id=0;const call=(method,params={})=>new Promise((a,b)=>{const i=++id,t=setTimeout(()=>b(Error("timeout "+method)),10000),fn=e=>{const m=JSON.parse(e.data);if(m.id===i){clearTimeout(t);ws.removeEventListener("message",fn);a(m)}};ws.addEventListener("message",fn);ws.send(JSON.stringify({id:i,method,params}))});const ev=x=>call("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true}).then(r=>r.result.result.value);return{call,ev,close:()=>ws.close()}}
const p=await page();await p.call("Page.navigate",{url:"http://127.0.0.1:4173"});await sleep(1200);
if(!(await p.ev("document.getElementById('title')&&!document.getElementById('title').classList.contains('hidden')")))throw Error("title");
await p.ev("document.getElementById('start').click()");await sleep(500);
if(!(await p.ev("!document.getElementById('cutscene').classList.contains('hidden')")))throw Error("cutscene");
for(let i=0;i<20;i++){await p.ev("document.getElementById('sceneNext').click()");await sleep(180);if(await p.ev("!document.getElementById('starter').classList.contains('hidden')"))break}
if(!(await p.ev("!document.getElementById('starter').classList.contains('hidden')")))throw Error("starter");
const count=await p.ev("document.querySelectorAll('.starter-card').length");if(count!==3)throw Error("starter count "+count);
await p.ev("document.querySelector('.starter-card').click()");await sleep(1200);
if(!(await p.ev("!document.getElementById('world').classList.contains('hidden')")))throw Error("world");
const a=await p.ev("document.getElementById('map').toDataURL()");await sleep(200);const b=await p.ev("document.getElementById('map').toDataURL()");if(a===b)throw Error("animation");
for(const k of ["ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown"]){await p.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`);await sleep(80)}
await p.ev("Math.random=()=>0");for(let i=0;i<8;i++){await p.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");await sleep(100)}
await sleep(900);
const err=await p.ev("window.__e2eErrors||[]");if(err?.length)throw Error("browser errors "+JSON.stringify(err));
console.log("BROWSER_SMOKE_OK",JSON.stringify({starterCount:count,world:true,animationChanged:true}));p.close();