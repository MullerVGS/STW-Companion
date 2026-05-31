/**
 * BanjoBotAssets (`assets.json`) -> normalized Schematic[].
 *
 * STW ships many rarity/tier/material variants of the same weapon (~25 per gun).
 * We collapse them into one record per (weapon identity, rarity), keeping the
 * highest-tier variant's stats — this maps cleanly onto Collection Book slots
 * and is robust to template-id quirks because we group on DisplayName+Rarity.
 *
 * Field names are PascalCase to match the real export (see banjo-types.ts).
 */

import type { RawAssets, RawNamedItem, RawAlterationSlot } from "./banjo-types.js";
import type {
  CraftIngredient,
  ImageSet,
  PerkEntity,
  PerkSlot,
  Rarity,
  Schematic,
  SchematicCategory,
  SchematicStats,
} from "./schema.js";
import type { Lookups } from "./lookups.js";
import { compact, slug, tagId, titleCase } from "./util.js";

const RARITIES: Record<string, Rarity> = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  epic: "epic",
  legendary: "legendary",
  mythic: "mythic",
};

function normalizeRarity(raw?: string): Rarity {
  return RARITIES[(raw ?? "").toLowerCase()] ?? "common";
}

/**
 * Category is derived from which stat block is present (deterministic and
 * version-stable), falling back to the textual `Category` field.
 */
function deriveCategory(item: RawNamedItem): SchematicCategory {
  if (item.TrapStats) return "trap";
  if (item.MeleeWeaponStats) return "melee";
  if (item.RangedWeaponStats) return "ranged";
  const c = (item.Category ?? "").toLowerCase();
  if (c.includes("trap")) return "trap";
  if (c.includes("melee")) return "melee";
  return "ranged";
}

function pickImages(item: RawNamedItem): ImageSet {
  const p = item.ImagePaths ?? {};
  return compact({
    icon: p.Icon ?? p.SmallPreview,
    small: p.SmallPreview,
    large: p.LargePreview ?? p.PackImage,
  }) as ImageSet;
}

function mergeImages(base: ImageSet | undefined, next: ImageSet): ImageSet {
  return { ...next, ...compact(base ?? {}) } as ImageSet;
}

/** Real export ammo values are already display-ready ("Shells 'n' Slugs");
 *  only token-shaped values ("AmmoType_Medium_Bullets") get prettified. */
