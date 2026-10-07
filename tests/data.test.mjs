import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTERS,AREAS,stats,typeMultiplier,monsterById} from '../data.js';
test('catalog is consistent',()=>{assert.equal(new Set(MONSTERS.map(m=>m.id)).size,MONSTERS.length);for(const m of MONSTERS){assert.ok(m.name);assert.ok(m.base.hp>0);assert.ok(m.moves.length>=2)}for(const a of AREAS){assert.ok(monsterById(a.boss));for(const id of a.encounters)assert.ok(monsterById(id))}});
test('level stats grow',()=>assert.ok(stats(MONSTERS[0],10).hp>stats(MONSTERS[0],1).hp));
test('type chart works',()=>{assert.equal(typeMultiplier('ほのお','くさ'),2);assert.equal(typeMultiplier('ほのお','みず'),.5);assert.equal(typeMultiplier('かげ','せいれい'),2);assert.equal(typeMultiplier('みず','せいれい'),1)})