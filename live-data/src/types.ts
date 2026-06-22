// Public contract for the daily STW "Home" surface. Produced by the scheduled
// GitHub Action and consumed as static JSON by the SPA.

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type TheaterKind = "campaign" | "venture" | "special";

/** Reward "kind" — drives grouping/icon choice. */
export type RewardKind =
  | "vbucks"
  | "perkup" // reagent_alteration_upgrade_* (by rarity)
  | "reperk" // reagent_alteration_generic
  | "elemental" // FIRE-UP! / FROST-UP! / AMP-UP!
  | "evomat" // pure drop / lightning / eye / shard
  | "flux" // reagent_evolverarity_*
  | "tickets" // event/venture currency
  | "ventureXp"
  | "xp" // hero/survivor/schematic XP card packs
  | "hero"
  | "survivor"
  | "defender"
  | "schematic"
  | "cardpack"
  | "resource"
  | "other";

export interface HomeTheater {
  id: string;
  name: string;
  short: string; // SW / PT / CV / TP / VENT / ...
  kind: TheaterKind;
  order: number;
  event?: string;
}

export interface RewardRef {
  templateId: string; // raw, e.g. "AccountResource:currency_mtxswap"
  kind: RewardKind;
  label: string; // friendly, e.g. "V-Bucks", "Legendary Perk-Up"
  rarity?: Rarity; // when derivable from the template suffix
  quantity: number;
  level?: number; // attributes.desired_level (hero/survivor/defender rewards)
  icon?: string | null; // filled later from the reward-registry (etapa 3)
}

export interface ModifierRef {
  templateId: string;
  label: string;
  icon?: string | null;
}

export interface MissionLite {
  guid: string;
  theaterId: string;
  tileIndex: number;
  objective: string; // friendly mission name
  objectiveCode: string; // raw generator token (provenance)
  powerLevel: number | null; // RecommendedRating
  difficultyRow: string; // raw rowName (provenance)
  rewards: RewardRef[];
}

export interface AlertLite {
  guid: string;
  theaterId: string;
  tileIndex: number;
  category: string;
  objective: string | null; // joined from the mission on the same tile
  objectiveCode: string | null;
  powerLevel: number | null;
  rewards: RewardRef[];
  modifiers: ModifierRef[];
  hasVbucks: boolean;
  vbucks: number;
}

export interface VBucksMission {
  guid: string;
  theaterId: string;
  theaterShort: string;
  tileIndex: number;
  objective: string | null;
  powerLevel: number | null;
  amount: number;
}

export interface AlertSummaryRow {
  key: string; // templateId (stable group key)
  kind: RewardKind;
  label: string;
  rarity?: Rarity;
  perTheater: Record<string, number>; // main theaters: SW/PT/CV/TP
  total: number; // across ALL player theaters (incl. ventures)
  icon?: string | null;
}

/** A notable named reward (hero/survivor/defender/schematic) drawn from an alert. */
export interface HonorableReward {
  guid: string;
  theaterId: string;
  theaterShort: string;
  kind: RewardKind; // hero | survivor | defender | schematic
  templateId: string;
  label: string;
  rarity?: Rarity;
  level?: number;
  powerLevel: number | null;
}

export interface Supercharger {
  templateId: string;
  label: string;
  icon?: string | null;
}

export interface VBucksHistory {
  today: number;
  daily: Record<string, number>; // { "2026-06-20": 100 }
  official?: VBucksHistoryOfficial;
}

/** Editable official totals used while the local daily series is incomplete. */
export interface VBucksHistoryOfficial {
  asOf: string;
  today: number;
  yesterday: number;
  last7Days: number;
  last30Days: number;
  thisYear: number;
}

export interface HomeMeta {
  generatedAt: string;
  expiresAt: string; // = world/info nextRefresh
  resetAt: string;
  source: string;
  version: number;
  stale: boolean;
}

/** templateId (lowercased) -> presentation. Mirror of data/src/import-rewards.ts. */
export interface RewardEntry {
  name: string;
  rarity?: Rarity;
  icon?: string;
}
export type RewardRegistry = Record<string, RewardEntry>;

export interface HomeData {
  meta: HomeMeta;
  theaters: HomeTheater[];
  vbucks: VBucksMission[];
  vbucksHistory?: VBucksHistory; // carried forward from the previous Pages deployment
  supercharger?: Supercharger | null;
  alertSummary: AlertSummaryRow[];
  honorable: HonorableReward[];
  alerts: AlertLite[];
  missions: MissionLite[];
}
