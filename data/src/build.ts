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

import sharp from "sharp";

import { buildAllFacets } from "./facets.js";
import { buildSearchIndex } from "./search.js";
import { buildBook } from "./book.js";
import { buildLookups } from "./lookups.js";
import { importSchematics } from "./import-banjo.js";
import { importAbilities, importHeroes } from "./import-heroes.js";
import { importDefenders, importSurvivors } from "./import-personnel.js";
import { importGadgets, importTeamPerks } from "./import-loadout.js";
import { importRewards } from "./import-rewards.js";
import type { DatasetMeta, ImageSet, Perk, Rarity } from "./schema.js";
import type { RawAssets } from "./banjo-types.js";
import { slug } from "./util.js";

const dataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(dataRoot, "raw");
const webPublic = path.resolve(dataRoot, "..", "web", "public");
const outDir = path.join(webPublic, "data");
const iconsDir = path.join(webPublic, "icons");
const taxonomyFile = path.join(dataRoot, "manual", "collection-book-taxonomy.csv");

function resolveSource(): { file: string; kind: DatasetMeta["source"] } {
  const real = path.join(rawDir, "assets.json");
  if (fs.existsSync(real)) return { file: real, kind: "assets.json" };
  const sample = path.join(rawDir, "sample.assets.json");
  if (fs.existsSync(sample)) return { file: sample, kind: "sample.assets.json" };
  throw new Error(`No input found. Expected ${real} (real extraction) or ${sample} (fixture).`);
}

/** Resolve referenced icons → `/icons/<name>.webp` URLs (assigned synchronously,
 *  so facets/search can embed them), converting the real files to WebP in a
 *  batched async flush() — this shrinks the shipped art ~75% vs. the raw PNGs.
 *  Missing files are dropped so the UI falls back to a rarity-colored tile. */
function makeIconCopier() {
  const bySource = new Map<string, string>();
  const usedNames = new Set<string>();
  const jobs: { src: string; dest: string }[] = [];

  function one(value: string | undefined): string | undefined {
    if (typeof value !== "string") return undefined;
    if (value.startsWith("/")) return value;
    const srcAbs = path.resolve(rawDir, value.replace(/\\/g, "/"));
    const cached = bySource.get(srcAbs);
    if (cached !== undefined) return cached;
    if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile()) return undefined;

    const stem = slug(path.basename(srcAbs, path.extname(srcAbs)));
    let name = `${stem}.webp`;
    for (let i = 1; usedNames.has(name); i++) name = `${stem}-${i}.webp`;
    usedNames.add(name);

    const url = `/icons/${name}`;
    jobs.push({ src: srcAbs, dest: path.join(iconsDir, name) });
    bySource.set(srcAbs, url);
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

  /** Convert every queued icon to WebP (parallel, bounded). Returns files written. */
  async function flush(): Promise<number> {
    fs.mkdirSync(iconsDir, { recursive: true });
    let copied = 0;
    let fallbacks = 0;
    let cursor = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const job = jobs[cursor++];
        if (!job) return;
        try {
          await sharp(job.src).webp({ quality: 80 }).toFile(job.dest);
        } catch {
          // URL/extension are already baked as .webp; raw bytes are a last-resort
          // fallback (browsers content-sniff). Surface it so it isn't silent.
          fs.copyFileSync(job.src, job.dest);
          fallbacks++;
        }
        copied++;
      }
    };
    const lanes = Math.min(24, jobs.length) || 1;
    await Promise.all(Array.from({ length: lanes }, worker));
    if (fallbacks > 0) {
      console.warn(`[data] WARN: ${fallbacks} icon(s) failed WebP conversion — copied raw bytes into a .webp name`);
    }
    return copied;
  }

  return { rewrite, one, flush };
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

