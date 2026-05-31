import type {
  Ability,
  BookSection,
  Dataset,
  DatasetMeta,
  Defender,
  FacetsByDataset,
  Hero,
  PerkEntity,
  Schematic,
  SearchEntry,
  Survivor,
} from "../types";

const base = import.meta.env.BASE_URL; // ends with "/"

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) {
    throw new Error(
      `Failed to load data/${file} (${res.status}). Run \`npm run data:build\` first.`,
    );
  }
  return (await res.json()) as T;
}

export async function loadDataset(): Promise<Dataset> {
  const [heroes, abilities, survivors, defenders, schematics, perks, search, facets, book, meta] =
    await Promise.all([
      getJson<Hero[]>("heroes.json"),
      getJson<Record<string, Ability>>("abilities.json"),
      getJson<Survivor[]>("survivors.json"),
      getJson<Defender[]>("defenders.json"),
      getJson<Schematic[]>("schematics.json"),
      getJson<Record<string, PerkEntity>>("perks.json"),
      getJson<SearchEntry[]>("search-index.json"),
      getJson<FacetsByDataset>("facets.json"),
      getJson<BookSection[]>("book.json"),
      getJson<DatasetMeta>("meta.json"),
    ]);
  return { heroes, abilities, survivors, defenders, schematics, perks, search, facets, book, meta };
}
