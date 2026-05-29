import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { toggle, useCount } from "../store/collection";
import type { Ability, Defender, Hero, Schematic, Survivor } from "../types";
import { rarityColor } from "../lib/rarity";
import { tagId, weaponStatRows, type Selected } from "../lib/view";

interface Props {
  selected: Selected;
  abilities: Record<string, Ability>;
  onClose: () => void;
  /** jump to a section/subcategory with a facet applied (cross-link / comps) */
  onCrossLink: (sectionKey: string, subKey: string, tagId: string) => void;
}

const KIND_LABEL: Record<string, string> = {
  hero: "Hero",
  survivor: "Survivor",
  "mythic-lead": "Mythic Lead",
  lead: "Lead Survivor",
  defender: "Defender",
  schematic: "Schematic",
};

export function InspectModal({ selected, abilities, onClose, onCrossLink }: Props) {
  const { kind, item } = selected;
  const count = useCount(item.id);
  const color = rarityColor(item.rarity);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const art = item.images.large ?? item.images.icon;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ "--rarity": color } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-head">
          <div className="modal-titles">
            <span className="modal-kind" style={{ color }}>
              {item.rarity} · {kind === "survivor" ? KIND_LABEL[(item as Survivor).kind] : KIND_LABEL[kind]}
            </span>
            <h2>{item.name}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="modal-body">
          <div className="modal-left">
            <div className="modal-art">
              {art ? <img src={art} alt="" /> : <span className="card-placeholder">{item.name.slice(0, 2)}</span>}
            </div>
            <button
              type="button"
              className={`own-btn${count > 0 ? " is-on" : ""}`}
              onClick={() => toggle(item.id)}
            >
              {count > 0 ? "✓ Collected" : "Mark as collected"}
            </button>
          </div>

          <div className="modal-main">
            {kind === "hero" && <HeroBody hero={item as Hero} abilities={abilities} onCrossLink={onCrossLink} />}
            {kind === "schematic" && <SchematicBody s={item as Schematic} onCrossLink={onCrossLink} />}
            {(kind === "survivor" || kind === "defender") && <PersonnelBody item={item as Survivor | Defender} kind={kind} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <div className="modal-chips">{children}</div>;
}
function LinkChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="link-chip" onClick={onClick}>
      {label}
    </button>
  );
}

function PerkIcon({ perk }: { perk: { name: string; images?: { icon?: string } } }) {
  return perk.images?.icon ? (
    <img className="perk-icon" src={perk.images.icon} alt="" />
  ) : (
    <span className="perk-icon perk-icon-fallback">{perk.name.slice(0, 1)}</span>
  );
}

