import { memo, useEffect, useRef, useState, type CSSProperties } from "react";

import { toggle, useCount } from "../store/collection";
import type { AnyItem, Survivor } from "../types";
import { RARITY_LEVEL, STARS, rarityColor } from "../lib/rarity";
import type { ItemKind } from "../lib/view";

interface Props {
  kind: ItemKind;
  item: AnyItem;
  onInspect: (item: AnyItem) => void;
  /** when true, scroll into view and play the locate flash (find-in-book) */
  highlight?: boolean;
}

function Stars({ rarity, n }: { rarity: string; n: number }) {
  const filled = STARS[rarity] ?? 1;
  return (
    <div className="stars" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <i key={i} className={i < filled ? "" : "off"}>
          ★
        </i>
      ))}
    </div>
  );
}

function ItemCardImpl({ kind, item, onInspect, highlight = false }: Props) {
  const count = useCount(item.id);
  const owned = count > 0;
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = rarityColor(item.rarity);
  const lv = RARITY_LEVEL[item.rarity] ?? 1;
  const img = item.images.icon && !broken ? item.images.icon : null;
  const isSurv = kind === "survivor" || kind === "defender";
  const badges = (item as Survivor).badgeImages;
  const hasBadges = badges && (badges.leader || badges.personality || badges.squad);

  // find-in-book: when this card becomes the locate target, center it in view
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  return (
    <div
      ref={ref}
      className={`cb-card${owned ? " owned" : " miss"}${isSurv ? " surv" : ""}${highlight ? " is-locate" : ""}`}
      style={{ "--rc": color } as CSSProperties}
      onClick={() => onInspect(item)}
      title={item.name}
    >
      <div className="art">
        {img ? (
          <img src={img} alt="" loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className="ph">{item.name.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="lv">{lv}</span>
        {count > 1 && <span className="qty">×{count}</span>}
        {hasBadges && (
          <span className="glyphs" aria-hidden>
            {badges?.leader && <img src={badges.leader} alt="" loading="lazy" />}
            {badges?.personality && <img src={badges.personality} alt="" loading="lazy" />}
            {badges?.squad && <img src={badges.squad} alt="" loading="lazy" />}
          </span>
        )}
        <button
          type="button"
          className={`own${owned ? " on" : ""}`}
          title={owned ? "Owned — click to unmark" : "Mark as owned"}
          aria-pressed={owned}
          onClick={(e) => {
            e.stopPropagation();
            toggle(item.id);
          }}
        >
          {owned ? "✓" : "+"}
        </button>
      </div>
      <div className="foot">
        <Stars rarity={item.rarity} n={5} />
        <div className="xp">
          <i style={{ width: owned ? "100%" : "0%" }} />
        </div>
      </div>
    </div>
  );
}

export const ItemCard = memo(ItemCardImpl);
