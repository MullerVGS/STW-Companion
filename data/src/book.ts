/**
 * Builds the in-game Collection Book hierarchy from the manually transcribed
 * taxonomy CSV. The CSV owns section/division/entry labels and ordering; this
 * module only resolves each entry to normalized collectible ids.
 */

import fs from "node:fs";

import type {
  BookEntry,
  BookSection,
  BookSlot,
  DatasetName,
  Defender,
  Hero,
  Rarity,
  Schematic,
  Survivor,
} from "./schema.js";
import { slug } from "./util.js";

interface Datasets {
  heroes: Hero[];
  survivors: Survivor[];
  defenders: Defender[];
  schematics: Schematic[];
}

interface TaxonomyRow {
  sectionOrder: number;
  divisionOrder: number;
  itemOrder: number;
  section: string;
  division: string;
  item: string;
}

interface IndexedRecord {
  dataset: DatasetName;
  id: string;
  name: string;
  rarity: Rarity;
  templateId?: string;
  record: Hero | Survivor | Defender | Schematic;
}

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

const SECTION_KEYS: Record<string, string> = {
  Heroes: "heroes",
  Personnel: "personnel",
  "Ranged Weapons": "ranged",
  "Melee Weapons": "melee",
  Traps: "traps",
  "Starter Packs": "starter-packs",
  "Event People": "event-people",
  "Event Schematics": "event-schematics",
  "Expansion People": "expansion-people",
  "Expansion Schematics": "expansion-schematics",
};

const SECTION_DATASETS: Record<string, DatasetName[]> = {
  Heroes: ["heroes"],
  Personnel: ["survivors", "defenders"],
  "Ranged Weapons": ["schematics"],
  "Melee Weapons": ["schematics"],
  Traps: ["schematics"],
  "Starter Packs": ["heroes", "schematics"],
  "Event People": ["heroes", "survivors"],
  "Event Schematics": ["schematics"],
  "Expansion People": ["heroes"],
  "Expansion Schematics": ["schematics"],
};

