# STW Companion

A personal companion for **Fortnite: Save the World** with three surfaces:

- **Home** — current daily missions, alerts, V-Bucks and weekly Supercharger.
- **Collection Book** — wiki + tracker for every item (schematics, heroes, survivors, defenders, perks), linked by shared attributes, with an inspect view and click-to-filter. Toggle what you own.
- **Hero Loadout** — plan a team (commander + support + team perk + gadgets), see the whole team's perks/abilities at a glance, and jump straight to any hero in the Collection Book ("find in book").

More tools are planned.

> 🤖 **Working with an AI agent (or contributing)?** Start with [`AGENTS.md`](AGENTS.md) — it has the architecture, commands, and gotchas. (`CLAUDE.md` is a symlink to it.)

## Architecture

A three-package npm workspace:

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
├── live-data/       # Daily Epic collector -> static web/public/data/home.json
├── web/             # React + Vite app (static, runs entirely in the browser)
├── .github/
│   └── workflows/pages.yml  # daily collection + GitHub Pages deployment
└── docs/
    ├── extraction.md        # how to pull real data + icons from the game files
    └── github-pages.md      # hosting and secret setup
```

### Why this shape

- **Static by default.** Item data is rebuilt when game assets change. Daily missions are collected once after the 00:00 UTC reset and baked into the same static site.
- **Authenticity via the game files.** Primary source is the game's own assets (via [BanjoBotAssets](https://github.com/BanjoByTheBay/BanjoBotAssets)). The pipeline is built to later reconcile a second source (FortniteDB/Fandom) for cross-reference.
- **Attributes are linkable.** Shared attributes (rarity, category, weapon subtype, ammo, …) become **facets** — clickable chips that filter and cross-link items.
- **One icon per item.** "Not collected" is rendered from the *same* icon via a CSS grayscale/dim filter, halving asset count and bandwidth.
- **Collection state is yours.** Stored in `localStorage` (with JSON export/import); optional cloud sync (Supabase) can be layered on later.

## Quickstart

```bash
npm install          # install all workspaces
npm run data:build   # build normalized JSON from the sample fixture -> web/public/data
npm run daily:fixture # build an offline daily-mission fixture
npm run web:dev      # start the app (Vite)
```

The app boots against the **sample fixture** out of the box. To load the full game data, follow [`docs/extraction.md`](docs/extraction.md), drop `assets.json` into `data/raw/`, and re-run `npm run data:build`.

## Hosting

The repository is configured for GitHub Pages. On every push to `master` and
once per day at 00:30 UTC, `.github/workflows/pages.yml`:

1. builds the static dataset;
2. authenticates with Epic using GitHub Actions secrets;
3. writes the current rotation to `data/home.json`;
4. builds and deploys `web/dist`.

Setup instructions: [`docs/github-pages.md`](docs/github-pages.md).

## Status

**Collection Book** follows the in-game section/page/panel ordering across Heroes, Personnel, core schematics, Starter Packs, Event and Expansion categories, with inspect, facets, and global search. **Hero Loadout** planner ships team perks + gadgets and "find in Collection Book". Next: more companion tools and a cross-reference second source.
