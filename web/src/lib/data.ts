import type { Dataset, FacetGroup, DatasetMeta, Schematic } from "../types";

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
  const [schematics, facets, meta] = await Promise.all([
    getJson<Schematic[]>("schematics.json"),
    getJson<FacetGroup[]>("facets.json"),
    getJson<DatasetMeta>("meta.json"),
  ]);
  return { schematics, facets, meta };
}
