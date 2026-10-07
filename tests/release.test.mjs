import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname);
test("release structure",()=>{
  for(const file of ["index.html","styles.css","game.js","server.js","package.json","render.yaml"])
    assert.equal(fs.existsSync(path.join(root,file)),true,file);
  assert.equal(fs.existsSync(path.join(root,"data.js")),false);
  assert.equal(fs.existsSync(path.join(root,"game-data.js")),false);
  assert.equal(fs.existsSync(path.join(root,"pokeapi.js")),false);
});
test("package is valid",()=>{
  const p=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  assert.equal(p.type,"module");assert.ok(p.scripts.start);assert.ok(p.scripts.test);
});
test("html references only current client",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.match(html,/src="\/game\.js"/);assert.match(html,/href="\/styles\.css"/);assert.match(html,/introCanvas/);assert.match(html,/introSpeaker/);
  assert.doesNotMatch(html,/game-data\.js|pokeapi\.js/);
});
test("client/server contracts are present",()=>{
  const js=fs.readFileSync(path.join(root,"game.js"),"utf8");
  const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
  assert.match(js,/\/api\/pokemon\//);assert.match(js,/\/api\/move\//);assert.match(js,/data-battle/);
  assert.match(server,/\/api\/pokemon\/:name/);assert.match(server,/\/api\/move\/:name/);assert.match(server,/\/api\/sprite\/:id/);assert.match(server,/\/health/);
  assert.doesNotMatch(js,/pokeapi\.co|raw\.githubusercontent\.com/);
});