import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

class ClassList {
  constructor(){this.s=new Set()}
  add(...xs){xs.forEach(x=>this.s.add(x))}
  remove(...xs){xs.forEach(x=>this.s.delete(x))}
  toggle(x){this.s.has(x)?this.s.delete(x):this.s.add(x);return this.s.has(x)}
  contains(x){return this.s.has(x)}
}
class El {
  constructor(id=''){this.id=id;this.style={};this.classList=new ClassList();this.textContent='';this.innerHTML='';this.value='';this.dataset={};this.children=[];this.parentNode=null;this.onclick=null;this._listeners={}}
  appendChild(c){c.parentNode=this;this.children.push(c);return c}
  insertAdjacentHTML(_pos,html){this.innerHTML+=html}
  addEventListener(type,fn){(this._listeners[type]??=[]).push(fn)}
  get scrollHeight(){return this.children.length*20}
}

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/id=["']([^"']+)["']/g)].map(m=>m[1]);
const els=new Map(ids.map(id=>[id,new El(id)]));
const moves=['up','left','down','right'].map(d=>{const e=new El();e.dataset.move=d;return e});
const actions=['fight','talk','catch','item','run'].map(a=>{const e=new El();e.dataset.action=a;return e});
const starterList=els.get('starterList');
const eventMap=new Map();
globalThis.document={
  getElementById(id){return els.get(id)??new El(id)},
  createElement(){return new El()},
  querySelectorAll(sel){if(sel==='[data-move]')return moves;if(sel==='[data-action]')return actions;return []},
  addEventListener(type,fn){if(!eventMap.has(type))eventMap.set(type,[]);eventMap.get(type).push(fn)}
};
const store=new Map();
globalThis.localStorage={setItem(k,v){store.set(k,String(v))},getItem(k){return store.get(k)??null}};
let rand=0.99;const oldRandom=Math.random;Math.random=()=>rand;
await import('../game.js?smoke='+Date.now());
const dispatch=(type,evt)=>{for(const fn of eventMap.get(type)||[])fn(evt)};

test('full local smoke flow',()=>{
  assert.equal(starterList.children.length,3);
  els.get('newGameBtn').onclick();
  starterList.children[0].onclick();
  assert.equal(els.get('gameScreen').classList.contains('hidden'),false);
  assert.equal(els.get('partyCount').textContent,'1 / 6');
  rand=0.01;
  moves.find(x=>x.dataset.move==='left').onclick();
  moves.find(x=>x.dataset.move==='left').onclick();
  assert.equal(els.get('battleScreen').classList.contains('hidden'),false);
  actions.find(x=>x.dataset.action==='talk').onclick();
  actions.find(x=>x.dataset.action==='catch').onclick();
  assert.equal(els.get('battleScreen').classList.contains('hidden'),true);
  els.get('bagBtn').onclick();
  assert.equal(els.get('modal').classList.contains('hidden'),false);
  els.get('modalClose').onclick();
  els.get('saveBtn').onclick();
  assert.ok(store.get('monster-veil-save'));
  els.get('loadGameBtn').onclick();
  assert.equal(els.get('gameScreen').classList.contains('hidden'),false);
  dispatch('keydown',{key:'ArrowRight',target:{tagName:'BODY'}});
  assert.match(els.get('areaName').textContent,/.+/);
  Math.random=oldRandom;
});