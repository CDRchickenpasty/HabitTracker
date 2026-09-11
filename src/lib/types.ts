export type TimerMode = "focus" | "shortBreak" | "longBreak";

export type TimerStatus = "idle" | "running" | "paused";

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
}

/** Live Pomodoro clock — persisted so refresh survives */
export interface LiveTimerState {
  mode: TimerMode;
  status: TimerStatus;
  /** Remaining seconds (authoritative when paused/idle; snapshot while running) */
  secondsLeft: number;
  /** Epoch ms when a running timer hits 0; null when not running */
  endsAt: number | null;
}

export interface DailyStats {
  /** Local YYYY-MM-DD */
  date: string;
  focusSessionsCompleted: number;
  focusMinutesCompleted: number;
}

export interface StreakState {
  /** Local YYYY-MM-DD of last day that qualified (≥1 completed Focus) */
  lastQualifyingDate: string | null;
  currentStreak: number;
  bestStreak: number;
}

export interface PersistedState {
  version: 1;
  todos: Todo[];
  activeTodoId: string | null;
  settings: AppSettings;
  streak: StreakState;
  /** Completed Focus sessions toward next long break (0–3; resets after long break cycle) */
  focusTowardLongBreak: number;
  /** Stats keyed by local YYYY-MM-DD */
  dailyStats: Record<string, DailyStats>;
  timer: LiveTimerState;
}

export const FOCUS_DURATION_PRESETS = [15, 25, 45, 50] as const;

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
};

export const DEFAULT_TIMER: LiveTimerState = {
  mode: "focus",
  status: "idle",
  secondsLeft: 25 * 60,
  endsAt: null,
};

export const DEFAULT_STATE: PersistedState = {
  version: 1,
  todos: [],
  activeTodoId: null,
  settings: DEFAULT_SETTINGS,
  streak: {
    lastQualifyingDate: null,
    currentStreak: 0,
    bestStreak: 0,
  },
  focusTowardLongBreak: 0,
  dailyStats: {},
  timer: DEFAULT_TIMER,
};

export const STORAGE_KEY = "habit-tracker-v1";
