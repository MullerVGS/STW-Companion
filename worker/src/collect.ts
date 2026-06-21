// Etapa 1 — local collector. Authenticates with the device auth in env/.env and
// dumps the raw world/info + catalog into worker/.data/ (git-ignored) for the
// normalizer and for fixture generation. This is the exact logic the Worker's
// cron handler will run (minus the KV write).
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
