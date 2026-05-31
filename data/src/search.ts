/**
 * Builds the global search index (`search-index.json`): one flat list of every
 * searchable thing — items (heroes/survivors/defenders/schematics) and every
 * linkable entity (perks, abilities, sets, classes, personalities, squads).
 *
 * Entity entries are derived from the already-built facets so their ids, labels
 * and icons stay byte-for-byte consistent with the filter chips — clicking a
 * search result applies the exact same tag a chip would. Perk/ability/hero-perk
 * descriptions are folded into the haystack so a search for a word inside an
 * effect (e.g. "containers") surfaces the perk that mentions it.
 */

import type {
  Ability,
  DatasetName,
  Defender,
  Hero,
  PerkEntity,
  Schematic,
  SearchEntry,
  SearchKind,
  Survivor,
} from "./schema.js";
import type { FacetsByDataset } from "./facets.js";
import { tagId } from "./util.js";

const KIND_LABEL: Record<string, string> = {
  survivor: "Survivor",
  "mythic-survivor": "Mythic Survivor",
  lead: "Lead Survivor",
  "mythic-lead": "Mythic Lead",
};

/** join + lowercase a few (maybe undefined) parts into a search haystack */
const lc = (...parts: (string | undefined)[]): string =>
  parts.filter(Boolean).join(" ").toLowerCase();

interface FacetSearchMap {
  kind: SearchKind;
  /** secondary label shown on the result */
  subLabel: string;
  /** where to navigate */
  section: string;
  /** sub key, or the sentinel "__value__" to use the facet value as the sub key */
  sub: string;
  descOf?: (value: string) => string | undefined;
}

export function buildSearchIndex(d: {
  heroes: Hero[];
  survivors: Survivor[];
  defenders: Defender[];
  schematics: Schematic[];
  perks: Record<string, PerkEntity>;
  abilities: Ability[];
  facets: FacetsByDataset;
}): SearchEntry[] {
  const out: SearchEntry[] = [];
  const seen = new Set<string>();
  const add = (e: SearchEntry): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push(e);
  };

  // ── items ──────────────────────────────────────────────────────────────────
  for (const h of d.heroes)
    add({
      id: `item:${h.id}`,
      kind: "hero",
      label: h.name,
      sub: `${h.class} · ${h.setLabel}`,
      icon: h.images.icon,
      t: lc(h.name, h.class, h.setLabel, h.description),
      a: { k: "item", dataset: "heroes", id: h.id },
    });
  for (const s of d.survivors)
    add({
      id: `item:${s.id}`,
      kind: "survivor",
      label: s.name,
      sub: [KIND_LABEL[s.kind] ?? "Survivor", s.squad, s.personality].filter(Boolean).join(" · "),
      icon: s.images.icon,
      t: lc(s.name, s.squad, s.personality, s.description),
      a: { k: "item", dataset: "survivors", id: s.id },
    });
  for (const def of d.defenders)
    add({
      id: `item:${def.id}`,
      kind: "defender",
      label: def.name,
      sub: def.weaponType ?? "Defender",
      icon: def.images.icon,
      t: lc(def.name, def.weaponType, def.description),
      a: { k: "item", dataset: "defenders", id: def.id },
    });
  for (const s of d.schematics)
    add({
      id: `item:${s.id}`,
      kind: "schematic",
      label: s.name,
      sub: [s.subType, s.ammoType].filter(Boolean).join(" · ") || undefined,
      icon: s.images.icon,
      t: lc(s.name, s.subType, s.ammoType, s.description),
      a: { k: "item", dataset: "schematics", id: s.id },
    });

  // ── abilities (no facet group; pulled straight from the lookup) ─────────────
  for (const a of d.abilities)
    add({
      id: `ability:${a.id}`,
      kind: "ability",
      label: a.name,
      sub: "Ability",
      icon: a.images.icon,
      t: lc(a.name, a.description),
      a: { k: "filter", section: "heroes", sub: "all", tag: tagId("ability", a.id) },
    });

  // ── entities derived from facets (ids/labels/icons stay in lockstep) ────────
  const heroPerkDesc = new Map<string, string>();
  const cmdPerkDesc = new Map<string, string>();
  const classPerkDesc = new Map<string, string>();
  for (const h of d.heroes) {
    if (h.heroPerk) heroPerkDesc.set(h.heroPerk.name, h.heroPerk.description);
    if (h.commanderPerk) cmdPerkDesc.set(h.commanderPerk.name, h.commanderPerk.description);
    for (const p of h.classPerks) classPerkDesc.set(p.name, p.description);
  }
  const perkText = (fam: string): string | undefined => {
    const p = d.perks[fam];
    return p ? [p.name, ...p.tiers, p.statType].join(" ") : undefined;
  };

  // Perk facets are per-category (rangedPerk / meleePerk / trapPerk), so each
  // routes to its own section — keeping search and inspect cross-links in sync.
  const FACET_MAP: Record<string, FacetSearchMap | undefined> = {
    set: { kind: "set", subLabel: "Collection Set", section: "heroes", sub: "__value__" },
    class: { kind: "class", subLabel: "Class", section: "heroes", sub: "all" },
    heroPerk: { kind: "heroPerk", subLabel: "Standard Perk", section: "heroes", sub: "all", descOf: (v) => heroPerkDesc.get(v) },
    commanderPerk: { kind: "commanderPerk", subLabel: "Commander Perk", section: "heroes", sub: "all", descOf: (v) => cmdPerkDesc.get(v) },
    classPerk: { kind: "classPerk", subLabel: "Class Perk", section: "heroes", sub: "all", descOf: (v) => classPerkDesc.get(v) },
    personality: { kind: "personality", subLabel: "Personality", section: "personnel", sub: "all-survivors" },
    squad: { kind: "squad", subLabel: "Squad", section: "personnel", sub: "all-survivors" },
    rangedPerk: { kind: "weaponPerk", subLabel: "Weapon Perk", section: "ranged", sub: "all", descOf: perkText },
    meleePerk: { kind: "weaponPerk", subLabel: "Weapon Perk", section: "melee", sub: "all", descOf: perkText },
    trapPerk: { kind: "trapPerk", subLabel: "Trap Perk", section: "traps", sub: "all", descOf: perkText },
  };

  for (const ds of ["heroes", "survivors", "defenders", "schematics"] as DatasetName[]) {
    for (const group of d.facets[ds]) {
      const map = FACET_MAP[group.facet];
      if (!map) continue;
      for (const v of group.values) {
        const usesValueAsSub = map.sub === "__value__";
        add({
          id: `facet:${v.id}`,
          kind: map.kind,
          label: v.label,
          sub: map.subLabel,
          icon: v.icon,
          t: lc(v.label, map.subLabel, map.descOf?.(v.value)),
          a: {
            k: "filter",
            section: map.section,
            sub: usesValueAsSub ? v.value : map.sub,
            tag: usesValueAsSub ? undefined : v.id,
          },
        });
      }
    }
  }

  return out;
}
