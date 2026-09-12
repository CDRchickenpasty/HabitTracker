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
  clearToDefaultState,
  exportStateToJson,
  importStateFromJson,
} from "@/lib/storage";
import {
  getServerSnapshot,
  getSnapshot,
  hydrateFromStorage,
  isStoreHydrated,
  replacePersistedState,
  setPersistedState,
  subscribe,
} from "@/lib/store";
import {
  durationSecondsForMode,
  maybeNotify,
  modeLabel,
  nextModeAfterCompletion,
  playEndSound,
  playPreEndCue,
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

export type SessionToast =
  | { kind: "preEnd" }
  | { kind: "focusComplete" }
  | null;

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
  /** Brief beat after a natural Focus completion (00:00 only). */
  const [focusCredited, setFocusCredited] = useState(false);
  /** Transient toast: pre-end cue or focus-complete a11y beat. */
  const [sessionToast, setSessionToast] = useState<SessionToast>(null);

  const statusRef = useRef<TimerStatus>("idle");
  const modeRef = useRef<TimerMode>("focus");
  const secondsLeftRef = useRef(25 * 60);
  const endsAtRef = useRef<number | null>(null);
  const stateRef = useRef<PersistedState>(state);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completingRef = useRef(false);
  const restoredRef = useRef(false);
  /** Once per running Focus session — fired in last 10s. */
  const preEndCueFiredRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showTransientToast = useCallback(
    (toast: Exclude<SessionToast, null>, ms = 3500) => {
      clearToastTimer();
      setSessionToast(toast);
      toastTimerRef.current = setTimeout(() => {
        setSessionToast(null);
        toastTimerRef.current = null;
      }, ms);
    },
    [clearToastTimer]
  );

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

    // End sound respects mute
    if (settings.soundEnabled) playEndSound();
    await maybeNotify(
      completedMode === "focus" ? "Focus complete" : `${modeLabel(completedMode)} complete`,
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
    preEndCueFiredRef.current = false;
    setMode(nextMode);
    setSecondsLeft(nextSecs);
    setStatus("idle");

    // Credit beat ONLY on natural Focus completion (00:00 path)
    if (completedMode === "focus") {
      setFocusCredited(true);
      showTransientToast({ kind: "focusComplete" }, 2500);
    }

    completingRef.current = false;
  }, [clearTick, durationFor, showTransientToast]);

  const maybeFirePreEndCue = useCallback(
    (nextSeconds: number) => {
      if (preEndCueFiredRef.current) return;
      if (modeRef.current !== "focus") return;
      if (statusRef.current !== "running") return;
      if (!stateRef.current.settings.preEndCueEnabled) return;
      // Bart contract: once in last 10s (not on skip/reset)
      if (nextSeconds > 10 || nextSeconds <= 0) return;
      preEndCueFiredRef.current = true;
      if (stateRef.current.settings.soundEnabled) playPreEndCue();
      showTransientToast({ kind: "preEnd" }, 4000);
    },
    [showTransientToast]
  );

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
      maybeFirePreEndCue(next);
    }, 1000);
  }, [clearTick, onSessionComplete, maybeFirePreEndCue]);

  useEffect(() => {
    return () => {
      clearTick();
      clearToastTimer();
    };
  }, [clearTick, clearToastTimer]);

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
      // If already in last 10s on restore, don't re-fire cue
      if (remaining <= 10) preEndCueFiredRef.current = true;
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
      if (secs <= 10) preEndCueFiredRef.current = true;
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
    preEndCueFiredRef.current = false;
    setFocusCredited(false);
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

  /** Reset without credit — caller must confirm for in-progress Focus. */
  const reset = useCallback(() => {
    clearTick();
    statusRef.current = "idle";
    setStatus("idle");
    const secs = durationFor(modeRef.current);
    secondsLeftRef.current = secs;
    setSecondsLeft(secs);
    preEndCueFiredRef.current = false;
    writeTimer({
      mode: modeRef.current,
      status: "idle",
      secondsLeft: secs,
      endsAt: null,
    });
  }, [clearTick, durationFor, writeTimer]);

  /** Skip without credit — caller must confirm for in-progress Focus. */
  const skip = useCallback(() => {
    clearTick();
    const current = modeRef.current;
    const nextMode: TimerMode = current === "focus" ? "shortBreak" : "focus";
    const secs = durationFor(nextMode);
    modeRef.current = nextMode;
    secondsLeftRef.current = secs;
    statusRef.current = "idle";
    preEndCueFiredRef.current = false;
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

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setPersistedState((prev) => {
        const settings = mergeSettings(prev.settings, patch);
        return { ...prev, settings };
      });

      // Soft presets / duration edits: refresh idle clock so Focus duration shows immediately
      const nextSettings = mergeSettings(stateRef.current.settings, patch);
      if (statusRef.current === "idle") {
        const secs = durationSecondsForMode(
          modeRef.current,
          nextSettings.durations,
          nextSettings.testOverrides
        );
        secondsLeftRef.current = secs;
        setSecondsLeft(secs);
        writeTimer({
          mode: modeRef.current,
          status: "idle",
          secondsLeft: secs,
          endsAt: null,
        });
      }
    },
    [writeTimer]
  );

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

  /** Apply a full replaced snapshot and sync live timer UI/refs. */
  const applyReplacedState = useCallback(
    (next: PersistedState) => {
      clearTick();
      clearToastTimer();
      completingRef.current = false;
      preEndCueFiredRef.current = false;
      setFocusCredited(false);
      setSessionToast(null);

      const today = getTodayLocalDateString(next.settings);
      const withDisplayStreak = {
        ...next,
        streak: resolveDisplayStreak(next.streak, today),
      };
      replacePersistedState(withDisplayStreak);

      const saved = withDisplayStreak.timer;
      const settings = withDisplayStreak.settings;

      if (saved.status === "running" && saved.endsAt != null) {
        const remaining = Math.ceil((saved.endsAt - Date.now()) / 1000);
        modeRef.current = saved.mode;
        setMode(saved.mode);
        if (remaining <= 0) {
          // Expired while away — land idle on that mode with full duration
          const secs = durationFor(saved.mode, settings);
          secondsLeftRef.current = secs;
          statusRef.current = "idle";
          endsAtRef.current = null;
          setSecondsLeft(secs);
          setStatus("idle");
          writeTimer({
            mode: saved.mode,
            status: "idle",
            secondsLeft: secs,
            endsAt: null,
          });
          return;
        }
        secondsLeftRef.current = remaining;
        statusRef.current = "running";
        endsAtRef.current = saved.endsAt;
        if (remaining <= 10) preEndCueFiredRef.current = true;
        setSecondsLeft(remaining);
        setStatus("running");
        writeTimer({
          mode: saved.mode,
          status: "running",
          secondsLeft: remaining,
          endsAt: saved.endsAt,
        });
        startTick();
        return;
      }

      if (saved.status === "paused") {
        const secs =
          saved.secondsLeft > 0
            ? saved.secondsLeft
            : durationFor(saved.mode, settings);
        modeRef.current = saved.mode;
        secondsLeftRef.current = secs;
        statusRef.current = "paused";
        endsAtRef.current = null;
        if (secs <= 10) preEndCueFiredRef.current = true;
        setMode(saved.mode);
        setSecondsLeft(secs);
        setStatus("paused");
        writeTimer({
          mode: saved.mode,
          status: "paused",
          secondsLeft: secs,
          endsAt: null,
        });
        return;
      }

      const idleSecs = durationFor(saved.mode, settings);
      modeRef.current = saved.mode;
      secondsLeftRef.current = idleSecs;
      statusRef.current = "idle";
      endsAtRef.current = null;
      setMode(saved.mode);
      setSecondsLeft(idleSecs);
      setStatus("idle");
      writeTimer({
        mode: saved.mode,
        status: "idle",
        secondsLeft: idleSecs,
        endsAt: null,
      });
    },
    [clearTick, clearToastTimer, durationFor, startTick, writeTimer]
  );

  const exportDataJson = useCallback(() => {
    return exportStateToJson(getSnapshot());
  }, []);

  const importDataJson = useCallback(
    (json: string) => {
      const next = importStateFromJson(json);
      applyReplacedState(next);
    },
    [applyReplacedState]
  );

  const clearAllData = useCallback(() => {
    applyReplacedState(clearToDefaultState());
  }, [applyReplacedState]);

  const resetClockToMode = useCallback(
    (m: TimerMode, settings?: AppSettings) => {
      clearTick();
      const secs = durationFor(m, settings ?? stateRef.current.settings);
      modeRef.current = m;
      secondsLeftRef.current = secs;
      statusRef.current = "idle";
      preEndCueFiredRef.current = false;
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

  const dismissFocusCredited = useCallback(() => {
    setFocusCredited(false);
  }, []);

  const dismissSessionToast = useCallback(() => {
    clearToastTimer();
    setSessionToast(null);
  }, [clearToastTimer]);

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

  /** In-progress Focus that would get zero credit if abandoned. */
  const focusInProgress =
    mode === "focus" && (status === "running" || status === "paused");

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
    focusCredited,
    dismissFocusCredited,
    sessionToast,
    dismissSessionToast,
    focusInProgress,
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
    exportDataJson,
    importDataJson,
    clearAllData,
    resetClockToMode,
  };
}

export type HabitStore = ReturnType<typeof useHabitStore>;
