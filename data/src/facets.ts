/**
 * Facets are the clickable, cross-linking attributes. Each facet yields values;
 * each value carries the ids of the records that have it, so the UI can filter
 * instantly client-side. Facets are built per dataset (heroes, survivors,
 * defenders, schematics) and the web app shows the ones relevant to the section.
 */

import { RARITY_ORDER, type Defender, type Hero, type Schematic, type Survivor } from "./schema.js";
import { tagId, titleCase } from "./util.js";

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

interface Indexed {
  id: string;
}
interface FacetDef<T> {
  facet: string;
  label: string;
  get: (r: T) => string | string[] | undefined;
  /** display label for a value (defaults to titleCase) */
  labelOf?: (r: T, value: string) => string;
}

const RARITY_RANK = new Map(RARITY_ORDER.map((r, i) => [r, i]));

function sortValues(facet: string, values: FacetValue[]): FacetValue[] {
  if (facet === "rarity") {
    return values.sort(
      (a, b) => (RARITY_RANK.get(a.value as never) ?? 99) - (RARITY_RANK.get(b.value as never) ?? 99),
    );
  }
  return values.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function build<T extends Indexed>(records: T[], defs: FacetDef<T>[]): FacetGroup[] {
  const groups: FacetGroup[] = [];
  for (const def of defs) {
    const byValue = new Map<string, FacetValue>();
    for (const r of records) {
      const raw = def.get(r);
      const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const value of values) {
        const id = tagId(def.facet, value);
        let fv = byValue.get(id);
        if (!fv) {
          fv = {
            id,
            facet: def.facet,
            value,
            label: def.labelOf ? def.labelOf(r, value) : titleCase(value),
            count: 0,
            itemIds: [],
          };
          byValue.set(id, fv);
        }
        fv.count++;
        fv.itemIds.push(r.id);
      }
    }
    if (byValue.size === 0) continue;
    groups.push({ facet: def.facet, label: def.label, values: sortValues(def.facet, [...byValue.values()]) });
  }
  return groups;
}

const HERO_DEFS: FacetDef<Hero>[] = [
  { facet: "set", label: "Collection Set", get: (h) => h.set, labelOf: (h) => h.setLabel },
  { facet: "class", label: "Class", get: (h) => h.class },
  { facet: "heroPerk", label: "Standard Perk", get: (h) => h.heroPerk?.name, labelOf: (_h, v) => v },
  { facet: "commanderPerk", label: "Commander Perk", get: (h) => h.commanderPerk?.name, labelOf: (_h, v) => v },
  { facet: "classPerk", label: "Class Perk", get: (h) => h.classPerks.map((p) => p.name), labelOf: (_h, v) => v },
  { facet: "rarity", label: "Rarity", get: (h) => h.rarity },
];
const SURVIVOR_DEFS: FacetDef<Survivor>[] = [
  { facet: "kind", label: "Type", get: (s) => s.kind, labelOf: (_s, v) => KIND_LABEL[v] ?? titleCase(v) },
  { facet: "squad", label: "Squad", get: (s) => s.squad },
  { facet: "personality", label: "Personality", get: (s) => s.personality },
  { facet: "rarity", label: "Rarity", get: (s) => s.rarity },
];
const DEFENDER_DEFS: FacetDef<Defender>[] = [
  { facet: "weaponType", label: "Weapon", get: (d) => d.weaponType },
  { facet: "rarity", label: "Rarity", get: (d) => d.rarity },
];
const SCHEMATIC_DEFS: FacetDef<Schematic>[] = [
  { facet: "subType", label: "Weapon / Trap Type", get: (s) => s.subType },
  { facet: "rarity", label: "Rarity", get: (s) => s.rarity },
  { facet: "ammoType", label: "Ammo", get: (s) => s.ammoType },
  { facet: "triggerType", label: "Fire Mode", get: (s) => s.triggerType },
  { facet: "evoType", label: "Material", get: (s) => s.evoType },
];

const KIND_LABEL: Record<string, string> = {
  survivor: "Survivor",
  "mythic-survivor": "Mythic Survivor",
  lead: "Lead Survivor",
  "mythic-lead": "Mythic Lead",
};

export interface FacetsByDataset {
  heroes: FacetGroup[];
  survivors: FacetGroup[];
  defenders: FacetGroup[];
  schematics: FacetGroup[];
}

export function buildAllFacets(d: {
  heroes: Hero[];
  survivors: Survivor[];
  defenders: Defender[];
  schematics: Schematic[];
}): FacetsByDataset {
  return {
    heroes: build(d.heroes, HERO_DEFS),
    survivors: build(d.survivors, SURVIVOR_DEFS),
    defenders: build(d.defenders, DEFENDER_DEFS),
    schematics: build(d.schematics, SCHEMATIC_DEFS),
  };
}
