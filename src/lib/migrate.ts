import { mergeFocusSessions } from "./history";
import { mergeStreakState } from "./streaks";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_KINDNESS,
  DEFAULT_SETTINGS,
  DEFAULT_TIMER,
  type AppSettings,
  type LiveTimerState,
  type PersistedState,
} from "./types";

/** Shape of habit-tracker-v1 blobs (and partial unknowns). */
type LegacyState = {
  version?: number;
  todos?: unknown;
  activeTodoId?: unknown;
  settings?: Partial<AppSettings> & Record<string, unknown>;
  streak?: Record<string, unknown>;
  focusTowardLongBreak?: unknown;
  dailyStats?: unknown;
  timer?: Partial<LiveTimerState> & Record<string, unknown>;
  focusSessions?: unknown;
};

function migrateSettings(raw: LegacyState["settings"]): AppSettings {
  const base = {
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
  };

  const appearanceRaw = raw?.appearance as
    | Partial<AppSettings["appearance"]>
    | undefined;
  const kindnessRaw = raw?.kindness as
    | Partial<AppSettings["kindness"]>
    | undefined;

  return {
    ...base,
    appearance: {
      ...DEFAULT_APPEARANCE,
      ...(appearanceRaw ?? {}),
      accent:
        appearanceRaw?.accent === "rose" ||
        appearanceRaw?.accent === "emerald" ||
        appearanceRaw?.accent === "sky" ||
        appearanceRaw?.accent === "amber" ||
        appearanceRaw?.accent === "violet"
          ? appearanceRaw.accent
          : DEFAULT_APPEARANCE.accent,
      density:
        appearanceRaw?.density === "comfortable" ||
        appearanceRaw?.density === "compact"
          ? appearanceRaw.density
          : DEFAULT_APPEARANCE.density,
    },
    kindness: {
      ...DEFAULT_KINDNESS,
      ...(kindnessRaw ?? {}),
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

function migrateTimer(
  raw: LegacyState["timer"] | undefined
): LiveTimerState {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_TIMER };
  }

  const mode =
    raw.mode === "focus" ||
    raw.mode === "shortBreak" ||
    raw.mode === "longBreak"
      ? raw.mode
      : DEFAULT_TIMER.mode;
  let status =
    raw.status === "idle" ||
    raw.status === "running" ||
    raw.status === "paused"
      ? raw.status
      : DEFAULT_TIMER.status;
  const secondsLeft =
    typeof raw.secondsLeft === "number" && Number.isFinite(raw.secondsLeft)
      ? Math.max(0, Math.floor(raw.secondsLeft))
      : DEFAULT_TIMER.secondsLeft;
  let endsAt =
    typeof raw.endsAt === "number" && Number.isFinite(raw.endsAt)
      ? raw.endsAt
      : null;

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
    // v1 had no frozen total — use secondsLeft as best effort for paused;
    // for running, prefer remaining until we know better (progress may be flat).
    sessionTotalSeconds = Math.max(1, secondsLeft || 1);
  }

  return { mode, status, secondsLeft, endsAt, sessionTotalSeconds };
}

/**
 * Normalize any legacy (v1) or partial blob into a v2 PersistedState.
 * Pure — does not touch localStorage.
 */
export function migrateToV2(raw: unknown): PersistedState {
  const parsed =
    raw && typeof raw === "object" ? (raw as LegacyState) : ({} as LegacyState);

  const focusTowardLongBreak =
    typeof parsed.focusTowardLongBreak === "number" &&
    Number.isFinite(parsed.focusTowardLongBreak)
      ? Math.min(3, Math.max(0, Math.floor(parsed.focusTowardLongBreak)))
      : 0;

  return {
    version: 2,
    todos: Array.isArray(parsed.todos) ? (parsed.todos as PersistedState["todos"]) : [],
    activeTodoId:
      typeof parsed.activeTodoId === "string" || parsed.activeTodoId === null
        ? ((parsed.activeTodoId as string | null) ?? null)
        : null,
    settings: migrateSettings(parsed.settings),
    streak: mergeStreakState(parsed.streak as Parameters<typeof mergeStreakState>[0]),
    focusTowardLongBreak,
    dailyStats:
      parsed.dailyStats && typeof parsed.dailyStats === "object"
        ? (parsed.dailyStats as PersistedState["dailyStats"])
        : {},
    timer: migrateTimer(parsed.timer),
    focusSessions: mergeFocusSessions(parsed.focusSessions),
  };
}
