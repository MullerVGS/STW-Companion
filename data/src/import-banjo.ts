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

/** Resolve the alteration (perk) pool: top tier of each slot, as display text. */
function buildPerkSlots(slots: RawAlterationSlot[] | undefined, look: Lookups): PerkSlot[] | undefined {
  if (!slots?.length) return undefined;
  const out: PerkSlot[] = [];
  for (const slot of slots) {
    const tiers = slot.Alterations;
    if (!tiers?.length) continue;
    const top = tiers[tiers.length - 1] ?? [];
    const options = top
      .map((id) => look.alteration(id))
      .filter((t): t is string => Boolean(t));
    if (options.length) out.push({ requiredLevel: slot.RequiredLevel, options: [...new Set(options)] });
  }
  return out.length ? out : undefined;
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

export function importSchematics(raw: RawAssets, look: Lookups): Schematic[] {
  const groups = new Map<string, Group>();

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
      perkSlots: buildPerkSlots(item.AlterationSlots, look),
      tags: buildTags(base),
      sources: ["banjo"],
    });
  }

  schematics.sort((a, b) => a.name.localeCompare(b.name) || a.rarity.localeCompare(b.rarity));
  return schematics;
}
