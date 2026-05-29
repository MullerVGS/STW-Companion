/**
 * Collection Book "set" derivation for heroes.
 *
 * The export does NOT carry the in-game set names ("Pirate Heroes") or the
 * location text ("Found inside Pirate Llamas"). We recover the set from two
 * signals — the 4th `_`-segment of the template Name (HID_Commando_027_
 * **PirateSoldier**_SR_T01) and the trailing token of the portrait filename
 * (...Commando-M-**Pirate01**) — then normalize through a curated alias map.
 *
 * Tokens we don't recognize still group heroes that share them (label =
 * Title-cased token + " Heroes"); only truly tokenless heroes fall to "other".
 * Extend SET_DEFS to add friendly labels / location strings over time.
 */

import { titleCase } from "./util.js";

export interface HeroSet {
  key: string;
  label: string;
  location?: string;
}

/** Canonical sets with friendly labels and (where known) Llama-shop locations. */
const SET_DEFS: Record<string, { label: string; location?: string }> = {
  pirate: { label: "Pirate Heroes", location: "Found inside Pirate Llamas in the Llama Shop." },
  rad: { label: "Rad Heroes", location: "Found inside event Loot Llamas in the Llama Shop." },
  retroscifi: { label: "Retro Sci-Fi Heroes", location: "Found inside event Loot Llamas in the Llama Shop." },
  toy: { label: "Toy Heroes", location: "Found inside event Loot Llamas during Misfit Toys." },
  fortnitemares: { label: "Fortnitemares Heroes", location: "Found inside event Loot Llamas during Fortnitemares." },
  holiday: { label: "Holiday Heroes", location: "Found inside event Loot Llamas during the holiday season." },
  lunarnewyear: { label: "Lunar New Year Heroes", location: "Found inside event Loot Llamas during Lunar New Year." },
  springtime: { label: "Springtime Heroes", location: "Found inside event Loot Llamas during the Spring event." },
  historic: { label: "Historic Heroes" },
  artdeco: { label: "Art Deco Heroes" },
  roadtrip: { label: "Road Trip Heroes" },
  blockbuster: { label: "Blockbuster Heroes" },
  spy: { label: "Spy Heroes" },
  wildwest: { label: "Wild West Heroes" },
  dino: { label: "Dino Heroes" },
  stpatricks: { label: "St. Patrick's Heroes" },
  pajama: { label: "Sleepover Heroes" },
  founders: { label: "Founder's Heroes", location: "Founder's Pack exclusive." },
  other: { label: "Other Heroes" },
};

/** Raw-token → canonical-key aliases (after normalization). */
const ALIASES: Record<string, string> = {
  pirate: "pirate",
  rad: "rad",
  retroscifi: "retroscifi",
  retro: "retroscifi",
  toy: "toy",
  toytinkerer: "toy",
  toymonkey: "toy",
  zombie: "fortnitemares",
  halloween: "fortnitemares",
  halloweenquest: "fortnitemares",
  fortnitemares: "fortnitemares",
  palespooky: "fortnitemares",
  holiday: "holiday",
  winter: "holiday",
  frost: "holiday",
  lny: "lunarnewyear",
  lunarnewyear: "lunarnewyear",
  spring: "springtime",
  springtime: "springtime",
  bunnybrawler: "springtime",
  historic: "historic",
  deco: "artdeco",
  artdeco: "artdeco",
  roadtrip: "roadtrip",
  blockbuster: "blockbuster",
  spy: "spy",
  gumshoe: "spy",
  wildwest: "wildwest",
  western: "wildwest",
  dino: "dino",
  stpatricks: "stpatricks",
  pajama: "pajama",
  founders: "founders",
  foundersf: "founders",
  foundersm: "founders",
};

const CLASS_SUFFIXES = ["soldier", "constructor", "ninja", "outlander"];
/** index-3 / image tokens that are really rarity / tier / reskin codes, not sets */
const NON_SET = /^(sr|vr|r|uc|c|f|m|ur|br|male|female|l)$|^t\d+$|^rs\d+$|^\d+$/i;

/** Lowercase, strip class suffix, strip trailing digits, strip BR suffix.
 *  Returns "" for junk (too short to be a real theme token). */
function normalizeToken(raw: string): string {
  let t = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const c of CLASS_SUFFIXES) if (t.endsWith(c) && t.length > c.length) t = t.slice(0, -c.length);
  t = t.replace(/\d+$/, "").replace(/(br|male|female)$/, "");
  return t.length >= 3 ? t : "";
}

/** Candidate raw tokens from template Name, portrait filename, and event code. */
function candidates(name?: string, imagePath?: string): string[] {
  const out: string[] = [];
  const parts = (name ?? "").split("_");
  const seg = parts[3];
  if (seg && !NON_SET.test(seg)) out.push(seg);
  if (imagePath) {
    const base = imagePath.replace(/\\/g, "/").split("/").pop() ?? "";
    const stem = base.replace(/\.[a-z0-9]+$/i, "");
    const last = stem.split("-").pop();
    if (last && !NON_SET.test(last)) out.push(last);
  }
  // event-code suffix heuristic (lowest priority): "007HW" -> Halloween, etc.
  const event = parts[2] ?? "";
  if (/hw$/i.test(event)) out.push("halloween");
  else if (/xmas$|winter$/i.test(event)) out.push("holiday");
  return out;
}

/** Build a HeroSet from a canonical key, guaranteeing a label. */
function known(key: string): HeroSet {
  const def = SET_DEFS[key];
  return { key, label: def?.label ?? `${titleCase(key)} Heroes`, location: def?.location };
}

export function deriveHeroSet(name?: string, imagePath?: string): HeroSet {
  for (const raw of candidates(name, imagePath)) {
    const norm = normalizeToken(raw);
    if (!norm) continue;
    const canon = ALIASES[norm];
    if (canon) return known(canon);
    // unknown but usable token: group on its own, friendly-ish label
    return { key: norm, label: `${titleCase(norm)} Heroes` };
  }
  return known("other");
}

/** Stable display order for known sets; unknown sets sort after, alphabetically. */
export function setSortKey(key: string): string {
  const known = Object.keys(SET_DEFS);
  const i = known.indexOf(key);
  return i >= 0 ? String(i).padStart(3, "0") : `999-${key}`;
}
