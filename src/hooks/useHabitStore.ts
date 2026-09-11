"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getTodayLocalDateString } from "@/lib/dates";
import {
  applyFocusCompletionToStreak,
  resolveDisplayStreak,
} from "@/lib/streaks";
import {
  getServerSnapshot,
  getSnapshot,
  hydrateFromStorage,
  isStoreHydrated,
  setPersistedState,
  subscribe,
} from "@/lib/store";
import {
  durationSecondsForMode,
  maybeNotify,
  modeLabel,
  nextModeAfterCompletion,
  playEndSound,
} from "@/lib/timerUtils";
import type {
  AppSettings,
  DailyStats,
  LiveTimerState,
  PersistedState,
  TimerMode,
  TimerStatus,
  Todo,
} from "@/lib/types";

function emptyDaily(date: string): DailyStats {
  return { date, focusSessionsCompleted: 0, focusMinutesCompleted: 0 };
}

function mergeSettings(
  base: AppSettings,
  patch: Partial<AppSettings>
): AppSettings {
  return {
    ...base,
    ...patch,
    durations: {
      ...base.durations,
      ...(patch.durations ?? {}),
    },
    testOverrides: {
      ...base.testOverrides,
      ...(patch.testOverrides ?? {}),
    },
  };
}

function persistTimer(timer: LiveTimerState): void {
  setPersistedState((prev) => ({ ...prev, timer }));
}

