# Pokémon Data Generator

A small Render-hosted exporter that retrieves Pokémon move and ability metadata from PokeAPI and returns JSON downloads.

## Endpoints
- `/` — Japanese download page
- `/health` — health check
- `/api/export/moves` — all move records as JSON
- `/api/export/abilities` — all ability records as JSON

Each export includes source, record count, generation timestamp, and data. Requests are cached in-process and fetched with bounded concurrency.
