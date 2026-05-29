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

/** Top-level Collection Book sections for the schematics category. */
export type SchematicCategory = "ranged" | "melee" | "trap";

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

/** Loose stat passthrough, kept per category so the UI can render what exists. */
export interface SchematicStats {
  ranged?: Record<string, unknown>;
  melee?: Record<string, unknown>;
  trap?: Record<string, unknown>;
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
  /**
   * During import these hold raw source paths; the build step rewrites them to
   * web URLs (e.g. "/icons/xxx.png") and copies the files, or drops them when
   * no real file is present (the UI then renders a rarity-colored placeholder).
   */
  images: ImageSet;
  stats?: SchematicStats;
  craftingCost?: Record<string, number>;
  /** denormalized facet tag ids for fast filtering & cross-linking (see facets.ts) */
  tags: string[];
  /** sources that contributed this record */
  sources: DataSource[];
  /** field-level disagreements between sources, surfaced for manual review */
  conflicts?: Record<string, Partial<Record<DataSource, unknown>>>;
}

export interface DatasetMeta {
  generatedAt: string;
  source: "assets.json" | "sample.assets.json";
  counts: {
    schematics: number;
    byCategory: Record<string, number>;
    byRarity: Record<string, number>;
  };
  facetGroups: number;
  iconsCopied: number;
}
