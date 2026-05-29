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

import type { RawAssets, RawNamedItem } from "./banjo-types.js";
import type {
  ImageSet,
  Rarity,
  Schematic,
  SchematicCategory,
  SchematicStats,
} from "./schema.js";
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
  // schematics expose SmallPreview (icon) + LargePreview; older assets use Icon
  return compact({
    icon: p.Icon ?? p.SmallPreview,
    small: p.SmallPreview,
    large: p.LargePreview ?? p.PackImage,
  }) as ImageSet;
}

/** Prefer already-set values; fill gaps from the incoming set. */
function mergeImages(base: ImageSet | undefined, next: ImageSet): ImageSet {
  return { ...next, ...compact(base ?? {}) } as ImageSet;
}

/** Real export ammo values are already display-ready ("Shells 'n' Slugs");
 *  only token-shaped values ("AmmoType_Medium_Bullets") get prettified. */
function cleanAmmo(raw?: string | null): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  if (/[\s']/.test(t)) return t; // already human-readable
  return titleCase(t.replace(/^ammo[_:\s-]*(type[_:\s-]*)?/i, ""));
}

function buildStats(item: RawNamedItem, category: SchematicCategory): SchematicStats | undefined {
  const stats: SchematicStats = {};
  if (category === "ranged" && item.RangedWeaponStats) stats.ranged = item.RangedWeaponStats;
  if (category === "melee" && item.MeleeWeaponStats) stats.melee = item.MeleeWeaponStats;
  if (category === "trap" && item.TrapStats) stats.trap = item.TrapStats;
  return Object.keys(stats).length ? stats : undefined;
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

export function importSchematics(raw: RawAssets): Schematic[] {
  const groups = new Map<string, Group>();

  for (const [templateId, item] of Object.entries(raw.NamedItems ?? {})) {
    if (item.Type !== "Schematic") continue;
    const name = item.DisplayName?.trim();
    if (!name) continue; // skip nameless/test/dev assets

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
    const triggerType = item.TriggerType?.trim() || undefined; // fire mode; empty for traps
    const evoType = item.EvoType?.trim() ? titleCase(item.EvoType.trim()) : undefined;

    const base = { rarity, category, subType, ammoType, triggerType, evoType };

    schematics.push({
      id: `${slug(name)}-${rarity}`,
      templateId: g.templateId,
      name,
      description: item.Description?.trim() || undefined,
      ...base,
      tier: g.tier || undefined,
      images: g.images,
      stats: buildStats(item, category),
      craftingCost: item.CraftingCost,
      tags: buildTags(base),
      sources: ["banjo"],
    });
  }

  // deterministic, reviewer-friendly order
  schematics.sort((a, b) => a.name.localeCompare(b.name) || a.rarity.localeCompare(b.rarity));
  return schematics;
}
