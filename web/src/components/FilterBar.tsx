import { useRef } from "react";

import type { FacetGroup } from "../types";

export type OwnedFilter = "all" | "owned" | "missing";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  ownedFilter: OwnedFilter;
  onOwnedFilter: (f: OwnedFilter) => void;
  facets: FacetGroup[];
  selectedTags: ReadonlySet<string>;
  onToggleFacet: (tagId: string) => void;
  onClearFacets: () => void;
  visibleCount: number;
  totalCount: number;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onReset: () => void;
}

const FILTERS: { key: OwnedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "owned", label: "Collected" },
  { key: "missing", label: "Missing" },
];

export function FilterBar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { facets, selectedTags, onToggleFacet } = props;

  return (
    <div className="filterbar">
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search this section…"
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
        />
        <div className="segmented" role="group" aria-label="Collection filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={props.ownedFilter === f.key ? "is-active" : ""}
              onClick={() => props.onOwnedFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="result-count">
          {props.visibleCount} / {props.totalCount}
        </span>
        <div className="toolbar-actions">
          <button type="button" onClick={props.onExport} title="Download your collection as JSON">
            Export
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} title="Load a collection JSON">
            Import
          </button>
          <button type="button" className="danger" onClick={props.onReset} title="Clear all collected items">
            Reset
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) props.onImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {facets.length > 0 && (
        <div className="facet-rows">
          {facets.map((group) => (
            <div key={group.facet} className="facet-row">
              <span className="facet-row-label">{group.label}</span>
              <div className="facet-chips">
                {group.values.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`facet-chip${selectedTags.has(v.id) ? " is-active" : ""}${
                      group.facet === "rarity" ? ` rarity-${v.value}` : ""
                    }`}
                    onClick={() => onToggleFacet(v.id)}
                    aria-pressed={selectedTags.has(v.id)}
                  >
                    {v.label}
                    <span className="facet-chip-count">{v.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {selectedTags.size > 0 && (
            <button type="button" className="link facet-clear" onClick={props.onClearFacets}>
              Clear filters ({selectedTags.size})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
