import { useMemo, useState } from "react";

import type {
  AlertLite,
  AlertSummaryRow,
  HomeData,
  HomeTheater,
  HonorableReward,
  ModifierRef,
  RewardKind,
  RewardRef,
  Supercharger,
  VBucksHistory,
  VBucksMission,
} from "../lib/home";
import { useHomeData } from "../lib/home";
import type { Rarity } from "../types";

// V-Bucks history seed (FortniteDB reference) — a v1 placeholder shown for the
// longer windows until the Worker's KV `daily` history accumulates real data.
const VBUCKS_SEED = { last7: 250, last30: 400, year: 4900 };

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
          Run <code>npm run build:home:fixture -w worker</code> to generate{" "}
          <code>web/public/data/home.json</code> for local dev, or point{" "}
          <code>VITE_HOME_URL</code> at the deployed Worker.
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
      <div className="home-grid">
        <VBucksPanel vbucks={data.vbucks} />
        <VBucksHistoryPanel history={data.vbucksHistory} generatedAt={data.meta.generatedAt} vbucks={data.vbucks} />
        <SuperchargerCard sc={data.supercharger ?? null} />
        <AlertSummaryPanel rows={data.alertSummary} />
        <HonorablePanel items={data.honorable} onOpen={onOpenReward} />
        {/* span layout: VBucks(2)+History(3)+Supercharger(1) | Summary(4)+Honorable(2) */}
      </div>
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
      <span className="dim">Updated {timeAgo(data.meta.generatedAt)}</span>
      <span className="sep">·</span>
      <span className="dim">Resets in {reset}</span>
      {data.meta.stale && <span className="home-pill home-pill--warn">stale — refreshing…</span>}
    </div>
  );
}

// ── V-Bucks missions ──────────────────────────────────────────────────────────

