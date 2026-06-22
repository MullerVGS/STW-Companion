import { useEffect, useMemo, useState } from "react";

import type {
  AlertLite,
  HomeData,
  HomeTheater,
  RewardKind,
  RewardRef,
  Supercharger,
  VBucksHistory,
  VBucksMission,
} from "../lib/home";
import { useHomeData } from "../lib/home";
import type { Rarity } from "../types";

const MAIN_SHORTS = ["SW", "PT", "CV", "TP"] as const;

export function HomeScreen({
  onOpenReward,
}: {
  onOpenReward?: (kind: RewardKind, name: string) => void;
}) {
  const { data, error } = useHomeData();

  if (error) {
    return (
      <div className="home-state">
        <h2>Daily STW data unavailable</h2>
        <p>{error}</p>
        <p className="dim">
          Run <code>npm run daily:fixture</code> to generate{" "}
          <code>web/public/data/home.json</code> for local development.
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="home-state">
        <div className="spinner" aria-hidden />
        <p className="dim">Loading daily missions…</p>
      </div>
    );
  }

  return (
    <div className="home">
      <MetaStrip data={data} />

      <section className="home-indicators">
        <VBucksAvailableCard vbucks={data.vbucks} supercharger={data.supercharger ?? null} />
        <TodaysVBucksMissions vbucks={data.vbucks} theaters={data.theaters} />
      </section>

      <VBucksHistoryPanel
        history={data.vbucksHistory}
        generatedAt={data.meta.generatedAt}
        vbucks={data.vbucks}
      />

      <AlertsBrowser alerts={data.alerts} theaters={data.theaters} onOpen={onOpenReward} />
    </div>
  );
}

// ── meta strip ────────────────────────────────────────────────────────────────

function MetaStrip({ data }: { data: HomeData }) {
  const reset = useCountdown(data.meta.resetAt);
  return (
    <div className="home-meta">
      <span className="home-meta__title">Daily Save the World</span>
      <span className="home-reset" title="Time until the daily mission reset">
        ⏱ resets in <b>{reset}</b>
      </span>
      <span className="sep">·</span>
      <span className="dim">Updated {timeAgo(data.meta.generatedAt)}</span>
      {data.meta.stale && <span className="home-pill home-pill--warn">outdated snapshot</span>}
    </div>
  );
}

// ── V-Bucks available (big indicator) ───────────────────────────────────────────

