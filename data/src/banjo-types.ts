/**
 * The subset of BanjoBotAssets' `assets.json` we actually read.
 * Mirrors BanjoBotAssets.Json (NamedItemData + per-type data).
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

/** One alteration slot on a schematic: nested [optionGroup][tier] template ids. */
export interface RawAlterationSlot {
  Alterations?: string[][];
  RequiredLevel?: number;
}

export interface RawHeroPerkRequirement {
  CommanderTag?: string[];
  Description?: string;
}

export interface RawNamedItem {
  /** "Schematic", "Hero", "Worker", "Defender", "Ability", "Alteration", "Ingredient", ... */
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
  AlterationSlots?: RawAlterationSlot[];
  RangedWeaponStats?: RawRangedStats | null;
  MeleeWeaponStats?: Record<string, unknown> | null;
  TrapStats?: Record<string, unknown> | null;

  // --- hero-specific (HeroItemData) ---
  CommanderPerk?: string;
  CommanderPerkDescription?: string;
  CommanderPerkName?: string;
  HeroAbilities?: string[];
  HeroPerk?: string;
  HeroPerkDescription?: string;
  HeroPerkName?: string;
  HeroPerkRequirement?: RawHeroPerkRequirement;

  // --- ability-specific (AbilityData) ---
  AbilityStats?: Record<string, number>;
  CooldownSeconds?: number;
  EnergyCost?: number;

  // --- worker-specific (WorkerData) ---
  Personality?: string;

  [k: string]: unknown;
}

export interface RawAssets {
  ExportedAt?: string;
  NamedItems?: Record<string, RawNamedItem>;
  [k: string]: unknown;
}
