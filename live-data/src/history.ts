import configuredHistory from "./data/vbucks-history.json";
import type {
  HomeData,
  VBucksHistory,
  VBucksHistoryOfficial,
} from "./types";

interface VBucksHistoryConfig extends VBucksHistoryOfficial {
  daily: Record<string, number>;
}

const configured = configuredHistory as VBucksHistoryConfig;

/**
 * Carry automatic snapshots forward, then apply committed manual corrections.
 * The current Epic total fills a date only when it has not been manually set.
 */
export function buildVBucksHistory(
  home: HomeData,
  previous?: HomeData,
): VBucksHistory {
  const day = home.meta.generatedAt.slice(0, 10);
  const collectedToday = home.vbucks.reduce(
    (sum, mission) => sum + mission.amount,
    0,
  );
  const daily = {
    ...(previous?.vbucksHistory?.daily ?? {}),
    [day]: collectedToday,
    ...configured.daily,
  };

  return {
    today: daily[day] ?? collectedToday,
    daily,
    official: {
      asOf: configured.asOf,
      today: configured.today,
      yesterday: configured.yesterday,
      last7Days: configured.last7Days,
      last30Days: configured.last30Days,
      thisYear: configured.thisYear,
    },
  };
}
