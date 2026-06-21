/**
 * Reward registry: template id -> { name, rarity, icon } for every NamedItem that
 * can show up as a live mission/alert/store reward. This is what lets the Worker
 * turn raw `world/info` reward ids (e.g. "Hero:hid_commando_007_uc_t01",
 * "AccountResource:currency_mtxswap", "GameplayModifier:minibossenable...") into
 * real names + icons + rarity without shipping the whole Collection Book dataset.
 *
 * Also includes MissionGen entries (keyed by the full generator path), so the
 * Worker resolves real objective names ("Ride The Lightning", "Backstage", …)
 * instead of guessing from the token — the export's DisplayName is authoritative
 * (the world/info `missionGenerator` path IS the NamedItems key).
 *
 * Keyed by the **lowercased** template id, because `world/info` serializes ids in
 * lowercase while NamedItems are PascalCase (same convention as lookups.ts).
 *
 * Output: web/public/data/reward-registry.json (fetched once/day by the Worker).
 */

import type { RawAssets, RawNamedItem } from "./banjo-types.js";
import type { Rarity } from "./schema.js";
import { compact } from "./util.js";

export interface RewardEntry {
  name: string;
  rarity?: Rarity;
  /** raw image path; rewritten to a web `/icons/*.webp` URL by the build step */
  icon?: string;
}

export type RewardRegistry = Record<string, RewardEntry>;

/** Prefixes that can appear as rewards in world/info or the storefront catalog. */
const REWARD_PREFIXES = new Set([
  "Hero",
  "Worker",
  "Defender",
  "Schematic",
  "AccountResource",
  "CardPack",
  "GameplayModifier",
]);

const RARITIES: ReadonlySet<string> = new Set<Rarity>([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
]);

function normRarity(raw: string | undefined): Rarity | undefined {
  if (!raw) return undefined;
  const r = raw.trim().toLowerCase();
  return RARITIES.has(r) ? (r as Rarity) : undefined;
}

export function importRewards(raw: RawAssets): RewardRegistry {
  const items = raw.NamedItems ?? {};
  const registry: RewardRegistry = {};

  for (const [id, it] of Object.entries(items) as [string, RawNamedItem][]) {
    const prefix = id.split(":")[0] ?? "";
    const isObjective = it.Type === "MissionGen"; // keyed by full generator path
    if (!REWARD_PREFIXES.has(prefix) && !isObjective) continue;

    const name = it.DisplayName?.trim() || it.Name?.trim() || id.split(":")[1] || id;
    const icon =
      it.ImagePaths?.SmallPreview ?? it.ImagePaths?.Icon ?? it.ImagePaths?.LargePreview;

    registry[id.toLowerCase()] = compact({
      name,
      rarity: normRarity(it.Rarity),
      icon,
    }) as RewardEntry;
  }

  return registry;
}
