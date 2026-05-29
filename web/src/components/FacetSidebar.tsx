import type { FacetGroup } from "../types";

interface Props {
  facets: FacetGroup[];
  selectedTags: ReadonlySet<string>;
  onToggleFacet: (tagId: string) => void;
  onClear: () => void;
}

export function FacetSidebar({ facets, selectedTags, onToggleFacet, onClear }: Props) {
  const hasSelection = selectedTags.size > 0;
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2>Filters</h2>
        {hasSelection && (
          <button type="button" className="link" onClick={onClear}>
            Clear ({selectedTags.size})
          </button>
        )}
      </div>
      {facets.map((group) => (
        <section key={group.facet} className="facet-group">
          <h3>{group.label}</h3>
          <div className="facet-values">
            {group.values.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`facet${selectedTags.has(v.id) ? " is-active" : ""}${
                  group.facet === "rarity" ? ` rarity-${v.value}` : ""
                }`}
                onClick={() => onToggleFacet(v.id)}
                aria-pressed={selectedTags.has(v.id)}
              >
                <span className="facet-label">{v.label}</span>
                <span className="facet-count">{v.count}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
