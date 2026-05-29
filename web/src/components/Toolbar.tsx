import { useRef } from "react";

export type OwnedFilter = "all" | "owned" | "missing";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  ownedFilter: OwnedFilter;
  onOwnedFilter: (f: OwnedFilter) => void;
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

export function Toolbar({
  query,
  onQuery,
  ownedFilter,
  onOwnedFilter,
  visibleCount,
  totalCount,
  onExport,
  onImportFile,
  onReset,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      <input
        type="search"
        className="search"
        placeholder="Search schematics…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />

      <div className="segmented" role="group" aria-label="Collection filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={ownedFilter === f.key ? "is-active" : ""}
            onClick={() => onOwnedFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <span className="result-count">
        {visibleCount} / {totalCount}
      </span>

      <div className="toolbar-actions">
        <button type="button" onClick={onExport} title="Download your collection as JSON">
          Export
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} title="Load a collection JSON">
          Import
        </button>
        <button type="button" className="danger" onClick={onReset} title="Clear all collected items">
          Reset
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
