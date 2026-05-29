# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Read this first — it
encodes the architecture, commands, and hard-won gotchas so you don't have to
re-derive them.

> **What this is:** a personal tracker for the **Fortnite: Save the World
> Collection Book**. Game item data is extracted once from the game files,
> normalized into versioned JSON, linked by shared attributes, and served as a
> static React site where you toggle what you've collected.

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
| Dev server | `npm run web:dev` | Vite at **http://localhost:5173** |
| Build everything | `npm run build` | `data:build` then `web:build` (static output in `web/dist`) |
| Typecheck | `npm run typecheck` | both workspaces, `tsc --noEmit` |
| **Verify (do this before finishing)** | `npm run verify` | typecheck + build |
| Docker up | `npm run docker:up` | builds image + serves at **http://localhost:8088** |
| Docker logs / down | `npm run docker:logs` / `npm run docker:down` | |

There is **no test suite yet** and **no linter** beyond `tsc`. "Green" = clean
typecheck + successful build.

---

## 🏗️ Architecture & data flow

Static site, no runtime backend. Item data is collected once and baked into JSON;
the only dynamic state is the user's collection, kept in `localStorage`.

```
 data/raw/assets.json            (real BanjoBotAssets export — git-ignored)
   └─ or sample.assets.json      (committed fixture fallback)
        │  data/src/build.ts  →  importSchematics() + buildFacets() + icon copy
        ▼
 web/public/data/schematics.json   normalized records
 web/public/data/facets.json       clickable attribute indices (facet → item ids)
 web/public/data/meta.json         counts / provenance
 web/public/icons/*.png            only the icons actually referenced
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
  schema.ts        ★ canonical domain model (Schematic, Rarity, ...). SOURCE OF TRUTH.
  banjo-types.ts     types for the raw export — PascalCase, defensive/optional
  import-banjo.ts  ★ raw assets.json → normalized Schematic[] (dedupe lives here)
  facets.ts          builds clickable facet indices; FACET_DEFS = which fields are facets
  build.ts         ★ orchestrator: read raw → import → facets → copy icons → write JSON
  util.ts            slug / tagId / titleCase / compact (shared by importer + facets)
data/raw/
  assets.json        real export (git-ignored)
  sample.assets.json committed fixture (real subset; keeps the pipeline runnable)

web/src/
  types.ts         ★ public data contract — mirror of schema.ts
  App.tsx            layout + filtering logic (facets: OR within a facet, AND across)
  store/collection.ts  localStorage state via useSyncExternalStore (+ export/import)
  lib/data.ts        fetches web/public/data/*.json
  lib/rarity.ts      rarity → color palette
  components/        FacetSidebar, Toolbar, SchematicGrid, SchematicCard
web/nginx.conf       static serving config (gzip + cache headers)

Dockerfile           multi-stage: node builder (runs pipeline + web build) → nginx
docs/extraction.md   how to (re)extract game data
```

---

## 🧩 Data model & conventions

- A **`Schematic`** = one (weapon/trap identity, rarity). Many in-game tier/material
  variants collapse into this — see dedupe below.
- **Attributes are linkable via "facets".** Each facet value has a stable tag id
  `"<facet>:<slug(value)>"` (e.g. `rarity:legendary`). `Schematic.tags` lists the
  tag ids it belongs to; `facets.json` maps each tag back to the matching item ids.
  This is what powers click-to-filter and cross-linking.
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
2. Copy `assets.json` → `data/raw/assets.json`, and the schematic-referenced
   images into `data/raw/ExportedImages/`.
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
