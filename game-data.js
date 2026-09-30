
const API = "https://pokeapi.co/api/v2";
const state = {
  source: "unavailable",
  pokemon: [],
  byId: new Map(),
  byName: new Map(),
  moves: new Map(),
  types: new Map(),
  species: new Map(),
  forms: []
};

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function addPokemon(p) {
  state.byId.set(Number(p.id), p);
  if (p.name) state.byName.set(p.name.toLowerCase(), p);
}

function localPokemon(idOrName) {
  const k = String(idOrName).toLowerCase();
  return /^\d+$/.test(k) ? state.byId.get(Number(k)) : state.byName.get(k);
}

function jpName(names, fallback) {
  for (const lang of ["ja-Hrkt", "ja"]) {
    const x = (names || []).find(v => v && v.language && v.language.name === lang);
    if (x && x.name) return x.name;
  }
  return fallback;
}

function stats(list) {
  const s = {hp:1, attack:1, defense:1, spAtk:1, spDef:1, speed:1};
  for (const x of list || []) {
    const n = x.stat && x.stat.name;
    if (n === "special-attack") s.spAtk = x.base_stat;
    else if (n === "special-defense") s.spDef = x.base_stat;
    else if (n in s) s[n] = x.base_stat;
  }
  return s;
}

async function loadLocal() {
  const [pokemon,moves,types,species,forms] = await Promise.all([
    json("./data/pokemon.json"),
    json("./data/moves.json").catch(() => ({})),
    json("./data/types.json").catch(() => ({})),
    json("./data/species.json").catch(() => ({})),
    json("./data/forms.json").catch(() => [])
  ]);
  state.pokemon = pokemon;
  state.byId.clear();
  state.byName.clear();
  for (const p of state.pokemon) addPokemon(p);
  state.moves = new Map(Object.entries(moves));
  state.types = new Map(Object.entries(types));
  state.species = new Map(Object.entries(species));
  state.forms = Array.isArray(forms) ? forms : [];
  if (!state.pokemon.length) throw new Error("empty dataset");
  state.source = "local";
}

async function remotePokemon(idOrName) {
  const raw = await json(API + "/pokemon/" + encodeURIComponent(String(idOrName)));
  let sp = null;
  if (raw.species && raw.species.url) {
    try { sp = await json(raw.species.url); } catch {}
  }
  const p = {
    id: raw.id,
    name: raw.name,
    jpName: jpName(sp && sp.names, raw.name),
    types: (raw.types || []).sort((a,b) => a.slot-b.slot).map(x => x.type.name),
    abilities: (raw.abilities || []).map(x => x.ability.name),
    stats: stats(raw.stats),
    moves: (raw.moves || []).map(x => ({name:x.move.name, levels:[]}))
  };
  addPokemon(p);
  return p;
}

async function remoteMove(idOrName) {
  const raw = await json(API + "/move/" + encodeURIComponent(String(idOrName)));
  return {
    id:raw.id,
    name:raw.name,
    jpName:jpName(raw.names, raw.name),
    type:raw.type && raw.type.name || "normal",
    power:Number(raw.power) || 0,
    accuracy:raw.accuracy == null ? 100 : Number(raw.accuracy),
    damageClass:raw.damage_class && raw.damage_class.name || "status"
  };
}

function multiplier(moveType, defenderTypes) {
  const rel = state.types.get(moveType);
  if (!rel) return 1;
  let x = 1;
  for (const t of defenderTypes || []) {
    if ((rel.double || []).includes(t)) x *= 2;
    if ((rel.half || []).includes(t)) x *= 0.5;
    if ((rel.no || []).includes(t)) x *= 0;
  }
  return x;
}

const PokeData = {
  state,
  async init() {
    try {
      await loadLocal();
    } catch (e) {
      state.source = "remote";
      try {
        const list = await json(API + "/pokemon?limit=2000");
        state.pokemon = list.results || [];
      } catch {
        state.source = "unavailable";
      }
    }
    return state;
  },
  async get(idOrName) {
    return localPokemon(idOrName) || remotePokemon(idOrName);
  },
  async move(idOrName) {
    const k = String(idOrName).toLowerCase();
    return state.moves.get(k) || remoteMove(idOrName);
  },
  multiplier,
  random(filter) {
    const pool = state.pokemon.filter(p => p && p.name && (!filter || filter(p)));
    return pool.length ? pool[Math.floor(Math.random()*pool.length)] : null;
  },
  movesFor(p, level) {
    const list = [];
    const seen = new Set();
    for (const m of (p.moves || [])) {
      if (!m || !m.name || seen.has(m.name)) continue;
      if (m.levels && m.levels.length && Math.min.apply(null,m.levels) > level) continue;
      const local = state.moves.get(m.name);
      if (local && Number(local.power) <= 0) continue;
      seen.add(m.name);
      list.push(m.name);
      if (list.length === 4) break;
    }
    return list.length ? list : ["tackle","quick-attack","bite","scratch"];
  }
};

window.PokeData = PokeData;
