// Daily "Home" data contract — mirror of live-data/src/types.ts.
// Generated once per day and served as static JSON with the rest of the site.

import { useEffect, useState } from "react";

import type { Rarity } from "../types";

export type TheaterKind = "campaign" | "venture" | "special";

export type RewardKind =
  | "vbucks"
  | "perkup"
  | "reperk"
  | "elemental"
  | "evomat"
  | "flux"
  | "tickets"
  | "ventureXp"
  | "xp"
  | "hero"
  | "survivor"
  | "defender"
  | "schematic"
  | "cardpack"
  | "resource"
  | "other";

export interface RewardRef {
  templateId: string;
  kind: RewardKind;
  label: string;
  rarity?: Rarity;
  quantity: number;
  level?: number;
  icon?: string | null;
}

export interface ModifierRef {
  templateId: string;
  label: string;
  icon?: string | null;
}

export interface HomeTheater {
  id: string;
  name: string;
  short: string;
  kind: TheaterKind;
  order: number;
  event?: string;
}

export interface VBucksMission {
  guid: string;
  theaterId: string;
  theaterShort: string;
  tileIndex: number;
  objective: string | null;
  powerLevel: number | null;
  amount: number;
}

export interface AlertSummaryRow {
  key: string;
  kind: RewardKind;
  label: string;
  rarity?: Rarity;
  perTheater: Record<string, number>;
  total: number;
  icon?: string | null;
}

export interface HonorableReward {
  guid: string;
  theaterId: string;
  theaterShort: string;
  kind: RewardKind;
  templateId: string;
  label: string;
  rarity?: Rarity;
  level?: number;
  powerLevel: number | null;
}

export interface AlertLite {
  guid: string;
  theaterId: string;
  tileIndex: number;
  category: string;
  objective: string | null;
  objectiveCode: string | null;
  powerLevel: number | null;
  rewards: RewardRef[];
  modifiers: ModifierRef[];
  hasVbucks: boolean;
  vbucks: number;
}

export interface MissionLite {
  guid: string;
  theaterId: string;
  tileIndex: number;
  objective: string;
  objectiveCode: string;
  powerLevel: number | null;
  difficultyRow: string;
  rewards: RewardRef[];
}

export interface Supercharger {
  templateId: string;
  label: string;
  icon?: string | null;
}

export interface VBucksHistory {
  today: number;
  daily: Record<string, number>;
}

export interface HomeMeta {
  generatedAt: string;
  expiresAt: string;
  resetAt: string;
  source: string;
  version: number;
  stale: boolean;
}

export interface HomeData {
  meta: HomeMeta;
  theaters: HomeTheater[];
  vbucks: VBucksMission[];
  vbucksHistory?: VBucksHistory;
  supercharger?: Supercharger | null;
  alertSummary: AlertSummaryRow[];
  honorable: HonorableReward[];
  alerts: AlertLite[];
  missions: MissionLite[];
}

const HOME_URL = `${import.meta.env.BASE_URL}data/home.json`;

export async function loadHome(): Promise<HomeData> {
  const res = await fetch(HOME_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Live data unavailable (${res.status}).`);
  const home = (await res.json()) as HomeData;
  home.meta.stale = Date.now() > Date.parse(home.meta.expiresAt);
  return home;
}

export function useHomeData(): { data: HomeData | null; error: string | null } {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadHome()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return { data, error };
}
