import { useEffect, useMemo, useState } from "react";

import { BookSidebar } from "./components/BookSidebar";
import { FilterBar, type OwnedFilter } from "./components/FilterBar";
import {
  ItemGrid,
  type DisplayEntry,
  type DisplaySlot,
} from "./components/ItemGrid";
import { HomeScreen } from "./components/HomeScreen";
import { InspectModal } from "./components/InspectModal";
import { LoadoutScreen } from "./components/LoadoutScreen";
import { SearchBar } from "./components/SearchBar";
import { loadDataset } from "./lib/data";
import { clearAll, useCollectionState } from "./store/collection";
import {
  KIND_OF,
  locateTarget,
  recordsOf,
  searchText,
  slug,
  type ItemKind,
  type Selected,
} from "./lib/view";
import type {
  AnyItem,
  BookEntry,
  Dataset,
  DatasetName,
  FacetGroup,
  FacetValue,
} from "./types";

type Mode = "home" | "book" | "loadout";

/** Map core sections to the schematic category used by hidden cross-link views. */
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

const DATASET_OF_KIND: Record<ItemKind, DatasetName> = {
  hero: "heroes",
  survivor: "survivors",
  defender: "defenders",
  schematic: "schematics",
};

function resolveBookEntry(dataset: Dataset, entry: BookEntry): DisplayEntry {
  const slots: DisplaySlot[] = [];
  for (const ref of entry.slots) {
    const item = recordsOf(dataset, ref.dataset).find((candidate) => candidate.id === ref.id);
    if (item) slots.push({ dataset: ref.dataset, kind: KIND_OF[ref.dataset], item });
  }
  return { key: entry.key, label: entry.label, slots };
}

