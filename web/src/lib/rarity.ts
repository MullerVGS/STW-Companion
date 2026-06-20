import type { Rarity } from "../types";

/** STW-ish rarity palette — mirrors the --r-* CSS vars in index.css. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9aa3ad",
  uncommon: "#5ea130",
  rare: "#2f7fe0",
  epic: "#a23ff0",
  legendary: "#f0832a",
  mythic: "#ffce3a",
};

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

/** rarity -> sort rank (used to order cards within a set panel). */
export const RARITY_RANK: Record<string, number> = Object.fromEntries(
  RARITY_ORDER.map((r, i) => [r, i]),
);

/** Approximate per-rarity STW item level for the card's level pill. */
export const RARITY_LEVEL: Record<string, number> = {
  common: 1,
  uncommon: 4,
  rare: 7,
  epic: 9,
  legendary: 12,
  mythic: 25,
};

/** Filled stars per rarity (out of 5). */
export const STARS: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 5,
};

export function rarityColor(r: Rarity): string {
  return RARITY_COLOR[r] ?? RARITY_COLOR.common;
}