function VBucksPanel({ vbucks }: { vbucks: VBucksMission[] }) {
  const total = vbucks.reduce((s, v) => s + v.amount, 0);
  return (
    <Panel className="span-2" title="V-Bucks Missions" badge={total ? `${total} total` : undefined}>
      {vbucks.length === 0 ? (
        <p className="home-empty">No V-Bucks missions today.</p>
      ) : (
        <ul className="vb-list">
          {vbucks.map((v) => (
            <li key={v.guid} className="vb-row">
              <TheaterTag short={v.theaterShort} />
              <PowerBadge pl={v.powerLevel} />
              <span className="vb-amount">{v.amount}× V-Bucks</span>
              <span className="vb-obj dim">{v.objective ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function VBucksHistoryPanel({
  history,
  generatedAt,
  vbucks,
}: {
  history: VBucksHistory | undefined;
  generatedAt: string;
  vbucks: VBucksMission[];
}) {
  const stats = useMemo(() => {
    const daily = history?.daily ?? {};
    const base = generatedAt.slice(0, 10);
    const shift = (date: string, delta: number) => {
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + delta);
      return d.toISOString().slice(0, 10);
    };
    const windowSum = (n: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += daily[shift(base, -i)] ?? 0;
      return s;
    };
    const yearSum = Object.entries(daily)
      .filter(([d]) => d.startsWith(base.slice(0, 4)))
      .reduce((s, [, v]) => s + v, 0);
    const today = history?.today ?? vbucks.reduce((s, v) => s + v.amount, 0);
    return [
      { k: "Today", v: today },
      { k: "Yesterday", v: daily[shift(base, -1)] ?? 0 },
      { k: "Last 7d", v: windowSum(7) || VBUCKS_SEED.last7 },
      { k: "Last 30d", v: windowSum(30) || VBUCKS_SEED.last30 },
      { k: "This Year", v: yearSum || VBUCKS_SEED.year },
    ];
  }, [history, generatedAt, vbucks]);

  return (
    <Panel className="span-3" title="V-Bucks History">
      <div className="vbh-grid">
        {stats.map((s) => (
          <div key={s.k} className="vbh-cell">
            <div className="vbh-k">{s.k}</div>
            <div className="vbh-v">
              <span className="vb-coin" aria-hidden>
                V
              </span>
              {fmtNum(s.v)}
            </div>
          </div>
        ))}
      </div>
      {!history?.daily || Object.keys(history.daily).length <= 1 ? (
        <p className="home-foot dim">Longer windows are seeded; real history accumulates daily.</p>
      ) : null}
    </Panel>
  );
}

// ── supercharger ──────────────────────────────────────────────────────────────

function SuperchargerCard({ sc }: { sc: Supercharger | null }) {
  return (
    <Panel className="span-1" title="Weekly Supercharger">
      {sc ? (
        <div className="sc-card">
          {sc.icon ? <img className="sc-icon" src={sc.icon} alt="" /> : <span className="sc-icon sc-icon--ph">⚡</span>}
          <span className="sc-label">{sc.label}</span>
        </div>
      ) : (
        <p className="home-empty">Not available.</p>
      )}
    </Panel>
  );
}

// ── alert summary ─────────────────────────────────────────────────────────────

function AlertSummaryPanel({ rows }: { rows: AlertSummaryRow[] }) {
  return (
    <Panel className="span-4" title="Alert Summary" subtitle="Reward quantity per zone · total includes Ventures">
      <div className="as-wrap">
        <table className="as-table">
          <thead>
            <tr>
              <th className="as-reward">Reward</th>
              {MAIN_SHORTS.map((s) => (
                <th key={s}>{s}</th>
              ))}
              <th className="as-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="as-reward">
                  <RewardGlyph icon={r.icon} rarity={r.rarity} fallback={r.label} />
                  <span style={{ color: r.rarity ? rarityVar(r.rarity) : undefined }}>{r.label}</span>
                </td>
                {MAIN_SHORTS.map((s) => (
                  <td key={s} className={r.perTheater[s] ? "" : "as-zero"}>
                    {r.perTheater[s] ? fmtNum(r.perTheater[s]) : "0"}
                  </td>
                ))}
                <td className="as-total">{fmtNum(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── honorable rewards ─────────────────────────────────────────────────────────

function HonorablePanel({
  items,
  onOpen,
}: {
  items: HonorableReward[];
  onOpen?: (kind: RewardKind, name: string) => void;
}) {
  const top = items.slice(0, 18);
  return (
    <Panel className="span-2" title="Honorable Rewards" badge={`${items.length}`}>
      {top.length === 0 ? (
        <p className="home-empty">No notable named rewards today.</p>
      ) : (
        <ul className="hr-list">
          {top.map((h, i) => (
            <li
              key={`${h.guid}-${h.templateId}-${i}`}
              className={`hr-row ${onOpen ? "is-link" : ""}`}
              style={{ borderLeftColor: rarityVar(h.rarity) }}
              onClick={onOpen ? () => onOpen(h.kind, h.label) : undefined}
              role={onOpen ? "button" : undefined}
              tabIndex={onOpen ? 0 : undefined}
              onKeyDown={
                onOpen
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onOpen(h.kind, h.label);
                    }
                  : undefined
              }
              title={onOpen ? `Open ${h.label} in the Collection Book` : undefined}
            >
              <PowerBadge pl={h.powerLevel} />
              <TheaterTag short={h.theaterShort} compact />
              <span className="hr-name" style={{ color: rarityVar(h.rarity) }}>
                {h.label}
              </span>
              <span className="hr-kind dim">{KIND_LABEL[h.kind] ?? h.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── alerts drill-down ─────────────────────────────────────────────────────────

const FILTER_KINDS: { key: RewardKind; label: string }[] = [
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
const FILTER_RARITIES: Rarity[] = ["legendary", "epic", "rare", "uncommon"];
const CAP = 80;

function AlertsBrowser({
  alerts,
  theaters,
  onOpen,
}: {
  alerts: AlertLite[];
  theaters: HomeTheater[];
  onOpen?: (kind: RewardKind, name: string) => void;
}) {
  const [zones, setZones] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<Set<RewardKind>>(new Set());
  const [rarities, setRarities] = useState<Set<Rarity>>(new Set());
  const [vbucksOnly, setVbucksOnly] = useState(false);

  const theaterName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of theaters) m.set(t.id, t.name);
    return m;
  }, [theaters]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (vbucksOnly && !a.hasVbucks) return false;
      if (zones.size && !zones.has(a.theaterId)) return false;
      if (kinds.size && !a.rewards.some((r) => kinds.has(r.kind))) return false;
      if (rarities.size && !a.rewards.some((r) => r.rarity && rarities.has(r.rarity))) return false;
      return true;
    });
  }, [alerts, zones, kinds, rarities, vbucksOnly]);

  const shown = filtered.slice(0, CAP);
  const reset = () => {
    setZones(new Set());
    setKinds(new Set());
    setRarities(new Set());
    setVbucksOnly(false);
  };
  const hasFilters = zones.size || kinds.size || rarities.size || vbucksOnly;

  return (
    <section className="home-panel ab">
      <div className="home-panel__head">
        <h3>Mission Alerts</h3>
        <span className="home-panel__sub dim">
          {filtered.length} alerts{filtered.length > CAP ? ` · showing ${CAP}` : ""}
        </span>
      </div>

      <div className="ab-filters">
        <div className="ab-frow">
          {theaters.map((t) => (
            <Chip key={t.id} on={zones.has(t.id)} onClick={() => setZones(toggle(zones, t.id))}>
              {t.name}
            </Chip>
          ))}
        </div>
        <div className="ab-frow">
          {FILTER_KINDS.map((k) => (
            <Chip key={k.key} on={kinds.has(k.key)} onClick={() => setKinds(toggle(kinds, k.key))}>
              {k.label}
            </Chip>
          ))}
        </div>
        <div className="ab-frow">
          {FILTER_RARITIES.map((r) => (
            <Chip key={r} on={rarities.has(r)} onClick={() => setRarities(toggle(rarities, r))} color={rarityVar(r)}>
              {r}
            </Chip>
          ))}
          <Chip on={vbucksOnly} onClick={() => setVbucksOnly((v) => !v)} color="var(--gold)">
            V-Bucks only
          </Chip>
          {hasFilters ? (
            <button type="button" className="ab-reset" onClick={reset}>
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="ab-grid">
        {shown.map((a) => (
          <article key={a.guid} className="ab-card">
            <header className="ab-card__head">
              <PowerBadge pl={a.powerLevel} />
              <span className="ab-card__obj">{a.objective ?? a.category}</span>
              <span className="ab-card__zone dim">{theaterName.get(a.theaterId) ?? ""}</span>
            </header>
            <div className="ab-rewards">
              {a.rewards.map((r, i) => (
                <RewardChip key={`${r.templateId}-${i}`} r={r} onOpen={onOpen} />
              ))}
            </div>
            {a.modifiers.length > 0 && (
              <div className="ab-mods">
                {a.modifiers.map((m, i) => (
                  <ModChip key={`${m.templateId}-${i}`} m={m} />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

// ── shared bits ───────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  badge,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`home-panel ${className ?? ""}`}>
      <div className="home-panel__head">
        <h3>{title}</h3>
        {subtitle && <span className="home-panel__sub dim">{subtitle}</span>}
        {badge && <span className="home-panel__badge">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function RewardChip({ r, onOpen }: { r: RewardRef; onOpen?: (kind: RewardKind, name: string) => void }) {
  const clickable = !!onOpen && NAMED.has(r.kind);
  const border = r.rarity ? rarityVar(r.rarity) : "var(--navy-line)";
  const inner = (
    <>
      <RewardGlyph icon={r.icon} rarity={r.rarity} fallback={r.label} />
      {r.quantity > 1 && <span className="rw-qty">{fmtNum(r.quantity)}</span>}
      <span className="rw-name">{r.label}</span>
      {r.level ? <span className="rw-lvl">lv{r.level}</span> : null}
    </>
  );
  if (clickable) {
    return (
      <button
        type="button"
        className="rw-chip rw-chip--link"
        style={{ borderColor: border }}
        title={`Open ${r.label} in the Collection Book`}
        onClick={() => onOpen!(r.kind, r.label)}
      >
        {inner}
      </button>
    );
  }
  return (
    <span className="rw-chip" style={{ borderColor: border }} title={r.label}>
      {inner}
    </span>
  );
}

function ModChip({ m }: { m: ModifierRef }) {
  return (
    <span className="mod-chip" title={m.label}>
      {m.icon ? <img src={m.icon} alt="" /> : null}
      {m.label}
    </span>
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

// ── helpers ───────────────────────────────────────────────────────────────────

const KIND_LABEL: Partial<Record<RewardKind, string>> = {
  hero: "Hero",
  survivor: "Survivor",
  defender: "Defender",
  schematic: "Schematic",
};

/** Reward kinds that exist in the Collection Book (so we can click through to them). */
const NAMED = new Set<RewardKind>(["hero", "survivor", "defender", "schematic"]);

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

function useCountdown(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "soon";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
