/**
 * The subset of BanjoBotAssets' `assets.json` we actually read.
 * Mirrors BanjoBotAssets.Json (NamedItemData + SchematicItemData).
 *
 * NOTE: BanjoBotAssets serializes with **PascalCase** keys (verified against a
 * real export), and image paths use Windows back-slashes. Everything is
 * optional/defensive because exporter output varies across game versions.
 *
 * @see https://github.com/BanjoByTheBay/BanjoBotAssets (BanjoBotAssets.Json/*.cs)
 */

export type RawImageType =
  | "SmallPreview"
  | "LargePreview"
  | "Icon"
  | "LoadingScreen"
  | "PackImage";

export interface RawRangedStats {
  AmmoType?: string | null;
  [k: string]: unknown;
}

export interface RawNamedItem {
  /** "Schematic", "Hero", "Survivor", "Defender", ... */
  Type?: string;
  Name?: string;
  DisplayName?: string;
  Description?: string;
  SubType?: string;
  Rarity?: string;
  Tier?: number;
  AssetPath?: string;
  ImagePaths?: Partial<Record<RawImageType, string>>;

  // --- schematic-specific (SchematicItemData) ---
  Category?: string;
  EvoType?: string;
  /** weapon fire mode: "Automatic" | "OnPress" | "OnRelease" (empty for traps) */
  TriggerType?: string;
  DisplayTier?: string;
  CraftingCost?: Record<string, number>;
  RangedWeaponStats?: RawRangedStats | null;
  MeleeWeaponStats?: Record<string, unknown> | null;
  TrapStats?: Record<string, unknown> | null;

  [k: string]: unknown;
}

export interface RawAssets {
  ExportedAt?: string;
  NamedItems?: Record<string, RawNamedItem>;
  [k: string]: unknown;
}
