import { useEffect, useMemo, useState } from "react";

import { BookSidebar } from "./components/BookSidebar";
import { FilterBar, type OwnedFilter } from "./components/FilterBar";
import { ItemGrid } from "./components/ItemGrid";
import { HomeScreen } from "./components/HomeScreen";
import { InspectModal } from "./components/InspectModal";
import { LoadoutScreen } from "./components/LoadoutScreen";
import { SearchBar } from "./components/SearchBar";
import { loadDataset } from "./lib/data";
import { clearAll, useCollectionState } from "./store/collection";
import {
  KIND_OF,
  locateTarget,
  matches,
  recordsOf,
  searchText,
  slug,
  type ItemKind,
  type Selected,
} from "./lib/view";
import type { AnyItem, BookSection, BookSubcategory, Dataset, DatasetName } from "./types";

type Mode = "home" | "book" | "loadout";

/** dataset that backs a section's synthetic "All" view (personnel spans two -> none). */
const SECTION_DATASET: Record<string, DatasetName> = {
  heroes: "heroes",
  ranged: "schematics",
  melee: "schematics",
  traps: "schematics",
};

/** Map a section to the schematic `category` it represents (for the "All" match). */
const SECTION_CATEGORY: Record<string, string> = {
  ranged: "ranged",
  melee: "melee",
  traps: "trap",
};

/** Home reward kind -> Collection Book dataset, for click-through on named loot. */
const NAMED_REWARD_DATASET: Record<string, DatasetName> = {
  hero: "heroes",
  survivor: "survivors",
  defender: "defenders",
  schematic: "schematics",
};

/** perk facet to surface per weapon/trap section. */
const PERK_FACET: Record<string, string> = {
  ranged: "rangedPerk",
  melee: "meleePerk",
  traps: "trapPerk",
};

