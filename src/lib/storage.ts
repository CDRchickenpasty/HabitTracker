import {
  DEFAULT_SETTINGS,
  DEFAULT_TIMER,
  STORAGE_KEY,
  type PersistedState,
  type AppSettings,
  type LiveTimerState,
  type TimerMode,
  type TimerStatus,
  type Todo,
  type DailyStats,
  type StreakState,
} from "./types";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Fresh default persisted snapshot (deep-enough clone; safe to mutate). */
export function createDefaultPersistedState(): PersistedState {
  return {
    version: 1,
    todos: [],
    activeTodoId: null,
    settings: {
      ...DEFAULT_SETTINGS,
      durations: { ...DEFAULT_SETTINGS.durations },
      testOverrides: { ...DEFAULT_SETTINGS.testOverrides },
    },
    streak: {
      lastQualifyingDate: null,
      currentStreak: 0,
      bestStreak: 0,
    },
    focusTowardLongBreak: 0,
    dailyStats: {},
    timer: { ...DEFAULT_TIMER },
  };
}

export function mergeSettings(raw: Partial<AppSettings> | undefined): AppSettings {
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
      typeof raw?.testToday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.testToday)
        ? raw.testToday
        : raw?.testToday === null
          ? null
          : DEFAULT_SETTINGS.testToday,
  };
}

const VALID_MODES: TimerMode[] = ["focus", "shortBreak", "longBreak"];
const VALID_STATUSES: TimerStatus[] = ["idle", "running", "paused"];

export function mergeTimer(raw: Partial<LiveTimerState> | undefined): LiveTimerState {
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

  return { mode, status, secondsLeft, endsAt };
}

function mergeStreak(raw: Partial<StreakState> | undefined): StreakState {
  return {
    lastQualifyingDate: raw?.lastQualifyingDate ?? null,
    currentStreak:
      typeof raw?.currentStreak === "number" && Number.isFinite(raw.currentStreak)
        ? Math.max(0, Math.floor(raw.currentStreak))
        : 0,
    bestStreak:
      typeof raw?.bestStreak === "number" && Number.isFinite(raw.bestStreak)
        ? Math.max(0, Math.floor(raw.bestStreak))
        : 0,
  };
}

function mergeTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is Todo =>
      !!t &&
      typeof t === "object" &&
      typeof (t as Todo).id === "string" &&
      typeof (t as Todo).text === "string"
  );
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

  const focusTowardLongBreak =
    typeof parsed.focusTowardLongBreak === "number" &&
    Number.isFinite(parsed.focusTowardLongBreak)
      ? Math.min(3, Math.max(0, Math.floor(parsed.focusTowardLongBreak)))
      : 0;

  return {
    version: 1,
    todos: mergeTodos(parsed.todos),
    activeTodoId:
      typeof parsed.activeTodoId === "string" || parsed.activeTodoId === null
        ? parsed.activeTodoId ?? null
        : null,
    settings: mergeSettings(parsed.settings),
    streak: mergeStreak(parsed.streak),
    focusTowardLongBreak,
    dailyStats: mergeDailyStats(parsed.dailyStats),
    timer: mergeTimer(parsed.timer),
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

export function loadState(): PersistedState {
  if (!isBrowser()) return createDefaultPersistedState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultPersistedState();
    return parsePersistedJson(raw);
  } catch {
    return createDefaultPersistedState();
  }
}

export function saveState(state: PersistedState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializePersistedState(state));
  } catch {
    // Quota / private mode — ignore
  }
}
