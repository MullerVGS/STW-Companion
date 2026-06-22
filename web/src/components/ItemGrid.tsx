import { ItemCard } from "./ItemCard";
import type { DatasetName, HeroClass, AnyItem } from "../types";
import type { ItemKind } from "../lib/view";

export interface DisplaySlot {
  dataset: DatasetName;
  kind: ItemKind;
  item: AnyItem;
}

export interface DisplayEntry {
  key: string;
  label: string;
  slots: DisplaySlot[];
}

interface Props {
  entries: DisplayEntry[];
  onInspect: (slot: DisplaySlot) => void;
  /** id of the card to highlight + scroll to (find-in-book) */
  highlightId?: string | null;
  classIcons: Partial<Record<HeroClass, string>>;
}

/** Renders the exact panel and slot order emitted by the Collection Book pipeline. */
export function ItemGrid({ entries, onInspect, highlightId, classIcons }: Props) {
  if (entries.length === 0) {
    return <div className="cb-empty">No items match these filters.</div>;
  }

  return (
    <div className="cb-sets">
      {entries.map((entry) => (
        <section className="cb-set" key={entry.key}>
          <div className="cb-set-head">
            <span className="nm">{entry.label}</span>
          </div>
          <div className="cb-set-cards">
            {entry.slots.map((slot, index) => (
              <ItemCard
                key={`${slot.dataset}:${slot.item.id}:${index}`}
                kind={slot.kind}
                item={slot.item}
                onInspect={() => onInspect(slot)}
                highlight={slot.item.id === highlightId}
                classIcons={classIcons}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
