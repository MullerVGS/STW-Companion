// Curated reference maps that resolve raw Epic template ids into render-ready labels.
// Every entry here was confirmed against a REAL world/info + catalog payload (see
// research in docs / memory). Uncertain mappings fall back to a humanized token and
// are flagged `// TODO confirm` — never invented as fact.

import powerLevelsJson from "./data/power-levels.json";
import type { ModifierRef, Rarity, RewardKind, RewardRegistry } from "./types";

const POWER = powerLevelsJson as Record<string, number | null>;

// ── Theaters ────────────────────────────────────────────────────────────────
// The 4 core campaign theaters have STABLE GUIDs across seasons. Ventures rotate,
// so they're detected by data (flags/name) rather than hardcoded ids.
export const CAMPAIGN_THEATERS: Record<string, { short: string; name: string; order: number }> = {
  "33A2311D4AE64B361CCE27BC9F313C8B": { short: "SW", name: "Stonewood", order: 1 },
  "D477605B4FA48648107B649CE97FCF27": { short: "PT", name: "Plankerton", order: 2 },
  "E6ECBD064B153234656CB4BDE6743870": { short: "CV", name: "Canny Valley", order: 3 },
  "D9A801C5444D1C74D1B7DAB5C7C12C5B": { short: "TP", name: "Twine Peaks", order: 4 },
};

export const MAIN_SHORTS = ["SW", "PT", "CV", "TP"] as const;

/** Keep only player-facing theaters (drop [TEST]/Homebase/duplicate utility theaters). */
export function isPlayerTheater(t: any): boolean {
  if (CAMPAIGN_THEATERS[t?.uniqueId]) return true;
  if (t?.bIsTestTheater || t?.bHideLikeTestTheater) return false;
  const name = String(t?.displayName ?? "");
  if (/\[test\]/i.test(name) || /^homebase$/i.test(name)) return false;
  // Non-gameplay theater types (a Tutorial "Stonewood" dupe, the "HestiaBeauty" Homebase).
  const type = String(t?.runtimeInfo?.theaterType ?? "");
  if (/tutorial|hestia/i.test(type)) return false;
  // Utility/duplicate theaters carry almost no regions.
  if (Array.isArray(t?.regions) && t.regions.length <= 1) return false;
  return true;
}

export function theaterShort(theaterId: string): string {
  return CAMPAIGN_THEATERS[theaterId]?.short ?? "VENT";
}

export function isMainTheater(theaterId: string): boolean {
  return !!CAMPAIGN_THEATERS[theaterId];
}

// ── Rarity ──────────────────────────────────────────────────────────────────
const RARITY_BY_CODE: Record<string, Rarity> = {
  c: "common",
  uc: "uncommon",
  r: "rare",
  vr: "epic",
  sr: "legendary",
  ur: "mythic",
};

/** "Hero:hid_commando_007_uc_t01" -> "uncommon" (best-effort from the rarity token). */
export function rarityFromTemplate(templateId: string): Rarity | undefined {
  const m = templateId.toLowerCase().match(/_(c|uc|r|vr|sr|ur)_t\d+$/) || templateId.toLowerCase().match(/_(c|uc|r|vr|sr|ur)(?:_|$)/);
  return m ? RARITY_BY_CODE[m[1]] : undefined;
}

// ── AccountResource rewards (confirmed vs the print's Alert Summary) ──────────
interface ResourceDef {
  kind: RewardKind;
  label: string;
  rarity?: Rarity;
}
const RESOURCE_REWARDS: Record<string, ResourceDef> = {
  currency_mtxswap: { kind: "vbucks", label: "V-Bucks" },
  // Perk-Up (rarity-tiered) — shown as separate rows in the summary.
  reagent_alteration_upgrade_uc: { kind: "perkup", label: "Uncommon Perk-Up", rarity: "uncommon" },
  reagent_alteration_upgrade_r: { kind: "perkup", label: "Rare Perk-Up", rarity: "rare" },
  reagent_alteration_upgrade_vr: { kind: "perkup", label: "Epic Perk-Up", rarity: "epic" },
  reagent_alteration_upgrade_sr: { kind: "perkup", label: "Legendary Perk-Up", rarity: "legendary" },
  reagent_alteration_generic: { kind: "reperk", label: "RE-PERK!" },
  // Elemental perk-ups.
  reagent_alteration_ele_fire: { kind: "elemental", label: "FIRE-UP!" },
  reagent_alteration_ele_water: { kind: "elemental", label: "FROST-UP!" },
  reagent_alteration_ele_nature: { kind: "elemental", label: "AMP-UP!" },
  // Evolution materials.
  reagent_c_t01: { kind: "evomat", label: "Pure Drop of Rain" },
  reagent_c_t02: { kind: "evomat", label: "Lightning in a Bottle" },
  reagent_c_t03: { kind: "evomat", label: "Eye of the Storm" },
  reagent_c_t04: { kind: "evomat", label: "Storm Shard" },
  // Flux.
  reagent_evolverarity_r: { kind: "flux", label: "Rare Flux", rarity: "rare" },
  reagent_evolverarity_vr: { kind: "flux", label: "Epic Flux", rarity: "epic" },
  reagent_evolverarity_sr: { kind: "flux", label: "Legendary Flux", rarity: "legendary" },
  // Currencies / XP.
  campaign_event_currency: { kind: "tickets", label: "Event Tickets" },
  eventcurrency_scaling: { kind: "tickets", label: "Venture Currency" },
  eventcurrency_roadtrip: { kind: "tickets", label: "Road Trip Tickets" },
  phoenixxp_reward: { kind: "ventureXp", label: "Venture XP" },
  peoplexp: { kind: "xp", label: "Survivor XP" },
  // Superchargers (also appear as catalog grants).
  reagent_promotion_heroes: { kind: "resource", label: "Hero Supercharger" },
  reagent_promotion_schematics: { kind: "resource", label: "Schematic Supercharger" },
  reagent_promotion_survivors: { kind: "resource", label: "Survivor Supercharger" },
  reagent_promotion_defenders: { kind: "resource", label: "Defender Supercharger" }, // TODO confirm token
};

