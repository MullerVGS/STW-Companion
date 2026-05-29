/**
 * Build step: raw game export -> web-ready JSON in web/public/data.
 *
 *   data/raw/assets.json        (real extraction; preferred when present)
 *   data/raw/sample.assets.json (committed fixture; fallback)
 *        |
 *        v  import {heroes, abilities, survivors, defenders, schematics}
 *           + buildAllFacets + buildBook + icon copy
 *   web/public/data/*.json   web/public/icons/*.png   (only icons present on disk)
 *
 * Run with: `npm run data:build` (from repo root) or `npm run build` (in /data).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAllFacets } from "./facets.js";
import { buildBook } from "./book.js";
import { buildLookups } from "./lookups.js";
import { importSchematics } from "./import-banjo.js";
import { importAbilities, importHeroes } from "./import-heroes.js";
import { importDefenders, importSurvivors } from "./import-personnel.js";
import type { DatasetMeta, ImageSet, Perk, Rarity } from "./schema.js";
import type { RawAssets } from "./banjo-types.js";
import { slug } from "./util.js";

const dataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(dataRoot, "raw");
const webPublic = path.resolve(dataRoot, "..", "web", "public");
const outDir = path.join(webPublic, "data");
const iconsDir = path.join(webPublic, "icons");

function resolveSource(): { file: string; kind: DatasetMeta["source"] } {
  const real = path.join(rawDir, "assets.json");
  if (fs.existsSync(real)) return { file: real, kind: "assets.json" };
  const sample = path.join(rawDir, "sample.assets.json");
  if (fs.existsSync(sample)) return { file: sample, kind: "sample.assets.json" };
  throw new Error(`No input found. Expected ${real} (real extraction) or ${sample} (fixture).`);
}

/** Copy referenced icons into web/public/icons; rewrite image fields to URLs.
 *  Missing files are dropped so the UI falls back to a rarity-colored tile. */
function makeIconCopier() {
  const bySource = new Map<string, string>();
  const usedNames = new Set<string>();
  let copied = 0;

  function one(value: string | undefined): string | undefined {
    if (typeof value !== "string") return undefined;
    if (value.startsWith("/")) return value;
    const srcAbs = path.resolve(rawDir, value.replace(/\\/g, "/"));
    const cached = bySource.get(srcAbs);
    if (cached !== undefined) return cached;
    if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile()) return undefined;

    const ext = path.extname(srcAbs) || ".png";
    const stem = slug(path.basename(srcAbs, ext));
    let name = `${stem}${ext}`;
    for (let i = 1; usedNames.has(name); i++) name = `${stem}-${i}${ext}`;
    usedNames.add(name);

    fs.mkdirSync(iconsDir, { recursive: true });
    fs.copyFileSync(srcAbs, path.join(iconsDir, name));
    const url = `/icons/${name}`;
    bySource.set(srcAbs, url);
    copied++;
    return url;
  }

  function rewrite(images: ImageSet): ImageSet {
    const out: ImageSet = {};
    for (const key of ["icon", "small", "large"] as const) {
      const url = one(images[key]);
      if (url) out[key] = url;
    }
    return out;
  }

  return { rewrite, one, get copied() { return copied; } };
}

function rewritePerkImages(perk: Perk | undefined, rewrite: (images: ImageSet) => ImageSet): void {
  if (!perk?.images) return;
  const images = rewrite(perk.images);
  if (Object.keys(images).length > 0) {
    perk.images = images;
  } else {
    delete perk.images;
  }
}

function rewriteBadgeImages(
  badges: { leader?: string; personality?: string; squad?: string } | undefined,
  copy: (value: string | undefined) => string | undefined,
): void {
  if (!badges) return;
  for (const key of ["leader", "personality", "squad"] as const) {
    const url = copy(badges[key]);
    if (url) {
      badges[key] = url;
    } else {
      delete badges[key];
    }
  }
}

function writeJson(file: string, data: unknown, pretty = false): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, pretty ? 2 : 0));
}

function tallyRarity(...lists: { rarity: Rarity }[][]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const list of lists) for (const r of list) out[r.rarity] = (out[r.rarity] ?? 0) + 1;
  return out;
}

function main(): void {
  const { file, kind } = resolveSource();
  console.log(`[data] source: ${path.relative(dataRoot, file)} (${kind})`);

  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as RawAssets;
  const look = buildLookups(raw);

  const { heroes, referencedAbilities } = importHeroes(raw);
  const abilities = importAbilities(raw, referencedAbilities);
  const survivors = importSurvivors(raw);
  const defenders = importDefenders(raw);
  const schematics = importSchematics(raw, look);

  // fresh output dirs so stale icons/data don't linger
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(iconsDir, { recursive: true, force: true });

  const icons = makeIconCopier();
  for (const h of heroes) {
    h.images = icons.rewrite(h.images);
    rewritePerkImages(h.heroPerk, icons.rewrite);
    rewritePerkImages(h.commanderPerk, icons.rewrite);
    for (const p of h.classPerks) rewritePerkImages(p, icons.rewrite);
  }
  for (const a of abilities) a.images = icons.rewrite(a.images);
  for (const s of survivors) {
    s.images = icons.rewrite(s.images);
    rewriteBadgeImages(s.badgeImages, icons.one);
  }
  for (const d of defenders) d.images = icons.rewrite(d.images);
  for (const s of schematics) {
    s.images = icons.rewrite(s.images);
    if (s.craftingCost) for (const c of s.craftingCost) c.icon = icons.one(c.icon);
  }

  const facets = buildAllFacets({ heroes, survivors, defenders, schematics });
  const book = buildBook({ heroes, survivors, defenders, schematics });

  const abilityMap: Record<string, (typeof abilities)[number]> = {};
  for (const a of abilities) abilityMap[a.id] = a;

  const meta: DatasetMeta = {
    generatedAt: new Date().toISOString(),
    source: kind,
    counts: {
      heroes: heroes.length,
      abilities: abilities.length,
      survivors: survivors.length,
      defenders: defenders.length,
      schematics: schematics.length,
      byRarity: tallyRarity(heroes, survivors, defenders, schematics),
    },
    iconsCopied: icons.copied,
  };

  writeJson(path.join(outDir, "heroes.json"), heroes);
  writeJson(path.join(outDir, "abilities.json"), abilityMap);
  writeJson(path.join(outDir, "survivors.json"), survivors);
  writeJson(path.join(outDir, "defenders.json"), defenders);
  writeJson(path.join(outDir, "schematics.json"), schematics);
  writeJson(path.join(outDir, "facets.json"), facets);
  writeJson(path.join(outDir, "book.json"), book);
  writeJson(path.join(outDir, "meta.json"), meta, true);

  console.log(
    `[data] heroes=${heroes.length} abilities=${abilities.length} survivors=${survivors.length} defenders=${defenders.length} schematics=${schematics.length} icons=${icons.copied}`,
  );
  console.log(`[data] sections: ${book.map((s) => `${s.label}(${s.subcategories.length})`).join(", ")}`);
}

main();
