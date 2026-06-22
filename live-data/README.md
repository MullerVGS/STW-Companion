# Daily STW data

Collects Epic's current Save the World rotation and writes the static
`web/public/data/home.json` consumed by the Home screen.

There is no runtime backend. GitHub Actions runs the collector once per day,
builds the React app, and deploys the resulting `web/dist` directory to GitHub
Pages.

## Data sources

- `GET …/fortnite/api/game/v2/world/info`: missions and mission alerts.
- `GET …/fortnite/api/storefront/v2/catalog`: weekly Supercharger and store data.
- OAuth `device_auth` using `EPIC_ACCOUNT_ID`, `EPIC_DEVICE_ID`, and
  `EPIC_DEVICE_SECRET`.

The account must have accepted the EULA and launched Fortnite at least once.
The Android public client is tried first; the disabled iOS client remains only
as a fallback.

## Commands

```bash
npm run daily:collect   # fetch raw payloads into live-data/.data/
npm run daily:update    # fetch, normalize, and publish web/public/data/home.json
npm run daily:fixture   # generate home.json from committed fixtures
```

For local commands, credentials are read from `env/.env`. In GitHub Actions,
they are read from repository secrets.

## Layout

```text
src/
  epic.ts          Epic authentication and HTTP requests
  normalize.ts     pure world/info + catalog -> HomeData transform
  update-home.ts   scheduled one-shot collection and static JSON writer
  build-home.ts    local fixture/raw dump normalizer
  types.ts         HomeData contract mirrored by web/src/lib/home.ts
fixtures/          committed payload samples for offline development
.data/             ignored live payloads and generated snapshots
```

The scheduled job downloads the previous deployed `home.json` before replacing
it so the V-Bucks daily history survives across stateless Action runners. If
Epic returns an already-expired rotation, the job fails and GitHub Pages keeps
serving the previous successful deployment.

## Editing V-Bucks history

Edit `src/data/vbucks-history.json` to correct the official history totals or
individual dates:

```json
{
  "asOf": "2026-06-22",
  "today": 50,
  "yesterday": 0,
  "last7Days": 300,
  "last30Days": 450,
  "thisYear": 4950,
  "daily": {
    "2026-06-21": 0,
    "2026-06-22": 50
  }
}
```

Entries in `daily` are manual corrections and take precedence over previously
deployed snapshots, including explicit zero values. The aggregate totals are
used while there are not enough individual daily entries to calculate a full
7-day or 30-day window.
