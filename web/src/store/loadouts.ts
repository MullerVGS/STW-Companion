/**
 * Hero Loadout planner state: a list of named loadouts (commander + 5 support
 * heroes + a team perk + 2 gadgets), persisted to localStorage. Mirrors the
 * collection store: imperative mutators + useSyncExternalStore hooks so a
 * component subscribes to just the slice it needs.
 *
 * Only ids are stored — the actual Hero / TeamPerk / Gadget records are resolved
 * against the loaded Dataset at render time (same id-keyed philosophy as the
 * collection store).
 */

import { useSyncExternalStore } from "react";

const KEY = "stw-loadouts-v1";

export const SUPPORT_SLOTS = 5;
export const GADGET_SLOTS = 2;

/** Which slot a mutation targets. `index` matters only for support/gadget. */
export type SlotKind = "commander" | "support" | "teamPerk" | "gadget";

export interface Loadout {
  id: string;
  name: string;
  commanderId: string | null;
  /** length === SUPPORT_SLOTS */
  supportIds: (string | null)[];
  teamPerkId: string | null;
  /** length === GADGET_SLOTS */
  gadgetIds: (string | null)[];
}

export interface LoadoutsState {
  loadouts: Loadout[];
  activeId: string;
}

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ld_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

function emptyLoadout(name: string): Loadout {
  return {
    id: uid(),
    name,
    commanderId: null,
    supportIds: Array(SUPPORT_SLOTS).fill(null),
    teamPerkId: null,
    gadgetIds: Array(GADGET_SLOTS).fill(null),
  };
}

/** Repair a parsed loadout so slot arrays always have the expected length. */
function normalize(l: Partial<Loadout>, i: number): Loadout {
  const fixLen = (arr: unknown, len: number): (string | null)[] => {
    const out = Array.isArray(arr) ? arr.slice(0, len).map((x) => (typeof x === "string" ? x : null)) : [];
    while (out.length < len) out.push(null);
    return out;
  };
  return {
    id: typeof l.id === "string" && l.id ? l.id : uid(),
    name: typeof l.name === "string" && l.name.trim() ? l.name : `Loadout ${i + 1}`,
    commanderId: typeof l.commanderId === "string" ? l.commanderId : null,
    supportIds: fixLen(l.supportIds, SUPPORT_SLOTS),
    teamPerkId: typeof l.teamPerkId === "string" ? l.teamPerkId : null,
    gadgetIds: fixLen(l.gadgetIds, GADGET_SLOTS),
  };
}

function seed(): LoadoutsState {
  const first = emptyLoadout("Loadout 1");
  return { loadouts: [first], activeId: first.id };
}

function load(): LoadoutsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as Partial<LoadoutsState>;
    const loadouts = Array.isArray(parsed.loadouts) ? parsed.loadouts.map(normalize) : [];
    if (loadouts.length === 0) return seed();
    const activeId = loadouts.some((l) => l.id === parsed.activeId)
      ? (parsed.activeId as string)
      : loadouts[0].id;
    return { loadouts, activeId };
  } catch {
    return seed();
  }
}

let state: LoadoutsState = load();
const listeners = new Set<() => void>();

function commit(next: LoadoutsState): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — keep working in-memory */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Replace the active loadout via an updater, keeping the rest untouched. */
function updateActive(fn: (l: Loadout) => Loadout): void {
  commit({
    ...state,
    loadouts: state.loadouts.map((l) => (l.id === state.activeId ? fn(l) : l)),
  });
}

// --- imperative API ---

export function getState(): LoadoutsState {
  return state;
}

export function getActiveLoadout(): Loadout {
  return state.loadouts.find((l) => l.id === state.activeId) ?? state.loadouts[0];
}

/** Next "Loadout N" name that avoids colliding with existing numbered names. */
function nextName(): string {
  let max = 0;
  for (const l of state.loadouts) {
    const m = /^Loadout (\d+)$/.exec(l.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Loadout ${Math.max(max, state.loadouts.length) + 1}`;
}

export function createLoadout(): string {
  const l = emptyLoadout(nextName());
  commit({ loadouts: [...state.loadouts, l], activeId: l.id });
  return l.id;
}

export function deleteLoadout(id: string): void {
  const remaining = state.loadouts.filter((l) => l.id !== id);
  const loadouts = remaining.length > 0 ? remaining : [emptyLoadout("Loadout 1")];
  const activeId = loadouts.some((l) => l.id === state.activeId) ? state.activeId : loadouts[0].id;
  commit({ loadouts, activeId });
}

export function renameLoadout(id: string, name: string): void {
  const clean = name.trim();
  if (!clean) return;
  commit({ ...state, loadouts: state.loadouts.map((l) => (l.id === id ? { ...l, name: clean } : l)) });
}

export function setActive(id: string): void {
  if (state.loadouts.some((l) => l.id === id)) commit({ ...state, activeId: id });
}

export function setSlot(kind: SlotKind, index: number, itemId: string | null): void {
  updateActive((l) => {
    switch (kind) {
      case "commander":
        return { ...l, commanderId: itemId };
      case "teamPerk":
        return { ...l, teamPerkId: itemId };
      case "support": {
        const supportIds = l.supportIds.slice();
        supportIds[index] = itemId;
        return { ...l, supportIds };
      }
      case "gadget": {
        const gadgetIds = l.gadgetIds.slice();
        gadgetIds[index] = itemId;
        return { ...l, gadgetIds };
      }
      default:
        return l;
    }
  });
}

export function clearActiveLoadout(): void {
  updateActive((l) => ({ ...emptyLoadout(l.name), id: l.id }));
}

// --- React hooks ---

/** Whole loadout state (list + active id) — for the loadout screen header. */
export function useLoadoutsState(): LoadoutsState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** The active loadout object (stable reference until it changes). */
export function useActiveLoadout(): Loadout {
  return useSyncExternalStore(subscribe, getActiveLoadout, getActiveLoadout);
}
