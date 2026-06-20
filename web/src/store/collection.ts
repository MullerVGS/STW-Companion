/**
 * Collection state: which items you own and how many duplicates.
 * Persisted to localStorage. Exposed via useSyncExternalStore so components can
 * subscribe to just the slice they need (a single item's count) and re-render
 * only when that slice changes — this scales to large grids.
 *
 * Shape: Record<schematicId, quantity>. Absent or 0 means "not collected".
 */

import { useSyncExternalStore } from "react";

const KEY = "stw-collection-v1";

type State = Readonly<Record<string, number>>;

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as State) : {};
  } catch {
    return {};
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State): void {
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

// --- imperative API ---

export function getState(): State {
  return state;
}

export function getCount(id: string): number {
  return state[id] ?? 0;
}

export function setCount(id: string, n: number): void {
  const next: Record<string, number> = { ...state };
  if (n <= 0) delete next[id];
  else next[id] = n;
  commit(next);
}

export function toggle(id: string): void {
  setCount(id, getCount(id) > 0 ? 0 : 1);
}

export function increment(id: string, delta = 1): void {
  setCount(id, getCount(id) + delta);
}

export function clearAll(): void {
  commit({});
}

export function ownedCount(): number {
  let n = 0;
  for (const v of Object.values(state)) if (v > 0) n++;
  return n;
}

export function exportJson(): string {
  return JSON.stringify(
    { app: "stw-companion", version: 1, savedAt: new Date().toISOString(), items: state },
    null,
    2,
  );
}

/** Accepts either a wrapped export ({items:{...}}) or a bare id->count map. */
export function importJson(text: string): void {
  const data = JSON.parse(text) as { items?: unknown } | Record<string, number>;
  const items = (data && typeof data === "object" && "items" in data ? data.items : data) as unknown;
  if (!items || typeof items !== "object") throw new Error("Unrecognized collection file.");
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(items as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) clean[k] = Math.floor(n);
  }
  commit(clean);
}

// --- React hooks ---

/** Re-renders only when THIS item's count changes. */
export function useCount(id: string): number {
  return useSyncExternalStore(
    subscribe,
    () => state[id] ?? 0,
    () => 0,
  );
}

/** Whole-state snapshot — use sparingly (header progress, owned filter). */
export function useCollectionState(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}
