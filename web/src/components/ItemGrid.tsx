import { ItemCard } from "./ItemCard";
import type { AnyItem } from "../types";
import type { ItemKind } from "../lib/view";

interface Props {
  kind: ItemKind;
  items: AnyItem[];
  onInspect: (item: AnyItem) => void;
}

export function ItemGrid({ kind, items, onInspect }: Props) {
  if (items.length === 0) {
    return <p className="empty">Nothing matches these filters.</p>;
  }
  return (
    <div className="grid">
      {items.map((item) => (
        <ItemCard key={item.id} kind={kind} item={item} onInspect={onInspect} />
      ))}
    </div>
  );
}
