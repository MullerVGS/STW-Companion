import { useEffect, useState, type CSSProperties } from "react";

import { toggle, useCount } from "../store/collection";
import type { Ability, AnyItem, Defender, Hero, Perk, PerkEntity, Schematic, Survivor } from "../types";
import { RARITY_LEVEL, STARS, rarityColor } from "../lib/rarity";
import { KIND_LABEL, heroStatRows, tagId, weaponStatRows, type ItemKind, type Selected } from "../lib/view";
import { Rich } from "./Rich";
import { IconBook } from "./icons";

interface Props {
  selected: Selected;
  abilities: Record<string, Ability>;
  /** shared perk registry, to resolve a schematic's perkSlots[].perkIds */
  perks: Record<string, PerkEntity>;
  onClose: () => void;
  /** jump to a section/subcategory, optionally applying a facet tag (cross-link) */
  onCrossLink: (sectionKey: string, subKey: string, tagId?: string) => void;
  /** find this item in the Collection Book (navigate + scroll + flash) */
  onLocate: (kind: ItemKind, item: AnyItem) => void;
}

type Tab = "perks" | "abilities" | "crafting";

function PerkIcon({ img, name, cls = "pic" }: { img?: string; name?: string; cls?: string }) {
  return img ? (
    <img className={cls} src={img} alt="" loading="lazy" />
  ) : (
    <span className={`${cls} ph`}>{(name ?? "?").slice(0, 1)}</span>
  );
}

function LinkChip({ label, img, onClick }: { label: string; img?: string; onClick: () => void }) {
  return (
    <button type="button" className="cb-linkchip" onClick={onClick}>
      {img && <img src={img} alt="" />}
      {label}
    </button>
  );
}

// ── hero body ────────────────────────────────────────────────────────────────
function PerkRow({
  perk,
  tagText,
  onClick,
  title,
}: {
  perk: Perk;
  tagText: string;
  onClick: () => void;
  title: string;
}) {
  const tagClass = tagText === "Standard" ? "std" : tagText === "Commander" ? "cmd" : "cls";
  return (
    <div className="cb-perk">
      <PerkIcon img={perk.images?.icon} name={perk.name} />
      <div className="pb">
        <div className="ph-name">
          <button type="button" className="pname cb-xlink" title={title} onClick={onClick}>
            {perk.name}
          </button>
          <span className={`ptag ${tagClass}`}>{tagText}</span>
        </div>
        <p>
          <Rich text={perk.description} />
        </p>
      </div>
    </div>
  );
}

