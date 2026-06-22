/**
 * One-shot daily job used by GitHub Actions:
 * authenticate -> fetch Epic data -> normalize -> preserve history -> write
 * web/public/data/home.json for the static site.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dataDir, loadDeviceAuth, repoRoot } from "./env";
import { fetchCatalog, fetchWorldInfo, getAccessToken } from "./epic";
import { normalizeHome } from "./normalize";
import type { HomeData, RewardRegistry, VBucksHistory } from "./types";

const publicDataDir = repoRoot() + "web/public/data/";
const homePath = publicDataDir + "home.json";

function readRegistry(): RewardRegistry | undefined {
  const file = publicDataDir + "reward-registry.json";
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as RewardRegistry;
}

async function readPreviousHome(): Promise<HomeData | undefined> {
  const url = process.env.PREVIOUS_HOME_URL;
  if (url) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.ok) return (await res.json()) as HomeData;
      console.warn(`[daily] previous snapshot unavailable: HTTP ${res.status}`);
    } catch (error) {
      console.warn(`[daily] previous snapshot unavailable: ${String(error)}`);
    }
  }

  for (const file of [homePath, dataDir() + "home.json"]) {
    if (!existsSync(file)) continue;
    try {
      return JSON.parse(readFileSync(file, "utf8")) as HomeData;
    } catch {
      // Ignore malformed local state and start a new history.
    }
  }
  return undefined;
}

function attachHistory(home: HomeData, previous?: HomeData): VBucksHistory {
  const day = home.meta.generatedAt.slice(0, 10);
  const today = home.vbucks.reduce((sum, mission) => sum + mission.amount, 0);
  const daily = { ...(previous?.vbucksHistory?.daily ?? {}), [day]: today };
  return { today, daily };
}

function assertFresh(home: HomeData): void {
  const generated = Date.parse(home.meta.generatedAt);
  const expires = Date.parse(home.meta.expiresAt);
  if (!Number.isFinite(expires) || expires <= generated) {
    throw new Error(
      `Epic returned an expired rotation: generated=${home.meta.generatedAt} expires=${home.meta.expiresAt}`,
    );
  }
}

const auth = loadDeviceAuth();
const token = await getAccessToken(auth);
const [world, catalog, previous] = await Promise.all([
  fetchWorldInfo(token.accessToken),
  fetchCatalog(token.accessToken),
  readPreviousHome(),
]);

const generatedAt = new Date().toISOString();
const home = normalizeHome(world, catalog, {
  generatedAt,
  registry: readRegistry(),
});
assertFresh(home);
home.vbucksHistory = attachHistory(home, previous);

mkdirSync(dataDir(), { recursive: true });
mkdirSync(publicDataDir, { recursive: true });
writeFileSync(dataDir() + "world-info.json", JSON.stringify(world));
writeFileSync(dataDir() + "catalog.json", JSON.stringify(catalog));
writeFileSync(dataDir() + "home.json", JSON.stringify(home, null, 2));
writeFileSync(homePath, JSON.stringify(home));

console.log(
  `[daily] generated=${home.meta.generatedAt} expires=${home.meta.expiresAt} ` +
    `missions=${home.missions.length} alerts=${home.alerts.length} vbucks=${home.vbucks.length}`,
);
