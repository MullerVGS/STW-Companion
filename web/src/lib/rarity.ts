import type { Rarity } from "../types";

/** STW-ish rarity palette, used for borders, glows and placeholder tiles. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9aa3ad",
  uncommon: "#5ca72f",
  rare: "#3aa0ff",
  epic: "#b14bff",
  legendary: "#ff8a3d",
  mythic: "#ffd24a",
};

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

export function rarityColor(r: Rarity): string {
  return RARITY_COLOR[r] ?? RARITY_COLOR.common;
}