function HeroBody({
  hero,
  abilities,
  onCrossLink,
}: {
  hero: Hero;
  abilities: Record<string, Ability>;
  onCrossLink: Props["onCrossLink"];
}) {
  const [tab, setTab] = useState<"perks" | "abilities">("perks");
  const resolved = hero.abilityIds.map((id) => abilities[id]).filter((a): a is Ability => Boolean(a));

  return (
    <>
      <Chips>
        <LinkChip label={hero.class} onClick={() => onCrossLink("heroes", "all", tagId("class", hero.class))} />
        <LinkChip label={hero.setLabel} onClick={() => onCrossLink("heroes", "all", tagId("set", hero.set))} />
      </Chips>
      {hero.location && <p className="modal-location">📍 {hero.location}</p>}
      {hero.description && <p className="modal-flavor">{hero.description}</p>}

      <div className="tabs">
        <button type="button" className={tab === "perks" ? "is-active" : ""} onClick={() => setTab("perks")}>
          Perks
        </button>
        <button type="button" className={tab === "abilities" ? "is-active" : ""} onClick={() => setTab("abilities")}>
          Abilities
        </button>
      </div>

      {tab === "perks" ? (
        <div className="perk-list">
          {hero.heroPerk && (
            <div className="perk">
              <PerkIcon perk={hero.heroPerk} />
              <div className="perk-text">
                <div className="perk-head">
                  Standard Perk ·{" "}
                  <button
                    type="button"
                    className="perk-link"
                    title="Find heroes that share this standard perk"
                    onClick={() => onCrossLink("heroes", "all", tagId("heroPerk", hero.heroPerk!.name))}
                  >
                    {hero.heroPerk.name}
                  </button>
                </div>
                <p>{hero.heroPerk.description}</p>
              </div>
            </div>
          )}
          {hero.commanderPerk && (
            <div className="perk">
              <PerkIcon perk={hero.commanderPerk} />
              <div className="perk-text">
                <div className="perk-head">
                  Commander Perk ·{" "}
                  <button
                    type="button"
                    className="perk-link"
                    title="Find heroes that share this commander perk"
                    onClick={() => onCrossLink("heroes", "all", tagId("commanderPerk", hero.commanderPerk!.name))}
                  >
                    {hero.commanderPerk.name}
                  </button>
                </div>
                <p>{hero.commanderPerk.description}</p>
                {hero.perkRequirement && <p className="perk-req">{hero.perkRequirement}</p>}
              </div>
            </div>
          )}
          {hero.classPerks.map((p) => (
            <div className="perk" key={p.name}>
              <PerkIcon perk={p} />
              <div className="perk-text">
                <div className="perk-head">
                  Class Perk ·{" "}
                  <button
                    type="button"
                    className="perk-link"
                    title="Find heroes that share this class perk"
                    onClick={() => onCrossLink("heroes", "all", tagId("classPerk", p.name))}
                  >
                    {p.name}
                  </button>
                </div>
                <p>{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ability-list">
          {resolved.length === 0 && <p className="note">No active abilities in the source data.</p>}
          {resolved.map((a) => (
            <div className="ability" key={a.id}>
              {a.images.icon && <img className="ability-icon" src={a.images.icon} alt="" />}
              <div className="ability-text">
                <button
                  type="button"
                  className="ability-name"
                  title="Find heroes that share this ability"
                  onClick={() => onCrossLink("heroes", "all", tagId("ability", a.id))}
                >
                  {a.name}
                </button>
                <div className="ability-meta">
                  {a.cooldown !== undefined && <span>Cooldown {a.cooldown}s</span>}
                  {a.energyCost !== undefined && <span>Cost {a.energyCost}</span>}
                </div>
                {a.description && <p>{a.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SchematicBody({ s, onCrossLink }: { s: Schematic; onCrossLink: Props["onCrossLink"] }) {
  const [tab, setTab] = useState<"perks" | "crafting">("crafting");
  const rows = weaponStatRows(s);

  return (
    <>
      <Chips>
        {s.subType && <LinkChip label={s.subType} onClick={() => onCrossLink(s.category, "all", tagId("subType", s.subType!))} />}
        {s.ammoType && <LinkChip label={s.ammoType} onClick={() => onCrossLink(s.category, "all", tagId("ammoType", s.ammoType!))} />}
        {s.triggerType && <LinkChip label={s.triggerType} onClick={() => onCrossLink(s.category, "all", tagId("triggerType", s.triggerType!))} />}
        {s.evoType && <LinkChip label={s.evoType} onClick={() => onCrossLink(s.category, "all", tagId("evoType", s.evoType!))} />}
      </Chips>
      {s.description && <p className="modal-flavor">{s.description}</p>}

      {rows.length > 0 && (
        <div className="stat-grid">
          {rows.map((r) => (
            <div className="stat" key={r.label}>
              <span className="stat-label">{r.label}</span>
              <span className="stat-value">{r.value}</span>
            </div>
          ))}
          <p className="note stat-note">Base values (level 1, unrolled).</p>
        </div>
      )}

      <div className="tabs">
        <button type="button" className={tab === "crafting" ? "is-active" : ""} onClick={() => setTab("crafting")}>
          Crafting
        </button>
        <button type="button" className={tab === "perks" ? "is-active" : ""} onClick={() => setTab("perks")}>
          Perks
        </button>
      </div>

      {tab === "crafting" ? (
        <div className="craft-list">
          {s.craftingCost?.length ? (
            s.craftingCost.map((c) => (
              <div className="craft" key={c.id}>
                {c.icon && <img src={c.icon} alt="" />}
                <span className="craft-name">{c.name}</span>
                <span className="craft-qty">×{c.qty}</span>
              </div>
            ))
          ) : (
            <p className="note">No crafting cost in the source data.</p>
          )}
        </div>
      ) : (
        <div className="perk-list">
          {s.perkSlots?.length ? (
            s.perkSlots.map((slot, i) => (
              <div className="perk" key={i}>
                <div className="perk-head">
                  Perk Slot {i + 1}
                  {slot.requiredLevel ? ` · Lv ${slot.requiredLevel}` : ""}
                </div>
                <ul className="perk-options">
                  {slot.options.map((o, j) => (
                    <li key={j}>{o}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="note">No perk pool in the source data.</p>
          )}
        </div>
      )}
    </>
  );
}

function PersonnelBody({ item, kind }: { item: Survivor | Defender; kind: "survivor" | "defender" }) {
  const rows: { label: string; value: string }[] = [];
  if (kind === "survivor") {
    const s = item as Survivor;
    if (s.squad) rows.push({ label: "Squad", value: s.squad });
    if (s.personality) rows.push({ label: "Personality", value: s.personality });
  } else {
    const d = item as Defender;
    if (d.weaponType) rows.push({ label: "Weapon", value: d.weaponType });
  }
  return (
    <>
      {rows.length > 0 && (
        <div className="stat-grid">
          {rows.map((r) => (
            <div className="stat" key={r.label}>
              <span className="stat-label">{r.label}</span>
              <span className="stat-value">{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {item.description && <p className="modal-flavor">{item.description}</p>}
      <p className="note">📍 Found inside Llamas in the Llama Shop.</p>
    </>
  );
}
