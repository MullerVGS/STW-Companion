// Local collector. Authenticates with device auth and dumps world/info + catalog
// into live-data/.data/ (git-ignored) for normalization and diagnostics.
import { mkdirSync, writeFileSync } from "node:fs";

import { fetchCatalog, fetchWorldInfo, getAccessToken } from "./epic";
import { dataDir, loadDeviceAuth } from "./env";

const dir = dataDir();
mkdirSync(dir, { recursive: true });

const auth = loadDeviceAuth();
const token = await getAccessToken(auth);
console.log(
  `auth ok via "${token.client}" client — account ${token.displayName ?? token.accountId}, token expires ${token.expiresAt}`,
);

const [world, catalog] = await Promise.all([
  fetchWorldInfo(token.accessToken),
  fetchCatalog(token.accessToken),
]);

writeFileSync(dir + "world-info.json", JSON.stringify(world));
writeFileSync(dir + "catalog.json", JSON.stringify(catalog));

console.log(
  `saved:\n  world-info.json  theaters=${world?.theaters?.length} missions=${world?.missions?.length} alerts=${world?.missionAlerts?.length}\n  catalog.json     storefronts=${catalog?.storefronts?.length} expires=${catalog?.expiration}`,
);
