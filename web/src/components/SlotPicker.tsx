import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { Dataset, Gadget, Hero, HeroClass, TeamPerk } from "../types";
import type { SlotKind } from "../store/loadouts";
import { RARITY_RANK, STARS, rarityColor } from "../lib/rarity";
import { unmetRequirement } from "../lib/view";
import { Rich } from "./Rich";

interface Props {
  kind: SlotKind;
  /** support/gadget slot index (for the title) */
  index: number;
  dataset: Dataset;
  /** current commander — used to flag unmet support-perk requirements */
  commander?: Hero;
  /** hero ids already used elsewhere in the loadout (shown as "assigned") */
  usedIds?: ReadonlySet<string>;
  onPick: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const TITLE: Record<SlotKind, string> = {
  commander: "Commander",
  support: "Support Team",
  teamPerk: "Team Perk",
  gadget: "Gadget",
};

const CLASS_TABS: { key: HeroClass | "all"; label: string; fallback: string }[] = [
  { key: "all", label: "All classes", fallback: "∞" },
  { key: "Soldier", label: "Soldier", fallback: "S" },
  { key: "Constructor", label: "Constructor", fallback: "C" },
  { key: "Ninja", label: "Ninja", fallback: "N" },
  { key: "Outlander", label: "Outlander", fallback: "O" },
];

function Stars({ rarity }: { rarity: string }) {
  const filled = STARS[rarity] ?? 1;
  return (
    <span className="stars" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <i key={i} className={i < filled ? "" : "off"}>
          ★
        </i>
      ))}
    </span>
  );
}

export function SlotPicker({
  kind,
  index,
  dataset,
  commander,
  usedIds,
  onPick,
  onClear,
  onClose,
}: Props) {
  const isHero = kind === "commander" || kind === "support";
  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState<HeroClass | "all">("all");
  const [showDesc, setShowDesc] = useState(!isHero); // long hero lists start compact

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    kind === "support"
      ? `Support Team · Slot ${index + 1}`
      : kind === "gadget"
        ? `Gadget · Slot ${index + 1}`
        : TITLE[kind];

  // hero rows, sorted highest-rarity first then name
  const heroRows = useMemo(() => {
    if (!isHero) return [];
    const q = query.trim().toLowerCase();
    return dataset.heroes
      .filter((h) => (klass === "all" ? true : h.class === klass))
      .filter((h) => {
        if (!q) return true;
        const perk = kind === "commander" ? h.commanderPerk : h.heroPerk;
        return `${h.name} ${h.class} ${h.setLabel} ${perk?.name ?? ""}`.toLowerCase().includes(q);
      })
      .sort(
        (a, b) =>
          (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0) ||
          a.name.localeCompare(b.name),
      );
  }, [isHero, dataset.heroes, klass, query, kind]);

  const entityRows = useMemo<(TeamPerk | Gadget)[]>(() => {
    if (isHero) return [];
    const list = kind === "teamPerk" ? dataset.teamPerks : dataset.gadgets;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => `${e.name} ${e.description ?? ""}`.toLowerCase().includes(q));
  }, [isHero, kind, dataset.teamPerks, dataset.gadgets, query]);

  const count = isHero ? heroRows.length : entityRows.length;

  return (
    <div className="cb-pick-overlay" onClick={onClose}>
      <div className="cb-pick" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cb-pick-head">
          <div className="cb-pick-titles">
            <span className="k">Selecting</span>
            <h3>{title}</h3>
          </div>
          <span className="ct">{count}</span>
          <button type="button" className="cb-pick-x" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className="cb-pick-tools">
          <div className="cb-pick-search">
            <span aria-hidden>⌕</span>
            <input
              type="search"
              autoFocus
              placeholder={isHero ? "Search heroes & perks…" : `Search ${TITLE[kind].toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {isHero && (
            <div className="cb-pick-classes">
              {CLASS_TABS.map((t) => {
                const icon = t.key !== "all" ? dataset.classIcons[t.key] : undefined;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`ctab${klass === t.key ? " on" : ""}`}
                    title={t.label}
                    aria-label={t.label}
                    onClick={() => setKlass(t.key)}
                  >
                    {icon ? <img src={icon} alt="" /> : <span className="g">{t.fallback}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className={`cb-pick-toggle${showDesc ? " on" : ""}`}
            onClick={() => setShowDesc((v) => !v)}
          >
            Descriptions
          </button>
        </div>

        <div className="cb-pick-list">
          <button type="button" className="cb-pick-row clear" onClick={onClear}>
            <span className="ic">✕</span>
            <span className="bd">
              <span className="nm">Clear slot</span>
            </span>
          </button>

          {isHero
            ? heroRows.map((h) => {
                const perk = kind === "commander" ? h.commanderPerk : h.heroPerk;
                const assigned = usedIds?.has(h.id) ?? false;
                const warn =
                  kind === "support" ? unmetRequirement(h, commander, dataset.abilities) : undefined;
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`cb-pick-row${assigned ? " assigned" : ""}`}
                    style={{ "--rc": rarityColor(h.rarity) } as CSSProperties}
                    disabled={assigned}
                    onClick={() => onPick(h.id)}
                  >
                    {h.images.icon ? (
                      <img className="ic" src={h.images.icon} alt="" loading="lazy" />
                    ) : (
                      <span className="ic ph">{h.name.slice(0, 1)}</span>
                    )}
                    <span className="bd">
                      <span className="nm-row">
                        <span className="nm">{h.name}</span>
                        <Stars rarity={h.rarity} />
                      </span>
                      <span className="sub">
                        {h.class} · {h.setLabel.replace(/ Heroes$/, "")}
                        {perk ? ` · ${perk.name}` : ""}
                      </span>
                      {showDesc && perk?.description && (
                        <span className="desc">
                          <Rich text={perk.description} />
                        </span>
                      )}
                      {warn && (
                        <span className="warn" title={warn}>
                          ⚠ {warn}
                        </span>
                      )}
                    </span>
                    {assigned && <span className="tag">Assigned</span>}
                  </button>
                );
              })
            : entityRows.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="cb-pick-row"
                  onClick={() => onPick(e.id)}
                >
                  {e.images.icon ? (
                    <img className="ic" src={e.images.icon} alt="" loading="lazy" />
                  ) : (
                    <span className="ic ph">{e.name.slice(0, 1)}</span>
                  )}
                  <span className="bd">
                    <span className="nm">{e.name}</span>
                    {showDesc && e.description && (
                      <span className="desc">
                        <Rich text={e.description} />
                      </span>
                    )}
                  </span>
                </button>
              ))}

          {count === 0 && <p className="cb-pick-empty">No matches.</p>}
        </div>

        <div className="cb-pick-foot">
          <button type="button" className="cb-pick-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
