import { getTodayLocalDateString } from "./dates";
import { loadState, saveState, touchLocalUpdatedAt } from "./storage";
import { resolveDisplayStreak } from "./streaks";
import { DEFAULT_STATE, type PersistedState } from "./types";

type Listener = () => void;

let memory: PersistedState = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function getSnapshot(): PersistedState {
  return memory;
}

export function getServerSnapshot(): PersistedState {
  return DEFAULT_STATE;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Load from localStorage once (client). Idempotent. */
export function hydrateFromStorage(): void {
  if (hydrated || typeof window === "undefined") return;
  const loaded = loadState();
  const today = getTodayLocalDateString(loaded.settings);
  memory = {
    ...loaded,
    streak: resolveDisplayStreak(
      loaded.streak,
      today,
      loaded.settings.kindness
    ),
  };
  // Do NOT seed local-updated-at here. Empty/default devices must keep a null
  // watermark so decideSyncOnSignIn(remote, null) → conflict (never silent
  // upload-local that wipes older cloud data). Watermark is set only on real
  // local writes via touchLocalUpdatedAt in set/replacePersistedState.
  hydrated = true;
  emit();
}

export function isStoreHydrated(): boolean {
  return hydrated;
}

export function setPersistedState(
  updater: PersistedState | ((prev: PersistedState) => PersistedState)
): void {
  const next =
    typeof updater === "function"
      ? (updater as (p: PersistedState) => PersistedState)(memory)
      : updater;
  memory = next;
  if (hydrated) {
    saveState(memory);
    touchLocalUpdatedAt();
  }
  emit();
}

export function replacePersistedState(next: PersistedState): void {
  memory = next;
  if (hydrated) {
    saveState(memory);
    touchLocalUpdatedAt();
  }
  emit();
}

/** Test-only: clear hydrate latch so hydrateFromStorage can run again. */
export function resetStoreForTests(): void {
  memory = DEFAULT_STATE;
  hydrated = false;
}
