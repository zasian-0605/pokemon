
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, ".pokeapi", "data", "api", "v2");
const out = path.join(root, "data");

async function readJsonFiles(dirName) {
  const base = path.join(src, dirName);
  const dirs = await fs.readdir(base, { withFileTypes: true });
  const result = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    try { result.push(JSON.parse(await fs.readFile(path.join(base, d.name, "index.json"), "utf8"))); } catch {}
  }
  return result;
}

function id(url) {
  const m = String(url || "").match(/\/(\d+)\/?$/);
  return m ? Number(m[1]) : 0;
}

function jp(names, fallback) {
  for (const lang of ["ja-Hrkt", "ja"]) {
    const x = (names || []).find(v => v && v.language && v.language.name === lang);
    if (x && x.name) return x.name;
  }
  return fallback;
}

function statMap(list) {
  const s = {hp:1, attack:1, defense:1, spAtk:1, spDef:1, speed:1};
  for (const x of list || []) {
    const n = x.stat && x.stat.name;
    if (n === "special-attack") s.spAtk = x.base_stat;
    else if (n === "special-defense") s.spDef = x.base_stat;
    else if (n in s) s[n] = x.base_stat;
  }
  return s;
}

await fs.rm(out, {recursive:true, force:true});
await fs.mkdir(out, {recursive:true});

const [rawPokemon, rawSpecies, rawMoves, rawTypes, rawForms] = await Promise.all([
  readJsonFiles("pokemon"),
  readJsonFiles("pokemon-species"),
  readJsonFiles("move"),
  readJsonFiles("type"),
  readJsonFiles("pokemon-form")
]);

const species = new Map(rawSpecies.map(x => [Number(x.id), x]));
const pokemon = rawPokemon.map(p => {
  const speciesId = id(p.species && p.species.url) || p.id;
  const s = species.get(speciesId);
  return {
    id:p.id,
    name:p.name,
    jpName:jp(s && s.names,p.name),
    speciesId:speciesId,
    types:(p.types || []).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),
    abilities:(p.abilities || []).map(x=>x.ability.name),
    stats:statMap(p.stats),
    isDefault:Boolean(p.is_default),
    moves:(p.moves || []).map(x=>({
      name:x.move.name,
      levels:(x.version_group_details || [])
        .filter(v=>v.move_learn_method && v.move_learn_method.name==="level-up")
        .map(v=>Number(v.level_learned_at)||0)
    })),
    speciesInfo:{
      genus:jp(s && s.genera,""),
      isLegendary:Boolean(s && s.is_legendary),
      isMythical:Boolean(s && s.is_mythical),
      generation:s && s.generation ? s.generation.name : "",
      evolutionChainId:id(s && s.evolution_chain && s.evolution_chain.url)
    }
  };
}).sort((a,b)=>a.id-b.id);

const moves = {};
for (const m of rawMoves) {
  moves[m.name] = {
    id:m.id,
    name:m.name,
    jpName:jp(m.names,m.name),
    type:m.type && m.type.name || "normal",
    power:Number(m.power)||0,
    accuracy:m.accuracy == null ? 100 : Number(m.accuracy),
    pp:Number(m.pp)||0,
    priority:Number(m.priority)||0,
    damageClass:m.damage_class && m.damage_class.name || "status",
    effectChance:Number(m.effect_chance)||0
  };
}

const types = {};
for (const t of rawTypes) {
  types[t.name] = {
    id:t.id,
    jpName:jp(t.names,t.name),
    double:(t.damage_relations && t.damage_relations.double_damage_to || []).map(x=>x.name),
    half:(t.damage_relations && t.damage_relations.half_damage_to || []).map(x=>x.name),
    no:(t.damage_relations && t.damage_relations.no_damage_to || []).map(x=>x.name)
  };
}

const speciesOut = {};
for (const s of rawSpecies) {
  speciesOut[String(s.id)] = {
    id:s.id,name:s.name,jpName:jp(s.names,s.name),
    genus:jp(s.genera,""),
    generation:s.generation && s.generation.name || "",
    evolutionChainId:id(s.evolution_chain && s.evolution_chain.url),
    evolvesFromSpeciesId:id(s.evolves_from_species && s.evolves_from_species.url),
    isLegendary:Boolean(s.is_legendary),
    isMythical:Boolean(s.is_mythical),
    captureRate:Number(s.capture_rate)||0
  };
}

const forms = rawForms.map(f=>({
  id:f.id,name:f.name,jpName:jp(f.names,f.name),formName:f.form_name||"",
  jpFormName:jp(f.form_names,f.form_name||""),
  pokemonId:id(f.pokemon && f.pokemon.url),pokemonName:f.pokemon && f.pokemon.name || "",
  isDefault:Boolean(f.is_default),isBattleOnly:Boolean(f.is_battle_only),isMega:Boolean(f.is_mega),
  types:(f.types || []).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name)
})).sort((a,b)=>a.id-b.id);

await fs.writeFile(path.join(out,"pokemon.json"),JSON.stringify(pokemon));
await fs.writeFile(path.join(out,"moves.json"),JSON.stringify(moves));
await fs.writeFile(path.join(out,"types.json"),JSON.stringify(types));
await fs.writeFile(path.join(out,"species.json"),JSON.stringify(speciesOut));
await fs.writeFile(path.join(out,"forms.json"),JSON.stringify(forms));
await fs.writeFile(path.join(out,"meta.json"),JSON.stringify({
  source:"PokeAPI/api-data",generatedAt:new Date().toISOString(),
  pokemonCount:pokemon.length,moveCount:Object.keys(moves).length,
  typeCount:Object.keys(types).length,speciesCount:Object.keys(speciesOut).length,formCount:forms.length
},null,2));

console.log("Local PokeAPI dataset built:", pokemon.length, "pokemon,", Object.keys(moves).length, "moves,", forms.length, "forms");
