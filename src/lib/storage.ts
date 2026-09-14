import { mergeFocusSessions } from "./history";
import { migrateToV2 } from "./migrate";
import { mergeStreakState } from "./streaks";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_KINDNESS,
  DEFAULT_SETTINGS,
  DEFAULT_STREAK,
  DEFAULT_TIMER,
  STORAGE_KEY,
  STORAGE_KEY_V1,
  type AccentTheme,
  type AppSettings,
  type DailyStats,
  type Density,
  type LiveTimerState,
  type PersistedState,
  type TimerMode,
  type TimerStatus,
  type Todo,
} from "./types";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Epoch ms watermark for cloud conflict decisions (separate from app blob). */
export const LOCAL_UPDATED_AT_KEY = "habit-tracker-local-updated-at";

export function getLocalUpdatedAtMs(): number | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_UPDATED_AT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function touchLocalUpdatedAt(atMs: number = Date.now()): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LOCAL_UPDATED_AT_KEY, String(atMs));
  } catch {
    // ignore quota
  }
}

/** Fresh default persisted snapshot (deep-enough clone; safe to mutate). */
export function createDefaultPersistedState(): PersistedState {
  return {
    version: 2,
    todos: [],
    activeTodoId: null,
    settings: {
      ...DEFAULT_SETTINGS,
      durations: { ...DEFAULT_SETTINGS.durations },
      testOverrides: { ...DEFAULT_SETTINGS.testOverrides },
      appearance: { ...DEFAULT_APPEARANCE },
      kindness: { ...DEFAULT_KINDNESS },
    },
    streak: { ...DEFAULT_STREAK, offDays: [], freezeUsedDates: [] },
    focusTowardLongBreak: 0,
    dailyStats: {},
    timer: { ...DEFAULT_TIMER },
    focusSessions: [],
  };
}

const ACCENTS: AccentTheme[] = [
  "rose",
  "emerald",
  "sky",
  "amber",
  "violet",
];

export function mergeSettings(
  raw: Partial<AppSettings> | undefined
): AppSettings {
  const appearanceRaw = raw?.appearance;
  const kindnessRaw = raw?.kindness;

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    durations: {
      ...DEFAULT_SETTINGS.durations,
      ...(raw?.durations ?? {}),
    },
    testOverrides: {
      ...DEFAULT_SETTINGS.testOverrides,
      ...(raw?.testOverrides ?? {}),
    },
    testToday:
      typeof raw?.testToday === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.testToday)
        ? raw.testToday
        : raw?.testToday === null
          ? null
          : DEFAULT_SETTINGS.testToday,
    appearance: {
      accent:
        appearanceRaw &&
        ACCENTS.includes(appearanceRaw.accent as AccentTheme)
          ? (appearanceRaw.accent as AccentTheme)
          : DEFAULT_APPEARANCE.accent,
      density:
        appearanceRaw?.density === "comfortable" ||
        appearanceRaw?.density === "compact"
          ? (appearanceRaw.density as Density)
          : DEFAULT_APPEARANCE.density,
    },
    kindness: {
      enabled:
        typeof kindnessRaw?.enabled === "boolean"
          ? kindnessRaw.enabled
          : DEFAULT_KINDNESS.enabled,
      freezeEveryNDays:
        typeof kindnessRaw?.freezeEveryNDays === "number" &&
        Number.isFinite(kindnessRaw.freezeEveryNDays)
          ? Math.max(1, Math.floor(kindnessRaw.freezeEveryNDays))
          : DEFAULT_KINDNESS.freezeEveryNDays,
    },
  };
}

const VALID_MODES: TimerMode[] = ["focus", "shortBreak", "longBreak"];
const VALID_STATUSES: TimerStatus[] = ["idle", "running", "paused"];

export function mergeTimer(
  raw: Partial<LiveTimerState> | undefined
): LiveTimerState {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_TIMER };
  }

  const mode = VALID_MODES.includes(raw.mode as TimerMode)
    ? (raw.mode as TimerMode)
    : DEFAULT_TIMER.mode;
  let status = VALID_STATUSES.includes(raw.status as TimerStatus)
    ? (raw.status as TimerStatus)
    : DEFAULT_TIMER.status;
  const secondsLeft =
    typeof raw.secondsLeft === "number" && Number.isFinite(raw.secondsLeft)
      ? Math.max(0, Math.floor(raw.secondsLeft))
      : DEFAULT_TIMER.secondsLeft;
  let endsAt =
    typeof raw.endsAt === "number" && Number.isFinite(raw.endsAt)
      ? raw.endsAt
      : null;

  // Old / incomplete snapshots: running without endsAt → treat as paused
  if (status === "running" && endsAt == null) {
    status = "paused";
  }
  if (status !== "running") {
    endsAt = null;
  }

  let sessionTotalSeconds: number | null = null;
  if (
    typeof raw.sessionTotalSeconds === "number" &&
    Number.isFinite(raw.sessionTotalSeconds)
  ) {
    sessionTotalSeconds = Math.max(1, Math.floor(raw.sessionTotalSeconds));
  } else if (status === "running" || status === "paused") {
    sessionTotalSeconds = Math.max(1, secondsLeft || 1);
  }

  return { mode, status, secondsLeft, endsAt, sessionTotalSeconds };
}

function mergeTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) return [];
  const out: Todo[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const todo = t as Partial<Todo>;
    if (typeof todo.id !== "string" || typeof todo.text !== "string") continue;
    out.push({
      id: todo.id,
      text: todo.text,
      completed: typeof todo.completed === "boolean" ? todo.completed : false,
      createdAt:
        typeof todo.createdAt === "number" && Number.isFinite(todo.createdAt)
          ? todo.createdAt
          : Date.now(),
    });
  }
  return out;
}

function mergeDailyStats(raw: unknown): Record<string, DailyStats> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DailyStats> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Partial<DailyStats>;
    out[key] = {
      date: typeof v.date === "string" ? v.date : key,
      focusSessionsCompleted:
        typeof v.focusSessionsCompleted === "number"
          ? Math.max(0, Math.floor(v.focusSessionsCompleted))
          : 0,
      focusMinutesCompleted:
        typeof v.focusMinutesCompleted === "number"
          ? Math.max(0, Math.floor(v.focusMinutesCompleted))
          : 0,
    };
  }
  return out;
}

/** Normalize a partial / unknown object into a full PersistedState (load/merge path). */
export function mergePersistedState(
  parsed: Partial<PersistedState> | null | undefined
): PersistedState {
  if (!parsed || typeof parsed !== "object") {
    return createDefaultPersistedState();
  }

  // Route through migrate so v1 blobs and partials get appearance/kindness/sessions
  const migrated = migrateToV2(parsed);

  const focusTowardLongBreak =
    typeof parsed.focusTowardLongBreak === "number" &&
    Number.isFinite(parsed.focusTowardLongBreak)
      ? Math.min(3, Math.max(0, Math.floor(parsed.focusTowardLongBreak)))
      : migrated.focusTowardLongBreak;

  return {
    version: 2,
    todos: mergeTodos(parsed.todos ?? migrated.todos),
    activeTodoId:
      typeof parsed.activeTodoId === "string" || parsed.activeTodoId === null
        ? parsed.activeTodoId ?? null
        : migrated.activeTodoId,
    settings: mergeSettings(parsed.settings ?? migrated.settings),
    streak: mergeStreakState(parsed.streak ?? migrated.streak),
    focusTowardLongBreak,
    dailyStats: mergeDailyStats(parsed.dailyStats ?? migrated.dailyStats),
    timer: mergeTimer(parsed.timer ?? migrated.timer),
    focusSessions: mergeFocusSessions(
      parsed.focusSessions ?? migrated.focusSessions
    ),
  };
}

/** Parse a JSON string through the same merge path `loadState` uses. */
export function parsePersistedJson(raw: string): PersistedState {
  const parsed = JSON.parse(raw) as Partial<PersistedState>;
  return mergePersistedState(parsed);
}

/** Serialize persisted state for export / localStorage. */
export function serializePersistedState(state: PersistedState): string {
  return JSON.stringify(state);
}

/** Pretty JSON for downloadable backups. */
export function exportStateToJson(state: PersistedState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Import a previously exported JSON backup.
 * Uses the same parse → merge path as loading from localStorage.
 */
export function importStateFromJson(json: string): PersistedState {
  return parsePersistedJson(json);
}

/** Empty default persisted state (clear-all-data). */
export function clearToDefaultState(): PersistedState {
  return createDefaultPersistedState();
}

export type SaveResult = { ok: true } | { ok: false; error: string };

let lastSaveError: string | null = null;
const saveErrorListeners = new Set<() => void>();

export function getLastSaveError(): string | null {
  return lastSaveError;
}

export function subscribeSaveErrors(listener: () => void): () => void {
  saveErrorListeners.add(listener);
  return () => saveErrorListeners.delete(listener);
}

function setSaveError(error: string | null) {
  lastSaveError = error;
  for (const l of saveErrorListeners) l();
}

export function loadState(): PersistedState {
  if (!isBrowser()) return createDefaultPersistedState();

  try {
    const rawV2 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      return parsePersistedJson(rawV2);
    }

    // One-time migrate from v1
    const rawV1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const migrated = parsePersistedJson(rawV1);
      const result = saveState(migrated);
      if (result.ok) {
        try {
          window.localStorage.removeItem(STORAGE_KEY_V1);
        } catch {
          // ignore
        }
      }
      return migrated;
    }

    return createDefaultPersistedState();
  } catch {
    return createDefaultPersistedState();
  }
}

export function saveState(state: PersistedState): SaveResult {
  if (!isBrowser()) return { ok: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, serializePersistedState(state));
    setSaveError(null);
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to save local data";
    setSaveError(message);
    return { ok: false, error: message };
  }
}
