/**
 * BanjoBotAssets `assets.json` -> normalized Hero[] + the Ability lookup they
 * reference. Heroes ship many tier/rarity variants; we collapse to one record
 * per (hero identity, rarity, class), keeping the highest-Tier variant — mirrors
 * the schematic dedupe so the Collection Book maps onto one slot per hero.
 */

import type { RawAssets, RawNamedItem } from "./banjo-types.js";
import type { Ability, Hero, HeroClass, ImageSet, Perk, Rarity } from "./schema.js";
import { CLASS_PERKS } from "./class-perks.js";
import { deriveHeroSet } from "./hero-sets.js";
import { compact, slug, tagId } from "./util.js";

const RARITIES: Record<string, Rarity> = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  epic: "epic",
  legendary: "legendary",
  mythic: "mythic",
};
const CLASSES: readonly HeroClass[] = ["Soldier", "Constructor", "Ninja", "Outlander"];

function normalizeRarity(raw?: string): Rarity {
  return RARITIES[(raw ?? "").toLowerCase()] ?? "common";
}
function normalizeClass(raw?: string): HeroClass {
  const t = (raw ?? "").trim();
  return (CLASSES as readonly string[]).includes(t) ? (t as HeroClass) : "Soldier";
}

function pickImages(it: RawNamedItem): ImageSet {
  const p = it.ImagePaths ?? {};
  return compact({ icon: p.SmallPreview ?? p.Icon, large: p.LargePreview }) as ImageSet;
}
function mergeImages(base: ImageSet | undefined, next: ImageSet): ImageSet {
  return { ...next, ...compact(base ?? {}) } as ImageSet;
}
function abilityImage(it: RawNamedItem | undefined): ImageSet | undefined {
  const p = it?.ImagePaths ?? {};
  const images = compact({ icon: p.Icon ?? p.SmallPreview }) as ImageSet;
  return Object.keys(images).length > 0 ? images : undefined;
}

function buildPerkAbilityLookup(items: Record<string, RawNamedItem>): Map<string, RawNamedItem> {
  const out = new Map<string, RawNamedItem>();
  for (const [key, item] of Object.entries(items)) {
    if (item.Type !== "Ability") continue;
    if (item.Name) out.set(item.Name, item);
    out.set(key, item);
    if (item.DisplayName) out.set(slug(item.DisplayName), item);
  }
  return out;
}

function perk(
  abilityLookup: Map<string, RawNamedItem>,
  templateId?: string,
  name?: string,
  description?: string,
): Perk | undefined {
  const n = name?.trim();
  const d = description?.trim();
  if (!n) return undefined;
  const tid = templateId?.trim() || undefined;
  const ability = tid ? abilityLookup.get(tid) ?? abilityLookup.get(`Ability:${tid}`) : abilityLookup.get(slug(n));
  return compact({
    templateId: tid,
    name: n,
    description: d ?? ability?.Description?.trim() ?? "",
    images: abilityImage(ability),
  }) as Perk;
}

function classPerksFor(cls: HeroClass, abilityLookup: Map<string, RawNamedItem>): Perk[] {
  return (CLASS_PERKS[cls] ?? []).map((p) => {
    const ability = abilityLookup.get(p.templateId ?? "") ?? abilityLookup.get(slug(p.name));
    return compact({
      ...p,
      description: p.description || ability?.Description?.trim() || "",
      images: abilityImage(ability) ?? p.images,
    }) as Perk;
  });
}

interface Group {
  rep: RawNamedItem;
  templateId: string;
  tier: number;
  images: ImageSet;
}

export interface HeroImport {
  heroes: Hero[];
  /** all ability template ids referenced by the surviving heroes */
  referencedAbilities: Set<string>;
}

export function importHeroes(raw: RawAssets): HeroImport {
  const groups = new Map<string, Group>();
  const items = raw.NamedItems ?? {};
  const perkAbilityLookup = buildPerkAbilityLookup(items);

  for (const [templateId, item] of Object.entries(items)) {
    if (item.Type !== "Hero") continue;
    const name = item.DisplayName?.trim();
    if (!name) continue;

    const rarity = normalizeRarity(item.Rarity);
    const cls = normalizeClass(item.SubType);
    const key = `${slug(name)}|${rarity}|${slug(cls)}`;
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

  const heroes: Hero[] = [];
  const referencedAbilities = new Set<string>();

  for (const g of groups.values()) {
    const item = g.rep;
    const name = item.DisplayName!.trim();
    const rarity = normalizeRarity(item.Rarity);
    const cls = normalizeClass(item.SubType);
    const set = deriveHeroSet(item.Name, item.ImagePaths?.SmallPreview);
    const abilityIds = (item.HeroAbilities ?? []).filter((a): a is string => typeof a === "string");
    const classPerks = classPerksFor(cls, perkAbilityLookup);
    for (const a of abilityIds) referencedAbilities.add(a);

    const tags = [
      tagId("class", cls),
      tagId("rarity", rarity),
      tagId("set", set.key),
      item.HeroPerk ? tagId("heroPerk", item.HeroPerk) : undefined,
      item.CommanderPerk ? tagId("commanderPerk", item.CommanderPerk) : undefined,
      ...classPerks.map((p) => tagId("classPerk", p.name)),
      ...abilityIds.map((a) => tagId("ability", a)),
    ].filter((t): t is string => Boolean(t));

    heroes.push({
      id: `${slug(name)}-${rarity}-${slug(cls)}`,
      templateId: g.templateId,
      name,
      class: cls,
      rarity,
      set: set.key,
      setLabel: set.label,
      location: set.location,
      description: item.Description?.trim() || undefined,
      heroPerk: perk(perkAbilityLookup, item.HeroPerkName, item.HeroPerk, item.HeroPerkDescription),
      commanderPerk: perk(perkAbilityLookup, item.CommanderPerkName, item.CommanderPerk, item.CommanderPerkDescription),
      classPerks,
      perkRequirement: item.HeroPerkRequirement?.Description?.trim() || undefined,
      abilityIds,
      tier: g.tier || undefined,
      images: g.images,
      tags: [...new Set(tags)],
      sources: ["banjo", "fandom"],
    });
  }

  heroes.sort(
    (a, b) => a.setLabel.localeCompare(b.setLabel) || a.name.localeCompare(b.name),
  );
  return { heroes, referencedAbilities };
}

/** Resolve only the abilities referenced by surviving heroes (keeps output lean). */
export function importAbilities(raw: RawAssets, referenced: Set<string>): Ability[] {
  const items = raw.NamedItems ?? {};
  const out: Ability[] = [];
  for (const id of referenced) {
    const it = items[id];
    if (!it) continue;
    const p = it.ImagePaths ?? {};
    out.push({
      id,
      name: it.DisplayName?.trim() || it.Name || id,
      description: it.Description?.trim() || undefined,
      cooldown: typeof it.CooldownSeconds === "number" ? it.CooldownSeconds : undefined,
      energyCost: typeof it.EnergyCost === "number" ? it.EnergyCost : undefined,
      stats: it.AbilityStats && Object.keys(it.AbilityStats).length ? it.AbilityStats : undefined,
      images: compact({ icon: p.Icon ?? p.SmallPreview }) as ImageSet,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
