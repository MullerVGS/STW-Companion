import type {
  AnyItem,
  BookFilter,
  Dataset,
  DatasetName,
  Defender,
  Hero,
  Schematic,
  Survivor,
} from "../types";

export type ItemKind = "hero" | "survivor" | "defender" | "schematic";

export interface Selected {
  kind: ItemKind;
  item: AnyItem;
}

export const KIND_OF: Record<DatasetName, ItemKind> = {
  heroes: "hero",
  survivors: "survivor",
  defenders: "defender",
  schematics: "schematic",
};

export const KIND_LABEL: Record<string, string> = {
  hero: "Hero",
  survivor: "Survivor",
  "mythic-survivor": "Mythic Survivor",
  lead: "Lead Survivor",
  "mythic-lead": "Mythic Lead",
  defender: "Defender",
  schematic: "Schematic",
};

/** All records from a named dataset. */
export function recordsOf(dataset: Dataset, name: DatasetName): AnyItem[] {
  return dataset[name] as AnyItem[];
}

/** Read a record field by name (used by book filters: kind / category / subType / set). */
export function field(rec: AnyItem, name: string): string | undefined {
  const v = (rec as unknown as Record<string, unknown>)[name];
  return typeof v === "string" ? v : undefined;
}

/** Does a record satisfy all of a subcategory's predicates? */
export function matches(rec: AnyItem, filters: BookFilter[] | undefined): boolean {
  if (!filters) return true;
  return filters.every((f) => field(rec, f.field) === f.value);
}

/** Short subtitle shown under a card name. */
export function subtitle(kind: ItemKind, rec: AnyItem): string {
  if (kind === "hero") {
    const h = rec as Hero;
    return h.class;
  }
  if (kind === "survivor") {
    const s = rec as Survivor;
    return [KIND_LABEL[s.kind], s.squad].filter(Boolean).join(" · ");
  }
  if (kind === "defender") {
    return (rec as Defender).weaponType ?? "Defender";
  }
  const s = rec as Schematic;
  return [s.subType, s.dps ? `${s.dps.toLocaleString()} DPS` : undefined]
    .filter(Boolean)
    .join(" · ");
}

/** Text considered by the section search box. */
export function searchText(kind: ItemKind, rec: AnyItem): string {
  if (kind === "hero") {
    const h = rec as Hero;
    return [
      h.name,
      h.class,
      h.setLabel,
      h.heroPerk?.name,
      h.heroPerk?.description,
      h.commanderPerk?.name,
      h.commanderPerk?.description,
      ...h.classPerks.flatMap((p) => [p.name, p.description]),
    ].filter(Boolean).join(" ");
  }
  return rec.name;
}

/** URL-safe slug (mirrors data/src/util.ts so tag ids match the pipeline). */
export function slug(input: string): string {
  const s = input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "unknown";
}

export const tagId = (facet: string, value: string): string => `${facet}:${slug(value)}`;

/** Where an item lives in the Collection Book — the section + preferred
 *  subcategory to navigate to when "locating" it. The caller validates the sub
 *  against the section's actual subcategories and falls back to the first one. */
export function locateTarget(kind: ItemKind, item: AnyItem): { section: string; sub: string } {
  if (kind === "hero") return { section: "heroes", sub: (item as Hero).set || "all" };
  if (kind === "schematic") {
    const cat = (item as Schematic).category;
    return { section: cat === "trap" ? "traps" : cat, sub: "all" };
  }
  if (kind === "defender") return { section: "personnel", sub: "defenders" };
  // survivors: jump to the subcategory matching the personnel kind
  const sub: Record<string, string> = {
    survivor: "survivors",
    "mythic-survivor": "mythic-survivors",
    lead: "leads",
    "mythic-lead": "mythic-leads",
  };
  return { section: "personnel", sub: sub[(item as Survivor).kind] ?? "all-survivors" };
}

/** Best-effort check: does the commander satisfy a support hero's perk
 *  requirement ("Requires commander with <Ability> ability.")? Returns the
 *  unmet requirement text when it isn't satisfied, else undefined. */
export function unmetRequirement(
  support: Hero,
  commander: Hero | undefined,
  abilities: Record<string, { name: string }>,
): string | undefined {
  const req = support.perkRequirement?.trim();
  if (!req) return undefined;
  const m = /requires commander with (.+?) ability/i.exec(req);
  if (!m) return undefined; // unrecognized shape — don't guess
  const needed = m[1].trim().toLowerCase();
  const have = (commander?.abilityIds ?? [])
    .map((id) => abilities[id]?.name?.toLowerCase())
    .filter(Boolean);
  return have.includes(needed) ? undefined : req;
}

export interface StatRow {
  label: string;
  value: string;
  /** rendered with emphasis in the inspect stat panel (headline stat). */
  big?: boolean;
}

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
const pct = (v: number) => `${Math.round(v * 100)}%`;

function get(obj: Record<string, unknown> | undefined, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** Curated base-stat rows for a schematic's inspect panel (values are level-1 base). */
export function weaponStatRows(s: Schematic): StatRow[] {
  const rows: StatRow[] = [];
  const push = (label: string, v: unknown, f: (n: number) => string = fmt, big = false) => {
    const n = num(v);
    if (n !== undefined) rows.push({ label, value: f(n), big });
  };
  if (s.dps !== undefined) rows.push({ label: "DPS", value: fmt(s.dps), big: true });

  if (s.category === "ranged") {
    const r = s.stats?.ranged;
    push("Damage", get(r, "PointBlank.Damage"));
    push("Impact", get(r, "PointBlank.ImpactDamage"));
    push("Crit Chance", get(r, "BaseCritChance"), pct);
    push("Crit Damage", get(r, "BaseCritDamage"), pct);
    push("Fire Rate", get(r, "FiringRate"));
    push("Magazine", get(r, "Reload.ClipSize"));
    push("Reload Time", get(r, "Reload.ReloadTime"));
    push("Durability", get(r, "Durability"));
  } else if (s.category === "melee") {
    const m = s.stats?.melee;
    push("Damage", get(m, "Damage"), fmt, true);
    push("Impact", get(m, "ImpactDamage"));
    push("Crit Chance", get(m, "BaseCritChance"), pct);
    push("Crit Damage", get(m, "BaseCritDamage"), pct);
    push("Range", get(m, "RangeVsEnemies"));
    push("Swing Time", get(m, "SwingTime"));
    push("Knockback", get(m, "KnockbackMagnitude"));
    push("Durability", get(m, "Durability"));
  } else {
    const t = s.stats?.trap;
    push("Damage", get(t, "Damage"), fmt, true);
    push("Crit Chance", get(t, "BaseCritChance"), pct);
    push("Crit Damage", get(t, "BaseCritDamage"), pct);
    push("Arm Time", get(t, "ArmTime"));
    push("Fire Delay", get(t, "FireDelay"));
    push("Reload Time", get(t, "ReloadTime"));
    push("Durability", get(t, "Durability"));
  }
  return rows;
}

/** Curated rows for a hero's inspect stat panel (the export lacks leveled stats). */
export function heroStatRows(h: Hero): StatRow[] {
  return [
    { label: "Class", value: h.class, big: true },
    { label: "Set", value: h.setLabel?.replace(/ Heroes$/, "") || "—" },
    { label: "Rarity", value: h.rarity[0].toUpperCase() + h.rarity.slice(1) },
    { label: "Tier", value: `T${h.tier ?? "—"}` },
    { label: "Abilities", value: String(h.abilityIds.length) },
  ];
}
