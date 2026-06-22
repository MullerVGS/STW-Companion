/**
 * Facets are the clickable, cross-linking attributes. Each facet yields values;
 * each value carries the ids of the records that have it, so the UI can filter
 * instantly client-side. Facets are built per dataset (heroes, survivors,
 * defenders, schematics) and the web app shows the ones relevant to the section.
 */

import {
  RARITY_ORDER,
  type Defender,
  type Hero,
  type PerkEntity,
  type Schematic,
  type Survivor,
} from "./schema.js";
import { tagId, titleCase } from "./util.js";

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

interface Indexed {
  id: string;
}
interface FacetDef<T> {
  facet: string;
  label: string;
  get: (r: T) => string | string[] | undefined;
  /** display label for a value (defaults to titleCase) */
  labelOf?: (r: T, value: string) => string;
  /** resolved icon URL for a value (for icon-bearing chips / search results) */
  iconOf?: (r: T, value: string) => string | undefined;
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
            icon: def.iconOf ? def.iconOf(r, value) : undefined,
            count: 0,
          };
          byValue.set(id, fv);
        }
        if (!fv.icon && def.iconOf) fv.icon = def.iconOf(r, value);
        fv.count++;
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
  { facet: "heroPerk", label: "Standard Perk", get: (h) => h.heroPerk?.name, labelOf: (_h, v) => v, iconOf: (h) => h.heroPerk?.images?.icon },
  { facet: "commanderPerk", label: "Commander Perk", get: (h) => h.commanderPerk?.name, labelOf: (_h, v) => v, iconOf: (h) => h.commanderPerk?.images?.icon },
  { facet: "classPerk", label: "Class Perk", get: (h) => h.classPerks.map((p) => p.name), labelOf: (_h, v) => v, iconOf: (h, v) => h.classPerks.find((p) => p.name === v)?.images?.icon },
  { facet: "rarity", label: "Rarity", get: (h) => h.rarity },
];
const SURVIVOR_DEFS: FacetDef<Survivor>[] = [
  { facet: "kind", label: "Type", get: (s) => s.kind, labelOf: (_s, v) => KIND_LABEL[v] ?? titleCase(v) },
  { facet: "squad", label: "Squad", get: (s) => s.squad, iconOf: (s) => s.badgeImages?.squad },
  { facet: "personality", label: "Personality", get: (s) => s.personality, iconOf: (s) => s.badgeImages?.personality },
  { facet: "rarity", label: "Rarity", get: (s) => s.rarity },
];
const DEFENDER_DEFS: FacetDef<Defender>[] = [
  { facet: "weaponType", label: "Weapon", get: (d) => d.weaponType },
  { facet: "gender", label: "Gender", get: (d) => d.gender },
  { facet: "rarity", label: "Rarity", get: (d) => d.rarity },
];
/** unique perk families a schematic can roll, across all of its slots */
const perkFamiliesOf = (s: Schematic): string[] => {
  const out = new Set<string>();
  for (const sl of s.perkSlots ?? []) for (const id of sl.perkIds) out.add(id);
  return [...out];
};

/**
 * Schematic facets need the perk registry to label/icon the perk facets, so
 * they're built as a function. Weapon perks (ranged/melee) and trap perks are
 * kept in separate facets — they're conceptually different pools.
 */
function schematicDefs(perks: Record<string, PerkEntity>): FacetDef<Schematic>[] {
  const perkLabel = (fam: string) => perks[fam]?.name ?? titleCase(fam);
  const perkIcon = (fam: string) => perks[fam]?.images?.icon;
  // one perk facet per category so each section (Ranged / Melee / Traps) shows
  // only the perks its own records can roll, with correct per-section counts.
  const perkFacet = (facet: string, label: string, category: string): FacetDef<Schematic> => ({
    facet,
    label,
    get: (s) => (s.category === category ? perkFamiliesOf(s) : undefined),
    labelOf: (_s, v) => perkLabel(v),
    iconOf: (_s, v) => perkIcon(v),
  });
  return [
    { facet: "subType", label: "Weapon / Trap Type", get: (s) => s.subType },
    { facet: "rarity", label: "Rarity", get: (s) => s.rarity },
    { facet: "ammoType", label: "Ammo", get: (s) => s.ammoType },
    { facet: "triggerType", label: "Fire Mode", get: (s) => s.triggerType },
    { facet: "evoType", label: "Material", get: (s) => s.evoType },
    perkFacet("rangedPerk", "Weapon Perk", "ranged"),
    perkFacet("meleePerk", "Weapon Perk", "melee"),
    perkFacet("trapPerk", "Trap Perk", "trap"),
  ];
}

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
  perks: Record<string, PerkEntity>;
}): FacetsByDataset {
  return {
    heroes: build(d.heroes, HERO_DEFS),
    survivors: build(d.survivors, SURVIVOR_DEFS),
    defenders: build(d.defenders, DEFENDER_DEFS),
    schematics: build(d.schematics, schematicDefs(d.perks)),
  };
}
