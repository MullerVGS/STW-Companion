import { useEffect, useMemo, useState } from "react";

import { FacetSidebar } from "./components/FacetSidebar";
import { SchematicGrid } from "./components/SchematicGrid";
import { Toolbar, type OwnedFilter } from "./components/Toolbar";
import { loadDataset } from "./lib/data";
import { clearAll, exportJson, importJson, useCollectionState } from "./store/collection";
import type { Dataset } from "./types";

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [selectedTags, setSelectedTags] = useState<ReadonlySet<string>>(new Set());

  const collection = useCollectionState();

  useEffect(() => {
    loadDataset().then(setDataset).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  const toggleFacet = (tagId: string) =>
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });

  // selected tags grouped by facet: OR within a facet, AND across facets
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

  // facets + text search (independent of collection state)
  const baseFiltered = useMemo(() => {
    if (!dataset) return [];
    const q = query.trim().toLowerCase();
    return dataset.schematics.filter((s) => {
      for (const values of selectedByFacet.values()) {
        if (!s.tags.some((t) => values.has(t))) return false;
      }
      return !q || s.name.toLowerCase().includes(q);
    });
  }, [dataset, selectedByFacet, query]);

  // collected/missing pass (depends on collection state)
  const visible = useMemo(() => {
    if (ownedFilter === "all") return baseFiltered;
    return baseFiltered.filter((s) => {
      const owned = (collection[s.id] ?? 0) > 0;
      return ownedFilter === "owned" ? owned : !owned;
    });
  }, [baseFiltered, ownedFilter, collection]);

  const total = dataset?.schematics.length ?? 0;
  const owned = useMemo(
    () =>
      dataset
        ? dataset.schematics.reduce((n, s) => n + ((collection[s.id] ?? 0) > 0 ? 1 : 0), 0)
        : 0,
    [dataset, collection],
  );
  const pct = total ? Math.round((owned / total) * 100) : 0;

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
      .catch((e: unknown) =>
        alert(`Import failed: ${e instanceof Error ? e.message : String(e)}`),
      );
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
  if (!dataset) {
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
          <span className="subtitle">Schematics</span>
        </div>
        <div className="progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-label">
            {owned} / {total} collected ({pct}%)
          </span>
        </div>
      </header>

      <div className="layout">
        <FacetSidebar
          facets={dataset.facets}
          selectedTags={selectedTags}
          onToggleFacet={toggleFacet}
          onClear={() => setSelectedTags(new Set())}
        />
        <main className="content">
          <Toolbar
            query={query}
            onQuery={setQuery}
            ownedFilter={ownedFilter}
            onOwnedFilter={setOwnedFilter}
            visibleCount={visible.length}
            totalCount={total}
            onExport={handleExport}
            onImportFile={handleImportFile}
            onReset={handleReset}
          />
          <SchematicGrid
            schematics={visible}
            selectedTags={selectedTags}
            onToggleFacet={toggleFacet}
          />
        </main>
      </div>
    </div>
  );
}
