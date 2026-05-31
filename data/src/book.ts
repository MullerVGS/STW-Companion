/**
 * Builds the Collection Book taxonomy (sections -> subcategories) that drives
 * the left rail, mirroring the in-game book: Heroes (by set), Personnel
 * (Defenders / Survivors / Lead Survivors / Mythic Leads), and weapon/trap
 * sections grouped by type. Counts are precomputed for completion display.
 */

import { setSortKey } from "./hero-sets.js";
import type {
  BookSection,
  BookSubcategory,
  Defender,
  Hero,
  Schematic,
  Survivor,
} from "./schema.js";

interface Datasets {
  heroes: Hero[];
  survivors: Survivor[];
  defenders: Defender[];
  schematics: Schematic[];
}

/** distinct subTypes within a schematic category, with counts, sorted. */
function weaponSubcats(schematics: Schematic[], category: string): BookSubcategory[] {
  const counts = new Map<string, number>();
  for (const s of schematics) {
    if (s.category !== category || !s.subType) continue;
    counts.set(s.subType, (counts.get(s.subType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([subType, count]) => ({
      key: subType.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label: subType,
      dataset: "schematics" as const,
      match: [
        { field: "category", value: category },
        { field: "subType", value: subType },
      ],
      count,
    }));
}

export function buildBook(d: Datasets): BookSection[] {
  // Heroes by set
  const setMeta = new Map<string, { label: string; count: number }>();
  for (const h of d.heroes) {
    const m = setMeta.get(h.set) ?? { label: h.setLabel, count: 0 };
    m.count++;
    setMeta.set(h.set, m);
  }
  const heroSubs: BookSubcategory[] = [...setMeta.entries()]
    .sort((a, b) => setSortKey(a[0]).localeCompare(setSortKey(b[0])))
    .map(([key, m]) => ({
      key,
      label: m.label,
      dataset: "heroes" as const,
      match: [{ field: "set", value: key }],
      count: m.count,
    }));

  const countKind = (k: string) => d.survivors.filter((s) => s.kind === k).length;
  const personnelAll: BookSubcategory[] = [
    // spans every survivor kind so squad/personality cross-links have a landing view
    { key: "all-survivors", label: "All Survivors", dataset: "survivors", count: d.survivors.length },
    { key: "defenders", label: "Defenders", dataset: "defenders", count: d.defenders.length },
    { key: "survivors", label: "Survivors", dataset: "survivors", match: [{ field: "kind", value: "survivor" }], count: countKind("survivor") },
    { key: "mythic-survivors", label: "Mythic Survivors", dataset: "survivors", match: [{ field: "kind", value: "mythic-survivor" }], count: countKind("mythic-survivor") },
    { key: "leads", label: "Lead Survivors", dataset: "survivors", match: [{ field: "kind", value: "lead" }], count: countKind("lead") },
    { key: "mythic-leads", label: "Mythic Leads", dataset: "survivors", match: [{ field: "kind", value: "mythic-lead" }], count: countKind("mythic-lead") },
  ];

  const sections: BookSection[] = [
    { key: "heroes", label: "Heroes", subcategories: heroSubs },
    { key: "personnel", label: "Personnel", subcategories: personnelAll.filter((s) => s.count > 0) },
    { key: "ranged", label: "Ranged Weapons", subcategories: weaponSubcats(d.schematics, "ranged") },
    { key: "melee", label: "Melee Weapons", subcategories: weaponSubcats(d.schematics, "melee") },
    { key: "traps", label: "Traps", subcategories: weaponSubcats(d.schematics, "trap") },
  ];
  return sections.filter((s) => s.subcategories.length > 0);
}
