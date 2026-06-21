// Extract mission power levels from the BanjoBotAssets export.
// assets.json -> DifficultyInfo[rowName] = { DisplayName, MaximumRating, RecommendedRating, RequiredRating }
// We keep rowName -> RecommendedRating (the in-game recommended power level).
//
// NOTE (etapa 3): this lives in `worker/` for now so the normalizer is self-contained
// and testable. Long-term this generation should move into `data/src/build.ts` and be
// published to Pages (like reward-registry.json), with the Worker fetching it. assets.json
// is git-ignored and only present on the extraction machine.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../../", import.meta.url); // repo root from worker/scripts/
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
