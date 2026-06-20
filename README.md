# STW Companion

A personal companion for **Fortnite: Save the World** — a toolkit with two surfaces:

- **Collection Book** — wiki + tracker for every item (schematics, heroes, survivors, defenders, perks), linked by shared attributes, with an inspect view and click-to-filter. Toggle what you own.
- **Hero Loadout** — plan a team (commander + support + team perk + gadgets), see the whole team's perks/abilities at a glance, and jump straight to any hero in the Collection Book ("find in book").

More tools are planned.

> 🤖 **Working with an AI agent (or contributing)?** Start with [`AGENTS.md`](AGENTS.md) — it has the architecture, commands, and gotchas. (`CLAUDE.md` is a symlink to it.)

## Architecture

A two-package npm workspace:

```
.
├── data/            # TypeScript pipeline: raw game export  ->  normalized, web-ready JSON
│   ├── src/
│   │   ├── schema.ts        # normalized domain model (the source of truth for shapes)
│   │   ├── banjo-types.ts   # subset of BanjoBotAssets' assets.json we consume
│   │   ├── import-banjo.ts  # BanjoBotAssets -> normalized
│   │   ├── facets.ts        # clickable-attribute (facet) config + index builder
│   │   └── build.ts         # orchestrates import -> facets -> writes web/public/data
│   └── raw/
│       └── sample.assets.json   # committed fixture so the pipeline runs before real extraction
├── web/             # React + Vite app (static, runs entirely in the browser)
└── docs/
    └── extraction.md        # how to pull real data + icons from the game files
```

### Why this shape

- **Data is collected once.** STW item data is static between game patches, so we extract/scrape once, bake it into versioned JSON, and ship a **static site** — no backend needed to browse.
- **Authenticity via the game files.** Primary source is the game's own assets (via [BanjoBotAssets](https://github.com/BanjoByTheBay/BanjoBotAssets)). The pipeline is built to later reconcile a second source (FortniteDB/Fandom) for cross-reference.
- **Attributes are linkable.** Shared attributes (rarity, category, weapon subtype, ammo, …) become **facets** — clickable chips that filter and cross-link items.
- **One icon per item.** "Not collected" is rendered from the *same* icon via a CSS grayscale/dim filter, halving asset count and bandwidth.
- **Collection state is yours.** Stored in `localStorage` (with JSON export/import); optional cloud sync (Supabase) can be layered on later.

## Quickstart

```bash
npm install          # install all workspaces
npm run data:build   # build normalized JSON from the sample fixture -> web/public/data
npm run web:dev      # start the app (Vite)
```

The app boots against the **sample fixture** out of the box. To load the full game data, follow [`docs/extraction.md`](docs/extraction.md), drop `assets.json` into `data/raw/`, and re-run `npm run data:build`.

## Status

**Collection Book** is end-to-end across all categories — Heroes (by set), Personnel (defenders / survivors / leads / mythic leads) and Ranged / Melee / Trap schematics — with inspect, facets, and global search. **Hero Loadout** planner ships team perks + gadgets and "find in Collection Book". Next: more companion tools and a cross-reference second source.
