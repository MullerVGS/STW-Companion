/**
 * Normalized domain model — the canonical shape consumed by the web app.
 * Keep this file as the single source of truth for data shapes; `web/src/types.ts`
 * mirrors the public subset that ships in web/public/data/*.json.
 */

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export const RARITY_ORDER: readonly Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

/** A source that contributed or confirmed a record — enables cross-reference. */
export type DataSource = "banjo" | "fortnitedb" | "fandom" | "manual";

export interface ImageSet {
  /** square item icon used in grids and the book */
  icon?: string;
  /** smaller preview, if distinct from the icon */
  small?: string;
  /** large detailed art for the item detail view */
  large?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schematics (weapons / traps)
// ─────────────────────────────────────────────────────────────────────────────

/** Top-level Collection Book sections for the schematics category. */
export type SchematicCategory = "ranged" | "melee" | "trap";

/** Loose stat passthrough, kept per category so the UI can render what exists. */
export interface SchematicStats {
  ranged?: Record<string, unknown>;
  melee?: Record<string, unknown>;
  trap?: Record<string, unknown>;
}

/** One resolved crafting ingredient line. */
export interface CraftIngredient {
  id: string;
  name: string;
  qty: number;
  icon?: string;
}

/** A weapon perk (alteration) slot: the human-readable options it can roll. */
export interface PerkSlot {
  requiredLevel?: number;
  /** display strings of the top-tier alteration in each option group */
  options: string[];
}

export interface Schematic {
  /** stable, URL-safe id: `${slug(name)}-${rarity}` */
  id: string;
  /** representative BanjoBotAssets template key (provenance / dedupe) */
  templateId?: string;
  name: string;
  description?: string;
  rarity: Rarity;
  category: SchematicCategory;
  /** normalized weapon/trap subtype label, e.g. "Assault", "Sword", "Wall" */
  subType?: string;
  /** ranged weapons only */
  ammoType?: string;
  /** weapon fire mode (Automatic / OnPress / OnRelease); empty for traps */
  triggerType?: string;
  /** crafting material evolution path (e.g. "Ore", "Crystal") when present */
  evoType?: string;
  /** highest tier observed across merged variants */
  tier?: number;
  /** computed base DPS (ranged only), from base mid-range damage × fire rate */
  dps?: number;
  images: ImageSet;
  stats?: SchematicStats;
  craftingCost?: CraftIngredient[];
  /** the alteration (perk) pool this weapon can roll, by slot */
  perkSlots?: PerkSlot[];
  /** denormalized facet tag ids for fast filtering & cross-linking (see facets.ts) */
  tags: string[];
  sources: DataSource[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Heroes
// ─────────────────────────────────────────────────────────────────────────────

export type HeroClass = "Soldier" | "Constructor" | "Ninja" | "Outlander";

export interface Perk {
  /** raw template id, e.g. Kit_Perk_H_Buckle_T01 */
  templateId?: string;
  name: string;
  description: string;
  images?: ImageSet;
}

export interface Hero {
  /** stable id: `${slug(name)}-${rarity}-${slug(class)}` */
  id: string;
  templateId?: string;
  name: string;
  class: HeroClass;
  rarity: Rarity;
  /** collection-book set key (derived), e.g. "pirate" */
  set: string;
  /** friendly set label, e.g. "Pirate Heroes" */
  setLabel: string;
  /** curated location text, e.g. "Found inside Pirate Llamas in the Llama Shop." */
  location?: string;
  /** flavor text */
  description?: string;
  heroPerk?: Perk;
  commanderPerk?: Perk;
  /** class-level perks shared by all heroes of this class */
  classPerks: Perk[];
  perkRequirement?: string;
  /** ids into abilities.json (resolved client-side) */
  abilityIds: string[];
  tier?: number;
  images: ImageSet;
  tags: string[];
  sources: DataSource[];
}

/** Shared ability lookup, referenced by Hero.abilityIds. */
export interface Ability {
  id: string;
  name: string;
  description?: string;
  cooldown?: number;
  energyCost?: number;
  stats?: Record<string, number>;
  images: ImageSet;
}

// ─────────────────────────────────────────────────────────────────────────────
// Personnel (survivors / leads / mythic leads) + defenders
// ─────────────────────────────────────────────────────────────────────────────

export type PersonnelKind = "survivor" | "mythic-survivor" | "lead" | "mythic-lead";

export interface Survivor {
  id: string;
  templateId?: string;
  name: string;
  kind: PersonnelKind;
  /** squad / job type, e.g. "Doctor", "Explorer" (Worker.SubType) */
  squad?: string;
  /** personality, cleaned from "IsCompetitive" -> "Competitive" */
  personality?: string;
  rarity: Rarity;
  description?: string;
  tier?: number;
  images: ImageSet;
  tags: string[];
  sources: DataSource[];
}

export interface Defender {
  id: string;
  templateId?: string;
  name: string;
  /** weapon specialization, e.g. "Assault" (from "Assault Defender") */
  weaponType?: string;
  rarity: Rarity;
  description?: string;
  tier?: number;
  images: ImageSet;
  tags: string[];
  sources: DataSource[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection Book taxonomy + dataset meta
// ─────────────────────────────────────────────────────────────────────────────

export type DatasetName = "heroes" | "survivors" | "defenders" | "schematics";

/** A field=value predicate the web applies to select a subcategory's records. */
export interface BookFilter {
  field: string;
  value: string;
}

/** A clickable subcategory inside a section (a set, weapon type, squad, ...). */
export interface BookSubcategory {
  key: string;
  label: string;
  dataset: DatasetName;
  /** all predicates must match (e.g. category=ranged AND subType=Sniper) */
  match?: BookFilter[];
  count: number;
}

/** A top-level Collection Book section (Heroes, Personnel, Ranged, ...). */
export interface BookSection {
  key: string;
  label: string;
  subcategories: BookSubcategory[];
}

export interface DatasetMeta {
  generatedAt: string;
  source: "assets.json" | "sample.assets.json";
  counts: {
    heroes: number;
    abilities: number;
    survivors: number;
    defenders: number;
    schematics: number;
    byRarity: Record<string, number>;
  };
  iconsCopied: number;
}
