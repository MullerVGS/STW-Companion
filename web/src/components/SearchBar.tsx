import { useEffect, useMemo, useRef, useState } from "react";

import type { DatasetName, SearchEntry, SearchKind } from "../types";
import { searchIndex } from "../lib/search";

interface Props {
  index: SearchEntry[];
  /** open a record's inspect view */
  onPickItem: (dataset: DatasetName, id: string) => void;
  /** navigate to a section/subcategory, optionally applying a facet tag */
  onFilter: (section: string, sub: string, tag?: string) => void;
}

/** Short kind label shown on the right of each result. */
const KIND_BADGE: Record<SearchKind, string> = {
  hero: "Hero",
  survivor: "Personnel",
  defender: "Defender",
  schematic: "Schematic",
  weaponPerk: "Weapon Perk",
  trapPerk: "Trap Perk",
  heroPerk: "Standard Perk",
  commanderPerk: "Commander Perk",
  classPerk: "Class Perk",
  ability: "Ability",
  set: "Set",
  class: "Class",
  personality: "Personality",
  squad: "Squad",
};

const PAGE = 30; // rows revealed per lazy step

/** Global search: lazy, ranked dropdown over the prebuilt search index. */
export function SearchBar({ index, onPickItem, onFilter }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(PAGE);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchIndex(index, query), [index, query]);

  // reset windowing + selection whenever the result set changes
  useEffect(() => {
    setShown(PAGE);
    setActive(0);
  }, [query]);

  // lazy reveal more rows as the sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !open) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setShown((c) => Math.min(c + PAGE, results.length));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [open, results.length, shown]);

  // keep the keyboard-active row scrolled into view within the dropdown
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const visible = results.slice(0, shown);
  const isOpen = open && query.trim().length > 0;

  function activate(entry: SearchEntry) {
    const a = entry.a;
    if (a.k === "item") onPickItem(a.dataset, a.id);
    else onFilter(a.section, a.sub, a.tag);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => {
        const next = Math.min(i + 1, results.length - 1);
        if (next >= shown) setShown((c) => Math.min(c + PAGE, results.length));
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const pick = results[active];
      if (pick) activate(pick);
    }
  }

  return (
    <div className="cb-search" ref={wrapRef}>
      <span className="ico" aria-hidden>
        ⌕
      </span>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search heroes, weapons, traps, perks…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="search-global-list"
        aria-autocomplete="list"
      />

      {isOpen && (
        <div className="cb-search-pop">
          {results.length === 0 ? (
            <p className="cb-search-empty">No matches for “{query}”.</p>
          ) : (
            <>
              <ul id="search-global-list" className="cb-search-list" role="listbox" ref={listRef}>
                {visible.map((e, i) => (
                  <li key={e.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      data-idx={i}
                      className={`cb-sresult${i === active ? " act" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => activate(e)}
                    >
                      {e.icon ? (
                        <img className="ic" src={e.icon} alt="" loading="lazy" />
                      ) : (
                        <span className="ic ph" aria-hidden>
                          {e.label.slice(0, 1)}
                        </span>
                      )}
                      <span className="tx">
                        <span className="lb">{e.label}</span>
                        {e.sub && <span className="sb">{e.sub}</span>}
                      </span>
                      <span className="kd">{KIND_BADGE[e.kind]}</span>
                    </button>
                  </li>
                ))}
                {shown < results.length && (
                  <li ref={sentinelRef} className="search-sentinel" aria-hidden />
                )}
              </ul>
              <div className="cb-search-foot">
                Enter to open · ↑↓ to navigate · perks &amp; abilities jump to everything that
                shares them
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
