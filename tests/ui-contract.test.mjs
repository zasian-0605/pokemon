import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
test('UI contracts are complete',()=>{
  const ids=new Set([...html.matchAll(/id=["']([^"']+)["']/g)].map(m=>m[1]));
  const refs=[...js.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
  assert.deepEqual(refs.filter(x=>!ids.has(x)),[]);
  assert.equal((html.match(/<script/g)||[]).length,(html.match(/<\/script>/g)||[]).length);
});
test('release has no external runtime URLs',()=>{
  for(const file of ['index.html','game.js','data.js','styles.css','server.js'])
    assert.equal(/https?:\/\//.test(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8')),false,file);
});