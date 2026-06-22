// Epic Games auth + Save the World data fetch. Uses Node 20+'s global fetch.

const TOKEN_URL =
  "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token";
const WORLD_INFO_URL =
  "https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/world/info";
const CATALOG_URL =
  "https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/storefront/v2/catalog";

// Public Fortnite game clients (id:secret), tried in order.
// ⚠️ Epic disables clients over time — the iOS client is CURRENTLY DISABLED
// (errors.com.epicgames.account.client_disabled); Android works. Keep fallbacks.
export const AUTH_CLIENTS: ReadonlyArray<{ name: string; basic: string }> = [
  { name: "android", basic: "3f69e56c7649492c8cc29f1af08a8a12:b51ee9cb12234f50a69efa67ef53812e" },
  { name: "ios", basic: "3446cd72694c4a4485d81b77adbb2141:9209d4a5e25a457fb9b07489d313b41a" },
];

export interface DeviceAuth {
  accountId: string;
  deviceId: string;
  secret: string;
}

export interface TokenResult {
  accessToken: string;
  expiresAt: string;
  client: string;
  accountId: string;
  displayName?: string;
}

function toBase64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

/** Exchange a device auth for a user access token, trying each client until one works. */
export async function getAccessToken(
  auth: DeviceAuth,
  clients: ReadonlyArray<{ name: string; basic: string }> = AUTH_CLIENTS,
): Promise<TokenResult> {
  const failures: string[] = [];
  for (const client of clients) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${toBase64(client.basic)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "device_auth",
        account_id: auth.accountId,
        device_id: auth.deviceId,
        secret: auth.secret,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.ok && json.access_token) {
      const expiresAt =
        json.expires_at ??
        new Date(Date.now() + (json.expires_in ?? 7200) * 1000).toISOString();
      return {
        accessToken: json.access_token,
        expiresAt,
        client: client.name,
        accountId: json.account_id ?? auth.accountId,
        displayName: json.displayName,
      };
    }
    failures.push(`${client.name}: HTTP ${res.status} ${json.errorCode ?? ""}`.trim());
  }
  throw new Error(`Epic auth failed — ${failures.join(" | ")}`);
}

async function authedGet(url: string, token: string, label: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`${label} HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

/** Global STW state: theaters / missions / missionAlerts. Requires the PLAY action. */
export function fetchWorldInfo(token: string): Promise<any> {
  return authedGet(WORLD_INFO_URL, token, "world/info");
}

/** Storefront catalog (Weekly Supercharger lives in STWSpecialEventStorefront; llamas in CardPack stores). */
export function fetchCatalog(token: string): Promise<any> {
  return authedGet(CATALOG_URL, token, "catalog");
}