function cleanAmmo(raw?: string | null): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  if (/[\s']/.test(t)) return t;
  return titleCase(t.replace(/^ammo[_:\s-]*(type[_:\s-]*)?/i, ""));
}

function buildStats(item: RawNamedItem, category: SchematicCategory): SchematicStats | undefined {
  const stats: SchematicStats = {};
  if (category === "ranged" && item.RangedWeaponStats) stats.ranged = item.RangedWeaponStats;
  if (category === "melee" && item.MeleeWeaponStats) stats.melee = item.MeleeWeaponStats;
  if (category === "trap" && item.TrapStats) stats.trap = item.TrapStats;
  return Object.keys(stats).length ? stats : undefined;
}

/** Base DPS estimate for ranged weapons: point-blank damage × fire rate × pellets. */
function computeDps(item: RawNamedItem): number | undefined {
  const r = item.RangedWeaponStats;
  if (!r) return undefined;
  const dmg = (r.PointBlank as { Damage?: number } | undefined)?.Damage;
  const rate = r.FiringRate as number | undefined;
  const pellets = (r.BulletsPerCartridge as number | undefined) ?? 1;
  if (typeof dmg !== "number" || typeof rate !== "number") return undefined;
  return Math.round(dmg * rate * pellets * 10) / 10;
}

/** Resolve CraftingCost (lowercased ingredient ids) into display lines. */
function buildCrafting(item: RawNamedItem, look: Lookups): CraftIngredient[] | undefined {
  const cost = item.CraftingCost;
  if (!cost || !Object.keys(cost).length) return undefined;
  const out: CraftIngredient[] = [];
  for (const [id, qty] of Object.entries(cost)) {
    const info = look.ingredient(id);
    out.push({ id, name: info?.name ?? id.split(":").pop() ?? id, qty, icon: info?.icon });
  }
  return out.length ? out : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Perks (alterations) → shared, linkable registry
//
// An alteration template id like "Alteration:AID_Att_CritChance_T05" collapses
// to the perk *family* "att-critchance" (drop the AID_ prefix and _Tnn suffix).
// Two schematics "share a perk" when they can roll the same family — that is the
// stable key the UI cross-links on, regardless of which slot it sits in.
// ─────────────────────────────────────────────────────────────────────────────

/** Derive a stable perk family id from an alteration template id. */
function perkFamily(rawId: string): string {
  const s = rawId
    .replace(/^alteration:/i, "")
    .replace(/^aid[_:]/i, "")
    .replace(/_t\d+$/i, "");
  return slug(s);
}

/** Icon-grouping key: drop the leading group token (att/ele/g/conditional/set). */
function perkStatType(family: string): string {
  const m = family.match(/^(?:att|ele|g|conditional|set)-(.+)$/);
  return m?.[1] ?? family;
}

interface PerkAccEntry {
  id: string;
  statType: string;
  scope: Set<SchematicCategory>;
  tiers: Map<number, string>;
  icon?: string;
}
type PerkAcc = Map<string, PerkAccEntry>;

/**
 * Resolve a schematic's alteration slots into PerkSlot[] (top-tier rollable
 * families per slot) while feeding the shared perk registry from EVERY tier so
 * the registry carries each perk's full tier ladder and icon (when one exists).
 */
function collectPerks(
  slots: RawAlterationSlot[] | undefined,
  category: SchematicCategory,
  look: Lookups,
  acc: PerkAcc,
): PerkSlot[] | undefined {
  if (!slots?.length) return undefined;
  const out: PerkSlot[] = [];
  for (const slot of slots) {
    const tiers = slot.Alterations;
    if (!tiers?.length) continue;

    tiers.forEach((row, tierIdx) => {
      for (const rawId of row) {
        const info = look.alterationInfo(rawId);
        if (!info?.text) continue;
        const fam = perkFamily(rawId);
        let e = acc.get(fam);
        if (!e) {
          e = { id: fam, statType: perkStatType(fam), scope: new Set(), tiers: new Map() };
          acc.set(fam, e);
        }
        e.scope.add(category);
        const tierNum = Number(rawId.match(/_t(\d+)$/i)?.[1] ?? tierIdx + 1);
        if (!e.tiers.has(tierNum)) e.tiers.set(tierNum, info.text);
        if (!e.icon && info.icon) e.icon = info.icon;
      }
    });

    // top-tier row = the perk families this slot can actually roll at max tier
    const top = tiers[tiers.length - 1] ?? [];
    const perkIds = [...new Set(top.map(perkFamily))].filter((f) => acc.has(f));
    if (perkIds.length) out.push({ requiredLevel: slot.RequiredLevel, perkIds });
  }
  return out.length ? out : undefined;
}

/** Curated stat-perk art lives here (relative to data/raw, resolved by the icon
 *  copier). Drop `<statType>.png` to give a stat perk an icon; missing files are
 *  silently skipped, so this is a safe incremental drop-in. */
const CURATED_PERK_ICONS = "../assets/perk-icons";

/** Materialize the accumulated families into the public perk registry. */
function buildPerkRegistry(acc: PerkAcc): Record<string, PerkEntity> {
  const perks: Record<string, PerkEntity> = {};
  for (const e of acc.values()) {
    const tierNums = [...e.tiers.keys()].sort((a, b) => a - b);
    const tiers = tierNums.map((n) => e.tiers.get(n)!);
    const top = tiers[tiers.length - 1] ?? e.id;
    // elemental perks carry real export art; everything else points at the
    // curated dir (the copier drops it if the file isn't there yet).
    perks[e.id] = {
      id: e.id,
      name: top,
      description: top,
      statType: e.statType,
      scope: [...e.scope].sort(),
      tiers,
      images: { icon: e.icon ?? `${CURATED_PERK_ICONS}/${e.statType}.png` },
    };
  }
  return perks;
}

function buildTags(
  s: Pick<Schematic, "rarity" | "category" | "subType" | "ammoType" | "triggerType" | "evoType">,
): string[] {
  const tags = [tagId("rarity", s.rarity), tagId("category", s.category)];
  if (s.subType) tags.push(tagId("subType", s.subType));
  if (s.ammoType) tags.push(tagId("ammoType", s.ammoType));
  if (s.triggerType) tags.push(tagId("triggerType", s.triggerType));
  if (s.evoType) tags.push(tagId("evoType", s.evoType));
  return [...new Set(tags)];
}

interface Group {
  rep: RawNamedItem;
  templateId: string;
  tier: number;
  images: ImageSet;
}

export interface SchematicImport {
  schematics: Schematic[];
  /** shared perk registry (perks.json) referenced by Schematic.perkSlots[].perkIds */
  perks: Record<string, PerkEntity>;
}

export function importSchematics(raw: RawAssets, look: Lookups): SchematicImport {
  const groups = new Map<string, Group>();
  const perkAcc: PerkAcc = new Map();

  for (const [templateId, item] of Object.entries(raw.NamedItems ?? {})) {
    if (item.Type !== "Schematic") continue;
    const name = item.DisplayName?.trim();
    if (!name) continue;

    const rarity = normalizeRarity(item.Rarity);
    const key = `${slug(name)}|${rarity}`;
    const tier = item.Tier ?? 0;
    const images = pickImages(item);
    const existing = groups.get(key);

    if (!existing || tier > existing.tier) {
      groups.set(key, {
        rep: item,
        templateId,
        tier: Math.max(tier, existing?.tier ?? 0),
        images: mergeImages(existing?.images, images),
      });
    } else {
      existing.images = mergeImages(existing.images, images);
    }
  }

  const schematics: Schematic[] = [];
  for (const g of groups.values()) {
    const item = g.rep;
    const name = item.DisplayName!.trim();
    const rarity = normalizeRarity(item.Rarity);
    const category = deriveCategory(item);
    const subType = item.SubType ? titleCase(item.SubType) : undefined;
    const ammoType = category === "ranged" ? cleanAmmo(item.RangedWeaponStats?.AmmoType) : undefined;
    const triggerType = item.TriggerType?.trim() || undefined;
    const evoType = item.EvoType?.trim() ? titleCase(item.EvoType.trim()) : undefined;

    const base = { rarity, category, subType, ammoType, triggerType, evoType };

    const perkSlots = collectPerks(item.AlterationSlots, category, look, perkAcc);

    // tag every rollable perk family so a perk click can find every schematic
    // that shares it. Perks are kept in per-category facets (rangedPerk /
    // meleePerk / trapPerk) because the book splits those into separate sections
    // — a single "weapon perk" pool would surface melee-only perks in the ranged
    // section (and vice-versa) as dead, zero-result chips.
    const tags = buildTags(base);
    if (perkSlots) {
      const facet = `${category}Perk`;
      const fams = new Set<string>();
      for (const sl of perkSlots) for (const id of sl.perkIds) fams.add(id);
      for (const f of fams) tags.push(tagId(facet, f));
    }

    schematics.push({
      id: `${slug(name)}-${rarity}`,
      templateId: g.templateId,
      name,
      description: item.Description?.trim() || undefined,
      ...base,
      tier: g.tier || undefined,
      dps: category === "ranged" ? computeDps(item) : undefined,
      images: g.images,
      stats: buildStats(item, category),
      craftingCost: buildCrafting(item, look),
      perkSlots,
      tags: [...new Set(tags)],
      sources: ["banjo"],
    });
  }

  schematics.sort((a, b) => a.name.localeCompare(b.name) || a.rarity.localeCompare(b.rarity));
  return { schematics, perks: buildPerkRegistry(perkAcc) };
}
