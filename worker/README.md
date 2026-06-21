# stw-worker — live STW data (etapas 1+2)

Collects Epic's global Save the World state and normalizes it into the render-ready
`HomeData` contract consumed by the SPA's Home page. Cloudflare Worker is the eventual
target; right now this workspace contains the **collector** (etapa 1) and the **pure
normalizer** (etapa 2), runnable locally.

## Data sources (confirmed against real payloads)

- `GET …/fortnite/api/game/v2/world/info` → `theaters / missions / missionAlerts`
  (daily, resets 00:00 UTC). Source of V-Bucks missions, Alert Summary, drill-down.
- `GET …/fortnite/api/storefront/v2/catalog` → Weekly Supercharger
  (`STWSpecialEventStorefront`, a `reagent_promotion_*` grant) + llama rotation.
- Auth: OAuth `device_auth` with the `EPIC_*` device auth in `../env/.env`.
  ⚠️ The public **iOS** client is disabled by Epic; the **Android** client works
  (`epic.ts` falls back through `AUTH_CLIENTS`). The account needs the `PLAY` action
  (accept EULA + launch the game once).

## Commands

```bash
npm run extract:power -w worker   # assets.json -> src/data/power-levels.json (needs the real export)
npm run collect       -w worker   # live: dump world-info.json + catalog.json to .data/
npm run make:fixture  -w worker   # .data/ dumps -> committed fixtures/ (slim, tiles stripped)
npm run build:home    -w worker --fixture   # normalize the fixture, print a summary, write .data/home.json
npm run build:home    -w worker             # same, against the live .data/ dump
npm run typecheck     -w worker
```

## Layout

```
src/
  epic.ts        auth + fetch (runtime-agnostic: Node CLI and Worker)
  types.ts       HomeData contract (what the SPA consumes)
  maps.ts        curated resolvers: theaters, reward catalog, objectives, power, supercharger
  normalize.ts   pure world/info(+catalog) -> HomeData
  env.ts         local-only env/.env loader + paths
  collect.ts     etapa 1 CLI (live dump)
  make-fixture.ts / build-home.ts   fixture + summary CLIs
  data/power-levels.json   rowName -> RecommendedRating (generated; etapa 3 moves this into data/src)
fixtures/        committed slim world-info + catalog samples
.data/           git-ignored raw dumps + generated home.json
```

## Reward registry (etapa 3 — done)

`data/src/import-rewards.ts` emits `web/public/data/reward-registry.json`
(templateId → name/rarity/icon) from the game export. `normalizeHome` takes it as
`opts.registry` and resolves real names + icons for V-Bucks, resources, modifiers,
supercharger and named loot (e.g. "Electro-pulse Penny", "Legendary PERK-UP!"). It
also includes MissionGen entries, so objective names come from the export's real
DisplayName (the token "VHT_LtB" is actually "Ride The Lightning", not a guess).
Locally `build-home` loads it from `web/public/data/`; the deployed Worker will
fetch it from Pages once/day and cache it in KV. Run `npm run data:build` to
(re)generate it. Power levels stay bundled in `src/data/power-levels.json` (tiny,
patch-rare) rather than fetched.

## Worker runtime (etapa 4 — done)

`src/index.ts` is the Cloudflare Worker: `scheduled` (cron `5 0 * * *` + `20 0 * * *`)
refreshes KV from Epic; `fetch` serves `GET /api/home` (+ `/api/meta`, guarded
`/api/raw`) straight from KV with edge cache headers, a lazy single-flight refresh
when cold/stale, cached Epic token, registry pulled from Pages, and daily V-Bucks
history accumulation. Typechecked under `tsconfig.worker.json`; bundles clean
(`wrangler deploy --dry-run`). The SPA Home tab lives in `web/` (`components/HomeScreen.tsx`).

### Deploy (needs your Cloudflare account)

```bash
# 1) KV namespace — paste both ids into wrangler.toml
npx wrangler kv namespace create STW_KV
npx wrangler kv namespace create STW_KV --preview
# 2) secrets (from env/.env)
npx wrangler secret put EPIC_ACCOUNT_ID
npx wrangler secret put EPIC_DEVICE_ID
npx wrangler secret put EPIC_DEVICE_SECRET
npx wrangler secret put RAW_DEBUG_TOKEN   # optional, guards /api/raw
# 3) set PAGES_ORIGIN in wrangler.toml to your Pages domain, then:
npx wrangler deploy
```

Pages: build `npm run build`, output `web/dist`. Point the SPA at the Worker with
build env `VITE_HOME_URL=/api/home` (same-domain `/api/*` route → Worker, no CORS)
or the Worker's full URL (CORS is enabled). Locally the SPA reads the static
`web/public/data/home.json` produced by `build:home`.