/** Prepend an "All <section>" subcategory to single-dataset sections. */
function withAll(section: BookSection, d: Dataset): BookSubcategory[] {
  const ds = SECTION_DATASET[section.key];
  if (!ds) return section.subcategories;
  const match =
    ds === "schematics"
      ? [{ field: "category", value: SECTION_CATEGORY[section.key] }]
      : undefined;
  const count = recordsOf(d, ds).filter((r) => matches(r, match)).length;
  const all: BookSubcategory = { key: "all", label: `All ${section.label}`, dataset: ds, match, count };
  return [all, ...section.subcategories];
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("home");
  const [activeSection, setActiveSection] = useState("heroes");
  const [activeSub, setActiveSub] = useState("all");
  const [query, setQuery] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [selectedTags, setSelectedTags] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<Selected | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const collection = useCollectionState();

  useEffect(() => {
    loadDataset()
      .then(setDataset)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // clear the find-in-book flash once it has played
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(t);
  }, [highlightId]);

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
    return dataset.facets[sub.dataset].filter((g) => {
      if (constrained.has(g.facet)) return false;
      // perk facets are per-category; show only the one matching the active section
      if (g.facet.endsWith("Perk")) return PERK_FACET[activeSection] === g.facet;
      // the "set" facet is redundant once you're on a specific hero set page
      if (g.facet === "set" && activeSection === "heroes" && activeSub !== "all") return false;
      return g.values.length > 1;
    });
  }, [dataset, sub, activeSection, activeSub]);

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
    const kind = sub ? KIND_OF[sub.dataset] : "hero";
    return records.filter((r) => {
      for (const values of selectedByFacet.values()) {
        if (!r.tags.some((t) => values.has(t))) return false;
      }
      return !q || searchText(kind, r).toLowerCase().includes(q);
    });
  }, [records, selectedByFacet, query, sub]);

  const visible = useMemo(() => {
    if (ownedFilter === "all") return baseFiltered;
    return baseFiltered.filter((r) => {
      const owned = (collection[r.id] ?? 0) > 0;
      return ownedFilter === "owned" ? owned : !owned;
    });
  }, [baseFiltered, ownedFilter, collection]);

  const selectSub = (sectionKey: string, subKey: string) => {
    setActiveSection(sectionKey);
    setActiveSub(subKey);
    setSelectedTags(new Set());
    setQuery("");
    setSelected(null);
  };
  const crossLink = (sectionKey: string, subKey: string, tag?: string) => {
    setMode("book");
    setActiveSection(sectionKey);
    setActiveSub(subKey || "all");
    setSelectedTags(tag ? new Set([tag]) : new Set());
    setQuery("");
    setOwnedFilter("all");
    setSelected(null);
  };

  // find-in-book: jump to where an item lives, clear filters, flash its card
  const locate = (kind: ItemKind, item: AnyItem) => {
    const target = locateTarget(kind, item);
    const sec = sections.find((s) => s.key === target.section);
    const subKey = sec?.subcategories.some((x) => x.key === target.sub)
      ? target.sub
      : (sec?.subcategories[0]?.key ?? "all");
    setMode("book");
    setActiveSection(target.section);
    setActiveSub(subKey);
    setSelectedTags(new Set());
    setQuery("");
    setOwnedFilter("all");
    setSelected(null);
    setHighlightId(item.id);
  };
  const toggleFacet = (tagId: string) =>
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });

  // open a record straight from a global-search hit (modal overlays current view)
  const openItem = (datasetName: DatasetName, id: string) => {
    if (!dataset) return;
    const rec = recordsOf(dataset, datasetName).find((r) => r.id === id);
    if (rec) setSelected({ kind: KIND_OF[datasetName], item: rec });
  };
  const searchFilter = (sectionKey: string, subKey: string, tag?: string) => {
    setMode("book");
    if (tag) crossLink(sectionKey, subKey, tag);
    else selectSub(sectionKey, subKey);
  };

  // Home cross-link: open a named reward (hero/survivor/defender/schematic) by name.
  const openReward = (kind: string, name: string) => {
    if (!dataset) return;
    const ds = NAMED_REWARD_DATASET[kind];
    if (!ds) return;
    const norm = name.trim().toLowerCase();
    const rec = recordsOf(dataset, ds).find(
      (r) => (r as { name?: string }).name?.trim().toLowerCase() === norm,
    );
    if (rec) setSelected({ kind: KIND_OF[ds], item: rec });
  };

  const handleReset = () => {
    if (confirm("Clear your entire owned collection? This cannot be undone.")) clearAll();
  };

  // spotlight: describe an active perk / ability tag above the grid
  const spotlight = useMemo(() => {
    if (!dataset || selectedTags.size !== 1) return null;
    const tag = [...selectedTags][0];
    const f = tag.slice(0, tag.indexOf(":"));
    const val = tag.slice(tag.indexOf(":") + 1);
    if (f === "rangedPerk" || f === "meleePerk" || f === "trapPerk") {
      const p = dataset.perks[val];
      if (p)
        return {
          k: "Weapon/Trap Perk",
          n: p.name,
          d: p.tiers[p.tiers.length - 1] ?? p.description ?? "",
          icon: p.images?.icon,
        };
    }
    if (f === "ability") {
      const a = Object.values(dataset.abilities).find((ab) => slug(ab.id) === val);
      if (a) return { k: "Hero Ability", n: a.name, d: a.description ?? "", icon: a.images.icon };
    }
    if (f === "heroPerk" || f === "commanderPerk" || f === "classPerk") {
      for (const h of dataset.heroes) {
        for (const p of [h.heroPerk, h.commanderPerk, ...h.classPerks]) {
          if (p && slug(p.name) === val)
            return {
              k:
                f === "classPerk"
                  ? "Class Perk"
                  : f === "commanderPerk"
                    ? "Commander Perk"
                    : "Standard Perk",
              n: p.name,
              d: p.description,
              icon: p.images?.icon,
            };
        }
      }
    }
    return null;
  }, [dataset, selectedTags]);

  // Shared top bar (brand + Home/Book/Loadout switch + global search).
  const header = () => (
    <header className="cb-topbar">
      <div className="cb-brand">
        <span className="mark" aria-hidden>
          STW
        </span>
        <div className="cb-title">
          Companion<span className="sub">Save the World</span>
        </div>
      </div>
      <div className="cb-modeswitch" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "home"}
          className={mode === "home" ? "on" : ""}
          onClick={() => setMode("home")}
        >
          Home
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "book"}
          className={mode === "book" ? "on" : ""}
          onClick={() => setMode("book")}
        >
          Collection Book
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "loadout"}
          className={mode === "loadout" ? "on" : ""}
          onClick={() => setMode("loadout")}
        >
          Hero Loadout
        </button>
      </div>
      <div className="cb-top-spacer" />
      {dataset && <SearchBar index={dataset.search} onPickItem={openItem} onFilter={searchFilter} />}
    </header>
  );

  if (error) {
    return (
      <div className="cb-loading">
        <div>
          <div className="lg">STW COMPANION</div>
          <div className="ls" style={{ color: "#ff7b72" }}>
            {error}
          </div>
        </div>
      </div>
    );
  }
  if (mode === "home") {
    return (
      <div className="cb-root">
        {header()}
        <HomeScreen onOpenReward={openReward} />
        {dataset && selected && (
          <InspectModal
            selected={selected}
            abilities={dataset.abilities}
            perks={dataset.perks}
            onClose={() => setSelected(null)}
            onCrossLink={crossLink}
            onLocate={locate}
          />
        )}
      </div>
    );
  }
  if (!dataset || !section || !sub) {
    return (
      <div className="cb-root">
        {header()}
        <div className="cb-loading">
          <div>
            <div className="lg">STW COMPANION</div>
            <div className="ls">Loading data…</div>
          </div>
        </div>
      </div>
    );
  }

  const kind = KIND_OF[sub.dataset];
  const pageIndex = section.subcategories.findIndex((candidate) => candidate.key === sub.key);
  const adjacentPage = (direction: -1 | 1) => {
    const next = section.subcategories[pageIndex + direction];
    if (next) selectSub(section.key, next.key);
  };

  return (
    <div className="cb-root">
      {header()}

      {mode === "loadout" ? (
        <LoadoutScreen dataset={dataset} onLocate={locate} onInspect={(sel) => setSelected(sel)} />
      ) : (
        <>
          <div className="cb-book-titlebar">
            <h1>Collection Book</h1>
          </div>

          <div className="cb-layout">
            <BookSidebar
              sections={sections}
              activeSection={section.key}
              activeSub={sub.key}
              onSelect={selectSub}
            />
            <main className="cb-content">
              <div className="cb-content-head">
                <div>
                  <span className="eyebrow">Collection category</span>
                  <h2>{section.label}</h2>
                </div>
                <div className="cb-page-nav">
                  <button
                    type="button"
                    className="arrow"
                    onClick={() => adjacentPage(-1)}
                    disabled={pageIndex <= 0}
                    title="Previous page"
                  >
                    ‹
                  </button>
                  <label>
                    <span>Page</span>
                    <select
                      value={sub.key}
                      onChange={(event) => selectSub(section.key, event.target.value)}
                    >
                      {section.subcategories.map((candidate) => (
                        <option key={candidate.key} value={candidate.key}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="arrow"
                    onClick={() => adjacentPage(1)}
                    disabled={pageIndex >= section.subcategories.length - 1}
                    title="Next page"
                  >
                    ›
                  </button>
                </div>
              </div>

              {spotlight && (
                <div className="cb-spotlight">
                  {spotlight.icon ? (
                    <img className="ic" src={spotlight.icon} alt="" />
                  ) : (
                    <span
                      className="ic"
                      style={{ display: "grid", placeItems: "center", fontFamily: "Anton" }}
                    >
                      {spotlight.n.slice(0, 1)}
                    </span>
                  )}
                  <div className="meta">
                    <div className="k">Cross-link · {spotlight.k}</div>
                    <div className="n">{spotlight.n}</div>
                    <div className="d">{spotlight.d}</div>
                  </div>
                  <button type="button" className="x" onClick={() => setSelectedTags(new Set())}>
                    Clear ✕
                  </button>
                </div>
              )}

              <FilterBar
                query={query}
                onQuery={setQuery}
                owned={ownedFilter}
                onOwned={setOwnedFilter}
                facets={facets}
                selected={selectedTags}
                onToggle={toggleFacet}
                onClear={() => setSelectedTags(new Set())}
                visible={visible.length}
                total={records.length}
                onReset={handleReset}
              />

              <ItemGrid
                kind={kind}
                items={visible}
                onInspect={(item) => setSelected({ kind, item })}
                highlightId={highlightId}
                classIcons={dataset.classIcons}
              />
            </main>
          </div>
        </>
      )}

      {selected && (
        <InspectModal
          selected={selected}
          abilities={dataset.abilities}
          perks={dataset.perks}
          onClose={() => setSelected(null)}
          onCrossLink={crossLink}
          onLocate={locate}
        />
      )}
    </div>
  );
}
