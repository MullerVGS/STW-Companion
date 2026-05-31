import type { SearchEntry } from "../types";

/**
 * Client-side search over the prebuilt index. Tokenized AND substring match
 * against each entry's lowercased haystack (`t`, which already folds in labels,
 * sub-labels and descriptions), with light ranking so exact/prefix label hits
 * float above body-only matches. The index is ~2k entries, so a linear scan is
 * sub-millisecond — the only thing we lazy-load is the *rendering* (see SearchBar).
 */
export function searchIndex(index: SearchEntry[], query: string, limit = 300): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const ranked: { e: SearchEntry; score: number }[] = [];
  for (const e of index) {
    if (!tokens.every((tk) => e.t.includes(tk))) continue;
    const label = e.label.toLowerCase();
    let score: number;
    if (label === q) score = 1000;
    else if (label.startsWith(q)) score = 600;
    else if (label.includes(q)) score = 300;
    else score = 100;
    score -= Math.min(label.length, 80) * 0.5; // prefer the more specific (shorter) label
    ranked.push({ e, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.e.label.localeCompare(b.e.label));
  return ranked.slice(0, limit).map((r) => r.e);
}
