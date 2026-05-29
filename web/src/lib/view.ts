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

const KIND_LABEL: Record<string, string> = {
  survivor: "Survivor",
  "mythic-survivor": "Mythic Survivor",
  lead: "Lead Survivor",
  "mythic-lead": "Mythic Lead",
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

export interface StatRow {
  label: string;
  value: string;
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
  const push = (label: string, v: unknown, f: (n: number) => string = fmt) => {
    const n = num(v);
    if (n !== undefined) rows.push({ label, value: f(n) });
  };
  if (s.dps !== undefined) rows.push({ label: "DPS", value: fmt(s.dps) });

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
    push("Damage", get(m, "Damage"));
    push("Impact", get(m, "ImpactDamage"));
    push("Crit Chance", get(m, "BaseCritChance"), pct);
    push("Crit Damage", get(m, "BaseCritDamage"), pct);
    push("Range", get(m, "RangeVsEnemies"));
    push("Swing Time", get(m, "SwingTime"));
    push("Knockback", get(m, "KnockbackMagnitude"));
    push("Durability", get(m, "Durability"));
  } else {
    const t = s.stats?.trap;
    push("Damage", get(t, "Damage"));
    push("Crit Chance", get(t, "BaseCritChance"), pct);
    push("Crit Damage", get(t, "BaseCritDamage"), pct);
    push("Arm Time", get(t, "ArmTime"));
    push("Fire Delay", get(t, "FireDelay"));
    push("Reload Time", get(t, "ReloadTime"));
    push("Durability", get(t, "Durability"));
  }
  return rows;
}
