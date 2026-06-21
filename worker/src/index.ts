/**
 * Cloudflare Worker runtime (etapa 4).
 *
 *  - `scheduled` (cron, just after the 00:00 UTC reset): authenticate → fetch
 *    world/info + catalog → resolve via the reward-registry → normalize → write KV.
 *  - `fetch` (hot path): serve `/api/home` straight from KV (never calls Epic),
 *    with edge cache headers + a lazy single-flight refresh if KV is cold/stale.
 *
 * Secrets/bindings come from `Env` (wrangler secret + kv_namespaces). The device
 * auth and tokens never leave the Worker. See README / wrangler.toml.
 */
import { fetchCatalog, fetchWorldInfo, getAccessToken, type DeviceAuth } from "./epic";
import { normalizeHome } from "./normalize";
import type { HomeData, RewardRegistry, VBucksHistory } from "./types";

export interface Env {
  STW_KV: KVNamespace;
  EPIC_ACCOUNT_ID: string;
  EPIC_DEVICE_ID: string;
  EPIC_DEVICE_SECRET: string;
  /** Origin serving the static dataset, e.g. https://stw-companion.pages.dev */
  PAGES_ORIGIN: string;
  /** Optional shared secret guarding /api/raw. */
  RAW_DEBUG_TOKEN?: string;
}

const KEY = {
  home: "home:current",
  raw: "raw:current",
  token: "epic:token",
  registry: "registry:current",
  history: "vbucks:history",
  lock: "refresh:lock",
} as const;

const CORS: Record<string, string> = { "Access-Control-Allow-Origin": "*" };
const REGISTRY_TTL = 23 * 3600; // refetched ~daily by the cron
const TOKEN_SKEW_MS = 5 * 60_000;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const { pathname } = new URL(req.url);
    try {
      switch (pathname) {
        case "/api/home":
          return await serveHome(env, ctx);
        case "/api/meta":
          return await serveMeta(env);
        case "/api/raw":
          return await serveRaw(req, env);
        default:
          return json({ error: "not_found" }, 404);
      }
    } catch (e) {
      return json({ error: "internal", message: String((e as Error)?.message ?? e) }, 500);
    }
  },

  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env, "cron"));
  },
};

// ── handlers ──────────────────────────────────────────────────────────────────

async function serveHome(env: Env, ctx: ExecutionContext): Promise<Response> {
  let home = await env.STW_KV.get<HomeData>(KEY.home, "json");
  if (!home) {
    home = await refresh(env, "lazy-miss"); // cold start: must fetch once
  } else if (isStale(home)) {
    ctx.waitUntil(refresh(env, "lazy-stale")); // serve stale now, refresh in bg
    home = { ...home, meta: { ...home.meta, stale: true } };
  }
  if (!home) return json({ error: "unavailable" }, 503, { "Cache-Control": "no-store" });
  return json(home, 200, cacheHeaders(home));
}

async function serveMeta(env: Env): Promise<Response> {
  const home = await env.STW_KV.get<HomeData>(KEY.home, "json");
  if (!home) return json({ error: "unavailable" }, 503, { "Cache-Control": "no-store" });
  return json(
    {
      ...home.meta,
      stale: isStale(home),
      vbucksToday: home.vbucksHistory?.today ?? sumVbucks(home),
      counts: { alerts: home.alerts.length, missions: home.missions.length, vbucks: home.vbucks.length },
    },
    200,
    cacheHeaders(home),
  );
}

async function serveRaw(req: Request, env: Env): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? req.headers.get("x-debug-token");
  if (!env.RAW_DEBUG_TOKEN || token !== env.RAW_DEBUG_TOKEN) return json({ error: "forbidden" }, 403);
  const raw = await env.STW_KV.get(KEY.raw, "json");
  if (!raw) return json({ error: "no_raw" }, 404);
  return json(raw, 200, { "Cache-Control": "no-store" });
}

// ── refresh (cron + lazy) ─────────────────────────────────────────────────────

