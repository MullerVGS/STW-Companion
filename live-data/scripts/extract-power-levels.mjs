// Extract mission power levels from the BanjoBotAssets export.
// assets.json -> DifficultyInfo[rowName] = { DisplayName, MaximumRating, RecommendedRating, RequiredRating }
// We keep rowName -> RecommendedRating (the in-game recommended power level).
//
// Kept with the daily normalizer so the power-level lookup remains self-contained.
// assets.json is git-ignored and only present on the extraction machine.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../../", import.meta.url); // repo root from live-data/scripts/
const assetsPath = new URL("data/raw/assets.json", root);
const outDir = new URL("../src/data/", import.meta.url);
const outPath = new URL("power-levels.json", outDir);

const assets = JSON.parse(readFileSync(assetsPath, "utf8"));
const di = assets.DifficultyInfo || {};
const out = {};
for (const [row, v] of Object.entries(di)) {
  out[row] = typeof v?.RecommendedRating === "number" ? v.RecommendedRating : null;
}
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 0));
console.log(`wrote power-levels.json: ${Object.keys(out).length} rows`);
