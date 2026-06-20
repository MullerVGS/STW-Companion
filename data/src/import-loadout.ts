/**
 * Hero Loadout entities: Team Perks and Gadgets.
 *
 * Unlike heroes/schematics these aren't deduped tier variants — each is a single
 * identity. The raw export carries them as flat NamedItems with Type "TeamPerk"
 * / "Gadget" (name, description, one icon). The game doesn't link a hero to its
 * team perk or to gadgets (both are picked manually in the loadout screen), so
 * we ship them as standalone lookups the planner selects from.
 */

import type { RawAssets, RawNamedItem } from "./banjo-types.js";
import type { Gadget, ImageSet, TeamPerk } from "./schema.js";
import { compact, slug } from "./util.js";

function pickImages(it: RawNamedItem): ImageSet {
  const p = it.ImagePaths ?? {};
  return compact({ icon: p.SmallPreview ?? p.Icon, large: p.LargePreview }) as ImageSet;
}

/** Gadget descriptions carry unresolved runtime tokens ("[Ability.MaxStacks]",
 *  "[FireRate]", "[Range]") the game fills with numbers we don't have in this
 *  export. Replace each with a neutral "X" value-placeholder (keeps the sentence
 *  intact and honest — "fires X rounds for X seconds"), collapse adjacent
 *  placeholders ("X, XX" -> "X"), then tidy stray spacing/punctuation. */
function cleanGadgetText(raw?: string): string | undefined {
  const t = raw
    ?.replace(/\[[^\]]*\]/g, "X")
    .replace(/X(?:[\s,]*X)+/g, "X") // merge runs like "X, XX" into one
    .replace(/\s+([.,;:%])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+X\s*$/, "") // drop a dangling trailing placeholder ("range. X")
    .trim();
  return t || undefined;
}

export function importTeamPerks(raw: RawAssets): TeamPerk[] {
  const out: TeamPerk[] = [];
  for (const item of Object.values(raw.NamedItems ?? {})) {
    if (item.Type !== "TeamPerk") continue;
    const name = item.DisplayName?.trim();
    if (!name) continue;
    out.push({
      id: slug(name),
      name,
      // No "REQUIRES: N heroes" field exists in the export — ship the plain
      // description only; we don't fabricate the requirement line.
      description: item.Description?.trim() || undefined,
      images: pickImages(item),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** The gadgets actually equippable in the in-game loadout wheel, keyed by raw
 *  `Name`. The export also holds debug/onboarding/cosmetic gadgets (GlowTorch
 *  colours, Cart, Tracks, Hoverboard…) we deliberately exclude. Extend here. */
const EQUIPPABLE_GADGETS: ReadonlySet<string> = new Set([
  "G_AirStrike",
  "G_Generic_AdrenalineRush",
  "G_Generic_Banner",
  "G_Generic_BotTurret",
  "G_Generic_ProximityMines",
  "G_Generic_SlowField",
  "G_SupplyDrop",
  "G_Teleporter",
]);

export function importGadgets(raw: RawAssets): Gadget[] {
  const out: Gadget[] = [];
  for (const item of Object.values(raw.NamedItems ?? {})) {
    if (item.Type !== "Gadget" || !item.Name || !EQUIPPABLE_GADGETS.has(item.Name)) continue;
    const name = item.DisplayName?.trim();
    if (!name) continue;
    out.push({
      id: slug(item.Name),
      name,
      description: cleanGadgetText(item.Description),
      images: pickImages(item),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
