# Extracting STW data

The dataset is produced from the game's own files with
[**BanjoBotAssets**](https://github.com/BanjoByTheBay/BanjoBotAssets) — the most
authentic source. Run it on **Windows** (where Fortnite is installed).

## Prerequisites

- Fortnite (Save the World) installed via the Epic Games Launcher.
- **.NET SDK** (`dotnet --version`). The project targets `net8.0`; if you only
  have a newer SDK (e.g. .NET 10), see the roll-forward note below.
- Git.

## Run it

```powershell
git clone https://github.com/BanjoByTheBay/BanjoBotAssets
cd BanjoBotAssets
git submodule update --init --recursive   # CUE4Parse — required, won't build without it

# The runnable project is BanjoBotAssets.Console (the README is outdated:
# the "BanjoBotAssets" folder is now a LIBRARY, not the executable).
cd BanjoBotAssets.Console
dotnet run
```

First run auto-downloads the AES keys + mappings for the current game version
(cached on disk) and writes, into the `BanjoBotAssets.Console` folder:

- `assets.json` (~46 MB) — everything, keyed by template id under `NamedItems`.
- `schematics.json` — schematic-focused view (not used by this project).
- `ExportedImages/` — ~3000 PNG icons (flat folder).

**Schematics only (faster):**
```powershell
dotnet run -- /only SchematicExporter,AssetRegistryExporter,CraftingRecipeExporter
```

### .NET version mismatch

If you see `Framework 'Microsoft.NETCore.App' version '8.0.x' was not found`:

- Quick: `$env:DOTNET_ROLL_FORWARD = "Major"` then `dotnet run`, **or**
- Clean: install the [.NET 8 runtime](https://dotnet.microsoft.com/download/dotnet/8.0)
  (coexists with newer SDKs).

### Notes

- "Failed assets" for `GameplayModifiers` / `MissionGens` are unrelated to
  schematics — safe to ignore.
- If the game isn't auto-detected, set the install path in
  `BanjoBotAssets.Console/appsettings.json`.

## Load it into this project

```bash
# from the repo root
cp <export>/assets.json data/raw/assets.json
cp -r <export>/ExportedImages data/raw/ExportedImages   # or just the referenced icons
npm run data:build         # normalizes + copies only the referenced icons
npm run docker:up          # rebuild the image so it serves the new data
```

The build prefers `data/raw/assets.json`; without it, it uses
`data/raw/sample.assets.json` (a committed real-subset fixture) so the pipeline
always runs.

## Format quirks (already handled in `data/src/`)

- Keys are **PascalCase** (`NamedItems`, `DisplayName`, `RangedWeaponStats.AmmoType`).
- `ImagePaths` use **Windows back-slashes** (`build.ts` normalizes them).
- `TriggerType` = weapon fire mode (`Automatic`/`OnPress`/`OnRelease`), empty for
  traps; trap placement is in `SubType`.
- Many tier/material variants per weapon → deduped to one record per
  (DisplayName, rarity), keeping the highest tier.
