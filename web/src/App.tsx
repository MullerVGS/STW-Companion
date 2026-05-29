import { useEffect, useMemo, useState } from "react";

import { BookSidebar } from "./components/BookSidebar";
import { FilterBar, type OwnedFilter } from "./components/FilterBar";
import { ItemGrid } from "./components/ItemGrid";
import { InspectModal } from "./components/InspectModal";
import { loadDataset } from "./lib/data";
import { clearAll, exportJson, importJson, useCollectionState } from "./store/collection";
import { KIND_OF, matches, recordsOf, searchText, type Selected } from "./lib/view";
import type { AnyItem, BookSection, BookSubcategory, Dataset, DatasetName } from "./types";

/** dataset that backs a section's synthetic "All" view (personnel spans two -> none). */
const SECTION_DATASET: Record<string, DatasetName> = {
  heroes: "heroes",
  ranged: "schematics",
  melee: "schematics",
  traps: "schematics",
};

/** Prepend an "All <section>" subcategory to single-dataset sections. */
function withAll(section: BookSection, d: Dataset): BookSubcategory[] {
  const ds = SECTION_DATASET[section.key];
  if (!ds) return section.subcategories;
  const match = ds === "schematics" ? [{ field: "category", value: section.key }] : undefined;
  const count = recordsOf(d, ds).filter((r) => matches(r, match)).length;
  const all: BookSubcategory = { key: "all", label: `All ${section.label}`, dataset: ds, match, count };
  return [all, ...section.subcategories];
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState("heroes");
  const [activeSub, setActiveSub] = useState("all");
  const [query, setQuery] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [selectedTags, setSelectedTags] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<Selected | null>(null);

  const collection = useCollectionState();

  useEffect(() => {
    loadDataset().then(setDataset).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  // sections with synthetic "All" subcategories
  const sections = useMemo(
    () => (dataset ? dataset.book.map((s) => ({ ...s, subcategories: withAll(s, dataset) })) : []),
    [dataset],
  );

  const section = sections.find((s) => s.key === activeSection) ?? sections[0];
  const sub = section?.subcategories.find((x) => x.key === activeSub) ?? section?.subcategories[0];

  // records for the active subcategory
  const records = useMemo<AnyItem[]>(() => {
    if (!dataset || !sub) return [];
    return recordsOf(dataset, sub.dataset).filter((r) => matches(r, sub.match));
  }, [dataset, sub]);

  // facets for the active dataset, hiding ones already constrained by the subcategory
  const facets = useMemo(() => {
    if (!dataset || !sub) return [];
    const constrained = new Set((sub.match ?? []).map((m) => m.field));
    return dataset.facets[sub.dataset].filter((g) => !constrained.has(g.facet));
  }, [dataset, sub]);

  const selectedByFacet = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const t of selectedTags) {
      const facet = t.slice(0, t.indexOf(":"));
      let set = m.get(facet);
      if (!set) m.set(facet, (set = new Set()));
      set.add(t);
    }
    return m;
  }, [selectedTags]);

  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      for (const values of selectedByFacet.values()) {
        if (!r.tags.some((t) => values.has(t))) return false;
      }
      return !q || searchText(KIND_OF[sub.dataset], r).toLowerCase().includes(q);
    });
  }, [records, selectedByFacet, query, sub]);

  const visible = useMemo(() => {
    if (ownedFilter === "all") return baseFiltered;
    return baseFiltered.filter((r) => {
      const owned = (collection[r.id] ?? 0) > 0;
      return ownedFilter === "owned" ? owned : !owned;
    });
  }, [baseFiltered, ownedFilter, collection]);

  // per-subcategory owned counts for the sidebar
  const ownedBySub = useMemo(() => {
    const out: Record<string, number> = {};
    if (!dataset) return out;
    for (const sec of sections) {
      for (const sc of sec.subcategories) {
        let owned = 0;
        for (const r of recordsOf(dataset, sc.dataset)) {
          if (matches(r, sc.match) && (collection[r.id] ?? 0) > 0) owned++;
        }
        out[`${sec.key}/${sc.key}`] = owned;
      }
    }
    return out;
  }, [dataset, sections, collection]);

  // overall progress across every collectible
  const { total, owned } = useMemo(() => {
    if (!dataset) return { total: 0, owned: 0 };
    const all = [...dataset.heroes, ...dataset.survivors, ...dataset.defenders, ...dataset.schematics];
    let o = 0;
    for (const r of all) if ((collection[r.id] ?? 0) > 0) o++;
    return { total: all.length, owned: o };
  }, [dataset, collection]);
  const pct = total ? Math.round((owned / total) * 100) : 0;

  const selectSub = (sectionKey: string, subKey: string) => {
    setActiveSection(sectionKey);
    setActiveSub(subKey);
    setSelectedTags(new Set());
    setQuery("");
  };
  const crossLink = (sectionKey: string, subKey: string, tagId: string) => {
    setActiveSection(sectionKey);
    setActiveSub(subKey);
    setSelectedTags(new Set([tagId]));
    setQuery("");
    setOwnedFilter("all");
    setSelected(null);
  };
  const toggleFacet = (tagId: string) =>
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stw-collection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImportFile = (file: File) => {
    file
      .text()
      .then((text) => importJson(text))
      .catch((e: unknown) => alert(`Import failed: ${e instanceof Error ? e.message : String(e)}`));
  };
  const handleReset = () => {
    if (confirm("Clear your entire collection? This cannot be undone.")) clearAll();
  };

  if (error) {
    return (
      <div className="boot">
        <h1>STW Collection Book</h1>
        <p className="error">{error}</p>
      </div>
    );
  }
  if (!dataset || !section || !sub) {
    return (
      <div className="boot">
        <h1>STW Collection Book</h1>
        <p>Loading data…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>STW Collection Book</h1>
          <span className="subtitle">Wiki + Tracker</span>
        </div>
        <div className="progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-label">
            {owned} / {total} ({pct}%)
          </span>
        </div>
      </header>

      <div className="layout">
        <BookSidebar
          sections={sections}
          activeSection={section.key}
          activeSub={sub.key}
          ownedBySub={ownedBySub}
          onSelect={selectSub}
        />
        <main className="content">
          <div className="content-head">
            <h2>
              {section.label} <span className="content-sub">{sub.label}</span>
            </h2>
          </div>
          <FilterBar
            query={query}
            onQuery={setQuery}
            ownedFilter={ownedFilter}
            onOwnedFilter={setOwnedFilter}
            facets={facets}
            selectedTags={selectedTags}
            onToggleFacet={toggleFacet}
            onClearFacets={() => setSelectedTags(new Set())}
            visibleCount={visible.length}
            totalCount={records.length}
            onExport={handleExport}
            onImportFile={handleImportFile}
            onReset={handleReset}
          />
          <ItemGrid
            kind={KIND_OF[sub.dataset]}
            items={visible}
            onInspect={(item) => setSelected({ kind: KIND_OF[sub.dataset], item })}
          />
        </main>
      </div>

      {selected && (
        <InspectModal
          selected={selected}
          abilities={dataset.abilities}
          onClose={() => setSelected(null)}
          onCrossLink={crossLink}
        />
      )}
    </div>
  );
}
