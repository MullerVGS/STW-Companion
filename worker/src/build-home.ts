// Etapa 2 — run the pure normalizer over a payload and print a human summary so we
// can eyeball it against the reference UI. Reads the committed fixture (`--fixture`)
// or the live dump in .data/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dataDir, fixturesDir, repoRoot } from "./env";
import { normalizeHome } from "./normalize";
import type { RewardRegistry } from "./types";

const useFixture = process.argv.includes("--fixture");
const dir = useFixture ? fixturesDir() : dataDir();
const worldFile = useFixture ? "world-info.sample.json" : "world-info.json";
const catalogFile = useFixture ? "catalog.sample.json" : "catalog.json";

const world = JSON.parse(readFileSync(dir + worldFile, "utf8"));
let catalog: any = null;
try {
  catalog = JSON.parse(readFileSync(dir + catalogFile, "utf8"));
} catch {
  /* catalog optional */
}

// Reward registry from the data pipeline (real names/icons). Optional: falls back
// to curated labels if `npm run data:build` hasn't been run.
let registry: RewardRegistry | undefined;
try {
  registry = JSON.parse(
    readFileSync(repoRoot() + "web/public/data/reward-registry.json", "utf8"),
  ) as RewardRegistry;
} catch {
  /* registry optional */
}

const generatedAt = new Date().toISOString();
const home = normalizeHome(world, catalog, { generatedAt, registry });

const outPath = dataDir() + "home.json";
writeFileSync(outPath, JSON.stringify(home, null, 2));

// Also publish for local SPA dev (served by Vite at /data/home.json). In prod the
// SPA points VITE_HOME_URL at the deployed Worker instead.
try {
  mkdirSync(repoRoot() + "web/public/data", { recursive: true });
  writeFileSync(repoRoot() + "web/public/data/home.json", JSON.stringify(home));
} catch {
  /* web/public/data may not exist until `npm run data:build` has run */
}

// ── pretty summary ────────────────────────────────────────────────────────────
const L = (s = "") => console.log(s);
L(`source: ${useFixture ? "fixture" : "live .data"}   reset/expires: ${home.meta.resetAt}`);
L(`registry: ${registry ? Object.keys(registry).length + " entries" : "MISSING — run `npm run data:build` (using curated fallback)"}`);
L(`theaters kept: ${home.theaters.map((t) => `${t.name}[${t.short}/${t.kind}]`).join(", ")}`);

L(`\n── V-Bucks missions (${home.vbucks.length}) ──`);
for (const v of home.vbucks) {
  L(`  ${v.theaterShort.padEnd(4)} PL${String(v.powerLevel ?? "?").padStart(3)}  ${v.amount}x V-Bucks  (${v.objective ?? "?"})`);
}
L(`  total today: ${home.vbucks.reduce((s, v) => s + v.amount, 0)} V-Bucks`);

L(`\n── Weekly Supercharger ──\n  ${home.supercharger ? home.supercharger.label + "  [" + home.supercharger.templateId + "]" : "(none in catalog)"}`);

L(`\n── Alert Summary (qty per theater | total = all incl. ventures) ──`);
L(`  ${"Reward".padEnd(22)} ${"SW".padStart(6)} ${"PT".padStart(6)} ${"CV".padStart(6)} ${"TP".padStart(6)} ${"Total".padStart(7)}`);
for (const r of home.alertSummary) {
  const p = r.perTheater;
  L(
    `  ${r.label.padEnd(22)} ${String(p.SW).padStart(6)} ${String(p.PT).padStart(6)} ${String(p.CV).padStart(6)} ${String(p.TP).padStart(6)} ${String(r.total).padStart(7)}`,
  );
}

L(`\n── Honorable rewards (named loot) — top 12 of ${home.honorable.length} ──`);
for (const h of home.honorable.slice(0, 12)) {
  L(`  ${h.theaterShort.padEnd(4)} PL${String(h.powerLevel ?? "?").padStart(3)}  ${(h.rarity ?? "?").padEnd(9)} ${h.kind.padEnd(9)} ${h.label}${h.level ? "  (lvl " + h.level + ")" : ""}`);
}

L(`\ncounts: alerts=${home.alerts.length} missions=${home.missions.length} summaryRows=${home.alertSummary.length}`);
L(`wrote ${outPath} (${(JSON.stringify(home).length / 1024).toFixed(0)} KB)`);
