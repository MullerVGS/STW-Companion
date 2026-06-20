import { useState, type CSSProperties } from "react";

import type { FacetGroup } from "../types";
import { rarityColor } from "../lib/rarity";
import type { Rarity } from "../types";

export type OwnedFilter = "all" | "owned" | "missing";

/** Facets with more values than this collapse behind a "+N more" toggle. */
const COLLAPSE_LIMIT = 12;

interface Props {
  query: string;
  onQuery: (q: string) => void;
  owned: OwnedFilter;
  onOwned: (f: OwnedFilter) => void;
  facets: FacetGroup[];
  selected: ReadonlySet<string>;
  onToggle: (tagId: string) => void;
  onClear: () => void;
  visible: number;
  total: number;
  onReset: () => void;
}

const FILTERS: OwnedFilter[] = ["all", "owned", "missing"];

function FacetRow({
  group,
  selected,
  onToggle,
}: {
  group: FacetGroup;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRarity = group.facet === "rarity";
  const vals = expanded ? group.values : group.values.slice(0, COLLAPSE_LIMIT);

  return (
    <div className="cb-filter-row">
      <span className="cb-frow-label">{group.label}</span>
      {vals.map((v) => {
        const on = selected.has(v.id);
        const color = isRarity ? rarityColor(v.value as Rarity) : undefined;
        const style: CSSProperties | undefined =
          isRarity && on
            ? {
                borderColor: color,
                background: `color-mix(in srgb, ${color} 24%, transparent)`,
              }
            : undefined;
        return (
          <button
            key={v.id}
            type="button"
            className={`cb-chip${on ? " on" : ""}`}
            onClick={() => onToggle(v.id)}
            aria-pressed={on}
            style={style}
            title={v.label}
          >
            {isRarity && <span className="dot" style={{ background: color }} aria-hidden />}
            {v.icon && !isRarity && <img className="ci" src={v.icon} alt="" loading="lazy" />}
            <span>{v.label}</span>
            <span className="cc">{v.count}</span>
          </button>
        );
      })}
      {group.values.length > COLLAPSE_LIMIT && (
        <button type="button" className="cb-chip" onClick={() => setExpanded((x) => !x)}>
          {expanded ? "− less" : `+${group.values.length - COLLAPSE_LIMIT} more`}
        </button>
      )}
    </div>
  );
}

export function FilterBar({
  query,
  onQuery,
  owned,
  onOwned,
  facets,
  selected,
  onToggle,
  onClear,
  visible,
  total,
  onReset,
}: Props) {
  return (
    <div className="cb-filter">
      <div className="cb-filter-row">
        <input
          className="cb-localsearch"
          value={query}
          placeholder="Filter this page…"
          onChange={(e) => onQuery(e.target.value)}
        />
        <div className="cb-seg" role="group" aria-label="Collection filter">
          {FILTERS.map((m) => (
            <button
              key={m}
              type="button"
              className={owned === m ? "on" : ""}
              onClick={() => onOwned(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="cb-filter-actions">
          <button type="button" className="cb-act" onClick={onReset} title="Clear your collection">
            Reset owned
          </button>
        </div>
      </div>

      {facets.map((g) => (
        <FacetRow key={g.facet} group={g} selected={selected} onToggle={onToggle} />
      ))}

      <div className="cb-filter-row">
        <span className="cb-frow-label">Showing</span>
        <span style={{ fontFamily: "Barlow Condensed", fontWeight: 600, color: "var(--text-dim)" }}>
          {visible} of {total}
        </span>
        {selected.size > 0 && (
          <button type="button" className="cb-chip" onClick={onClear}>
            Clear filters ✕
          </button>
        )}
      </div>
    </div>
  );
}
