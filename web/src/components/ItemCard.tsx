import { memo, useState, type CSSProperties } from "react";

import { increment, toggle, useCount } from "../store/collection";
import type { AnyItem } from "../types";
import { rarityColor } from "../lib/rarity";
import { subtitle, type ItemKind } from "../lib/view";

interface Props {
  kind: ItemKind;
  item: AnyItem;
  onInspect: (item: AnyItem) => void;
}

function ItemCardImpl({ kind, item, onInspect }: Props) {
  const count = useCount(item.id);
  const owned = count > 0;
  const [imgBroken, setImgBroken] = useState(false);
  const color = rarityColor(item.rarity);
  const showIcon = item.images.icon && !imgBroken;

  return (
    <article
      className={`card${owned ? " is-owned" : " is-missing"}`}
      style={{ "--rarity": color } as CSSProperties}
    >
      <button
        type="button"
        className="card-tile"
        onClick={() => onInspect(item)}
        title={`Inspect ${item.name}`}
      >
        {showIcon ? (
          <img src={item.images.icon} alt="" loading="lazy" onError={() => setImgBroken(true)} />
        ) : (
          <span className="card-placeholder" aria-hidden>
            {item.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        {count > 1 && <span className="card-qty">×{count}</span>}
      </button>

      <button
        type="button"
        className={`card-own${owned ? " is-on" : ""}`}
        onClick={() => toggle(item.id)}
        title={owned ? "Collected — click to unmark" : "Mark as collected"}
        aria-pressed={owned}
      >
        {owned ? "✓" : "+"}
      </button>

      <div className="card-meta">
        <div className="card-name" title={item.name}>
          {item.name}
        </div>
        <div className="card-sub">{subtitle(kind, item)}</div>
        {owned && (
          <div className="card-stepper">
            <button type="button" onClick={() => increment(item.id, -1)} aria-label="Remove one duplicate">
              −
            </button>
            <span>{count}</span>
            <button type="button" onClick={() => increment(item.id, 1)} aria-label="Add one duplicate">
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export const ItemCard = memo(ItemCardImpl);
