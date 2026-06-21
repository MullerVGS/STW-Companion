// Pure transform: raw Epic world/info (+ optional catalog) -> HomeData contract.
// No I/O, no clock access beyond what the caller injects (`generatedAt`) — so it's
// fully deterministic and testable against a committed fixture.

import {
  CAMPAIGN_THEATERS,
  NAMED_KINDS,
  findSupercharger,
  isMainTheater,
  isPlayerTheater,
  powerLevel,
  rarityFromTemplate,
  resolveModifier,
  resolveObjective,
  resolveReward,
  theaterShort,
} from "./maps";
import type {
  AlertLite,
  AlertSummaryRow,
  HomeData,
  HomeTheater,
  HonorableReward,
  MissionLite,
  RewardRef,
  RewardRegistry,
  Supercharger,
  TheaterKind,
  VBucksMission,
} from "./types";

const VBUCKS_TEMPLATE = "AccountResource:currency_mtxswap";

export interface NormalizeOpts {
  generatedAt: string; // ISO timestamp of collection
  stale?: boolean;
  registry?: RewardRegistry; // reward-registry.json (real names/icons/rarity)
}

export function normalizeHome(
  world: any,
  catalog: any | null,
  opts: NormalizeOpts,
): HomeData {
  const resetAt = firstRefresh(world) ?? opts.generatedAt;

  const theaterRecords: any[] = Array.isArray(world?.theaters) ? world.theaters : [];
  const kept = theaterRecords.filter(isPlayerTheater);
  const keepIds = new Set<string>(kept.map((t) => t.uniqueId));
  const theaters: HomeTheater[] = kept.map(toHomeTheater).sort((a, b) => a.order - b.order);

  // Missions, indexed by theater+tile so alerts can borrow objective/power.
  const missions: MissionLite[] = [];
  const missionByTile = new Map<string, MissionLite>();
  for (const block of arr(world?.missions)) {
    const theaterId = block.theaterId;
    if (!keepIds.has(theaterId)) continue;
    for (const m of arr(block.availableMissions)) {
      const lite = toMission(m, theaterId, opts.registry);
      missions.push(lite);
      missionByTile.set(tileKey(theaterId, lite.tileIndex), lite);
    }
  }

  // Alerts.
  const alerts: AlertLite[] = [];
  for (const block of arr(world?.missionAlerts)) {
    const theaterId = block.theaterId;
    if (!keepIds.has(theaterId)) continue;
    for (const a of arr(block.availableMissionAlerts)) {
      alerts.push(toAlert(a, theaterId, missionByTile, opts.registry));
    }
  }

  const vbucks: VBucksMission[] = alerts
    .filter((a) => a.hasVbucks)
    .map((a) => ({
      guid: a.guid,
      theaterId: a.theaterId,
      theaterShort: theaterShort(a.theaterId),
      tileIndex: a.tileIndex,
      objective: a.objective,
      powerLevel: a.powerLevel,
      amount: a.vbucks,
    }))
    .sort((a, b) => (a.powerLevel ?? 0) - (b.powerLevel ?? 0));

  const honorable = buildHonorable(alerts);
  const alertSummary = buildSummary(alerts);
  const supercharger: Supercharger | null = catalog
    ? findSupercharger(catalog, opts.registry)
    : null;

  return {
    meta: {
      generatedAt: opts.generatedAt,
      expiresAt: resetAt,
      resetAt,
      source: "epic:world/info",
      version: 1,
      stale: opts.stale ?? false,
    },
    theaters,
    vbucks,
    supercharger,
    alertSummary,
    honorable,
    alerts,
    missions,
  };
}

// ── element builders ─────────────────────────────────────────────────────────

function toHomeTheater(t: any): HomeTheater {
  const id: string = t.uniqueId;
  const name = String(t.displayName ?? id);
  const campaign = CAMPAIGN_THEATERS[id];
  if (campaign) {
    return { id, name: campaign.name, short: campaign.short, kind: "campaign", order: campaign.order };
  }
  const kind: TheaterKind = isVenture(t) ? "venture" : "special";
  return {
    id,
    name,
    short: "VENT",
    kind,
    order: 10,
    event: eventTag(t),
  };
}

function toMission(m: any, theaterId: string, registry?: RewardRegistry): MissionLite {
  const { code, name } = resolveObjective(m.missionGenerator, registry);
  const difficultyRow = m?.missionDifficultyInfo?.rowName ?? "";
  return {
    guid: m.missionGuid,
    theaterId,
    tileIndex: m.tileIndex ?? -1,
    objective: name,
    objectiveCode: code,
    powerLevel: powerLevel(difficultyRow),
    difficultyRow,
    rewards: toRewards(m?.missionRewards?.items, registry),
  };
}

