/**
 * Cross-reference indexes resolved at build time.
 *
 * Schematic `CraftingCost` keys and `AlterationSlots` ids are serialized in
 * **lowercase** ("Ingredient:ingredient_bacon") while NamedItems are keyed in
 * PascalCase ("Ingredient:Ingredient_Bacon"), so every lookup is keyed by the
 * lowercased template id.
 */

import type { RawAssets, RawNamedItem } from "./banjo-types.js";

export interface IngredientInfo {
  name: string;
  /** raw image path; rewritten to a web URL by the build step */
  icon?: string;
}

export interface AlterationInfo {
  /** perk effect text (the export stores it as DisplayName) */
  text: string;
  /** raw image path when present (only ~45 alterations carry one — elements/specials) */
  icon?: string;
}

export interface Lookups {
  ingredient(id: string): IngredientInfo | undefined;
  /** alteration display text (the export stores the perk text as DisplayName) */
  alteration(id: string): string | undefined;
  /** alteration text + icon, keyed by (lowercased) template id */
  alterationInfo(id: string): AlterationInfo | undefined;
}

export function buildLookups(raw: RawAssets): Lookups {
  const items = raw.NamedItems ?? {};
  const ingredients = new Map<string, IngredientInfo>();
  const alterations = new Map<string, AlterationInfo>();

  for (const [id, it] of Object.entries(items) as [string, RawNamedItem][]) {
    const key = id.toLowerCase();
    if (it.Type === "Ingredient") {
      ingredients.set(key, {
        name: it.DisplayName?.trim() || it.Name || id,
        icon: it.ImagePaths?.SmallPreview ?? it.ImagePaths?.Icon ?? it.ImagePaths?.LargePreview,
      });
    } else if (it.Type === "Alteration") {
      const text = it.DisplayName?.trim();
      if (text) {
        const p = it.ImagePaths ?? {};
        alterations.set(key, { text, icon: p.SmallPreview ?? p.Icon ?? p.LargePreview });
      }
    }
  }

  return {
    ingredient: (id) => ingredients.get(id.toLowerCase()),
    alteration: (id) => alterations.get(id.toLowerCase())?.text,
    alterationInfo: (id) => alterations.get(id.toLowerCase()),
  };
}
