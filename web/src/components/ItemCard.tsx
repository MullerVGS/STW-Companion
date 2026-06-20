import { memo, useEffect, useRef, useState, type CSSProperties } from "react";

import { toggle, useCount } from "../store/collection";
import type { AnyItem, Hero, HeroClass, Survivor } from "../types";
import { rarityColor } from "../lib/rarity";
import type { ItemKind } from "../lib/view";

interface Props {
  kind: ItemKind;
  item: AnyItem;
  onInspect: (item: AnyItem) => void;
  /** when true, scroll into view and play the locate flash (find-in-book) */
  highlight?: boolean;
  classIcons: Partial<Record<HeroClass, string>>;
}

function ItemCardImpl({ kind, item, onInspect, highlight = false, classIcons }: Props) {
  const count = useCount(item.id);
  const owned = count > 0;
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = rarityColor(item.rarity);
  const img = item.images.icon && !broken ? item.images.icon : null;
  const isSurv = kind === "survivor" || kind === "defender";
  const badges = (item as Survivor).badgeImages;
  const hasBadges = badges && (badges.leader || badges.personality || badges.squad);
  const classIcon = kind === "hero" ? classIcons[(item as Hero).class] : undefined;

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
        <span className="cb-card-sheen" aria-hidden />
        {classIcon && <img className="class-glyph" src={classIcon} alt="" loading="lazy" />}
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
      <div className="foot" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export const ItemCard = memo(ItemCardImpl);