async function main(): Promise<void> {
  const { file, kind } = resolveSource();
  console.log(`[data] source: ${path.relative(dataRoot, file)} (${kind})`);

  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as RawAssets;
  const look = buildLookups(raw);

  const { heroes, referencedAbilities } = importHeroes(raw);
  const abilities = importAbilities(raw, referencedAbilities);
  const survivors = importSurvivors(raw);
  const defenders = importDefenders(raw);
  const { schematics, perks } = importSchematics(raw, look);
  const teamPerks = importTeamPerks(raw);
  const gadgets = importGadgets(raw);
  const rewards = importRewards(raw);

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
  for (const t of teamPerks) t.images = icons.rewrite(t.images);
  for (const g of gadgets) g.images = icons.rewrite(g.images);

  // standalone UI art: the hero-class glyphs used by the loadout class filter
  const classIcons: Record<string, string> = {};
  for (const [cls, file] of [
    ["Soldier", "ExportedImages\\T-Icon-Hero-Soldier-128.png"],
    ["Constructor", "ExportedImages\\T-Icon-Hero-Constructor-128.png"],
    ["Ninja", "ExportedImages\\T-Icon-Hero-Ninja-128.png"],
    ["Outlander", "ExportedImages\\T-Icon-Hero-Outlander-128.png"],
  ] as const) {
    const url = icons.one(file);
    if (url) classIcons[cls] = url;
  }
  // perk registry icons must be rewritten BEFORE facets so perk facet chips
  // (which carry the icon) reference the copied URL, not the raw export path.
  for (const p of Object.values(perks)) {
    if (!p.images) continue;
    const imgs = icons.rewrite(p.images);
    if (Object.keys(imgs).length > 0) p.images = imgs;
    else delete p.images;
  }
  // reward-registry icons (live home data): resolve each to a copied URL, drop misses.
  for (const entry of Object.values(rewards)) {
    const url = icons.one(entry.icon);
    if (url) entry.icon = url;
    else delete entry.icon;
  }

  const facets = buildAllFacets({ heroes, survivors, defenders, schematics, perks });
  const search = buildSearchIndex({ heroes, survivors, defenders, schematics, perks, abilities, facets });
  const book = buildBook(
    { heroes, survivors, defenders, schematics },
    taxonomyFile,
    kind === "assets.json",
  );

  // URLs were assigned above; now actually write the WebP files.
  const iconsCopied = await icons.flush();

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
      perks: Object.keys(perks).length,
      teamPerks: teamPerks.length,
      gadgets: gadgets.length,
      search: search.length,
      rewards: Object.keys(rewards).length,
      byRarity: tallyRarity(heroes, survivors, defenders, schematics),
    },
    iconsCopied,
  };

  writeJson(path.join(outDir, "heroes.json"), heroes);
  writeJson(path.join(outDir, "abilities.json"), abilityMap);
  writeJson(path.join(outDir, "survivors.json"), survivors);
  writeJson(path.join(outDir, "defenders.json"), defenders);
  writeJson(path.join(outDir, "schematics.json"), schematics);
  writeJson(path.join(outDir, "perks.json"), perks);
  writeJson(path.join(outDir, "team-perks.json"), teamPerks);
  writeJson(path.join(outDir, "gadgets.json"), gadgets);
  writeJson(path.join(outDir, "reward-registry.json"), rewards);
  writeJson(path.join(outDir, "class-icons.json"), classIcons);
  writeJson(path.join(outDir, "search-index.json"), search);
  writeJson(path.join(outDir, "facets.json"), facets);
  writeJson(path.join(outDir, "book.json"), book);
  writeJson(path.join(outDir, "meta.json"), meta, true);

  console.log(
    `[data] heroes=${heroes.length} abilities=${abilities.length} survivors=${survivors.length} defenders=${defenders.length} schematics=${schematics.length} perks=${Object.keys(perks).length} teamPerks=${teamPerks.length} gadgets=${gadgets.length} search=${search.length} rewards=${Object.keys(rewards).length} icons=${iconsCopied}`,
  );
  console.log(`[data] sections: ${book.map((s) => `${s.label}(${s.divisions.length})`).join(", ")}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