/** Panels whose title is a group rather than an exported display name. */
const PANEL_NAMES: Record<string, string[]> = {
  "Heroes/Soldiers/Campaign Soldiers": [
    "Archetype Havoc",
    "Buckshot Raptor",
    "Liteshow Spitfire",
  ],
  "Heroes/Constructors/Campaign Constructors": [
    "Conqueror Magnus",
    "Dark Vanguard Airheart",
  ],
  "Heroes/Ninjas/Campaign Ninjas": ["Forged Fate", "Overtaker Hiro"],
  "Heroes/Outlanders/Campaign Outlanders": ["Valkyrie Rio", "Ventura Ramirez"],

  "Event People/Road Trip Heroes/Road Trip Heroes": [
    "Redline Ramirez",
    "Whiteout Fiona",
    "Tactical Assault Sledgehammer",
    "Thunder Thora",
  ],
  "Event People/Road Trip Heroes/Prickly Patroller": ["Prickly Patroller Ramirez"],
  "Event People/Blockbuster Heroes/Blockbuster Heroes": [
    "8-Bit Demo",
    "Archaeolo-Jess",
    "Chromium Ramirez",
    "Diecast Jonesy",
  ],
  "Event People/Blockbuster Heroes/Blockbuster Mythics": [
    "Carbide",
    "Raven",
    "The Cloaked Star",
  ],
  "Event People/Springtime Heroes/Lucky Folk": [
    "Battle Hound Jonesy",
    "Four Leaf Wildcat",
    "Highland Warrior Wildcat",
    "Staredown Southie",
  ],
  "Event People/Springtime Heroes/Spring Folk": [
    "Bunny Brawler Luna",
    "Rabbit Raider Jonesy",
    "Miss Bunny Penny",
    "Dashing Hare Ken",
    "Cottontail Eagle Eye",
  ],
  "Event People/Springtime Heroes/Matchmakers & Heartbreakers": [
    "Love Ranger Jonesy",
    "Fallen Love Ranger Jonesy",
    "Snuggle Specialist Sarah",
    "Anti-Cuddle Sarah",
  ],
  "Event People/Springtime Heroes/Flag-Bearers": [
    "Stars and Stripes Jonesy",
    "Star-Spangled Headhunter",
    "Patriot Penny",
    "Old Glory A.C.",
  ],
  "Event People/Springtime Heroes/Horde Heroes (2025)": [
    "Dashing Hawk",
    "Flutter",
    "Hotwire",
    "Deimos",
  ],
  "Event People/Lunar New Year Heroes/Lunar Soldiers": [
    "Berserker Renegade",
    "Onslaught Headhunter",
  ],
  "Event People/Lunar New Year Heroes/Lunar Constructors": [
    "Riot Control Izza",
    "Riot Response Hazard",
  ],
  "Event People/Lunar New Year Heroes/Lunar Ninjas": [
    "Thunderstrike Mari",
    "Whirlwind Scorch",
  ],
  "Event People/Lunar New Year Heroes/Lunar Outlanders": [
    "Flash A.C.",
    "Fireflower Eagle Eye",
  ],
  "Event People/Holiday Heroes/Frostnite Heroes (2018)": [
    "Crackshot",
    "Sentry Gunner Krampus",
    "Lynx Kassandra",
    "Subzero Zenith",
  ],
  "Event People/Holiday Heroes/Frostnite Mythics (2018)": [
    "The Ice King",
    "The Ice Queen",
  ],
  "Event People/Fortnitemares Heroes/Fortnitemares (2018)": [
    "Dire",
    "Plague Doctor Igor",
    "Sanguine Dusk",
    "Cloaked Shadow",
  ],
  "Event People/Fortnitemares Heroes/Fortnitemares (2018) (Promotional)": [
    "Skull Ranger Ramirez",
    "Brainiac Jonesy",
  ],
  "Event People/Fortnitemares Heroes/Fortnitemares (2017) (Soldiers)": [
    "Ghoul Trooper Ramirez",
    "Skull Trooper Jonesy",
  ],
  "Event People/Fortnitemares Heroes/Fortnitemares (2017) (Constructors)": [
    "Kyle the 13th",
    "Catstructor Penny",
  ],
  "Event People/Fortnitemares Heroes/Fortnitemares (2017) (Ninjas)": [
    "Sarah Hotep",
    "Swift Shuriken Llamurai",
  ],
  "Event People/Fortnitemares Heroes/Fortnitemares (2017) (Outlanders)": [
    "Beetlejess",
    "Bloodfinder A.C.",
  ],
  "Event Schematics/Dragon Weapons/Dragon's Breath Shotgun": ["Dragon's Might"],
};

/**
 * Core and expansion schematic panels use a family title instead of the item
 * display names. Values are canonical template roots after rarity/tier removal.
 */
