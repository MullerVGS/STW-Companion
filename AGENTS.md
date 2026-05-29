# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Read this first — it
encodes the architecture, commands, and hard-won gotchas so you don't have to
re-derive them.

> **What this is:** an interactive **wiki + tracker** for the **Fortnite: Save
> the World Collection Book**, covering all sections — Heroes (by set),
> Personnel (Defenders / Survivors / Lead Survivors / Mythic Leads), and
> Ranged / Melee / Trap schematics. Game data is extracted once from the game
> files, normalized into versioned JSON, linked by shared attributes (facets),
> and served as a static React site with an inspect view (perks, abilities,
> stats, crafting) and click-to-filter; the only dynamic state is the user's
> collection in `localStorage`.

---

## 🔑 Golden rules (read before editing)

1. **Never hand-edit generated output.** `web/public/data/*.json` and
   `web/public/icons/*` are build artifacts. Change the pipeline in `data/src/`
   and run `npm run data:build` instead.
2. **Keep the two type definitions in sync.** `data/src/schema.ts` is the source
   of truth; `web/src/types.ts` mirrors the public subset. If you change one,
   change the other.
3. **`data/raw/assets.json` is real game data** (~46 MB, git-ignored). Don't
   commit it. If it's missing, the build falls back to
   `data/raw/sample.assets.json` (a committed, faithful fixture). See
   [Data refresh](#-data-refresh-extraction).
4. **The raw export uses PascalCase keys and Windows back-slash image paths.**
   This trips everyone up — details in [Gotchas](#-gotchas).
5. **Validate before declaring done:** `npm run verify` (typecheck + full build).
6. **Data is baked into the Docker image at build time.** After refreshing data,
   rebuild with `--build` (`npm run docker:up`).

---

## ⚡ Commands

| Task | Command | Notes |
| --- | --- | --- |
| Install | `npm install` | npm workspaces; one install at the root |
| Build dataset | `npm run data:build` | `data/raw/assets.json` → `web/public/data/*` + copies referenced icons |
| **Dev in Docker (hot reload)** | `npm run docker:dev` | Vite HMR in a container at **http://localhost:5173** (bind-mounted source) |
| Dev (host, no Docker) | `npm run web:dev` | Vite at **http://localhost:5173** (host Node) |
| Build everything | `npm run build` | `data:build` then `web:build` (static output in `web/dist`) |
| Typecheck | `npm run typecheck` | both workspaces, `tsc --noEmit` |
| **Verify (do this before finishing)** | `npm run verify` | typecheck + build |
| **Prod in Docker** | `npm run docker:up` | builds nginx image + serves at **http://localhost:8088** |
| Docker logs / down | `npm run docker:logs` / `npm run docker:down` (prod); `:dev` variants for dev | |

Both stacks run in Docker and **coexist** (separate compose project names:
`stw` for prod, `stw-dev` for dev) — prod on 8088, dev on 5173. Dev mounts the
repo and rebuilds the dataset on container start, so source edits hot-reload and
data refreshes on restart; prod bakes data into the image at build time (rebuild
with `docker:up`). Dockerfile targets: `dev` (Vite) and `runner` (nginx, default).

There is **no test suite yet** and **no linter** beyond `tsc`. "Green" = clean
typecheck + successful build.

---

## 🏗️ Architecture & data flow

Static site, no runtime backend. Item data is collected once and baked into JSON;
the only dynamic state is the user's collection, kept in `localStorage`.

```
 data/raw/assets.json            (real BanjoBotAssets export — git-ignored)
   └─ or sample.assets.json      (committed fixture fallback)
 data/raw/ExportedImages/*.png   (full image export, git-ignored — see Data refresh)
        │  data/src/build.ts  →  import{Heroes,Abilities,Survivors,Defenders,Schematics}
        │                        + buildAllFacets() + buildBook() + icon copy
        ▼
 web/public/data/heroes.json      normalized heroes (set, perks, abilityIds, location)
 web/public/data/abilities.json   id → ability lookup (referenced by heroes)
 web/public/data/survivors.json   personnel: survivors / leads / mythic leads
 web/public/data/defenders.json   defenders
 web/public/data/schematics.json  weapons/traps (stats, dps, crafting, perk pool)
 web/public/data/facets.json      per-dataset clickable attribute indices
 web/public/data/book.json        section → subcategory taxonomy (drives the left rail)
 web/public/data/meta.json        counts / provenance
 web/public/icons/*.png           only the icons actually referenced & present on disk
        │  vite build (copies public/ into dist/)
        ▼
 web/dist  ──►  nginx (Docker)  ──►  browser  ──►  localStorage (collection state)
```

**Why static:** STW item data is static between game patches, so we extract once
and ship a CDN-friendly static site. Re-run the pipeline only when the game
updates.

---

## 🗺️ Repo map (the files that matter)

```
data/src/
  schema.ts        ★ canonical domain model (Hero, Survivor, Defender, Schematic, ...). SOURCE OF TRUTH.
  banjo-types.ts     types for the raw export — PascalCase, defensive/optional
  hero-sets.ts     ★ derive Collection Book set + location from template/image tokens (curated map)
  book.ts            builds the section → subcategory taxonomy (book.json)
  lookups.ts         id → ingredient / alteration indexes (crafting + perk-pool resolution)
  import-heroes.ts ★ heroes (dedupe) + the abilities they reference
  import-personnel.ts survivors (survivor/lead/mythic-lead) + defenders
  import-banjo.ts  ★ schematics: dedupe + crafting/perk-pool/dps enrichment
  facets.ts          per-dataset facet builders (HERO_DEFS / SURVIVOR_DEFS / ...)
  build.ts         ★ orchestrator: read raw → import all → facets → book → copy icons → write JSON
  util.ts            slug / tagId / titleCase / compact (shared across the pipeline)
data/raw/
  assets.json        real export (git-ignored)
  ExportedImages/    full image export (git-ignored; needed for hero/ability/etc. art)
  sample.assets.json committed fixture (real subset; keeps the pipeline runnable)

web/src/
  types.ts         ★ public data contract — mirror of schema.ts
  App.tsx            section/subcategory state, filtering (facets: OR within, AND across), inspect
  store/collection.ts  localStorage state via useSyncExternalStore (+ export/import)
  lib/data.ts        fetches web/public/data/*.json into one Dataset
  lib/view.ts        record helpers: kind, subtitle, slug/tagId, weapon stat rows
  lib/rarity.ts      rarity → color palette
  components/        BookSidebar, FilterBar, ItemGrid, ItemCard, InspectModal
web/nginx.conf       static serving config (gzip + cache headers)

Dockerfile           multi-stage: node builder (runs pipeline + web build) → nginx
docs/extraction.md   how to (re)extract game data
```

---

## 🧩 Data model & conventions

- **Four datasets, one dedupe philosophy.** `Hero`, `Survivor`, `Defender`,
  `Schematic` each collapse the game's many tier/rarity variants into one record
  per identity (keep highest `Tier`). Keys: heroes `slug(name)|rarity|class`,
  schematics/defenders `slug(name)|rarity`, survivors `slug(name)|rarity|squad`.
- **Heroes carry their Collection Book set + location.** The export has neither,
  so `hero-sets.ts` derives the set from template/image tokens (e.g.
  `HID_Commando_027_PirateSoldier` / `...-M-Pirate01` → `pirate`) and a curated
  `SET_DEFS`/`ALIASES` map gives the friendly label + Llama-shop location text.
  Unrecognized tokens still group on their own; tokenless heroes fall to `other`.
  **Extend the map** to improve coverage — that's the intended way to add sets.
- **Some data isn't in the export (handle honestly, surface a note):** hero
  *class* perks (only Hero + Commander perks exist), in-game *leveled* stats
  (we ship base/level-1 values + a computed base DPS for ranged), and survivor
  portraits (generic art). The inspect view labels these explicitly.
- **Cross-references are resolved at build time.** Schematic `CraftingCost` →
  ingredient names+icons and `AlterationSlots` → perk-pool text via `lookups.ts`
  (lowercased ids — the export mixes casing); hero `HeroAbilities` → `abilities.json`.
- **Attributes are linkable via "facets".** Each facet value has a stable tag id
  `"<facet>:<slug(value)>"` (e.g. `rarity:legendary`, `set:pirate`, `ability:...`).
  A record's `tags` list its facet ids; the web filters client-side (OR within a
  facet, AND across) and the inspect view exposes click-to-filter chips (comps).
- **One icon per item.** "Not collected" is the same icon rendered with a CSS
  grayscale/dim filter (`.card.is-missing` in `web/src/index.css`) — don't add a
  second "greyed-out" asset.
- **Provenance is built in.** `Schematic.sources` (+ optional `conflicts`) exists
  so a second source (FortniteDB/Fandom) can later be reconciled for
  cross-reference. For now everything is `["banjo"]`.

**Code style:** TypeScript `strict`, ESM, 2-space indent, double quotes. Pipeline
code is pure functions over plain objects; parse raw data **defensively** (every
raw field is optional). React: function components, `memo` for list rows,
`useSyncExternalStore` for the collection store (subscribe to the narrowest slice).

---

## ⚠️ Gotchas (these cost real debugging time)

1. **PascalCase + back-slashes.** BanjoBotAssets serializes `NamedItems`,
   `DisplayName`, `RangedWeaponStats.AmmoType`, etc. (NOT camelCase), and
   `ImagePaths` use Windows `\`. `banjo-types.ts` matches the casing;
   `build.ts` normalizes `\`→`/` before resolving icon files.
2. **`TriggerType` is the weapon fire mode** (`Automatic` / `OnPress` /
   `OnRelease`), empty for traps. **Trap placement** (Floor / Wall / Ceiling)
   lives in **`SubType`**. (The old README implied otherwise.)
3. **Dedupe key = `slug(DisplayName) + "|" + rarity`,** keeping the highest
   `Tier` variant. This is intentional and id-scheme-agnostic. Don't switch to
   template-id parsing.
4. **`AmmoType` is already display-ready** (`"Shells 'n' Slugs"`). Don't
   title-case it — only token-shaped values (`AmmoType_Medium_Bullets`) get
   cleaned. See `cleanAmmo()`.
5. **Vite `base: "./"`** keeps the build portable (sub-paths / GitHub Pages).
   Keep image/data URLs root-relative (`/icons/...`, `/data/...`).
6. **Docker host port is 8088** (8080 was taken on the dev machine). Container
   listens on 80.

---

## ➕ How to extend

**Add a new facet (e.g. crafting material tier):**
1. Add the field to `Schematic` in `data/src/schema.ts` and mirror in
   `web/src/types.ts`.
2. Populate it in `import-banjo.ts` and add it to `buildTags()`.
3. Add a `FACET_DEFS` entry in `data/src/facets.ts` (facet key + label + getter).
4. `npm run data:build` — the sidebar picks it up automatically.

**Add a new category (Heroes / Survivors / Defenders):** the raw `assets.json`
already contains them (`Type` = `"Hero"`, `"Survivor"`/`"Worker"`, `"Defender"`).
Create `data/src/import-<category>.ts` modeled on `import-banjo.ts`, add a schema
type, wire it into `build.ts` (write `web/public/data/<category>.json` +
its facets), and add a view in `web/src`. Keep the per-item collection store
generic (it's keyed by id, category-agnostic).

---

## 🔄 Data refresh (extraction)

Full guide: [`docs/extraction.md`](docs/extraction.md). Short version:

1. Run **BanjoBotAssets** (`dotnet run` from the `BanjoBotAssets.Console` project)
   against the game files → produces `assets.json` + `ExportedImages/`.
2. Copy `assets.json` → `data/raw/assets.json`, and the **full** `ExportedImages/`
   into `data/raw/ExportedImages/` (heroes, abilities, ingredients, defenders all
   need art — not just schematics). From WSL:
   `cp -ru "/mnt/c/.../BanjoBotAssets.Console/ExportedImages/." data/raw/ExportedImages/`
3. `npm run data:build` (then `npm run docker:up` to rebuild the image).

On the current dev machine the export lands under
`/mnt/c/Users/.../BanjoBotAssets/BanjoBotAssets.Console/` (reachable from WSL).

---

## ✅ Definition of done

- [ ] `npm run verify` is clean (typecheck + build).
- [ ] If the pipeline changed: `npm run data:build` and sanity-check
      `web/public/data/meta.json` counts.
- [ ] `data/src/schema.ts` and `web/src/types.ts` still agree.
- [ ] No generated artifacts (`web/public/data`, `web/public/icons`,
      `data/raw/assets.json`) staged for commit.
- [ ] If serving via Docker: `npm run docker:up`, then `curl -sI
      http://localhost:8088/` returns `200`.