function VBucksAvailableCard({
  vbucks,
  supercharger,
}: {
  vbucks: VBucksMission[];
  supercharger: Supercharger | null;
}) {
  const total = vbucks.reduce((s, v) => s + v.amount, 0);
  return (
    <div className="vba-card">
      <div className="vba-k">V-Bucks available today</div>
      <div className="vba-num">{total}</div>
      <div className="vba-sub">
        across <b>{vbucks.length}</b> daily mission{vbucks.length === 1 ? "" : "s"}
      </div>
      <div className="vba-divider" />
      <div className="vba-note">
        <span className="vba-star">★</span> V-Bucks &amp; legendary rewards are highlighted across the
        list below.
      </div>
      {supercharger && (
        <div className="vba-sc" title="This week's Supercharger material">
          {supercharger.icon ? (
            <img className="vba-sc__icon" src={supercharger.icon} alt="" />
          ) : (
            <span className="vba-sc__icon vba-sc__icon--ph">⚡</span>
          )}
          <div className="vba-sc__text">
            <span className="vba-sc__k">Weekly Supercharger</span>
            <span className="vba-sc__label">{supercharger.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── today's V-Bucks missions ────────────────────────────────────────────────────

function TodaysVBucksMissions({
  vbucks,
  theaters,
}: {
  vbucks: VBucksMission[];
  theaters: HomeTheater[];
}) {
  const theaterName = useTheaterNames(theaters);
  return (
    <section className="home-panel">
      <div className="home-panel__head">
        <h3>
          <span className="vba-star">★</span> Today's V-Bucks Missions
        </h3>
        <span className="home-panel__badge">{vbucks.length}</span>
      </div>
      {vbucks.length === 0 ? (
        <p className="home-empty">No V-Bucks missions today.</p>
      ) : (
        <div className="tvm-grid">
          {vbucks.map((v) => (
            <div key={v.guid} className="tvm-card">
              <div className="tvm-top">
                <PowerBadge pl={v.powerLevel} />
                <span className="tvm-amount">{v.amount} V-Bucks</span>
              </div>
              <div className="tvm-name">{v.objective ?? "Mission"}</div>
              <div className="tvm-zone">
                <TheaterTag short={v.theaterShort} compact />
                {theaterName.get(v.theaterId) ?? v.theaterShort}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── V-Bucks history ─────────────────────────────────────────────────────────────

function VBucksHistoryPanel({
  history,
  generatedAt,
  vbucks,
}: {
  history: VBucksHistory | undefined;
  generatedAt: string;
  vbucks: VBucksMission[];
}) {
  const cells = useMemo(() => {
    const daily = history?.daily ?? {};
    const official = history?.official;
    const base = generatedAt.slice(0, 10);
    const shift = (date: string, delta: number) => {
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + delta);
      return d.toISOString().slice(0, 10);
    };
    const hasDay = (date: string) => Object.hasOwn(daily, date);
    // sum [offset, offset+n) days back from base (offset 0 = window ending today)
    const windowSum = (n: number, offset: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += daily[shift(base, -(i + offset))] ?? 0;
      return s;
    };
    const hasWindow = (n: number, offset: number) => {
      for (let i = 0; i < n; i++) {
        if (!hasDay(shift(base, -(i + offset)))) return false;
      }
      return true;
    };
    const yearSum = Object.entries(daily)
      .filter(([d]) => d.startsWith(base.slice(0, 4)))
      .reduce((s, [, v]) => s + v, 0);
    const todayDate = base;
    const yesterdayDate = shift(base, -1);
    const today = hasDay(todayDate)
      ? daily[todayDate]
      : official?.asOf === base
        ? official.today
        : history?.today ?? vbucks.reduce((s, v) => s + v.amount, 0);
    const yesterday = hasDay(yesterdayDate)
      ? daily[yesterdayDate]
      : official?.asOf === base
        ? official.yesterday
        : 0;
    const real7 = windowSum(7, 0);
    const real30 = windowSum(30, 0);
    const has7 = hasWindow(7, 0);
    const has30 = hasWindow(30, 0);
    const previous7 = hasWindow(7, 7) ? windowSum(7, 7) : null;
    const previous30 = hasWindow(30, 30) ? windowSum(30, 30) : null;
    const officialYear =
      official && official.asOf.startsWith(base.slice(0, 4))
        ? official.thisYear +
          Object.entries(daily)
            .filter(([date]) => date > official.asOf && date.startsWith(base.slice(0, 4)))
            .reduce((sum, [, value]) => sum + value, 0)
        : null;

    const cells = [
      { k: "Today", v: today, delta: null as Delta | null, today: true },
      { k: "Yesterday", v: yesterday, delta: null as Delta | null, today: false },
      {
        k: "Last 7 days",
        v: has7 ? real7 : official?.last7Days ?? real7,
        delta: has7 && previous7 !== null ? pctDelta(real7, previous7) : null,
        today: false,
      },
      {
        k: "Last 30 days",
        v: has30 ? real30 : official?.last30Days ?? real30,
        delta: has30 && previous30 !== null ? pctDelta(real30, previous30) : null,
        today: false,
      },
      {
        k: "This year",
        v: officialYear ?? yearSum,
        delta: null as Delta | null,
        today: false,
      },
    ];
    return cells;
  }, [history, generatedAt, vbucks]);

  return (
    <section className="home-panel">
      <div className="home-panel__head">
        <h3>V-Bucks Missions History</h3>
      </div>
      <div className="vbh-grid">
        {cells.map((s) => (
          <div key={s.k} className={`vbh-cell ${s.today ? "vbh-cell--today" : ""}`}>
            <div className="vbh-k">{s.k}</div>
            <div className="vbh-v">
              <span className="vb-coin" aria-hidden>
                V
              </span>
              {fmtNum(s.v)}
            </div>
            <div className="vbh-delta" style={s.delta ? { color: s.delta.color } : undefined}>
              {s.delta ? `${s.delta.up ? "▲" : "▼"} ${s.delta.pct}` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Delta {
  up: boolean;
  pct: string;
  color: string;
}
function pctDelta(current: number, prev: number): Delta | null {
  if (!prev) return null;
  const ratio = (current - prev) / prev;
  if (Math.abs(ratio) < 0.005) return null;
  const up = ratio > 0;
  return {
    up,
    pct: `${Math.abs(Math.round(ratio * 1000) / 10)}%`,
    color: up ? "var(--r-uncommon)" : "var(--r-legendary)",
  };
}

// ── alerts browser (sidebar + tabular list) ─────────────────────────────────────

const FILTER_KINDS: { key: RewardKind; label: string }[] = [
  { key: "vbucks", label: "V-Bucks" },
  { key: "hero", label: "Heroes" },
  { key: "survivor", label: "Survivors" },
  { key: "defender", label: "Defenders" },
  { key: "schematic", label: "Schematics" },
  { key: "perkup", label: "Perk-Up" },
  { key: "reperk", label: "RE-PERK" },
  { key: "evomat", label: "Evo Mats" },
  { key: "elemental", label: "Elemental" },
  { key: "flux", label: "Flux" },
];
const FILTER_RARITIES: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
const CAP = 120;

type SortMode = "vb" | "pdesc" | "pasc";
const SORT_LABEL: Record<SortMode, string> = {
  vb: "V-Bucks → Power",
  pdesc: "Power: high → low",
  pasc: "Power: low → high",
};
const SORT_ORDER: SortMode[] = ["vb", "pdesc", "pasc"];

function AlertsBrowser({
  alerts,
  theaters,
  onOpen,
}: {
  alerts: AlertLite[];
  theaters: HomeTheater[];
  onOpen?: (kind: RewardKind, name: string) => void;
}) {
  const theaterName = useTheaterNames(theaters);
  const theaterShort = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of theaters) m.set(t.id, t.short);
    return m;
  }, [theaters]);

  // power bounds derived from the data
  const [plMin, plMax] = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const a of alerts) {
      if (a.powerLevel == null) continue;
      lo = Math.min(lo, a.powerLevel);
      hi = Math.max(hi, a.powerLevel);
    }
    if (!Number.isFinite(lo)) return [1, 160];
    return [lo, hi];
  }, [alerts]);

  const [zones, setZones] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<Set<RewardKind>>(new Set());
  const [rarities, setRarities] = useState<Set<Rarity>>(new Set());
  const [vbucksOnly, setVbucksOnly] = useState(false);
  const [legendaryOnly, setLegendaryOnly] = useState(false);
  const [power, setPower] = useState<[number, number]>([plMin, plMax]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("vb");

  // pre-compute each alert's headline reward once
  const enriched = useMemo(
    () =>
      alerts.map((a) => {
        const key = pickKeyReward(a);
        return {
          a,
          key,
          rarity: key?.rarity,
          haystack: `${a.objective ?? ""} ${a.rewards.map((r) => r.label).join(" ")} ${
            theaterName.get(a.theaterId) ?? ""
          }`.toLowerCase(),
        };
      }),
    [alerts, theaterName],
  );

  const rarityCounts = useMemo(() => {
    const m = new Map<Rarity, number>();
    for (const e of enriched) if (e.rarity) m.set(e.rarity, (m.get(e.rarity) ?? 0) + 1);
    return m;
  }, [enriched]);

  const powerNarrowed = power[0] > plMin || power[1] < plMax;
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const out = enriched.filter((e) => {
      const { a } = e;
      if (vbucksOnly && !a.hasVbucks) return false;
      if (legendaryOnly && e.rarity !== "legendary") return false;
      if (zones.size && !zones.has(a.theaterId)) return false;
      if (kinds.size && !a.rewards.some((r) => kinds.has(r.kind))) return false;
      if (rarities.size && !(e.rarity && rarities.has(e.rarity))) return false;
      if (powerNarrowed) {
        const pl = a.powerLevel ?? 0;
        if (pl < power[0] || pl > power[1]) return false;
      }
      if (q && !e.haystack.includes(q)) return false;
      return true;
    });
    out.sort((x, y) => {
      if (sort === "vb" && x.a.hasVbucks !== y.a.hasVbucks) return x.a.hasVbucks ? -1 : 1;
      const px = x.a.powerLevel ?? -1;
      const py = y.a.powerLevel ?? -1;
      return sort === "pasc" ? px - py : py - px;
    });
    return out;
  }, [enriched, vbucksOnly, legendaryOnly, zones, kinds, rarities, powerNarrowed, power, q, sort]);

  const shown = filtered.slice(0, CAP);

  const hasFilters =
    zones.size || kinds.size || rarities.size || vbucksOnly || legendaryOnly || powerNarrowed || q;
  const reset = () => {
    setZones(new Set());
    setKinds(new Set());
    setRarities(new Set());
    setVbucksOnly(false);
    setLegendaryOnly(false);
    setPower([plMin, plMax]);
    setQuery("");
  };

  return (
    <section className="ab2">
      <div className="ab2-head">
        <h3>All Mission Alerts</h3>
        <span className="dim">
          {alerts.length} alerts · sorted: {SORT_LABEL[sort]}
        </span>
      </div>

      <div className="ab2-body">
        {/* ── filter sidebar ── */}
        <aside className="abf">
          <div className="abf-title">Filters</div>

          <div className="abf-h">Zone</div>
          <div className="abf-chips">
            {theaters.map((t) => (
              <Chip key={t.id} on={zones.has(t.id)} onClick={() => setZones(toggle(zones, t.id))}>
                {t.name}
              </Chip>
            ))}
          </div>

          <div className="abf-h">Rarity</div>
          <div className="abf-rar">
            {FILTER_RARITIES.map((r) => {
              const count = rarityCounts.get(r) ?? 0;
              const on = rarities.has(r);
              return (
                <button
                  key={r}
                  type="button"
                  className={`abf-rar__row ${on ? "on" : ""}`}
                  onClick={() => setRarities(toggle(rarities, r))}
                  disabled={count === 0 && !on}
                >
                  <span className="abf-rar__box" style={{ background: rarityVar(r) }} />
                  <span className="abf-rar__label" style={{ color: rarityVar(r) }}>
                    {r}
                  </span>
                  <span className="abf-rar__count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="abf-h">Reward type</div>
          <div className="abf-chips">
            {FILTER_KINDS.map((k) => (
              <Chip
                key={k.key}
                on={kinds.has(k.key)}
                onClick={() => setKinds(toggle(kinds, k.key))}
                color={k.key === "vbucks" ? "var(--gold)" : undefined}
              >
                {k.label}
              </Chip>
            ))}
          </div>

          <div className="abf-h">Power range</div>
          <div className="abf-range">
            <div className="abf-range__val">
              ⚡{power[0]} – ⚡{power[1]}
            </div>
            <input
              type="range"
              min={plMin}
              max={plMax}
              value={power[0]}
              onChange={(e) =>
                setPower(([, hi]) => [Math.min(Number(e.target.value), hi), hi])
              }
              aria-label="Minimum power"
            />
            <input
              type="range"
              min={plMin}
              max={plMax}
              value={power[1]}
              onChange={(e) =>
                setPower(([lo]) => [lo, Math.max(Number(e.target.value), lo)])
              }
              aria-label="Maximum power"
            />
          </div>

          <div className="abf-h">Presets</div>
          <div className="abf-chips">
            <Chip on={vbucksOnly} onClick={() => setVbucksOnly((v) => !v)} color="var(--gold)">
              ★ Only V-Bucks
            </Chip>
            <Chip
              on={legendaryOnly}
              onClick={() => setLegendaryOnly((v) => !v)}
              color="var(--r-legendary)"
            >
              Only Legendary
            </Chip>
          </div>

          <button type="button" className="abf-reset" onClick={reset} disabled={!hasFilters}>
            Reset filters
          </button>
        </aside>

        {/* ── results ── */}
        <div className="abl">
          <div className="abl-tools">
            <span className="abl-search">
              <span className="abl-search__ico" aria-hidden>
                🔍
              </span>
              <input
                type="search"
                placeholder="search missions, rewards, zones…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
            <button
              type="button"
              className="abl-sort"
              onClick={() => setSort((s) => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length])}
              title="Change sort order"
            >
              Sort: {SORT_LABEL[sort]} ▾
            </button>
          </div>

          <div className="abl-active">
            {vbucksOnly && (
              <ActiveChip color="var(--gold)" onClear={() => setVbucksOnly(false)}>
                ★ V-Bucks
              </ActiveChip>
            )}
            {legendaryOnly && (
              <ActiveChip color="var(--r-legendary)" onClear={() => setLegendaryOnly(false)}>
                Legendary
              </ActiveChip>
            )}
            {[...zones].map((id) => (
              <ActiveChip key={id} onClear={() => setZones(toggle(zones, id))}>
                {theaterName.get(id) ?? id}
              </ActiveChip>
            ))}
            {[...rarities].map((r) => (
              <ActiveChip key={r} color={rarityVar(r)} onClear={() => setRarities(toggle(rarities, r))}>
                {r}
              </ActiveChip>
            ))}
            {[...kinds].map((k) => (
              <ActiveChip key={k} onClear={() => setKinds(toggle(kinds, k))}>
                {FILTER_KINDS.find((f) => f.key === k)?.label ?? k}
              </ActiveChip>
            ))}
            {powerNarrowed && (
              <ActiveChip onClear={() => setPower([plMin, plMax])}>
                ⚡{power[0]}–{power[1]}
              </ActiveChip>
            )}
            <span className="abl-count dim">
              {filtered.length === alerts.length
                ? `${alerts.length} shown`
                : `${filtered.length} of ${alerts.length} shown`}
              {filtered.length > CAP ? ` · top ${CAP}` : ""}
            </span>
          </div>

          <div className="abl-header">
            <span>⚡ Power</span>
            <span>📍 Zone</span>
            <span>Mission</span>
            <span>Key reward</span>
            <span>Rarity</span>
            <span className="abl-vbcol">V-Bucks</span>
          </div>

          <div className="abl-rows">
            {shown.length === 0 ? (
              <p className="home-empty">No alerts match these filters.</p>
            ) : (
              shown.map((e) => (
                <AlertRow
                  key={e.a.guid}
                  alert={e.a}
                  keyReward={e.key}
                  zone={theaterName.get(e.a.theaterId) ?? ""}
                  short={theaterShort.get(e.a.theaterId) ?? "?"}
                  onOpen={onOpen}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AlertRow({
  alert,
  keyReward,
  zone,
  short,
  onOpen,
}: {
  alert: AlertLite;
  keyReward: RewardRef | null;
  zone: string;
  short: string;
  onOpen?: (kind: RewardKind, name: string) => void;
}) {
  const vb = alert.hasVbucks;
  const legendary = keyReward?.rarity === "legendary";
  const clickable = !!onOpen && keyReward != null && NAMED.has(keyReward.kind);
  return (
    <div className={`abl-row ${vb ? "abl-row--vb" : ""} ${!vb && legendary ? "abl-row--leg" : ""}`}>
      <span className="abl-power">
        <PowerBadge pl={alert.powerLevel} />
      </span>
      <span className="abl-zone">
        <TheaterTag short={short} compact />
        <span className="abl-zone__name">{zone}</span>
      </span>
      <span className="abl-name">{alert.objective ?? alert.category}</span>
      <span className="abl-reward">
        {keyReward ? (
          clickable ? (
            <button
              type="button"
              className="abl-reward__link"
              onClick={() => onOpen!(keyReward.kind, keyReward.label)}
              title={`Open ${keyReward.label} in the Collection Book`}
            >
              <RewardGlyph icon={keyReward.icon} rarity={keyReward.rarity} fallback={keyReward.label} />
              <span className="abl-reward__name">{keyReward.label}</span>
            </button>
          ) : (
            <>
              <RewardGlyph icon={keyReward.icon} rarity={keyReward.rarity} fallback={keyReward.label} />
              <span className="abl-reward__name">
                {keyReward.quantity > 1 ? `${fmtNum(keyReward.quantity)}× ` : ""}
                {keyReward.label}
              </span>
            </>
          )
        ) : (
          <span className="dim">—</span>
        )}
      </span>
      <span className="abl-rarity">
        {keyReward?.rarity ? (
          <span
            className="rar-pill"
            style={{ color: rarityVar(keyReward.rarity), borderColor: rarityVar(keyReward.rarity) }}
          >
            {keyReward.rarity}
          </span>
        ) : (
          <span className="dim">—</span>
        )}
      </span>
      <span className={`abl-vb ${vb ? "is-vb" : ""}`}>{vb ? `+${alert.vbucks}` : "—"}</span>
    </div>
  );
}

// ── shared bits ─────────────────────────────────────────────────────────────────

function ActiveChip({
  children,
  color,
  onClear,
}: {
  children: React.ReactNode;
  color?: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      className="abl-chip"
      style={color ? { borderColor: color, color } : undefined}
      onClick={onClear}
    >
      {children} <span className="abl-chip__x">✕</span>
    </button>
  );
}

function RewardGlyph({ icon, rarity, fallback }: { icon?: string | null; rarity?: Rarity; fallback: string }) {
  if (icon) return <img className="rw-icon" src={icon} alt="" loading="lazy" />;
  return (
    <span className="rw-icon rw-icon--ph" style={{ background: rarity ? rarityVar(rarity) : "var(--navy-3)" }}>
      {fallback.slice(0, 1)}
    </span>
  );
}

function PowerBadge({ pl }: { pl: number | null }) {
  return (
    <span className="pl-badge" title="Recommended power level">
      ⚡{pl ?? "?"}
    </span>
  );
}

function TheaterTag({ short, compact }: { short: string; compact?: boolean }) {
  const main = (MAIN_SHORTS as readonly string[]).includes(short);
  return (
    <span className={`th-tag ${main ? "th-tag--main" : "th-tag--vent"} ${compact ? "th-tag--c" : ""}`}>{short}</span>
  );
}

function Chip({
  on,
  onClick,
  color,
  children,
}: {
  on: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`home-chip ${on ? "on" : ""}`}
      style={on && color ? { borderColor: color, color } : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────────

/** Reward kinds that exist in the Collection Book (so we can click through to them). */
const NAMED = new Set<RewardKind>(["hero", "survivor", "defender", "schematic"]);

// Priority for choosing an alert's headline ("key") reward — named collectibles
// first, then the meaningful upgrade currencies. Filler (xp, tickets, vbucks) is
// excluded so the column stays informative.
const KEY_RANK: Partial<Record<RewardKind, number>> = {
  hero: 0,
  schematic: 1,
  defender: 2,
  survivor: 3,
  perkup: 4,
  reperk: 5,
  elemental: 6,
  evomat: 7,
  flux: 8,
  cardpack: 9,
  resource: 10,
};
const RARITY_RANK: Record<Rarity, number> = {
  mythic: 0,
  legendary: 1,
  epic: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
};

function pickKeyReward(a: AlertLite): RewardRef | null {
  let best: RewardRef | null = null;
  let bestScore = Infinity;
  for (const r of a.rewards) {
    const rank = KEY_RANK[r.kind];
    if (rank == null) continue;
    const rr = r.rarity ? RARITY_RANK[r.rarity] : 9;
    const score = rank * 10 + rr;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best ?? a.rewards[0] ?? null;
}

function useTheaterNames(theaters: HomeTheater[]): Map<string, string> {
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const t of theaters) m.set(t.id, t.name);
    return m;
  }, [theaters]);
}

function rarityVar(r?: Rarity): string {
  return r ? `var(--r-${r})` : "var(--text-mute)";
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Ticks every second so the countdown stays live. The reset target comes from
// the data's `resetAt` (Epic's next world refresh, 00:00 UTC). Until the data
// actually refreshes past that instant we show "soon" rather than a fake clock.
function useCountdown(iso: string): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "soon";
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
