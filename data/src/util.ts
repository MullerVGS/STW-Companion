/** Shared helpers used by both the importer and the facet builder so that
 *  tag ids stay byte-for-byte consistent across the pipeline. */

/** URL-safe, accent-folded slug. Always returns a non-empty string. */
export function slug(input: string): string {
  const s = input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip combining diacritics (after NFKD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "unknown";
}

/** Stable id for a facet value, e.g. tagId("rarity", "Legendary") -> "rarity:legendary". */
export function tagId(facet: string, value: string): string {
  return `${facet}:${slug(value)}`;
}

/** "medium_bullets" / "WALL-light" -> "Medium Bullets" / "Wall Light". */
export function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Drop keys whose value is undefined/null/"" so JSON stays lean. */
export function compact<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
