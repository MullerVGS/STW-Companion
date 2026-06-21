/**
 * Public data contract — mirrors the subset of data/src/schema.ts that ships in
 * web/public/data/*.json. Keep in sync with the pipeline output.
 */

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type SchematicCategory = "ranged" | "melee" | "trap";
export type HeroClass = "Soldier" | "Constructor" | "Ninja" | "Outlander";
export type PersonnelKind = "survivor" | "mythic-survivor" | "lead" | "mythic-lead";
export type DatasetName = "heroes" | "survivors" | "defenders" | "schematics";

export interface ImageSet {
  icon?: string;
  small?: string;
  large?: string;
}

// ── Schematics ──────────────────────────────────────────────────────────────
export interface CraftIngredient {
  id: string;
  name: string;
  qty: number;
  icon?: string;
}
/** A weapon/trap alteration family — shared, linkable entity (perks.json). */
export interface PerkEntity {
  id: string;
  name: string;
  description?: string;
  statType?: string;
  scope: SchematicCategory[];
  tiers: string[];
  images?: ImageSet;
}
export interface PerkSlot {
  requiredLevel?: number;
  /** ids into the perks registry */
  perkIds: string[];
}
export interface Schematic {
  id: string;
  name: string;
  description?: string;
  rarity: Rarity;
  category: SchematicCategory;
  subType?: string;
  ammoType?: string;
  triggerType?: string;
  evoType?: string;
  tier?: number;
  dps?: number;
  images: ImageSet;
  stats?: {
    ranged?: Record<string, unknown>;
    melee?: Record<string, unknown>;
    trap?: Record<string, unknown>;
  };
  craftingCost?: CraftIngredient[];
  perkSlots?: PerkSlot[];
  tags: string[];
  sources: string[];
}

// ── Heroes / abilities ──────────────────────────────────────────────────────
export interface Perk {
  templateId?: string;
  name: string;
  description: string;
  images?: ImageSet;
}
export interface Hero {
  id: string;
  name: string;
  class: HeroClass;
  rarity: Rarity;
  set: string;
  setLabel: string;
  location?: string;
  description?: string;
  heroPerk?: Perk;
  commanderPerk?: Perk;
  classPerks: Perk[];
  perkRequirement?: string;
  abilityIds: string[];
  tier?: number;
  images: ImageSet;
  tags: string[];
  sources: string[];
}
export interface Ability {
  id: string;
  name: string;
  description?: string;
  cooldown?: number;
  energyCost?: number;
  stats?: Record<string, number>;
  images: ImageSet;
}

// ── Personnel ───────────────────────────────────────────────────────────────
export interface Survivor {
  id: string;
  name: string;
  kind: PersonnelKind;
  squad?: string;
  personality?: string;
  rarity: Rarity;
  description?: string;
  tier?: number;
  images: ImageSet;
  badgeImages?: {
    leader?: string;
    personality?: string;
    squad?: string;
  };
  tags: string[];
  sources: string[];
}
export interface Defender {
  id: string;
  name: string;
  weaponType?: string;
  rarity: Rarity;
  description?: string;
  tier?: number;
  images: ImageSet;
  tags: string[];
  sources: string[];
}

// ── Hero Loadout entities (team perks / gadgets) ────────────────────────────
export interface TeamPerk {
  id: string;
  name: string;
  description?: string;
  images: ImageSet;
}
export interface Gadget {
  id: string;
  name: string;
  description?: string;
  images: ImageSet;
}

// ── Facets + book taxonomy + meta ───────────────────────────────────────────
export interface FacetValue {
  id: string;
  facet: string;
  value: string;
  label: string;
  /** resolved icon URL for the value, when the entity behind it has one */
  icon?: string;
  count: number;
}
export interface FacetGroup {
  facet: string;
  label: string;
  values: FacetValue[];
}
export interface FacetsByDataset {
  heroes: FacetGroup[];
  survivors: FacetGroup[];
  defenders: FacetGroup[];
  schematics: FacetGroup[];
}

export interface BookFilter {
  field: string;
  value: string;
}
export interface BookSubcategory {
  key: string;
  label: string;
  dataset: DatasetName;
  match?: BookFilter[];
  count: number;
}
export interface BookSection {
  key: string;
  label: string;
  subcategories: BookSubcategory[];
}

// ── Global search index ─────────────────────────────────────────────────────
export type SearchKind =
  | "hero"
  | "survivor"
  | "defender"
  | "schematic"
  | "weaponPerk"
  | "trapPerk"
  | "heroPerk"
  | "commanderPerk"
  | "classPerk"
  | "ability"
  | "set"
  | "class"
  | "personality"
  | "squad";

export type SearchAction =
  | { k: "item"; dataset: DatasetName; id: string }
  | { k: "filter"; section: string; sub: string; tag?: string };

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  label: string;
  sub?: string;
  icon?: string;
  /** lowercased haystack */
  t: string;
  a: SearchAction;
}

export interface DatasetMeta {
  generatedAt: string;
  source: string;
  counts: {
    heroes: number;
    abilities: number;
    survivors: number;
    defenders: number;
    schematics: number;
    perks: number;
    teamPerks: number;
    gadgets: number;
    search: number;
    rewards: number;
    byRarity: Record<string, number>;
  };
  iconsCopied: number;
}

export interface Dataset {
  heroes: Hero[];
  abilities: Record<string, Ability>;
  survivors: Survivor[];
  defenders: Defender[];
  schematics: Schematic[];
  /** shared perk registry referenced by Schematic.perkSlots[].perkIds */
  perks: Record<string, PerkEntity>;
  /** hero-loadout lookups (standalone, not collection grids) */
  teamPerks: TeamPerk[];
  gadgets: Gadget[];
  /** hero-class glyph urls for the loadout class filter (class name → icon) */
  classIcons: Partial<Record<HeroClass, string>>;
  /** prebuilt global search index over items + every linkable entity */
  search: SearchEntry[];
  facets: FacetsByDataset;
  book: BookSection[];
  meta: DatasetMeta;
}

/** Any collectible record (all share id/name/rarity/images/tags). */
export type AnyItem = Hero | Survivor | Defender | Schematic;