/** Hidden aggregate views keep cross-links useful without adding fake sidebar pages. */
function virtualEntries(dataset: Dataset, sectionKey: string): DisplayEntry[] {
  const refs: { dataset: DatasetName; item: AnyItem }[] = [];
  if (sectionKey === "heroes") {
    refs.push(...dataset.heroes.map((item) => ({ dataset: "heroes" as const, item })));
  } else if (sectionKey === "personnel") {
    refs.push(...dataset.defenders.map((item) => ({ dataset: "defenders" as const, item })));
    refs.push(...dataset.survivors.map((item) => ({ dataset: "survivors" as const, item })));
  } else if (SECTION_CATEGORY[sectionKey]) {
    refs.push(
      ...dataset.schematics
        .filter((item) => item.category === SECTION_CATEGORY[sectionKey])
        .map((item) => ({ dataset: "schematics" as const, item })),
    );
  } else {
    const section = dataset.book.find((candidate) => candidate.key === sectionKey);
    return (
      section?.divisions.flatMap((division) =>
        division.entries.map((entry) => resolveBookEntry(dataset, entry)),
      ) ?? []
    );
  }

  const groups = new Map<string, DisplaySlot[]>();
  for (const ref of refs) {
    const slots = groups.get(ref.item.name) ?? [];
    slots.push({ dataset: ref.dataset, kind: KIND_OF[ref.dataset], item: ref.item });
    groups.set(ref.item.name, slots);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, slots]) => ({
      key: `all-${slug(label)}`,
      label,
      slots,
    }));
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("home");
  const [activeSection, setActiveSection] = useState("heroes");
  const [activeDivision, setActiveDivision] = useState("soldiers");
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

  const sections = dataset?.book ?? [];
  const section = sections.find((candidate) => candidate.key === activeSection) ?? sections[0];
  const division =
    activeDivision === "all"
      ? undefined
      : section?.divisions.find((candidate) => candidate.key === activeDivision) ??
        section?.divisions[0];

  const entries = useMemo<DisplayEntry[]>(() => {
    if (!dataset || !section) return [];
    if (activeDivision === "all") return virtualEntries(dataset, section.key);
    return (division?.entries ?? []).map((entry) => resolveBookEntry(dataset, entry));
  }, [dataset, section, division, activeDivision]);

  const records = useMemo(() => entries.flatMap((entry) => entry.slots), [entries]);

  // Recount facets against this page, including mixed hero/schematic pages.
  const facets = useMemo<FacetGroup[]>(() => {
    if (!dataset) return [];
    const merged = new Map<string, { label: string; values: Map<string, FacetValue> }>();
    for (const datasetName of ["heroes", "survivors", "defenders", "schematics"] as DatasetName[]) {
      const pageSlots = records.filter((slot) => slot.dataset === datasetName);
      if (pageSlots.length === 0) continue;
      for (const group of dataset.facets[datasetName]) {
        let target = merged.get(group.facet);
        if (!target) {
          target = { label: group.label, values: new Map() };
          merged.set(group.facet, target);
        }
        for (const value of group.values) {
          const count = pageSlots.filter((slot) => slot.item.tags.includes(value.id)).length;
          if (count === 0) continue;
          const existing = target.values.get(value.id);
          target.values.set(value.id, {
            ...value,
            count: (existing?.count ?? 0) + count,
            icon: existing?.icon ?? value.icon,
          });
        }
      }
    }
    return [...merged.entries()]
      .map(([facet, group]) => ({
        facet,
        label: group.label,
        values: [...group.values.values()],
      }))
      .filter((group) => group.values.length > 1);
  }, [dataset, records]);

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

  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .map((entry) => ({
        ...entry,
        slots: entry.slots.filter((slot) => {
          for (const values of selectedByFacet.values()) {
            if (!slot.item.tags.some((tag) => values.has(tag))) return false;
          }
          if (q && !searchText(slot.kind, slot.item).toLowerCase().includes(q)) return false;
          if (ownedFilter === "all") return true;
          const owned = (collection[slot.item.id] ?? 0) > 0;
          return ownedFilter === "owned" ? owned : !owned;
        }),
      }))
      .filter((entry) => entry.slots.length > 0);
  }, [entries, selectedByFacet, query, ownedFilter, collection]);

  const visibleCount = useMemo(
    () => visibleEntries.reduce((total, entry) => total + entry.slots.length, 0),
    [visibleEntries],
  );

  const selectDivision = (sectionKey: string, divisionKey: string) => {
    setActiveSection(sectionKey);
    setActiveDivision(divisionKey);
    setSelectedTags(new Set());
    setQuery("");
    setSelected(null);
  };
  const crossLink = (sectionKey: string, subKey: string, tag?: string) => {
    setMode("book");
    setActiveSection(sectionKey);
    setActiveDivision(subKey || "all");
    setSelectedTags(tag ? new Set([tag]) : new Set());
    setQuery("");
    setOwnedFilter("all");
    setSelected(null);
  };

  // find-in-book: jump to where an item lives, clear filters, flash its card
  const locate = (kind: ItemKind, item: AnyItem) => {
    if (!dataset) return;
    const target = locateTarget(dataset.book, DATASET_OF_KIND[kind], item);
    setMode("book");
    setActiveSection(target.section);
    setActiveDivision(target.sub);
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
    else selectDivision(sectionKey, subKey);
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
  if (!dataset || !section) {
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

  const pageIndex = division
    ? section.divisions.findIndex((candidate) => candidate.key === division.key)
    : -1;
  const adjacentPage = (direction: -1 | 1) => {
    if (pageIndex < 0) return;
    const next = section.divisions[pageIndex + direction];
    if (next) selectDivision(section.key, next.key);
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
              activeDivision={activeDivision === "all" ? "" : (division?.key ?? "")}
              onSelect={selectDivision}
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
                      value={activeDivision === "all" ? "all" : (division?.key ?? "")}
                      onChange={(event) => selectDivision(section.key, event.target.value)}
                    >
                      {activeDivision === "all" && (
                        <option value="all">All {section.label}</option>
                      )}
                      {section.divisions.map((candidate) => (
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
                    disabled={pageIndex < 0 || pageIndex >= section.divisions.length - 1}
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
                visible={visibleCount}
                total={records.length}
                onReset={handleReset}
              />

              <ItemGrid
                entries={visibleEntries}
                onInspect={(slot) => setSelected({ kind: slot.kind, item: slot.item })}
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
