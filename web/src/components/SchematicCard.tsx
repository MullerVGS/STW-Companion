import { memo, useState, type CSSProperties } from "react";

import { increment, toggle, useCount } from "../store/collection";
import type { Schematic } from "../types";
import { rarityColor } from "../lib/rarity";

interface Props {
  schematic: Schematic;
  selectedTags: ReadonlySet<string>;
  onToggleFacet: (tagId: string) => void;
}

function tagFor(s: Schematic, facet: string): string | undefined {
  return s.tags.find((t) => t.startsWith(`${facet}:`));
}

function SchematicCardImpl({ schematic: s, selectedTags, onToggleFacet }: Props) {
  const count = useCount(s.id);
  const owned = count > 0;
  const [imgBroken, setImgBroken] = useState(false);
  const color = rarityColor(s.rarity);
  const showIcon = s.images.icon && !imgBroken;

  const rarityTag = tagFor(s, "rarity");
  const subTypeTag = tagFor(s, "subType");

  return (
    <article
      className={`card${owned ? " is-owned" : " is-missing"}`}
      style={{ "--rarity": color } as CSSProperties}
    >
      <button
        type="button"
        className="card-tile"
        onClick={() => toggle(s.id)}
        title={owned ? `Collected — click to unmark` : `Not collected — click to mark as collected`}
        aria-pressed={owned}
      >
        {showIcon ? (
          <img src={s.images.icon} alt="" loading="lazy" onError={() => setImgBroken(true)} />
        ) : (
          <span className="card-placeholder" aria-hidden>
            {s.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        {owned && <span className="card-check" aria-hidden>✓</span>}
        {count > 1 && <span className="card-qty">×{count}</span>}
      </button>

      <div className="card-meta">
        <div className="card-name" title={s.name}>
          {s.name}
        </div>
        <div className="card-chips">
          {rarityTag && (
            <button
              type="button"
              className={`chip chip-rarity${selectedTags.has(rarityTag) ? " is-active" : ""}`}
              onClick={() => onToggleFacet(rarityTag)}
              title="Filter by rarity"
            >
              {s.rarity}
            </button>
          )}
          {s.subType && subTypeTag && (
            <button
              type="button"
              className={`chip${selectedTags.has(subTypeTag) ? " is-active" : ""}`}
              onClick={() => onToggleFacet(subTypeTag)}
              title="Filter by type"
            >
              {s.subType}
            </button>
          )}
        </div>
        {owned && (
          <div className="card-stepper">
            <button type="button" onClick={() => increment(s.id, -1)} aria-label="Remove one duplicate">
              −
            </button>
            <span>{count}</span>
            <button type="button" onClick={() => increment(s.id, 1)} aria-label="Add one duplicate">
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export const SchematicCard = memo(SchematicCardImpl);
