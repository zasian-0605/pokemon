const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const POKE_CACHE_PREFIX = "pokemon-wild-world-pokeapi:";
const POKE_LIST_KEY = POKE_CACHE_PREFIX + "list-v1";

window.PokeData = {
  list: [],
  byName: new Map(),
  loading: null,
  async init() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(POKE_LIST_KEY) || "null");
        if (cached?.results?.length) {
          this.list = cached.results;
        } else {
          const res = await fetch(POKEAPI_BASE + "/pokemon?limit=2000");
          if (!res.ok) throw new Error("PokeAPI list failed");
          const data = await res.json();
          this.list = data.results || [];
          localStorage.setItem(POKE_LIST_KEY, JSON.stringify(data));
        }
        await Promise.allSettled([
          this.get("bulbasaur"),
          this.get("pikachu"),
          this.get("eevee")
        ]);
        return this.list;
      } catch (err) {
        console.warn("PokeAPI initialization failed:", err);
        return this.list;
      }
    })();
    return this.loading;
  },
  async get(nameOrUrl) {
    const key = String(nameOrUrl).toLowerCase();
    if (this.byName.has(key)) return this.byName.get(key);
    const cacheKey = POKE_CACHE_PREFIX + key;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached) {
        this.byName.set(key, cached);
        return cached;
      }
      const url = key.startsWith("http") ? key : POKEAPI_BASE + "/pokemon/" + encodeURIComponent(key);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Pokémon not found: " + key);
      const data = await res.json();
      const normalized = {
        id: data.id,
        name: data.name,
        names: {},
        types: (data.types || []).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),
        abilities: (data.abilities || []).map(x=>x.ability.name),
        stats: Object.fromEntries((data.stats || []).map(x=>[x.stat.name, x.base_stat])),
        moves: (data.moves || []).map(x=>x.move.name),
        forms: (data.forms || []).map(x=>x.name),
        speciesUrl: data.species?.url || null,
        sprite: data.sprites?.front_default || null,
        cries: data.cries || {}
      };
      this.byName.set(key, normalized);
      localStorage.setItem(cacheKey, JSON.stringify(normalized));
      return normalized;
    } catch (err) {
      console.warn(err);
      return null;
    }
  },
  async speciesNames(speciesUrl) {
    if (!speciesUrl) return {};
    const key = POKE_CACHE_PREFIX + "species:" + speciesUrl;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      if (cached) return cached;
      const res = await fetch(speciesUrl);
      if (!res.ok) return {};
      const data = await res.json();
      const names = {};
      for (const n of data.names || []) names[n.language.name] = n.name;
      localStorage.setItem(key, JSON.stringify(names));
      return names;
    } catch { return {}; }
  },
  async enrich(pokemon) {
    if (!pokemon) return null;
    if (!pokemon.names?.ja && pokemon.speciesUrl) pokemon.names = await this.speciesNames(pokemon.speciesUrl);
    return pokemon;
  },
  random() {
    if (!this.list.length) return null;
    return this.list[Math.floor(Math.random() * this.list.length)];
  }
};
