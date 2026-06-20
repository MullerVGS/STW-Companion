import { useMemo } from "react";

import { ItemCard } from "./ItemCard";
import { useCollectionState } from "../store/collection";
import { RARITY_RANK } from "../lib/rarity";
import type { AnyItem } from "../types";
import type { ItemKind } from "../lib/view";

interface Props {
  kind: ItemKind;
  items: AnyItem[];
  onInspect: (item: AnyItem) => void;
  /** id of the card to highlight + scroll to (find-in-book) */
  highlightId?: string | null;
}

/** Groups items by name into "set" panels (rarity/tier variants of one identity). */
export function ItemGrid({ kind, items, onInspect, highlightId }: Props) {
  const collection = useCollectionState();

  const groups = useMemo(() => {
    const m = new Map<string, AnyItem[]>();
    for (const it of items) {
      const list = m.get(it.name);
      if (list) list.push(it);
      else m.set(it.name, [it]);
    }
    const arr = [...m.entries()].map(([name, list]) => {
      list.sort(
        (a, b) =>
          (RARITY_RANK[a.rarity] ?? 0) - (RARITY_RANK[b.rarity] ?? 0) ||
          ((a as { tier?: number }).tier ?? 0) - ((b as { tier?: number }).tier ?? 0),
      );
      return { name, list };
    });
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [items]);

  if (items.length === 0) {
    return <div className="cb-empty">No items match these filters.</div>;
  }

  return (
    <div className="cb-sets">
      {groups.map((g) => {
        const ownedCt = g.list.filter((x) => (collection[x.id] ?? 0) > 0).length;
        const full = ownedCt >= g.list.length;
        return (
          <section className="cb-set" key={g.name}>
            <div className="cb-set-head">
              <span className="nm">{g.name}</span>
              <span className={`frac${full ? " full" : ""}`}>
                {ownedCt}/{g.list.length}
              </span>
            </div>
            <div className="cb-set-cards">
              {g.list.map((it) => (
                <ItemCard
                  key={it.id}
                  kind={kind}
                  item={it}
                  onInspect={onInspect}
                  highlight={it.id === highlightId}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