// CardPack reward prefixes (mission base rewards). Matched by startsWith.
const CARDPACK_PREFIXES: Array<[string, ResourceDef]> = [
  ["zcp_personnelxp", { kind: "xp", label: "Survivor XP" }],
  ["zcp_schematicxp", { kind: "xp", label: "Schematic XP" }],
  ["zcp_heroxp", { kind: "xp", label: "Hero XP" }],
  ["zcp_phoenixxp", { kind: "ventureXp", label: "Venture XP" }],
  ["zcp_eventscaling", { kind: "tickets", label: "Event XP" }],
  ["zcp_mayday", { kind: "cardpack", label: "Mayday Pack" }],
  ["zcp_voucher", { kind: "cardpack", label: "Voucher" }],
  ["zcp_reagent_alteration_generic", { kind: "reperk", label: "RE-PERK! Pack" }],
  ["zcp_reagent_alteration_upgrade", { kind: "perkup", label: "Perk-Up Pack" }],
  ["zcp_reagent_c", { kind: "evomat", label: "Evo Mat Pack" }],
  ["cardpack_bronze", { kind: "cardpack", label: "Upgrade Llama" }],
  ["cardpack_jackpot", { kind: "cardpack", label: "Troll Stash Llama" }],
];

export interface ResolvedReward {
  kind: RewardKind;
  label: string;
  rarity?: Rarity;
  icon?: string | null;
}

/**
 * Resolve a reward template id. The semantic `kind` always comes from the curated
 * maps (grouping is our concept, not the game's); `label`/`rarity`/`icon` prefer
 * the reward-registry (real game data) and fall back to the curated maps.
 */
export function resolveReward(templateId: string, registry?: RewardRegistry): ResolvedReward {
  const base = resolveRewardCurated(templateId);
  const reg = registry?.[templateId.toLowerCase()];
  if (!reg) return base;
  return {
    kind: base.kind,
    label: reg.name || base.label,
    rarity: reg.rarity ?? base.rarity,
    icon: reg.icon ?? null,
  };
}

/** Curated kind + best-effort label/rarity, used as the registry's fallback. */
function resolveRewardCurated(templateId: string): ResolvedReward {
  const [prefix, pathRaw = ""] = templateId.split(":");
  const path = pathRaw.toLowerCase();
  switch (prefix) {
    case "AccountResource": {
      const def = RESOURCE_REWARDS[path];
      if (def) return def;
      return { kind: "resource", label: humanize(path) };
    }
    case "CardPack": {
      for (const [pre, def] of CARDPACK_PREFIXES) if (path.startsWith(pre)) return def;
      return { kind: "cardpack", label: humanize(path) };
    }
    case "Hero":
      return { kind: "hero", label: humanize(path), rarity: rarityFromTemplate(templateId) };
    case "Worker":
      return { kind: "survivor", label: humanize(path), rarity: rarityFromTemplate(templateId) };
    case "Defender":
      return { kind: "defender", label: humanize(path), rarity: rarityFromTemplate(templateId) };
    case "Schematic":
      return { kind: "schematic", label: humanize(path), rarity: rarityFromTemplate(templateId) };
    default:
      return { kind: "other", label: humanize(path || templateId) };
  }
}

export const NAMED_KINDS: ReadonlySet<RewardKind> = new Set<RewardKind>([
  "hero",
  "survivor",
  "defender",
  "schematic",
]);