async function refresh(env: Env, reason: string): Promise<HomeData | null> {
  // Best-effort single-flight: don't stampede Epic when several requests miss.
  if (reason.startsWith("lazy")) {
    const locked = await env.STW_KV.get(KEY.lock);
    if (locked) return env.STW_KV.get<HomeData>(KEY.home, "json");
  }
  await env.STW_KV.put(KEY.lock, reason, { expirationTtl: 120 });
  try {
    const token = await getToken(env);
    const [world, catalog] = await Promise.all([fetchWorldInfo(token), fetchCatalog(token)]);
    const registry = await getRegistry(env);
    const generatedAt = new Date().toISOString();

    const home = normalizeHome(world, catalog, { generatedAt, registry });
    home.vbucksHistory = await updateHistory(env, home, generatedAt);

    await Promise.all([
      env.STW_KV.put(KEY.home, JSON.stringify(home)),
      env.STW_KV.put(KEY.raw, JSON.stringify({ world, catalog, fetchedAt: generatedAt })),
    ]);
    return home;
  } finally {
    await env.STW_KV.delete(KEY.lock);
  }
}

async function getToken(env: Env): Promise<string> {
  const cached = await env.STW_KV.get<{ accessToken: string; expiresAt: string }>(KEY.token, "json");
  if (cached && Date.parse(cached.expiresAt) - Date.now() > TOKEN_SKEW_MS) return cached.accessToken;

  const auth: DeviceAuth = {
    accountId: env.EPIC_ACCOUNT_ID,
    deviceId: env.EPIC_DEVICE_ID,
    secret: env.EPIC_DEVICE_SECRET,
  };
  const tok = await getAccessToken(auth);
  const ttl = Math.max(300, Math.floor((Date.parse(tok.expiresAt) - Date.now()) / 1000) - 60);
  await env.STW_KV.put(
    KEY.token,
    JSON.stringify({ accessToken: tok.accessToken, expiresAt: tok.expiresAt }),
    { expirationTtl: ttl },
  );
  return tok.accessToken;
}

/** Reward registry from Pages (real names/icons), cached in KV ~1 day. */
async function getRegistry(env: Env): Promise<RewardRegistry | undefined> {
  const cached = await env.STW_KV.get<RewardRegistry>(KEY.registry, "json");
  if (cached) return cached;
  try {
    const res = await fetch(`${env.PAGES_ORIGIN}/data/reward-registry.json`);
    if (!res.ok) return undefined;
    const reg = (await res.json()) as RewardRegistry;
    await env.STW_KV.put(KEY.registry, JSON.stringify(reg), { expirationTtl: REGISTRY_TTL });
    return reg;
  } catch {
    return undefined; // normalizer falls back to curated labels
  }
}

/** Append today's V-Bucks total to the running daily history (1 write/day, no extra Epic calls). */
async function updateHistory(env: Env, home: HomeData, generatedAt: string): Promise<VBucksHistory> {
  const day = generatedAt.slice(0, 10); // YYYY-MM-DD (UTC)
  const today = sumVbucks(home);
  const prev = (await env.STW_KV.get<VBucksHistory>(KEY.history, "json")) ?? { today: 0, daily: {} };
  const daily = { ...prev.daily, [day]: today };
  const hist: VBucksHistory = { today, daily };
  await env.STW_KV.put(KEY.history, JSON.stringify(hist));
  return hist;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function sumVbucks(home: HomeData): number {
  return home.vbucks.reduce((s, v) => s + v.amount, 0);
}

function isStale(home: HomeData): boolean {
  return Date.now() > Date.parse(home.meta.expiresAt);
}

function cacheHeaders(home: HomeData): Record<string, string> {
  const secs = Math.max(0, Math.floor((Date.parse(home.meta.expiresAt) - Date.now()) / 1000));
  return {
    "Cache-Control": `public, max-age=${secs}, s-maxage=${secs}, stale-while-revalidate=86400`,
    ETag: `"${home.meta.generatedAt}"`,
  };
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...headers },
  });
}
