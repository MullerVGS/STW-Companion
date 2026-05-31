import { useRef, useState } from "react";

import type { FacetGroup } from "../types";

export type OwnedFilter = "all" | "owned" | "missing";

/** Facets with more values than this collapse behind a "+N more" toggle. */
const COLLAPSE_LIMIT = 14;

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
          {facets.map((group) => {
            const isOpen = expanded[group.facet];
            const overflow = group.values.length - COLLAPSE_LIMIT;
            // when collapsed, keep the head plus any selected values past it visible
            const forcedSelected =
              overflow > 0
                ? group.values.slice(COLLAPSE_LIMIT).filter((v) => selectedTags.has(v.id)).length
                : 0;
            const hidden = overflow - forcedSelected; // values actually hidden while collapsed
            const shown =
              isOpen || overflow <= 0
                ? group.values
                : [
                    ...group.values.slice(0, COLLAPSE_LIMIT),
                    ...group.values.slice(COLLAPSE_LIMIT).filter((v) => selectedTags.has(v.id)),
                  ];
            return (
              <div key={group.facet} className="facet-row">
                <span className="facet-row-label">{group.label}</span>
                <div className="facet-chips">
                  {shown.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`facet-chip${selectedTags.has(v.id) ? " is-active" : ""}${
                        group.facet === "rarity" ? ` rarity-${v.value}` : ""
                      }`}
                      onClick={() => onToggleFacet(v.id)}
                      aria-pressed={selectedTags.has(v.id)}
                      title={v.label}
                    >
                      {v.icon && <img className="facet-chip-icon" src={v.icon} alt="" loading="lazy" />}
                      <span className="facet-chip-label">{v.label}</span>
                      <span className="facet-chip-count">{v.count}</span>
                    </button>
                  ))}
                  {overflow > 0 && (isOpen || hidden > 0) && (
                    <button
                      type="button"
                      className="facet-chip facet-more"
                      onClick={() => setExpanded((p) => ({ ...p, [group.facet]: !isOpen }))}
                    >
                      {isOpen ? "− less" : `+${hidden} more`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