const PANEL_ROOTS: Record<string, string[]> = {
  "Ranged Weapons/Assault Rifles/Auto Rifles": ["SID_Assault_Auto"],
  "Ranged Weapons/Assault Rifles/Burst Rifles": ["SID_Assault_Burst"],
  "Ranged Weapons/Assault Rifles/Doubleshot Rifles": ["SID_Assault_Doubleshot"],
  "Ranged Weapons/Assault Rifles/LMG Rifles": ["SID_Assault_LMG"],
  "Ranged Weapons/Assault Rifles/Semi-Auto Rifles": ["SID_Assault_SemiAuto"],
  "Ranged Weapons/Assault Rifles/Single-Shot Rifles": ["SID_Assault_SingleShot"],
  "Ranged Weapons/Assault Rifles/Surgical Rifles": ["SID_Assault_Surgical"],
  "Ranged Weapons/Assault Rifles/Raygun": ["SID_Assault_Raygun"],
  "Ranged Weapons/Shotguns/Auto Shotguns": ["SID_Shotgun_Auto"],
  "Ranged Weapons/Shotguns/Break Action Shotguns": ["SID_Shotgun_Break"],
  "Ranged Weapons/Shotguns/Heavy Shotguns": ["SID_Shotgun_Heavy"],
  "Ranged Weapons/Shotguns/Pump-Action Shotguns": ["SID_Shotgun_Standard"],
  "Ranged Weapons/Shotguns/Tactical Shotguns": ["SID_Shotgun_Tactical"],
  "Ranged Weapons/Shotguns/Precision Tactical Shotguns": ["SID_Shotgun_Tactical_Precision"],
  "Ranged Weapons/Shotguns/Over-Under Shotguns": ["SID_Shotgun_Break_OU"],
  "Ranged Weapons/Shotguns/Semi Auto Shotguns": ["SID_Shotgun_SemiAuto"],
  "Ranged Weapons/Pistols/Bolt Revolver Pistols": ["SID_Pistol_BoltRevolver"],
  "Ranged Weapons/Pistols/Firecracker Pistols": ["SID_Pistol_FireCracker"],
  "Ranged Weapons/Pistols/Handcannon Pistols": ["SID_Pistol_Handcannon"],
  "Ranged Weapons/Pistols/Semi-Auto Handcannon Pistols": ["SID_Pistol_Handcannon_Semi"],
  "Ranged Weapons/Pistols/Rapid Fire Pistols": ["SID_Pistol_Rapid"],
  "Ranged Weapons/Pistols/Semi-Auto Pistols": ["SID_Pistol_SemiAuto"],
  "Ranged Weapons/Pistols/Six Shooter Pistols": ["SID_Pistol_SixShooter"],
  "Ranged Weapons/Pistols/Energy Pistols": [
    "SID_Pistol_Bolt",
    "SID_Pistol_Rocket",
    "SID_Pistol_Space",
    "SID_Pistol_Zapper",
  ],
  "Ranged Weapons/SMGs/Machine Pistols": ["SID_Pistol_Auto"],
  "Ranged Weapons/SMGs/Heavy Auto SMGs": ["SID_Pistol_AutoHeavy"],
  "Ranged Weapons/Sniper Rifles/Laser Sniper": ["SID_Sniper_AMR"],
  "Ranged Weapons/Sniper Rifles/Auto Sniper": ["SID_Sniper_Auto"],
  "Ranged Weapons/Sniper Rifles/Standard Scoped Snipers": ["SID_Sniper_Standard_Scope"],
  "Ranged Weapons/Sniper Rifles/Bolt-Action Sniper": ["SID_Sniper_BoltAction"],
  "Ranged Weapons/Sniper Rifles/Scoped Bolt-Action Sniper": ["SID_Sniper_BoltAction_Scope"],
  "Ranged Weapons/Sniper Rifles/Shredder Sniper": ["SID_Sniper_Shredder"],
  "Ranged Weapons/Sniper Rifles/Standard Sniper": ["SID_Sniper_Standard"],
  "Ranged Weapons/Sniper Rifles/Triple-Shot Sniper": ["SID_Sniper_TripleShot"],
  "Ranged Weapons/Explosive Weapons/Grenade Launchers": ["SID_Launcher_Grenade"],
  "Ranged Weapons/Explosive Weapons/Rocket Launchers": ["SID_Launcher_Rocket"],

  "Melee Weapons/Axes/Improvised Axes": ["SID_Edged_Axe_Light"],
  "Melee Weapons/Axes/Medium Axes": ["SID_Edged_Axe_Medium"],
  "Melee Weapons/Axes/Heavy Axes": ["SID_Edged_Axe_Heavy"],
  "Melee Weapons/Axes/Laser Axes": ["SID_Edged_Axe_Medium_Laser"],
  "Melee Weapons/Clubs/Baseball Bats": [
    "SID_Blunt_Light_Bat",
    "SID_Blunt_Light_Rocketbat",
  ],
  "Melee Weapons/Clubs/Golf Clubs": ["SID_Blunt_Light", "SID_Blunt_Club_Light"],
  "Melee Weapons/Clubs/Cricket Bats": ["SID_Blunt_Heavy_Paddle"],
  "Melee Weapons/Scythes/Scythes": ["SID_Edged_Scythe"],
  "Melee Weapons/Scythes/Laser Scythes": ["SID_Edged_Scythe_Laser"],
  "Melee Weapons/Spears/Spears": ["SID_Piercing_Spear"],
  "Melee Weapons/Spears/Military Spears": ["SID_Piercing_Spear_Military"],
  "Melee Weapons/Spears/Laser Spears": ["SID_Piercing_Spear_Laser"],
  "Melee Weapons/Swords/Light Swords": ["SID_Edged_Sword_Light"],
  "Melee Weapons/Swords/Medium Swords": ["SID_Edged_Sword_Medium"],
  "Melee Weapons/Swords/Heavy Swords": ["SID_Edged_Sword_Heavy"],
  "Melee Weapons/Swords/Laser Swords": ["SID_Edged_Sword_Medium_Laser"],
  "Melee Weapons/Hardware/Crowbars": ["SID_Blunt_Tool_Light"],
  "Melee Weapons/Hardware/Wrenches": ["SID_Blunt_Medium"],
  "Melee Weapons/Hardware/Rocket Sledges": ["SID_Blunt_Hammer_Rocket"],
  "Melee Weapons/Hardware/Heavy Hammers": ["SID_Blunt_Hammer_Heavy"],

  "Expansion Schematics/Vacuum Tube Weapons/Tube Assault Rifles": ["SID_Assault_VacuumTube"],
  "Expansion Schematics/Vacuum Tube Weapons/Tube SMGs and Pistols": [
    "SID_Pistol_VacuumTube_Auto",
    "SID_Pistol_VacuumTube_Revolver",
  ],
  "Expansion Schematics/Vacuum Tube Weapons/Tube Shotguns": ["SID_Shotgun_VacuumTube"],
  "Expansion Schematics/Vacuum Tube Weapons/Tube Snipers": ["SID_Sniper_VacuumTube"],
  "Expansion Schematics/Vacuum Tube Weapons/Tube Launchers": ["SID_Launcher_VacuumTube"],
  "Expansion Schematics/Vacuum Tube Weapons/Tube Axes": ["SID_Edged_Axe_Heavy_VacuumTube"],
  "Expansion Schematics/Vacuum Tube Weapons/Tube Swords": ["SID_Edged_Sword_Medium_VacuumTube"],
  "Expansion Schematics/Vacuum Tube Weapons/Tube Spears": ["SID_Piercing_Spear_VacuumTube"],
  "Expansion Schematics/Neon Weapons/Krypton Pistols": ["SID_Pistol_NeonGlow"],
  "Expansion Schematics/Neon Weapons/Helium Shotguns": ["SID_Shotgun_NeonGlow"],
  "Expansion Schematics/Neon Weapons/Argon Assault Rifles": ["SID_Assault_NeonGlow"],
  "Expansion Schematics/Neon Weapons/Neon Sniper": ["SID_Sniper_NeonGlow"],
  "Expansion Schematics/Neon Weapons/Argon Axes": ["SID_Edged_Axe_NeonGlow"],
  "Expansion Schematics/Neon Weapons/Neon Scythes": ["SID_Edged_Scythe_NeonGlow"],
  "Expansion Schematics/Neon Weapons/Krypton Swords": ["SID_Edged_Sword_NeonGlow"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Pulse Rifles": ["SID_Assault_Auto_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech SMGs": ["SID_Pistol_AutoHeavy_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Burst Pistols": ["SID_Pistol_Handcannon_Semi_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Blaster Pistol": ["SID_Pistol_Handcannon_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Shotguns": ["SID_Shotgun_Standard_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Snipers": ["SID_Sniper_Standard_Scope_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Rocket Hammers": ["SID_Blunt_Hammer_Rocket_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Laser Axes": ["SID_Edged_Axe_VT"],
  "Expansion Schematics/VinderTech Weapons/Vindertech Laser Swords": ["SID_Edged_Sword_Medium_VT"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Assault Rifles": ["SID_Assault_Hydraulic_Drum"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Shotguns": ["SID_Shotgun_Hydraulic"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Pistols": ["SID_Pistol_Hydraulic"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Snipers": ["SID_Sniper_Hydraulic"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Launchers": ["SID_Launcher_Hydraulic"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Swords": ["SID_Edged_Sword_Hydraulic"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Spears": ["SID_Piercing_Spear_Hydraulic"],
  "Expansion Schematics/Hydraulic Weapons/Hydraulic Hammers": ["SID_Blunt_Hammer_Hydraulic"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Assault Rifles": ["SID_Assault_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Double-Barreled Shotguns": ["SID_Shotgun_Break_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Semi-Auto Shotguns": ["SID_Shotgun_SemiAuto_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger SMGs": ["SID_Pistol_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Snipers": ["SID_Sniper_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Launcher": ["SID_Launcher_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Axes": ["SID_Edged_Axe_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Spears": ["SID_Piercing_Spear_Scavenger"],
  "Expansion Schematics/Scavenger Weapons/Scavenger Hardware": ["SID_Blunt_Scavenger"],
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function readTaxonomy(file: string): TaxonomyRow[] {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const header = rows.shift();
  const expected = ["section_order", "division_order", "item_order", "section", "division", "item"];
  if (!header || header.join("|") !== expected.join("|")) {
    throw new Error(`[book] unexpected taxonomy header in ${file}`);
  }
  return rows.map((r, index) => {
    if (r.length !== expected.length) {
      throw new Error(`[book] malformed taxonomy row ${index + 2}: ${r.join(",")}`);
    }
    return {
      sectionOrder: Number(r[0]),
      divisionOrder: Number(r[1]),
      itemOrder: Number(r[2]),
      section: r[3]!,
      division: r[4]!,
      item: r[5]!,
    };
  });
}

function normalizedName(value: string): string {
  return slug(value).replace(/-/g, "");
}

function templateRoot(templateId?: string): string {
  return (templateId ?? "")
    .replace(/^[^:]+:/, "")
    .replace(/_(?:C|UC|R|VR|SR|UR)(?:_(?:Ore|Crystal))?_T\d+$/i, "")
    .replace(/_T\d+$/i, "");
}

function panelKey(row: TaxonomyRow): string {
  return `${row.section}/${row.division}/${row.item}`;
}

function sortByRarity(records: IndexedRecord[]): IndexedRecord[] {
  return records.sort(
    (a, b) =>
      RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}

function recordsByNames(index: IndexedRecord[], names: string[]): IndexedRecord[] {
  const order = new Map(names.map((name, i) => [normalizedName(name), i]));
  return index
    .filter((r) => order.has(normalizedName(r.name)))
    .sort(
      (a, b) =>
        (order.get(normalizedName(a.name)) ?? 999) -
          (order.get(normalizedName(b.name)) ?? 999) ||
        RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity],
    );
}

function personnelRecords(row: TaxonomyRow, index: IndexedRecord[]): IndexedRecord[] | undefined {
  if (row.section !== "Personnel") return undefined;
  if (row.division === "Defenders") {
    const m = /^(Rifleman|Gunslinger|Shotgunner|Sniper|Bruiser) Defenders \((Female|Male)\)$/.exec(row.item);
    if (!m) return [];
    const weapon: Record<string, string> = {
      Rifleman: "Assault",
      Gunslinger: "Pistol",
      Shotgunner: "Shotgun",
      Sniper: "Sniper",
      Bruiser: "Melee",
    };
    return sortByRarity(
      index.filter((r) => {
        if (r.dataset !== "defenders") return false;
        const d = r.record as Defender;
        if (d.weaponType !== weapon[m[1]!] || d.gender !== m[2]) return false;
        return !["Rifleman Trainee", "Jill", "Idris"].includes(d.name);
      }),
    );
  }
  if (row.division === "Survivors") {
    const rarity = row.item.split(" ")[0]!.toLowerCase();
    return index.filter(
      (r) =>
        r.dataset === "survivors" &&
        (r.record as Survivor).kind === "survivor" &&
        r.name === "Survivor" &&
        r.rarity === rarity,
    );
  }
  if (row.division === "Lead Survivors") {
    const squad = row.item
      .replace(/^Lead /, "")
      .replace(/^Marksmen$/, "Marksman")
      .replace(/s$/, "");
    return sortByRarity(
      index.filter(
        (r) =>
          r.dataset === "survivors" &&
          (r.record as Survivor).kind === "lead" &&
          (r.record as Survivor).squad === squad,
      ),
    );
  }
  if (row.division === "Mythic Leads") {
    const squad = row.item
      .replace(/^Mythic /, "")
      .replace(/^Personal Trainers$/, "Trainer")
      .replace(/^Marksmen$/, "Marksman")
      .replace(/s$/, "");
    return index
      .filter(
        (r) =>
          r.dataset === "survivors" &&
          (r.record as Survivor).kind === "mythic-lead" &&
          (r.record as Survivor).squad === squad,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return [];
}

function costumePartyRecords(row: TaxonomyRow, index: IndexedRecord[]): IndexedRecord[] | undefined {
  if (row.section !== "Event People" || row.division !== "Costume Party 'Attendees'") {
    return undefined;
  }
  const rarity = row.item.split(" ")[0]!.toLowerCase();
  return index
    .filter(
      (r) =>
        r.dataset === "survivors" &&
        (r.record as Survivor).kind === "survivor" &&
        r.name !== "Survivor" &&
        r.rarity === rarity,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function scopeToPage(row: TaxonomyRow, index: IndexedRecord[]): IndexedRecord[] {
  if (row.section === "Heroes") {
    const heroClass = row.division.replace(/s$/, "");
    return index.filter(
      (r) => r.dataset === "heroes" && (r.record as Hero).class === heroClass,
    );
  }
  const schematicSubtype: Record<string, string> = {
    "Assault Rifles": "Assault",
    Shotguns: "Shotgun",
    Pistols: "Pistol",
    SMGs: "SMG",
    "Sniper Rifles": "Sniper",
    "Explosive Weapons": "Explosive",
    Axes: "Axe",
    Clubs: "Club",
    Scythes: "Scythe",
    Spears: "Spear",
    Swords: "Sword",
    Hardware: "Hardware",
    "Wall Traps": "Wall",
    "Ceiling Traps": "Ceiling",
    "Floor Traps": "Floor",
  };
  const subType = schematicSubtype[row.division];
  if (subType && ["Ranged Weapons", "Melee Weapons", "Traps"].includes(row.section)) {
    return index.filter(
      (r) => r.dataset === "schematics" && (r.record as Schematic).subType === subType,
    );
  }
  return index;
}

function resolveEntry(row: TaxonomyRow, index: IndexedRecord[]): BookEntry {
  const key = panelKey(row);
  const allowed = new Set(SECTION_DATASETS[row.section] ?? []);
  const scoped = scopeToPage(row, index.filter((r) => allowed.has(r.dataset)));
  let records =
    personnelRecords(row, scoped) ??
    costumePartyRecords(row, scoped) ??
    (PANEL_NAMES[key] ? recordsByNames(scoped, PANEL_NAMES[key]!) : undefined) ??
    (PANEL_ROOTS[key]
      ? sortByRarity(
          scoped.filter((r) => PANEL_ROOTS[key]!.includes(templateRoot(r.templateId))),
        )
      : undefined);

  if (!records) {
    const wanted = normalizedName(row.item);
    records = sortByRarity(scoped.filter((r) => normalizedName(r.name) === wanted));
  }

  if (records.length === 0) {
    throw new Error(`[book] unresolved panel: ${key}`);
  }

  const slots: BookSlot[] = records.map((r) => ({ dataset: r.dataset, id: r.id }));
  return {
    key: `${String(row.itemOrder).padStart(3, "0")}-${slug(row.item)}`,
    label: row.item,
    slots,
  };
}

function buildIndex(d: Datasets): IndexedRecord[] {
  const out: IndexedRecord[] = [];
  const add = (
    dataset: DatasetName,
    records: (Hero | Survivor | Defender | Schematic)[],
  ): void => {
    for (const record of records) {
      out.push({
        dataset,
        id: record.id,
        name: record.name,
        rarity: record.rarity,
        templateId: record.templateId,
        record,
      });
    }
  };
  add("heroes", d.heroes);
  add("survivors", d.survivors);
  add("defenders", d.defenders);
  add("schematics", d.schematics);
  return out;
}

export function buildBook(
  d: Datasets,
  taxonomyFile: string,
  strict = true,
): BookSection[] {
  const rows = readTaxonomy(taxonomyFile).sort(
    (a, b) =>
      a.sectionOrder - b.sectionOrder ||
      a.divisionOrder - b.divisionOrder ||
      a.itemOrder - b.itemOrder,
  );
  const index = buildIndex(d);
  const sections = new Map<number, BookSection>();
  const unresolved: string[] = [];
  const assignments = new Map<string, string[]>();

  for (const row of rows) {
    let section = sections.get(row.sectionOrder);
    if (!section) {
      section = {
        key: SECTION_KEYS[row.section] ?? slug(row.section),
        label: row.section,
        divisions: [],
      };
      sections.set(row.sectionOrder, section);
    }
    let division = section.divisions.find((dvn) => dvn.key === slug(row.division));
    if (!division) {
      division = {
        key: slug(row.division),
        label: row.division,
        entries: [],
        count: 0,
      };
      section.divisions.push(division);
    }
    let entry: BookEntry;
    try {
      entry = resolveEntry(row, index);
    } catch {
      unresolved.push(panelKey(row));
      entry = {
        key: `${String(row.itemOrder).padStart(3, "0")}-${slug(row.item)}`,
        label: row.item,
        slots: [],
      };
    }
    division.entries.push(entry);
    division.count += entry.slots.length;
    for (const slot of entry.slots) {
      const id = `${slot.dataset}:${slot.id}`;
      const locations = assignments.get(id) ?? [];
      locations.push(panelKey(row));
      assignments.set(id, locations);
    }
  }

  const unexpectedDuplicates = [...assignments.entries()].filter(([, locations]) => {
    if (locations.length < 2) return false;
    return !locations.every((location) => location.startsWith("Personnel/Survivors/"));
  });
  if (unresolved.length > 0 && strict) {
    throw new Error(`[book] unresolved panels (${unresolved.length}):\n${unresolved.join("\n")}`);
  }
  if (unexpectedDuplicates.length > 0 && strict) {
    throw new Error(
      `[book] records assigned to multiple panels:\n${unexpectedDuplicates
        .map(([id, locations]) => `${id}: ${locations.join(" | ")}`)
        .join("\n")}`,
    );
  }
  if (unresolved.length > 0) {
    console.warn(`[book] fixture left ${unresolved.length} taxonomy panels unresolved`);
  }
  const panelCount = [...sections.values()].reduce(
    (total, section) =>
      total + section.divisions.reduce((sum, division) => sum + division.entries.length, 0),
    0,
  );
  const slotCount = [...assignments.values()].reduce(
    (total, locations) => total + locations.length,
    0,
  );
  console.log(
    `[book] panels=${panelCount} slots=${slotCount} uniqueRecords=${assignments.size}`,
  );
  return [...sections.values()];
}
