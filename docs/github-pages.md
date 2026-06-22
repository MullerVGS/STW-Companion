# GitHub Pages deployment

The site and daily mission data are published by
`.github/workflows/pages.yml`. No server or persistent database is required.

## 1. Add Epic credentials

Open the repository on GitHub:

`Settings -> Secrets and variables -> Actions -> New repository secret`

Create these three repository secrets:

- `EPIC_ACCOUNT_ID`
- `EPIC_DEVICE_ID`
- `EPIC_DEVICE_SECRET`

Copy only the values, without quotes or surrounding spaces. Never commit these
credentials.

## 2. Enable GitHub Pages

Open:

`Settings -> Pages -> Build and deployment`

Set **Source** to **GitHub Actions**.

## 3. Run the first deployment

Open:

`Actions -> Build and deploy GitHub Pages -> Run workflow`

After the `deploy` job succeeds, the site URL appears in the workflow summary
and under `Settings -> Pages`.

For this repository it will normally be:

`https://mullervgs.github.io/stw_collection_book/`

## Schedule and failure behavior

The Action runs at 00:30 UTC, after STW's 00:00 UTC rotation. GitHub may delay
scheduled jobs during periods of high load.

The collector rejects an expired Epic rotation. A failed build does not replace
the currently deployed site, so the last successful snapshot remains available.

The previous deployed `data/home.json` is downloaded during each build to carry
forward V-Bucks history.

## Dataset limitation in hosted builds

`data/raw/assets.json` and `data/raw/ExportedImages/` are intentionally ignored
because they are large extracted game files. A GitHub runner therefore uses the
committed `sample.assets.json` unless the full raw export is made available by a
separate artifact source.

Daily missions are still live and current. The limitation applies to the
Collection Book dataset and icons generated in CI.