// ── Objectives (from missionGenerator) ───────────────────────────────────────
// Confirmed STW objective names; unmatched codes fall back to a humanized token.
const OBJECTIVES: Record<string, string> = {
  RtS: "Rescue the Survivors",
  RtD: "Retrieve the Data",
  RetrieveTheData: "Retrieve the Data",
  RtL: "Ride the Lightning",
  RideTheLightning: "Ride the Lightning",
  DtB: "Deliver the Bomb",
  DtE: "Destroy the Encampments",
  DestroyTheEncampments: "Destroy the Encampments",
  EtSurvivors: "Evacuate the Survivors",
  EvacuateTheSurvivors: "Evacuate the Survivors",
  EliminateAndCollect: "Eliminate and Collect",
  BuildtheRadarGrid: "Build the Radar Grid",
  RefuelTheBase: "Refuel the Homebase",
  Resupply: "Resupply",
  LtB: "Launch the Balloon",
  LaunchTheBalloon: "Launch the Balloon",
  Mayday: "Mayday",
  "1Gate": "Fight the Storm",
  "2Gates": "Fight the Storm",
  "3Gates": "Fight the Storm",
  "4Gates": "Fight the Storm",
  Gates: "Fight the Storm",
  Cat1FtS: "Category 1 Fight the Storm",
  TheOutpost: "Build the Outpost",
};

const THREAT_PREFIX = /^(VHT|VLT|VLG|HT|MT|LT|LG)_/;

/**
 * "/SaveTheWorld/.../MissionGen_T2_R2_RtD.MissionGen_T2_R2_RtD_C" -> { code, name }.
 * Prefers the export's real DisplayName (via the registry, keyed by the full path —
 * authoritative; e.g. "VHT_LtB" is actually "Ride The Lightning") and falls back to
 * the curated token map / humanized token when offline.
 */
export function resolveObjective(
  generator: string | undefined,
  registry?: RewardRegistry,
): { code: string; name: string } {
  if (!generator) return { code: "", name: "Unknown" };
  let token = generator.split("/").pop()?.split(".")[0] ?? "";
  token = token
    .replace(/^MissionGen_/, "")
    .replace(/_C$/, "")
    .replace(/_Group.*$/, "")
    .replace(/_PVE.*$/i, "")
    .replace(/_NoSecondary$|_NoBonus$|_Tutorial$/i, "")
    .replace(/^T\d+_R?\d*_?/i, "")
    .replace(/_WR$/i, "");
  while (THREAT_PREFIX.test(token)) token = token.replace(THREAT_PREFIX, "");
  const name = registry?.[generator.toLowerCase()]?.name || OBJECTIVES[token] || humanize(token);
  return { code: token, name };
}

// ── Power level ──────────────────────────────────────────────────────────────
export function powerLevel(rowName: string | undefined): number | null {
  if (!rowName) return null;
  const v = POWER[rowName];
  return typeof v === "number" ? v : null;
}

// ── Modifiers ────────────────────────────────────────────────────────────────
const MODIFIERS: Record<string, string> = {
  minibossenableprimarymissionitem: "Mini-Boss",
  elementalzonefireenableitem: "Fire Zone",
  elementalzonewaterenableitem: "Water Zone",
  elementalzonenatureenableitem: "Nature Zone",
};
export function resolveModifier(templateId: string, registry?: RewardRegistry): ModifierRef {
  const reg = registry?.[templateId.toLowerCase()];
  const path = templateId.split(":")[1] ?? templateId;
  const label = reg?.name || MODIFIERS[path.toLowerCase()] || humanize(path.replace(/^gm_/, ""));
  return { templateId, label, icon: reg?.icon ?? null };
}

// ── Supercharger (catalog) ───────────────────────────────────────────────────
const SUPERCHARGER_LABELS: Record<string, string> = {
  reagent_promotion_heroes: "Hero Supercharger",
  reagent_promotion_schematics: "Schematic Supercharger",
  reagent_promotion_survivors: "Survivor Supercharger",
  reagent_promotion_defenders: "Defender Supercharger", // TODO confirm token
};

/** Find the current Weekly Supercharger from the catalog (STWSpecialEventStorefront). */
export function findSupercharger(
  catalog: any,
  registry?: RewardRegistry,
): { templateId: string; label: string; icon?: string | null } | null {
  for (const front of catalog?.storefronts ?? []) {
    for (const entry of front.catalogEntries ?? []) {
      for (const grant of entry.itemGrants ?? []) {
        const tid: string = grant.templateId ?? grant;
        const path = (tid.split(":")[1] ?? "").toLowerCase();
        if (path.startsWith("reagent_promotion_")) {
          const reg = registry?.[tid.toLowerCase()];
          return {
            templateId: tid,
            label: reg?.name || SUPERCHARGER_LABELS[path] || humanize(path),
            icon: reg?.icon ?? null,
          };
        }
      }
    }
  }
  return null;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function humanize(token: string): string {
  return token
    .replace(/^[a-z]+_/i, (m) => m) // keep, just normalize separators below
    .replace(/[_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