function HeroBody({
  hero,
  tab,
  abilities,
  onCrossLink,
}: {
  hero: Hero;
  tab: Tab;
  abilities: Record<string, Ability>;
  onCrossLink: Props["onCrossLink"];
}) {
  if (tab === "abilities") {
    const list = hero.abilityIds.map((id) => abilities[id]).filter((a): a is Ability => Boolean(a));
    return (
      <div>
        {list.length === 0 && <p className="cb-flavor">No active abilities in the data.</p>}
        {list.map((a) => (
          <div className="cb-ability" key={a.id}>
            <PerkIcon img={a.images.icon} name={a.name} cls="aic" />
            <div className="pb">
              <button
                type="button"
                className="aname cb-xlink"
                title="Find heroes that share this ability"
                onClick={() => onCrossLink("heroes", "all", tagId("ability", a.id))}
              >
                {a.name}
              </button>
              <div className="meta">
                {a.cooldown !== undefined && <span>COOLDOWN {a.cooldown}s</span>}
                {a.energyCost !== undefined && <span>COST {a.energyCost}</span>}
              </div>
              <p>
                <Rich text={a.description} />
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      {hero.heroPerk && (
        <>
          <div className="cb-perkgroup-title">Standard Perk</div>
          <PerkRow
            perk={hero.heroPerk}
            tagText="Standard"
            title="Find heroes with this standard perk"
            onClick={() => onCrossLink("heroes", "all", tagId("heroPerk", hero.heroPerk!.name))}
          />
        </>
      )}
      {hero.commanderPerk && (
        <>
          <div className="cb-perkgroup-title">Commander Perk</div>
          <div className="cb-perk">
            <PerkIcon img={hero.commanderPerk.images?.icon} name={hero.commanderPerk.name} />
            <div className="pb">
              <div className="ph-name">
                <button
                  type="button"
                  className="pname cb-xlink"
                  title="Find heroes with this commander perk"
                  onClick={() =>
                    onCrossLink("heroes", "all", tagId("commanderPerk", hero.commanderPerk!.name))
                  }
                >
                  {hero.commanderPerk.name}
                </button>
                <span className="ptag cmd">Commander</span>
              </div>
              <p>
                <Rich text={hero.commanderPerk.description} />
              </p>
              {hero.perkRequirement && <p className="req">{hero.perkRequirement}</p>}
            </div>
          </div>
        </>
      )}
      {hero.classPerks.length > 0 && (
        <>
          <div className="cb-perkgroup-title">Class Perks</div>
          {hero.classPerks.map((p) => (
            <PerkRow
              key={p.name}
              perk={p}
              tagText="Class"
              title="Find heroes with this class perk"
              onClick={() => onCrossLink("heroes", "all", tagId("classPerk", p.name))}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── schematic body ───────────────────────────────────────────────────────────
function SchematicBody({
  s,
  tab,
  perks,
  onCrossLink,
}: {
  s: Schematic;
  tab: Tab;
  perks: Record<string, PerkEntity>;
  onCrossLink: Props["onCrossLink"];
}) {
  const sectionKey = s.category === "trap" ? "traps" : s.category;
  const perkFacet = `${s.category}Perk`; // rangedPerk / meleePerk / trapPerk
  if (tab === "crafting") {
    return (
      <div>
        <div className="cb-perkgroup-title">Crafting Cost</div>
        {s.craftingCost?.length ? (
          s.craftingCost.map((c) => (
            <div className="cb-craft" key={c.id}>
              {c.icon && <img src={c.icon} alt="" loading="lazy" />}
              <span className="cn">{c.name}</span>
              <span className="cq">×{c.qty}</span>
            </div>
          ))
        ) : (
          <p className="cb-flavor">No crafting cost in the data.</p>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="cb-perkgroup-title">
        Perk Pool — click a perk to find every {s.category === "trap" ? "trap" : "weapon"} that can
        roll it
      </div>
      {s.perkSlots?.length ? (
        s.perkSlots.map((slot, i) => (
          <div className="cb-slot" key={i}>
            <div className="sh">
              Slot {i + 1}
              {slot.requiredLevel ? ` · Lv ${slot.requiredLevel}` : ""}
            </div>
            <div className="opts">
              {slot.perkIds.map((id) => {
                const p = perks[id];
                if (!p) return null;
                return (
                  <button
                    type="button"
                    className="cb-slot-opt"
                    key={id}
                    title="Cross-link this perk"
                    onClick={() => onCrossLink(sectionKey, "all", tagId(perkFacet, id))}
                  >
                    {p.images?.icon ? (
                      <img src={p.images.icon} alt="" loading="lazy" />
                    ) : (
                      <span className="on">{p.name.slice(0, 1)}</span>
                    )}
                    <span className="nm">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <p className="cb-flavor">No perk pool in the data.</p>
      )}
    </div>
  );
}

// ── personnel body ───────────────────────────────────────────────────────────
function PersonnelBody({
  item,
  kind,
  onCrossLink,
}: {
  item: Survivor | Defender;
  kind: "survivor" | "defender";
  onCrossLink: Props["onCrossLink"];
}) {
  const s = item as Survivor;
  const d = item as Defender;
  return (
    <div>
      {item.description && <p className="cb-flavor">{item.description}</p>}
      <div className="cb-perkgroup-title">Cross-links</div>
      <div className="cb-insp-chips">
        {kind === "survivor" && s.squad && (
          <LinkChip
            label={`Squad · ${s.squad}`}
            img={s.badgeImages?.squad}
            onClick={() => onCrossLink("personnel", "all-survivors", tagId("squad", s.squad!))}
          />
        )}
        {kind === "survivor" && s.personality && (
          <LinkChip
            label={s.personality}
            img={s.badgeImages?.personality}
            onClick={() =>
              onCrossLink("personnel", "all-survivors", tagId("personality", s.personality!))
            }
          />
        )}
        {kind === "defender" && d.weaponType && (
          <LinkChip
            label={d.weaponType}
            onClick={() => onCrossLink("personnel", "defenders", tagId("weaponType", d.weaponType!))}
          />
        )}
      </div>
      <p className="cb-flavor">📍 Found inside Llamas in the Llama Shop.</p>
    </div>
  );
}

// ── shell ────────────────────────────────────────────────────────────────────
export function InspectModal({ selected, abilities, perks, onClose, onCrossLink, onLocate }: Props) {
  const { kind, item } = selected;
  const isHero = kind === "hero";
  const isSchem = kind === "schematic";
  const [tab, setTab] = useState<Tab>("perks");
  const count = useCount(item.id);
  const owned = count > 0;
  const color = rarityColor(item.rarity);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hero = item as Hero;
  const schem = item as Schematic;

  const tabs: [Tab, string][] = isHero
    ? [
        ["perks", "Perks"],
        ["abilities", "Abilities"],
      ]
    : isSchem
      ? [
          ["perks", "Perks"],
          ["crafting", "Crafting"],
        ]
      : [];

  const statRows = isSchem ? weaponStatRows(schem) : isHero ? heroStatRows(hero) : [];
  const stars = STARS[item.rarity] ?? 1;
  const kindLabel = KIND_LABEL[kind === "survivor" ? (item as Survivor).kind : kind];

  // header chips (cross-links)
  const chips =
    isHero ? (
      <>
        <LinkChip
          label={hero.class}
          onClick={() => onCrossLink("heroes", "all", tagId("class", hero.class))}
        />
        <LinkChip label={hero.setLabel} onClick={() => onCrossLink("heroes", hero.set)} />
      </>
    ) : isSchem ? (
      <>
        {schem.subType && (
          <LinkChip
            label={schem.subType}
            onClick={() =>
              onCrossLink(
                schem.category === "trap" ? "traps" : schem.category,
                "all",
                tagId("subType", schem.subType!),
              )
            }
          />
        )}
        {schem.ammoType && (
          <LinkChip
            label={schem.ammoType}
            onClick={() =>
              onCrossLink(
                schem.category === "trap" ? "traps" : schem.category,
                "all",
                tagId("ammoType", schem.ammoType!),
              )
            }
          />
        )}
        {schem.evoType && (
          <LinkChip
            label={schem.evoType}
            onClick={() =>
              onCrossLink(
                schem.category === "trap" ? "traps" : schem.category,
                "all",
                tagId("evoType", schem.evoType!),
              )
            }
          />
        )}
      </>
    ) : null;

  return (
    <div className="cb-inspect-overlay" onClick={onClose}>
      <div
        className="cb-inspect"
        style={{ "--rc": color } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="cb-insp-topbar">
          {tabs.map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              className={`tab${tab === k ? " on" : ""}`}
              onClick={() => setTab(k)}
            >
              {lbl}
            </button>
          ))}
          {tabs.length === 0 && <span className="tab on">Overview</span>}
          <button type="button" className="cb-insp-close" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className="cb-insp-body">
          {/* LEFT: stat panel */}
          <div className="cb-insp-left">
            <div className="cb-statpanel" style={{ "--rc": color } as CSSProperties}>
              <div className="cb-sp-head">
                <div className="rk">
                  {item.rarity} · {kindLabel}
                </div>
                <h3>{item.name}</h3>
                {isHero && (
                  <div className="cls">
                    {hero.class} · {hero.setLabel}
                  </div>
                )}
                {isSchem && (
                  <div className="cls">
                    {[schem.subType, schem.ammoType].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="cb-sp-tier">
                <span className="tnum">{RARITY_LEVEL[item.rarity] ?? "—"}</span>
                <div className="stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <i key={i} className={i < stars ? "" : "off"}>
                      ★
                    </i>
                  ))}
                </div>
                <span className="lv">{isHero || isSchem ? "LV 1 / 10" : ""}</span>
              </div>
              <div className="cb-sp-scroll">
                {statRows.map((r) => (
                  <div className={`cb-statrow${r.big ? " big" : ""}`} key={r.label}>
                    <span className="k">{r.label}</span>
                    <span className="v">{r.value}</span>
                  </div>
                ))}
                {isHero && hero.location && (
                  <div className="cb-loc" style={{ padding: "10px 16px 4px" }}>
                    📍 {hero.location}
                  </div>
                )}
                {isHero && hero.description && (
                  <p className="cb-flavor" style={{ padding: "4px 16px 12px" }}>
                    {hero.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* MIDDLE: framed perks / abilities / crafting */}
          <div className="cb-insp-listframe">
            <div className="cb-insp-mid">
              {chips && <div className="cb-insp-chips">{chips}</div>}
              {isHero && (
                <HeroBody hero={hero} tab={tab} abilities={abilities} onCrossLink={onCrossLink} />
              )}
              {isSchem && (
                <SchematicBody s={schem} tab={tab} perks={perks} onCrossLink={onCrossLink} />
              )}
              {(kind === "survivor" || kind === "defender") && (
                <PersonnelBody
                  item={item as Survivor | Defender}
                  kind={kind}
                  onCrossLink={onCrossLink}
                />
              )}
            </div>
          </div>
        </div>

        {/* bottom action bar */}
        <div className="cb-insp-actions">
          <button
            type="button"
            className={`ab primary${owned ? " on" : ""}`}
            onClick={() => toggle(item.id)}
          >
            <span className="key">F</span>
            {owned ? "Owned ✓" : "Mark Owned"}
          </button>
          <button
            type="button"
            className="ab"
            title="Find this item in the Collection Book"
            onClick={() => onLocate(kind, item)}
          >
            <IconBook />
            Find in Book
          </button>
          <span className="sp" />
          <button type="button" className="ab" onClick={onClose}>
            <span className="key">Esc</span>Back
          </button>
        </div>
      </div>
    </div>
  );
}
