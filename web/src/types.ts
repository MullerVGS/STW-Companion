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

export interface ImageSet {
  icon?: string;
  small?: string;
  large?: string;
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
  images: ImageSet;
  stats?: {
    ranged?: Record<string, unknown>;
    melee?: Record<string, unknown>;
    trap?: Record<string, unknown>;
  };
  craftingCost?: Record<string, number>;
  tags: string[];
  sources: string[];
}

export interface FacetValue {
  id: string;
  facet: string;
  value: string;
  label: string;
  count: number;
  itemIds: string[];
}

export interface FacetGroup {
  facet: string;
  label: string;
  values: FacetValue[];
}

export interface DatasetMeta {
  generatedAt: string;
  source: string;
  counts: {
    schematics: number;
    byCategory: Record<string, number>;
    byRarity: Record<string, number>;
  };
  facetGroups: number;
  iconsCopied: number;
}

export interface Dataset {
  schematics: Schematic[];
  facets: FacetGroup[];
  meta: DatasetMeta;
}
