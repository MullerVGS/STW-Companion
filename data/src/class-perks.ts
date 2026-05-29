import type { HeroClass, Perk } from "./schema.js";

/**
 * Class perks are shared by every hero of a class and are not present in the
 * BanjoBotAssets hero export. Keep this map small, explicit, and sourceable.
 *
 * Source cross-check: Fortnite Wiki class pages and Class Perks category.
 */
export const CLASS_PERKS: Record<HeroClass, Perk[]> = {
  Soldier: [
    {
      templateId: "Kit_Perk_C_Commando_SuppressiveFire_T01",
      name: "Suppressive Fire",
      description:
        "Consecutive shots against the same target deal an additional 3% Damage, up to 5 stacks. Bonus is lost on target switch.",
    },
    {
      templateId: "Kit_Perk_C_Commando_StayFrosty_T01",
      name: "Stay Frosty",
      description:
        "After 3 eliminations, increases Ranged Weapon Damage by 10% and Weapon Stability by 35% for 7 seconds. Additional eliminations refresh duration.",
    },
  ],
  Constructor: [
    {
      templateId: "Kit_Perk_C_KineticOverload_T01",
      name: "Kinetic Overload",
      description:
        "Melee knockbacks and staggers trigger Kinetic Overload, dealing 25 base Energy Damage to nearby enemies. After melee critical hits, increases Melee Impact Damage by 10% for 5 seconds up to 5 stacks.",
    },
    {
      templateId: "Kit_Perk_C_Constructor_BASE_T01",
      name: "B.A.S.E.",
      description:
        "Place B.A.S.E. to reinforce attached structures with 60 Armor. Extends 4 segments from placement. Placed from trap wheel.",
    },
  ],
  Ninja: [
    {
      templateId: "Kit_Perk_C_Ninja_MantisLeap_T01",
      name: "Mantis Leap",
      description: "Jump an additional time while airborne. Ninjas do not take fall damage.",
    },
    {
      templateId: "Kit_Perk_C_Ninja_ShadowStance_T01",
      name: "Shadow Stance",
      description:
        "After defeating an enemy with melee or edged damage, enter Shadow Stance for 4 seconds, increasing Armor and Movement Speed.",
    },
  ],
  Outlander: [
    {
      name: "Anti-Material Charge",
      description:
        "Punch forward, destroying structures and harvesting their materials. Deals damage to enemies. Activate Heavy Attack with your pickaxe equipped.",
      images: { icon: "ExportedImages\\Icon-Outlander-KineticPunch-128.png" },
    },
    {
      name: "Loot Llama",
      description:
        "Consumes a Llama Fragment to deploy a Loot Llama. Whack the Loot Llama with a harvesting tool to get building materials and crafting ingredients before it disappears.",
      images: { icon: "ExportedImages\\Icon-Outlander-LootFind-128.png" },
    },
    {
      templateId: "Kit_Perk_C_Outlander_InTheZone_T01",
      name: "In the Zone",
      description:
        "After 5 hits in a row with a pick axe, gain In the Zone, increasing pick axe damage by 24%.",
    },
  ],
};
