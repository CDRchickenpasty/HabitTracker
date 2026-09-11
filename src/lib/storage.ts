import {
  DEFAULT_STATE,
  DEFAULT_SETTINGS,
  DEFAULT_TIMER,
  STORAGE_KEY,
  type PersistedState,
  type AppSettings,
  type LiveTimerState,
  type TimerMode,
  type TimerStatus,
} from "./types";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function mergeSettings(raw: Partial<AppSettings> | undefined): AppSettings {
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

function mergeTimer(raw: Partial<LiveTimerState> | undefined): LiveTimerState {
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

export function loadState(): PersistedState {
  if (!isBrowser()) return { ...DEFAULT_STATE };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, settings: { ...DEFAULT_SETTINGS }, timer: { ...DEFAULT_TIMER } };

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      version: 1,
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      activeTodoId:
        typeof parsed.activeTodoId === "string" || parsed.activeTodoId === null
          ? parsed.activeTodoId ?? null
          : null,
      settings: mergeSettings(parsed.settings),
      streak: {
        lastQualifyingDate: parsed.streak?.lastQualifyingDate ?? null,
        currentStreak: parsed.streak?.currentStreak ?? 0,
        bestStreak: parsed.streak?.bestStreak ?? 0,
      },
      focusTowardLongBreak: parsed.focusTowardLongBreak ?? 0,
      dailyStats: parsed.dailyStats ?? {},
      timer: mergeTimer(parsed.timer),
    };
  } catch {
    return {
      ...DEFAULT_STATE,
      settings: { ...DEFAULT_SETTINGS },
      timer: { ...DEFAULT_TIMER },
    };
  }
}

export function saveState(state: PersistedState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore
  }
}
