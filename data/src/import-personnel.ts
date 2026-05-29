/**
 * Workers -> Survivor[] (survivors / lead survivors / mythic leads) and
 * Defenders -> Defender[]. Same dedupe philosophy as heroes/schematics: one
 * record per (identity, rarity), keeping the highest-Tier variant.
 */

import type { RawAssets, RawNamedItem } from "./banjo-types.js";
import type { Defender, ImageSet, PersonnelKind, Rarity, Survivor } from "./schema.js";
import { compact, slug, tagId, titleCase } from "./util.js";

const RARITIES: Record<string, Rarity> = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  epic: "epic",
  legendary: "legendary",
  mythic: "mythic",
};
const normalizeRarity = (raw?: string): Rarity => RARITIES[(raw ?? "").toLowerCase()] ?? "common";

function pickImages(it: RawNamedItem): ImageSet {
  const p = it.ImagePaths ?? {};
  return compact({ icon: p.SmallPreview ?? p.Icon, large: p.LargePreview }) as ImageSet;
}
function cleanPersonality(raw?: string): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  return titleCase(t.replace(/^is/i, ""));
}

interface Group {
  rep: RawNamedItem;
  templateId: string;
  tier: number;
}
function dedupe(
  raw: RawAssets,
  type: string,
  keyOf: (it: RawNamedItem) => string,
): Group[] {
  const groups = new Map<string, Group>();
  for (const [templateId, item] of Object.entries(raw.NamedItems ?? {})) {
    if (item.Type !== type) continue;
    if (!item.DisplayName?.trim()) continue;
    const key = keyOf(item);
    const tier = item.Tier ?? 0;
    const existing = groups.get(key);
    if (!existing || tier > existing.tier) groups.set(key, { rep: item, templateId, tier });
  }
  return [...groups.values()];
}

export function importSurvivors(raw: RawAssets): Survivor[] {
  const out: Survivor[] = [];
  for (const g of dedupe(raw, "Worker", (it) =>
    `${slug(it.DisplayName!)}|${normalizeRarity(it.Rarity)}|${slug(it.SubType ?? "")}`,
  )) {
    const item = g.rep;
    const name = item.DisplayName!.trim();
    const rarity = normalizeRarity(item.Rarity);
    const squad = item.SubType?.trim() || undefined;
    let kind: PersonnelKind;
    if (squad) {
      kind = rarity === "mythic" ? "mythic-lead" : "lead";
    } else {
      kind = rarity === "mythic" ? "mythic-survivor" : "survivor";
    }

    const tags = [tagId("kind", kind), tagId("rarity", rarity)];
    if (squad) tags.push(tagId("squad", squad));
    const personality = cleanPersonality(item.Personality);
    if (personality) tags.push(tagId("personality", personality));

    out.push({
      id: `${slug(name)}-${rarity}-${slug(squad ?? "survivor")}`,
      templateId: g.templateId,
      name,
      kind,
      squad,
      personality,
      rarity,
      description: item.Description?.trim() || undefined,
      tier: g.tier || undefined,
      images: pickImages(item),
      tags: [...new Set(tags)],
      sources: ["banjo"],
    });
  }
  out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  return out;
}

export function importDefenders(raw: RawAssets): Defender[] {
  const out: Defender[] = [];
  for (const g of dedupe(raw, "Defender", (it) =>
    `${slug(it.DisplayName!)}|${normalizeRarity(it.Rarity)}`,
  )) {
    const item = g.rep;
    const name = item.DisplayName!.trim();
    const rarity = normalizeRarity(item.Rarity);
    const weaponType = item.SubType?.replace(/\s*Defender$/i, "").trim() || undefined;

    const tags = [tagId("rarity", rarity)];
    if (weaponType) tags.push(tagId("weaponType", weaponType));

    out.push({
      id: `${slug(name)}-${rarity}`,
      templateId: g.templateId,
      name,
      weaponType,
      rarity,
      description: item.Description?.trim() || undefined,
      tier: g.tier || undefined,
      images: pickImages(item),
      tags: [...new Set(tags)],
      sources: ["banjo"],
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
