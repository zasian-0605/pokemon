import express from "express";

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const API = "https://pokeapi.co/api/v2";
const cache = new Map();

async function getJson(url, attempt = 0) {
  if (cache.has(url)) return cache.get(url);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "pokemon-data-exporter/1.0" } });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    const value = await response.json();
    cache.set(url, value);
    return value;
  } catch (error) {
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      return getJson(url, attempt + 1);
    }
    throw error;
  }
}

async function mapLimit(items, limit, task) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function jaName(names, fallback) {
  return (names || []).find(x => x.language?.name === "ja-Hrkt")?.name
    || (names || []).find(x => x.language?.name === "ja")?.name
    || fallback;
}
function englishEffect(entries) {
  return (entries || []).find(x => x.language?.name === "en")?.effect || "";
}
function japaneseFlavor(entries) {
  return (entries || []).find(x => x.language?.name === "ja")?.flavor_text
    || (entries || []).find(x => x.language?.name === "ja-Hrkt")?.flavor_text || "";
}

async function exportData(kind, res) {
  const endpoint = kind === "moves" ? "move" : "ability";
  try {
    const index = await getJson(`${API}/${endpoint}?limit=100000`);
    const entries = await mapLimit(index.results || [], 10, async item => {
      const data = await getJson(item.url);
      return kind === "moves" ? {
        id: data.id, name: data.name, nameJa: jaName(data.names, data.name),
        type: data.type?.name || null, power: data.power, accuracy: data.accuracy,
        pp: data.pp, priority: data.priority, damageClass: data.damage_class?.name || null,
        target: data.target?.name || null, effect: englishEffect(data.effect_entries),
        effectChance: data.effect_chance, flavorJa: japaneseFlavor(data.flavor_text_entries),
        meta: data.meta ? {
          ailment: data.meta.ailment?.name || "none",
          ailmentChance: data.meta.ailment_chance, category: data.meta.category?.name || null,
          critRate: data.meta.crit_rate, drain: data.meta.drain, flinchChance: data.meta.flinch_chance,
          healing: data.meta.healing, maxHits: data.meta.max_hits, minHits: data.meta.min_hits,
          maxTurns: data.meta.max_turns, minTurns: data.meta.min_turns, statChance: data.meta.stat_chance
        } : null,
        statChanges: (data.stat_changes || []).map(x => ({ change: x.change, stat: x.stat?.name })),
        flags: Object.keys(data.flags || {}).filter(k => data.flags[k]),
        machines: (data.machines || []).map(x => ({ machine: x.machine?.url, versionGroup: x.version_group?.name }))
      } : {
        id: data.id, name: data.name, nameJa: jaName(data.names, data.name),
        effect: englishEffect(data.effect_entries), flavorJa: japaneseFlavor(data.flavor_text_entries),
        generation: data.generation?.name || null,
        isMainSeries: data.is_main_series,
        pokemon: (data.pokemon || []).map(x => ({ name: x.pokemon?.name, isHidden: x.is_hidden, slot: x.slot }))
      };
    });
    const body = JSON.stringify({ source: "PokeAPI", kind, count: entries.length, generatedAt: new Date().toISOString(), data: entries }, null, 2);
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="pokemon-${kind}.json"`);
    res.send(body);
  } catch (error) {
    res.status(502).json({ error: "PokeAPIからデータを取得できませんでした", detail: error.message });
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "pokemon-data-generator" }));
app.get("/api/export/moves", (_req, res) => exportData("moves", res));
app.get("/api/export/abilities", (_req, res) => exportData("abilities", res));
app.get("/", (_req, res) => res.type("html").send(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ポケモンデータ生成</title><style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:0 18px;background:#f5f7fb;color:#182033}a{display:block;padding:18px;margin:12px 0;background:white;border:1px solid #ccd4e2;border-radius:12px;color:#174ea6;text-decoration:none;font-weight:700}small{display:block;color:#566}</style><h1>ポケモンデータ生成ツール</h1><p>PokéAPIから技・特性データをJSONで取得します。生成には少し時間がかかる場合があります。</p><a href="/api/export/moves">技データ（JSON）を生成・取得</a><a href="/api/export/abilities">特性データ（JSON）を生成・取得</a><small>取得元：PokeAPI。データを取得後、JSONファイルとして保存できます。</small></html>`));
app.listen(PORT, "0.0.0.0", () => console.log("Data generator listening on " + PORT));
