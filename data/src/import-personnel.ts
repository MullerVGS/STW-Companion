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

const MYTHIC_LEAD_GENDER: Record<string, "Male" | "Female"> = {
  birdie: "Female",
  countess: "Female",
  dragon: "Male",
  eagle: "Female",
  fixer: "Male",
  flak: "Female",
  frequency: "Male",
  jumpy: "Male",
  maths: "Female",
  noctor: "Male",
  princess: "Female",
  rad: "Female",
  raider: "Female",
  ramsie: "Male",
  samurai: "Male",
  sobs: "Male",
  spacebound: "Male",
  square: "Male",
  tiger: "Female",
  treky: "Female",
  yoglattes: "Female",
  zapps: "Female",
};

const LEAD_PORTRAIT_SUBTYPE: Record<string, string> = {
  Marksman: "Soldier",
  "Martial Artist": "MartialArtist",
};

function mythicLeadImages(item: RawNamedItem, squad: string | undefined, rarity: Rarity): ImageSet | undefined {
  if (rarity !== "mythic" || !squad) return undefined;
  const name = item.Name ?? "";
  if (name.includes("_kingsly_")) {
    return { icon: "ExportedImages\\T-SR-MartyKingsly.png", large: "ExportedImages\\T-SR-MartyKingsly-L.png" };
  }
  if (name.includes("_malcolm_")) {
    return { icon: "ExportedImages\\T-SR-Malcolm.png", large: "ExportedImages\\T-SR-Malcolm-L.png" };
  }

  const token = name.match(/_SR_([^_]+)_T\d+$/)?.[1];
  const gender = token ? MYTHIC_LEAD_GENDER[token] : undefined;
  if (!gender) return undefined;

  const portraitType = LEAD_PORTRAIT_SUBTYPE[squad] ?? squad.replace(/\s+/g, "");
  return {
    icon: `ExportedImages\\T-Icon-Leaders-Portrait-${portraitType}-${gender}.png`,
    large: `ExportedImages\\T-Icon-Leaders-Portrait-${portraitType}-${gender}-L.png`,
  };
}

const SQUAD_BADGE: Record<string, string> = {
  Doctor: "ExportedImages\\T-Icon-ST-Surv-EMTSquad-128.png",
  Engineer: "ExportedImages\\T-Icon-ST-Surv-EngineeringSquad-128.png",
  Explorer: "ExportedImages\\T-Icon-ST-Surv-ScoutingPartySquad-128.png",
  Gadgeteer: "ExportedImages\\T-Icon-ST-Surv-Gadgeteers-128.png",
  Inventor: "ExportedImages\\T-Icon-ST-Surv-ThinkTankSquad-128.png",
  Marksman: "ExportedImages\\T-Icon-ST-Surv-FireTeamAlphaSquad-128.png",
  "Martial Artist": "ExportedImages\\T-Icon-ST-Surv-CloseAssaultSquad-128.png",
  Trainer: "ExportedImages\\T-Icon-ST-Surv-TrainingTeamSquad-128.png",
};

const PERSONALITY_BADGE: Record<string, string> = {
  Adventurous: "ExternalImages\\Icon_Adventurer.png",
  Analytical: "ExternalImages\\Icon_Analytical.png",
  Competitive: "ExternalImages\\Icon_Competitive.png",
  Cooperative: "ExternalImages\\Icon_Cooperative.png",
  Curious: "ExternalImages\\Icon_Curious.png",
  Dependable: "ExternalImages\\Icon_Dependable.png",
  Dreamer: "ExternalImages\\Icon_Dreamer.png",
  Pragmatic: "ExternalImages\\Icon_Pragmatic.png",
};

function survivorBadgeImages(
  kind: PersonnelKind,
  squad: string | undefined,
  personality: string | undefined,
): Survivor["badgeImages"] | undefined {
  const badges = compact({
    leader: kind === "lead" || kind === "mythic-lead" ? "ExportedImages\\T-Icon-Leader-128.png" : undefined,
    personality: personality ? PERSONALITY_BADGE[personality] : undefined,
    squad: squad ? SQUAD_BADGE[squad] : undefined,
  }) as Survivor["badgeImages"];
  return badges && Object.keys(badges).length > 0 ? badges : undefined;
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

function defenderGender(templateId: string, weaponType: string | undefined): Defender["gender"] {
  const explicit = /_Basic_([FM])_/.exec(templateId)?.[1];
  if (explicit === "F") return "Female";
  if (explicit === "M") return "Male";
  if (/_Founders_/i.test(templateId)) {
    if (/Assault/i.test(templateId)) return "Female";
    if (/Pistol/i.test(templateId)) return "Male";
  }
  if (/_Basic_F_/i.test(templateId)) return "Female";
  const baseGender: Record<string, Defender["gender"]> = {
    Assault: "Female",
    Melee: "Male",
    Pistol: "Male",
    Shotgun: "Male",
    Sniper: "Female",
  };
  return weaponType ? baseGender[weaponType] : undefined;
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
      images: mythicLeadImages(item, squad, rarity) ?? pickImages(item),
      badgeImages: survivorBadgeImages(kind, squad, personality),
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
    `${slug(it.DisplayName!)}|${normalizeRarity(it.Rarity)}|${
      /_Basic_F_/.test(it.Name ?? "") ? "female" :
      /_Basic_M_/.test(it.Name ?? "") ? "male" :
      slug(it.ImagePaths?.SmallPreview ?? it.ImagePaths?.Icon ?? "base")
    }`,
  )) {
    const item = g.rep;
    const name = item.DisplayName!.trim();
    const rarity = normalizeRarity(item.Rarity);
    const weaponType = item.SubType?.replace(/\s*Defender$/i, "").trim() || undefined;
    const gender = defenderGender(g.templateId, weaponType);

    const tags = [tagId("rarity", rarity)];
    if (weaponType) tags.push(tagId("weaponType", weaponType));
    if (gender) tags.push(tagId("gender", gender));

    out.push({
      id: `${slug(name)}-${rarity}-${slug(gender ?? "unknown")}`,
      templateId: g.templateId,
      name,
      weaponType,
      gender,
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