function toAlert(
  a: any,
  theaterId: string,
  missionByTile: Map<string, MissionLite>,
  registry?: RewardRegistry,
): AlertLite {
  const tileIndex = a.tileIndex ?? -1;
  const mission = missionByTile.get(tileKey(theaterId, tileIndex));
  const rewards = toRewards(a?.missionAlertRewards?.items, registry);
  const vbItem = (a?.missionAlertRewards?.items ?? []).find(
    (it: any) => it.itemType === VBUCKS_TEMPLATE,
  );
  return {
    guid: a.missionAlertGuid,
    theaterId,
    tileIndex,
    category: a.categoryName ?? "",
    objective: mission?.objective ?? null,
    objectiveCode: mission?.objectiveCode ?? null,
    powerLevel: mission?.powerLevel ?? null,
    rewards,
    modifiers: arr(a?.missionAlertModifiers?.items).map((it: any) =>
      resolveModifier(it.itemType, registry),
    ),
    hasVbucks: !!vbItem,
    vbucks: vbItem?.quantity ?? 0,
  };
}

function toRewards(items: any, registry?: RewardRegistry): RewardRef[] {
  return arr(items).map((it: any): RewardRef => {
    const resolved = resolveReward(it.itemType, registry);
    const ref: RewardRef = {
      templateId: it.itemType,
      kind: resolved.kind,
      label: resolved.label,
      quantity: it.quantity ?? 1,
    };
    if (resolved.rarity) ref.rarity = resolved.rarity;
    if (resolved.icon) ref.icon = resolved.icon;
    const level = it?.attributes?.desired_level;
    if (typeof level === "number") ref.level = level;
    return ref;
  });
}

function buildHonorable(alerts: AlertLite[]): HonorableReward[] {
  const out: HonorableReward[] = [];
  for (const a of alerts) {
    for (const r of a.rewards) {
      if (!NAMED_KINDS.has(r.kind)) continue;
      out.push({
        guid: a.guid,
        theaterId: a.theaterId,
        theaterShort: theaterShort(a.theaterId),
        kind: r.kind,
        templateId: r.templateId,
        label: r.label,
        rarity: r.rarity ?? rarityFromTemplate(r.templateId),
        level: r.level,
        powerLevel: a.powerLevel,
      });
    }
  }
  // Strongest first (rarity then power).
  const rank: Record<string, number> = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
  return out.sort(
    (a, b) =>
      (rank[b.rarity ?? ""] ?? 0) - (rank[a.rarity ?? ""] ?? 0) ||
      (b.powerLevel ?? 0) - (a.powerLevel ?? 0),
  );
}

function buildSummary(alerts: AlertLite[]): AlertSummaryRow[] {
  const rows = new Map<string, AlertSummaryRow>();
  for (const a of alerts) {
    const short = theaterShort(a.theaterId);
    const main = isMainTheater(a.theaterId);
    for (const r of a.rewards) {
      // Only aggregate fungible rewards (resources/currencies/xp), not named loot.
      if (NAMED_KINDS.has(r.kind)) continue;
      let row = rows.get(r.templateId);
      if (!row) {
        row = {
          key: r.templateId,
          kind: r.kind,
          label: r.label,
          perTheater: { SW: 0, PT: 0, CV: 0, TP: 0 },
          total: 0,
        };
        if (r.rarity) row.rarity = r.rarity;
        rows.set(r.templateId, row);
      }
      if (main) row.perTheater[short] = (row.perTheater[short] ?? 0) + r.quantity;
      row.total += r.quantity;
    }
  }
  const order: Record<string, number> = {
    vbucks: 0,
    perkup: 1,
    reperk: 2,
    elemental: 3,
    evomat: 4,
    flux: 5,
    tickets: 6,
    ventureXp: 7,
    xp: 8,
    resource: 9,
    cardpack: 10,
    other: 11,
  };
  return [...rows.values()].sort(
    (a, b) => (order[a.kind] ?? 99) - (order[b.kind] ?? 99) || b.total - a.total,
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function arr<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function tileKey(theaterId: string, tile: number): string {
  return `${theaterId}:${tile}`;
}

function firstRefresh(world: any): string | null {
  for (const block of arr(world?.missions)) if (block.nextRefresh) return block.nextRefresh;
  for (const block of arr(world?.missionAlerts)) if (block.nextRefresh) return block.nextRefresh;
  return null;
}

function isVenture(t: any): boolean {
  const weights = String(t?.missionRewardNamedWeightsRowName ?? "");
  if (weights.startsWith("Theater.Phoenix")) return true;
  const tags = t?.runtimeInfo?.theaterTags?.gameplayTags ?? [];
  return tags.some((g: any) => /phoenix|venture/i.test(g?.tagName ?? ""));
}

function eventTag(t: any): string | undefined {
  const tags = t?.runtimeInfo?.theaterTags?.gameplayTags ?? [];
  for (const g of tags) {
    const name = String(g?.tagName ?? "");
    const m = name.match(/Stat\.Theater\.([A-Za-z0-9]+)/);
    if (m) return m[1];
  }
  return undefined;
}
