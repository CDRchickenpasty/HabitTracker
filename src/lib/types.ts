export type TimerMode = "focus" | "shortBreak" | "longBreak";

export type TimerStatus = "idle" | "running" | "paused";

export type AccentTheme = "rose" | "emerald" | "sky" | "amber" | "violet";

export type Density = "comfortable" | "compact";

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface DurationSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}

/** QA overrides — when set, used instead of DurationSettings for timer lengths */
export interface TestDurationOverrides {
  focusSeconds: number | null;
  shortBreakSeconds: number | null;
  longBreakSeconds: number | null;
}

export interface AppearanceSettings {
  accent: AccentTheme;
  density: Density;
}

export interface KindnessSettings {
  /** When false, streak rules match v1 (no freezes / off-days / repair). */
  enabled: boolean;
  /** Earn 1 freeze token every N qualifying Focus days. */
  freezeEveryNDays: number;
}

export interface AppSettings {
  durations: DurationSettings;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  /** Optional soft cue ~last 10s of a Focus (once per session) */
  preEndCueEnabled: boolean;
  /** Show Testing section in settings */
  showTestingHooks: boolean;
  testOverrides: TestDurationOverrides;
  /**
   * QA: optional local YYYY-MM-DD used as "today" for streaks / daily stats.
   * null = real device local today.
   */
  testToday: string | null;
  appearance: AppearanceSettings;
  kindness: KindnessSettings;
}

/** Live Pomodoro clock — persisted so refresh survives */
export interface LiveTimerState {
  mode: TimerMode;
  status: TimerStatus;
  /** Remaining seconds (authoritative when paused/idle; snapshot while running) */
  secondsLeft: number;
  /** Epoch ms when a running timer hits 0; null when not running */
  endsAt: number | null;
  /**
   * Total seconds for the active running/paused session (frozen at Start/Resume).
   * null when idle — progress ring uses configured duration instead.
   */
  sessionTotalSeconds: number | null;
}

export interface DailyStats {
  /** Local YYYY-MM-DD */
  date: string;
  focusSessionsCompleted: number;
  focusMinutesCompleted: number;
}

/** One completed Focus (natural 00:00 only). */
export interface FocusSession {
  id: string;
  completedAt: number;
  /** Local YYYY-MM-DD of completion */
  localDate: string;
  plannedMinutes: number;
  todoId: string | null;
  todoTextSnapshot: string | null;
}

export interface StreakState {
  /** Local YYYY-MM-DD of last day that qualified (≥1 completed Focus) */
  lastQualifyingDate: string | null;
  currentStreak: number;
  bestStreak: number;
  /** Planned off-days (YYYY-MM-DD) — do not break streak, do not require Focus */
  offDays: string[];
  /** Spendable freeze tokens */
  freezeTokens: number;
  /** Dates where a freeze was consumed */
  freezeUsedDates: string[];
  /** Qualifying days toward the next earned freeze (0 .. freezeEveryNDays-1) */
  towardNextFreeze: number;
  /** Remaining manual streak repairs */
  repairsRemaining: number;
}

export interface PersistedState {
  version: 2;
  todos: Todo[];
  activeTodoId: string | null;
  settings: AppSettings;
  streak: StreakState;
  /** Completed Focus sessions toward next long break (0–3; resets after long break cycle) */
  focusTowardLongBreak: number;
  /** Stats keyed by local YYYY-MM-DD */
  dailyStats: Record<string, DailyStats>;
  timer: LiveTimerState;
  /** Append-only Focus completion log (pruned) */
  focusSessions: FocusSession[];
}

export const FOCUS_DURATION_PRESETS = [15, 25, 45, 50] as const;

export const ACCENT_THEMES: AccentTheme[] = [
  "rose",
  "emerald",
  "sky",
  "amber",
  "violet",
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  accent: "rose",
  density: "comfortable",
};

export const DEFAULT_KINDNESS: KindnessSettings = {
  enabled: true,
  freezeEveryNDays: 7,
};

export const DEFAULT_SETTINGS: AppSettings = {
  durations: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
  },
  soundEnabled: true,
  notificationsEnabled: false,
  preEndCueEnabled: false,
  showTestingHooks: false,
  testOverrides: {
    focusSeconds: null,
    shortBreakSeconds: null,
    longBreakSeconds: null,
  },
  testToday: null,
  appearance: { ...DEFAULT_APPEARANCE },
  kindness: { ...DEFAULT_KINDNESS },
};

export const DEFAULT_TIMER: LiveTimerState = {
  mode: "focus",
  status: "idle",
  secondsLeft: 25 * 60,
  endsAt: null,
  sessionTotalSeconds: null,
};

export const DEFAULT_STREAK: StreakState = {
  lastQualifyingDate: null,
  currentStreak: 0,
  bestStreak: 0,
  offDays: [],
  freezeTokens: 0,
  freezeUsedDates: [],
  towardNextFreeze: 0,
  repairsRemaining: 1,
};

export const DEFAULT_STATE: PersistedState = {
  version: 2,
  todos: [],
  activeTodoId: null,
  settings: DEFAULT_SETTINGS,
  streak: { ...DEFAULT_STREAK },
  focusTowardLongBreak: 0,
  dailyStats: {},
  timer: DEFAULT_TIMER,
  focusSessions: [],
};

/** Current localStorage key */
export const STORAGE_KEY = "habit-tracker-v2";

/** Legacy v1 key — read once for migration */
export const STORAGE_KEY_V1 = "habit-tracker-v1";

/** Max Focus session log entries retained locally */
export const MAX_FOCUS_SESSIONS = 2000;