export function useHabitStore() {
  useEffect(() => {
    hydrateFromStorage();
  }, []);

  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const hydrated = useSyncExternalStore(
    subscribe,
    isStoreHydrated,
    () => false
  );

  const [mode, setMode] = useState<TimerMode>("focus");
  const [status, setStatus] = useState<TimerStatus>("idle");
  /** Remaining seconds while running/paused. Idle uses derived full duration. */
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerReady, setTimerReady] = useState(false);

  const statusRef = useRef<TimerStatus>("idle");
  const modeRef = useRef<TimerMode>("focus");
  const secondsLeftRef = useRef(25 * 60);
  const endsAtRef = useRef<number | null>(null);
  const stateRef = useRef<PersistedState>(state);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completingRef = useRef(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const durationFor = useCallback(
    (m: TimerMode, settings: AppSettings = stateRef.current.settings) =>
      durationSecondsForMode(m, settings.durations, settings.testOverrides),
    []
  );

  const configuredSeconds = durationSecondsForMode(
    mode,
    state.settings.durations,
    state.settings.testOverrides
  );

  const displaySeconds =
    status === "idle" ? configuredSeconds : secondsLeft;

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const writeTimer = useCallback(
    (next: {
      mode: TimerMode;
      status: TimerStatus;
      secondsLeft: number;
      endsAt: number | null;
    }) => {
      endsAtRef.current = next.endsAt;
      persistTimer(next);
    },
    []
  );

  const onSessionComplete = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    clearTick();
    endsAtRef.current = null;

    const completedMode = modeRef.current;
    const settings = stateRef.current.settings;
    const plannedSeconds = durationFor(completedMode, settings);
    const plannedMinutes = Math.max(1, Math.round(plannedSeconds / 60));

    const { mode: nextMode, focusTowardLongBreak } = nextModeAfterCompletion(
      completedMode,
      stateRef.current.focusTowardLongBreak
    );

    const today = getTodayLocalDateString(settings);

    setPersistedState((prev) => {
      let next: PersistedState = { ...prev, focusTowardLongBreak };

      if (completedMode === "focus") {
        const streak = applyFocusCompletionToStreak(prev.streak, today);
        const existing = prev.dailyStats[today] ?? emptyDaily(today);
        next = {
          ...next,
          streak,
          dailyStats: {
            ...prev.dailyStats,
            [today]: {
              ...existing,
              focusSessionsCompleted: existing.focusSessionsCompleted + 1,
              focusMinutesCompleted:
                existing.focusMinutesCompleted + plannedMinutes,
            },
          },
        };
      }

      const nextSecs = durationSecondsForMode(
        nextMode,
        settings.durations,
        settings.testOverrides
      );
      next = {
        ...next,
        timer: {
          mode: nextMode,
          status: "idle",
          secondsLeft: nextSecs,
          endsAt: null,
        },
      };

      return next;
    });

    if (settings.soundEnabled) playEndSound();
    await maybeNotify(
      `${modeLabel(completedMode)} complete`,
      nextMode === "focus"
        ? "Time to focus."
        : `Time for a ${modeLabel(nextMode).toLowerCase()}.`,
      settings.notificationsEnabled
    );

    const nextSecs = durationFor(nextMode, settings);
    modeRef.current = nextMode;
    secondsLeftRef.current = nextSecs;
    statusRef.current = "idle";
    endsAtRef.current = null;
    setMode(nextMode);
    setSecondsLeft(nextSecs);
    setStatus("idle");
    completingRef.current = false;
  }, [clearTick, durationFor]);

  const startTick = useCallback(() => {
    clearTick();
    tickRef.current = setInterval(() => {
      if (statusRef.current !== "running") return;

      // Prefer wall clock when endsAt is set (survives tab throttling better)
      const endsAt = endsAtRef.current;
      let next: number;
      if (endsAt != null) {
        next = Math.ceil((endsAt - Date.now()) / 1000);
      } else {
        next = secondsLeftRef.current - 1;
      }

      if (next <= 0) {
        secondsLeftRef.current = 0;
        setSecondsLeft(0);
        void onSessionComplete();
        return;
      }
      secondsLeftRef.current = next;
      setSecondsLeft(next);
    }, 1000);
  }, [clearTick, onSessionComplete]);

  useEffect(() => () => clearTick(), [clearTick]);

  // Restore live timer from persisted state once after hydrate
  useEffect(() => {
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;

    const saved = stateRef.current.timer;
    const settings = stateRef.current.settings;

    if (saved.status === "running" && saved.endsAt != null) {
      const remaining = Math.ceil((saved.endsAt - Date.now()) / 1000);
      modeRef.current = saved.mode;
      setMode(saved.mode);

      if (remaining <= 0) {
        secondsLeftRef.current = 0;
        statusRef.current = "running";
        endsAtRef.current = null;
        setSecondsLeft(0);
        setStatus("running");
        setTimerReady(true);
        // Same completion path as a natural zero-cross
        void onSessionComplete();
        return;
      }

      secondsLeftRef.current = remaining;
      statusRef.current = "running";
      endsAtRef.current = saved.endsAt;
      setSecondsLeft(remaining);
      setStatus("running");
      // Keep endsAt; refresh secondsLeft snapshot in storage
      persistTimer({
        mode: saved.mode,
        status: "running",
        secondsLeft: remaining,
        endsAt: saved.endsAt,
      });
      startTick();
      setTimerReady(true);
      return;
    }

    if (saved.status === "paused") {
      modeRef.current = saved.mode;
      setMode(saved.mode);
      if (saved.secondsLeft <= 0) {
        secondsLeftRef.current = 0;
        statusRef.current = "paused";
        endsAtRef.current = null;
        setSecondsLeft(0);
        setStatus("paused");
        setTimerReady(true);
        void onSessionComplete();
        return;
      }
      const secs = saved.secondsLeft;
      secondsLeftRef.current = secs;
      statusRef.current = "paused";
      endsAtRef.current = null;
      setSecondsLeft(secs);
      setStatus("paused");
      persistTimer({
        mode: saved.mode,
        status: "paused",
        secondsLeft: secs,
        endsAt: null,
      });
      setTimerReady(true);
      return;
    }

    // Idle (or unknown) — restore mode; display uses configured duration
    const idleSecs = durationFor(saved.mode, settings);
    modeRef.current = saved.mode;
    secondsLeftRef.current = idleSecs;
    statusRef.current = "idle";
    endsAtRef.current = null;
    setMode(saved.mode);
    setSecondsLeft(idleSecs);
    setStatus("idle");
    persistTimer({
      mode: saved.mode,
      status: "idle",
      secondsLeft: idleSecs,
      endsAt: null,
    });
    setTimerReady(true);
  }, [hydrated, durationFor, onSessionComplete, startTick]);

  const start = useCallback(() => {
    if (statusRef.current === "running") return;
    const secs = durationFor(modeRef.current);
    const endsAt = Date.now() + secs * 1000;
    secondsLeftRef.current = secs;
    setSecondsLeft(secs);
    statusRef.current = "running";
    setStatus("running");
    writeTimer({
      mode: modeRef.current,
      status: "running",
      secondsLeft: secs,
      endsAt,
    });
    startTick();
  }, [startTick, durationFor, writeTimer]);

  const pause = useCallback(() => {
    if (statusRef.current !== "running") return;
    const endsAt = endsAtRef.current;
    const rem =
      endsAt != null
        ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
        : secondsLeftRef.current;
    clearTick();
    secondsLeftRef.current = rem;
    setSecondsLeft(rem);
    statusRef.current = "paused";
    setStatus("paused");
    writeTimer({
      mode: modeRef.current,
      status: "paused",
      secondsLeft: rem,
      endsAt: null,
    });
  }, [clearTick, writeTimer]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") return;
    const secs = Math.max(0, secondsLeftRef.current);
    if (secs <= 0) {
      void onSessionComplete();
      return;
    }
    const endsAt = Date.now() + secs * 1000;
    statusRef.current = "running";
    setStatus("running");
    writeTimer({
      mode: modeRef.current,
      status: "running",
      secondsLeft: secs,
      endsAt,
    });
    startTick();
  }, [startTick, writeTimer, onSessionComplete]);

  const reset = useCallback(() => {
    clearTick();
    statusRef.current = "idle";
    setStatus("idle");
    const secs = durationFor(modeRef.current);
    secondsLeftRef.current = secs;
    setSecondsLeft(secs);
    writeTimer({
      mode: modeRef.current,
      status: "idle",
      secondsLeft: secs,
      endsAt: null,
    });
  }, [clearTick, durationFor, writeTimer]);

  const skip = useCallback(() => {
    clearTick();
    const current = modeRef.current;
    const nextMode: TimerMode = current === "focus" ? "shortBreak" : "focus";
    const secs = durationFor(nextMode);
    modeRef.current = nextMode;
    secondsLeftRef.current = secs;
    statusRef.current = "idle";
    setMode(nextMode);
    setSecondsLeft(secs);
    setStatus("idle");
    writeTimer({
      mode: nextMode,
      status: "idle",
      secondsLeft: secs,
      endsAt: null,
    });
  }, [clearTick, durationFor, writeTimer]);

  const addTodo = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const todo: Todo = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    setPersistedState((prev) => ({
      ...prev,
      todos: [todo, ...prev.todos],
      activeTodoId: prev.activeTodoId ?? todo.id,
    }));
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setPersistedState((prev) => ({
      ...prev,
      todos: prev.todos.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    }));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setPersistedState((prev) => ({
      ...prev,
      todos: prev.todos.filter((t) => t.id !== id),
      activeTodoId: prev.activeTodoId === id ? null : prev.activeTodoId,
    }));
  }, []);

  const editTodo = useCallback((id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPersistedState((prev) => ({
      ...prev,
      todos: prev.todos.map((t) =>
        t.id === id ? { ...t, text: trimmed } : t
      ),
    }));
  }, []);

  const selectTodo = useCallback((id: string) => {
    setPersistedState((prev) => ({
      ...prev,
      activeTodoId: prev.activeTodoId === id ? null : id,
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setPersistedState((prev) => {
      const settings = mergeSettings(prev.settings, patch);
      return { ...prev, settings };
    });
  }, []);

  const seedTesting = useCallback(
    (seed: {
      lastQualifyingDate?: string | null;
      currentStreak?: number;
      bestStreak?: number;
      focusTowardLongBreak?: number;
    }) => {
      setPersistedState((prev) => {
        const today = getTodayLocalDateString(prev.settings);
        return {
          ...prev,
          streak: resolveDisplayStreak(
            {
              lastQualifyingDate:
                seed.lastQualifyingDate !== undefined
                  ? seed.lastQualifyingDate
                  : prev.streak.lastQualifyingDate,
              currentStreak:
                seed.currentStreak !== undefined
                  ? seed.currentStreak
                  : prev.streak.currentStreak,
              bestStreak:
                seed.bestStreak !== undefined
                  ? seed.bestStreak
                  : prev.streak.bestStreak,
            },
            today
          ),
          focusTowardLongBreak:
            seed.focusTowardLongBreak !== undefined
              ? seed.focusTowardLongBreak
              : prev.focusTowardLongBreak,
        };
      });
    },
    []
  );

  const resetClockToMode = useCallback(
    (m: TimerMode, settings?: AppSettings) => {
      clearTick();
      const secs = durationFor(m, settings ?? stateRef.current.settings);
      modeRef.current = m;
      secondsLeftRef.current = secs;
      statusRef.current = "idle";
      setMode(m);
      setSecondsLeft(secs);
      setStatus("idle");
      writeTimer({
        mode: m,
        status: "idle",
        secondsLeft: secs,
        endsAt: null,
      });
    },
    [clearTick, durationFor, writeTimer]
  );

  const today = getTodayLocalDateString(state.settings);
  const todayStats = state.dailyStats[today] ?? emptyDaily(today);
  const displayStreak = useMemo(
    () => resolveDisplayStreak(state.streak, today),
    [state.streak, today]
  );
  const activeTodo =
    state.todos.find((t) => t.id === state.activeTodoId) ?? null;

  const totalForMode = configuredSeconds;
  const progress =
    totalForMode > 0 ? 1 - displaySeconds / totalForMode : 0;

  return {
    hydrated: hydrated && timerReady,
    mode,
    status,
    secondsLeft: displaySeconds,
    progress,
    totalForMode,
    todos: state.todos,
    activeTodo,
    activeTodoId: state.activeTodoId,
    settings: state.settings,
    settingsOpen,
    setSettingsOpen,
    streak: displayStreak,
    focusTowardLongBreak: state.focusTowardLongBreak,
    todayStats,
    start,
    pause,
    resume,
    reset,
    skip,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    selectTodo,
    updateSettings,
    seedTesting,
    resetClockToMode,
  };
}

export type HabitStore = ReturnType<typeof useHabitStore>;
