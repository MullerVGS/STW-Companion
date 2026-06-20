import { useMemo, useState, type CSSProperties } from "react";

import type { AnyItem, Dataset, Gadget, Hero, TeamPerk } from "../types";
import {
  GADGET_SLOTS,
  SUPPORT_SLOTS,
  clearActiveLoadout,
  createLoadout,
  deleteLoadout,
  renameLoadout,
  setActive,
  setSlot,
  useActiveLoadout,
  useLoadoutsState,
  type SlotKind,
} from "../store/loadouts";
import { rarityColor } from "../lib/rarity";
import { unmetRequirement, type ItemKind, type Selected } from "../lib/view";
import { IconBook, IconEye, IconX } from "./icons";
import { Rich } from "./Rich";
import { SlotPicker } from "./SlotPicker";

interface Props {
  dataset: Dataset;
  onLocate: (kind: ItemKind, item: AnyItem) => void;
  onInspect: (selected: Selected) => void;
}

interface Picking {
  kind: SlotKind;
  index: number;
}

export function LoadoutScreen({ dataset, onLocate, onInspect }: Props) {
  const { loadouts, activeId } = useLoadoutsState();
  const loadout = useActiveLoadout();
  const [picking, setPicking] = useState<Picking | null>(null);

  const heroMap = useMemo(() => new Map(dataset.heroes.map((h) => [h.id, h])), [dataset.heroes]);
  const teamPerkMap = useMemo(
    () => new Map(dataset.teamPerks.map((p) => [p.id, p])),
    [dataset.teamPerks],
  );
  const gadgetMap = useMemo(() => new Map(dataset.gadgets.map((g) => [g.id, g])), [dataset.gadgets]);

  const commander = loadout.commanderId ? heroMap.get(loadout.commanderId) : undefined;
  const supports = loadout.supportIds.map((id) => (id ? heroMap.get(id) : undefined));
  const teamPerk = loadout.teamPerkId ? teamPerkMap.get(loadout.teamPerkId) : undefined;
  const gadgets = loadout.gadgetIds.map((id) => (id ? gadgetMap.get(id) : undefined));
  const abilities = commander
    ? commander.abilityIds.map((id) => dataset.abilities[id]).filter(Boolean)
    : [];

  const activeIdx = loadouts.findIndex((l) => l.id === activeId);
  const cycle = (dir: number) => {
    const next = loadouts[(activeIdx + dir + loadouts.length) % loadouts.length];
    if (next) setActive(next.id);
  };

  // hero ids used elsewhere (so the picker can mark them "assigned")
  const usedFor = (skip: string | null): ReadonlySet<string> => {
    const ids = [loadout.commanderId, ...loadout.supportIds].filter(
      (id): id is string => Boolean(id) && id !== skip,
    );
    return new Set(ids);
  };

  const onPick = (id: string) => {
    if (picking) setSlot(picking.kind, picking.index, id);
    setPicking(null);
  };
  const onClearSlot = () => {
    if (picking) setSlot(picking.kind, picking.index, null);
    setPicking(null);
  };

  const rename = () => {
    const name = window.prompt("Loadout name", loadout.name);
    if (name) renameLoadout(loadout.id, name);
  };
  const remove = () => {
    if (loadouts.length === 1 || window.confirm(`Delete "${loadout.name}"?`)) deleteLoadout(loadout.id);
  };
  const clear = () => {
    if (window.confirm("Clear every slot in this loadout?")) clearActiveLoadout();
  };

  // ── slot renderers ──────────────────────────────────────────────────────────
  function HeroSlot({ hero, kind, index }: { hero: Hero | undefined; kind: SlotKind; index: number }) {
    if (!hero) {
      return (
        <button type="button" className="cb-slot empty" onClick={() => setPicking({ kind, index })}>
          <span className="ic add">+</span>
          <span className="bd">
            <span className="nm">Add {kind === "commander" ? "commander" : "support"}</span>
          </span>
        </button>
      );
    }
    const warn = kind === "support" ? unmetRequirement(hero, commander, dataset.abilities) : undefined;
    const perk = kind === "commander" ? hero.commanderPerk : hero.heroPerk;
    return (
      <div className="cb-slot filled" style={{ "--rc": rarityColor(hero.rarity) } as CSSProperties}>
        <button type="button" className="hit" onClick={() => setPicking({ kind, index })} title="Change">
          {hero.images.icon ? (
            <img className="ic" src={hero.images.icon} alt="" loading="lazy" />
          ) : (
            <span className="ic ph">{hero.name.slice(0, 1)}</span>
          )}
          <span className="bd">
            <span className="nm">{hero.name}</span>
            <span className="sub">
              {hero.class}
              {perk ? ` · ${perk.name}` : ""}
            </span>
            {warn && (
              <span className="warn" title={warn}>
                ⚠ unmet perk requirement
              </span>
            )}
          </span>
        </button>
        <span className="acts">
          <button type="button" title="Inspect" onClick={() => onInspect({ kind: "hero", item: hero })}>
            <IconEye />
          </button>
          <button type="button" title="Find in Collection Book" onClick={() => onLocate("hero", hero)}>
            <IconBook />
          </button>
          <button type="button" title="Remove" onClick={() => setSlot(kind, index, null)}>
            <IconX />
          </button>
        </span>
      </div>
    );
  }

  function EntitySlot({
    item,
    kind,
    index,
    addLabel,
  }: {
    item: TeamPerk | Gadget | undefined;
    kind: SlotKind;
    index: number;
    addLabel: string;
  }) {
    if (!item) {
      return (
        <button type="button" className="cb-slot empty" onClick={() => setPicking({ kind, index })}>
          <span className="ic add">+</span>
          <span className="bd">
            <span className="nm">{addLabel}</span>
          </span>
        </button>
      );
    }
    return (
      <div className="cb-slot filled entity">
        <button type="button" className="hit" onClick={() => setPicking({ kind, index })} title="Change">
          {item.images.icon ? (
            <img className="ic" src={item.images.icon} alt="" loading="lazy" />
          ) : (
            <span className="ic ph">{item.name.slice(0, 1)}</span>
          )}
          <span className="bd">
            <span className="nm">{item.name}</span>
            {item.description && <span className="sub one">{item.description}</span>}
          </span>
        </button>
        <span className="acts">
          <button type="button" title="Remove" onClick={() => setSlot(kind, index, null)}>
            <IconX />
          </button>
        </span>
      </div>
    );
  }

  const supportPerks = supports
    .map((h, i) => ({ h, i }))
    .filter((x): x is { h: Hero; i: number } => Boolean(x.h));

  return (
    <div className="cb-loadout">
      <header className="cb-lo-head">
        <div className="cb-lo-title">
          <span className="logo" aria-hidden>
            ⛨
          </span>
          HERO LOADOUT
          <span className="cdr">{commander ? `— ${commander.name}` : "— empty"}</span>
        </div>

        <div className="cb-lo-switch">
          <button type="button" onClick={() => cycle(-1)} title="Previous" disabled={loadouts.length < 2}>
            ‹
          </button>
          <span className="name">{loadout.name}</span>
          <button type="button" onClick={() => cycle(1)} title="Next" disabled={loadouts.length < 2}>
            ›
          </button>
          <span className="idx">
            {activeIdx + 1}/{loadouts.length}
          </span>
        </div>

        <div className="cb-lo-actions">
          <button type="button" onClick={() => createLoadout()}>
            + New
          </button>
          <button type="button" onClick={rename}>
            Rename
          </button>
          <button type="button" onClick={remove}>
            Delete
          </button>
          <button type="button" onClick={clear}>
            Clear All
          </button>
        </div>
      </header>

      <div className="cb-lo-body">
        {/* LEFT — readable team summary */}
        <section className="cb-lo-summary">
          <h4>Team Summary</h4>

          {commander ? (
            <>
              <div className="cb-sum-block">
                <div className="cb-sum-h">Commander · {commander.name}</div>
                {commander.commanderPerk && (
                  <div className="cb-sum-perk">
                    {commander.commanderPerk.images?.icon && (
                      <img src={commander.commanderPerk.images.icon} alt="" loading="lazy" />
                    )}
                    <div>
                      <b>{commander.commanderPerk.name}</b>
                      <p>
                        <Rich text={commander.commanderPerk.description} />
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {abilities.length > 0 && (
                <div className="cb-sum-block">
                  <div className="cb-sum-h">Hero Abilities</div>
                  {abilities.map((a) => (
                    <div className="cb-sum-perk" key={a.id}>
                      {a.images.icon && <img src={a.images.icon} alt="" loading="lazy" />}
                      <div>
                        <b>{a.name}</b>
                        <p>
                          <Rich text={a.description} />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="cb-sum-empty">Pick a commander to see the team's perks and abilities.</p>
          )}

          {teamPerk && (
            <div className="cb-sum-block">
              <div className="cb-sum-h">Team Perk</div>
              <div className="cb-sum-perk">
                {teamPerk.images.icon && <img src={teamPerk.images.icon} alt="" loading="lazy" />}
                <div>
                  <b>{teamPerk.name}</b>
                  <p>
                    <Rich text={teamPerk.description} />
                  </p>
                </div>
              </div>
            </div>
          )}

          {supportPerks.length > 0 && (
            <div className="cb-sum-block">
              <div className="cb-sum-h">Support Perks</div>
              {supportPerks.map(({ h, i }) => {
                const warn = unmetRequirement(h, commander, dataset.abilities);
                return (
                  <div className="cb-sum-perk" key={`${h.id}-${i}`}>
                    {h.heroPerk?.images?.icon ? (
                      <img src={h.heroPerk.images.icon} alt="" loading="lazy" />
                    ) : h.images.icon ? (
                      <img src={h.images.icon} alt="" loading="lazy" />
                    ) : null}
                    <div>
                      <b>{h.heroPerk?.name ?? h.name}</b>
                      <p>
                        <Rich text={h.heroPerk?.description} />
                      </p>
                      {warn && <p className="cb-sum-warn">⚠ {warn}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {gadgets.some(Boolean) && (
            <div className="cb-sum-block">
              <div className="cb-sum-h">Gadgets</div>
              {gadgets.filter((g): g is Gadget => Boolean(g)).map((g, i) => (
                <div className="cb-sum-perk" key={`${g.id}-${i}`}>
                  {g.images.icon && <img src={g.images.icon} alt="" loading="lazy" />}
                  <div>
                    <b>{g.name}</b>
                    <p>
                      <Rich text={g.description} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RIGHT — the in-game rail / interactive board */}
        <aside className="cb-lo-rail">
          <div className="cb-rail-sec">
            <div className="cb-rail-h">Commander</div>
            <HeroSlot hero={commander} kind="commander" index={0} />
            {commander && abilities.length > 0 && (
              <div className="cb-rail-abilities" title="Hero abilities">
                {abilities.map((a) =>
                  a.images.icon ? (
                    <img key={a.id} src={a.images.icon} alt={a.name} title={a.name} loading="lazy" />
                  ) : (
                    <span key={a.id} className="ph" title={a.name}>
                      {a.name.slice(0, 1)}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="cb-rail-sec">
            <div className="cb-rail-h">Team Perk</div>
            <EntitySlot item={teamPerk} kind="teamPerk" index={0} addLabel="Add team perk" />
          </div>

          <div className="cb-rail-sec">
            <div className="cb-rail-h">Support Team</div>
            {Array.from({ length: SUPPORT_SLOTS }).map((_, i) => (
              <HeroSlot key={i} hero={supports[i]} kind="support" index={i} />
            ))}
          </div>

          <div className="cb-rail-sec">
            <div className="cb-rail-h">Gadgets</div>
            {Array.from({ length: GADGET_SLOTS }).map((_, i) => (
              <EntitySlot key={i} item={gadgets[i]} kind="gadget" index={i} addLabel="Add gadget" />
            ))}
          </div>
        </aside>
      </div>

      {picking && (
        <SlotPicker
          kind={picking.kind}
          index={picking.index}
          dataset={dataset}
          commander={commander}
          usedIds={
            picking.kind === "commander"
              ? usedFor(loadout.commanderId)
              : picking.kind === "support"
                ? usedFor(loadout.supportIds[picking.index])
                : undefined
          }
          onPick={onPick}
          onClear={onClearSlot}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
