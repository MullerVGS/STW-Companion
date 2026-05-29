/**
 * Facets are the clickable, cross-linking attributes. Each facet (rarity,
 * category, subType, ...) yields values; each value carries the ids of the
 * schematics that have it, so the UI can filter instantly client-side without
 * scanning the full dataset.
 */

import { RARITY_ORDER, type Schematic } from "./schema.js";
import { tagId, titleCase } from "./util.js";

export interface FacetValue {
  /** matches Schematic.tags entries, e.g. "rarity:legendary" */
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

/** Which schematic fields become facets, in display order, with friendly labels. */
const FACET_DEFS: { facet: string; label: string; get: (s: Schematic) => string | undefined }[] = [
  { facet: "category", label: "Category", get: (s) => s.category },
  { facet: "rarity", label: "Rarity", get: (s) => s.rarity },
  { facet: "subType", label: "Weapon / Trap Type", get: (s) => s.subType },
  { facet: "ammoType", label: "Ammo", get: (s) => s.ammoType },
  { facet: "triggerType", label: "Fire Mode", get: (s) => s.triggerType },
  { facet: "evoType", label: "Material", get: (s) => s.evoType },
];

const RARITY_RANK = new Map(RARITY_ORDER.map((r, i) => [r, i]));

function sortValues(facet: string, values: FacetValue[]): FacetValue[] {
  if (facet === "rarity") {
    return values.sort(
      (a, b) => (RARITY_RANK.get(a.value as never) ?? 99) - (RARITY_RANK.get(b.value as never) ?? 99),
    );
  }
  // most-common first, then alphabetical — keeps the sidebar useful
  return values.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildFacets(schematics: Schematic[]): FacetGroup[] {
  const groups: FacetGroup[] = [];

  for (const def of FACET_DEFS) {
    const byValue = new Map<string, FacetValue>();

    for (const s of schematics) {
      const value = def.get(s);
      if (!value) continue;
      const id = tagId(def.facet, value);
      let fv = byValue.get(id);
      if (!fv) {
        fv = {
          id,
          facet: def.facet,
          value,
          label: def.facet === "rarity" ? titleCase(value) : value,
          count: 0,
          itemIds: [],
        };
        byValue.set(id, fv);
      }
      fv.count++;
      fv.itemIds.push(s.id);
    }

    if (byValue.size === 0) continue;
    groups.push({
      facet: def.facet,
      label: def.label,
      values: sortValues(def.facet, [...byValue.values()]),
    });
  }

  return groups;
}
