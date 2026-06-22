// Build small, committed fixtures from the raw dumps so the normalizer is testable
// without live API access. Strips the heavy theater `tiles` (the bulk of the 2.2 MB)
// while preserving every field the normalizer reads.
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

import { dataDir, fixturesDir } from "./env";

const src = dataDir();
const out = fixturesDir();
mkdirSync(out, { recursive: true });

const world = JSON.parse(readFileSync(src + "world-info.json", "utf8"));
const slimWorld = {
  theaters: (world.theaters ?? []).map((t: any) => ({
    uniqueId: t.uniqueId,
    displayName: t.displayName,
    bIsTestTheater: t.bIsTestTheater,
    bHideLikeTestTheater: t.bHideLikeTestTheater,
    missionRewardNamedWeightsRowName: t.missionRewardNamedWeightsRowName,
    runtimeInfo: {
      theaterType: t.runtimeInfo?.theaterType,
      theaterTags: t.runtimeInfo?.theaterTags,
    },
    // length preserved (isPlayerTheater drops <=1-region utility theaters), contents dropped.
    regions: (t.regions ?? []).map(() => ({})),
  })),
  missions: world.missions, // small once tiles are gone
  missionAlerts: world.missionAlerts,
};
writeFileSync(out + "world-info.sample.json", JSON.stringify(slimWorld));

const catalog = JSON.parse(readFileSync(src + "catalog.json", "utf8"));
const keepFronts = new Set([
  "STWSpecialEventStorefront",
  "STWRotationalEventStorefront",
  "CardPackStorePreroll",
  "CardPackStoreGameplay",
]);
const slimCatalog = {
  expiration: catalog.expiration,
  refreshIntervalHrs: catalog.refreshIntervalHrs,
  storefronts: (catalog.storefronts ?? [])
    .filter((f: any) => keepFronts.has(f.name))
    .map((f: any) => ({
      name: f.name,
      catalogEntries: (f.catalogEntries ?? []).map((e: any) => ({
        devName: e.devName,
        itemGrants: e.itemGrants,
        prices: e.prices,
      })),
    })),
};
writeFileSync(out + "catalog.sample.json", JSON.stringify(slimCatalog));

const kb = (p: string) => (statSync(p).size / 1024).toFixed(0) + " KB";
console.log(
  `wrote fixtures:\n  world-info.sample.json  ${kb(out + "world-info.sample.json")}\n  catalog.sample.json     ${kb(out + "catalog.sample.json")}`,
);
