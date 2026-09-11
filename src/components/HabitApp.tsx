"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHabitStore } from "@/hooks/useHabitStore";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { formatTime, modeLabel } from "@/lib/timerUtils";
import { SettingsPanel } from "./SettingsPanel";
import { Timer } from "./Timer";
import { TodayStrip } from "./TodayStrip";
import { TodoList } from "./TodoList";

type AbandonAction = "reset" | "skip";

const DEFAULT_TITLE = "Habit Tracker — Pomodoro · Todos · Streaks";

export function HabitApp() {
  const store = useHabitStore();
  const { focusInProgress, reset, skip } = store;
  const [abandonPending, setAbandonPending] = useState<AbandonAction | null>(
    null
  );

  const requestAbandon = useCallback(
    (action: AbandonAction) => {
      if (focusInProgress) {
        setAbandonPending(action);
        return;
      }
      if (action === "reset") reset();
      else skip();
    },
    [focusInProgress, reset, skip]
  );

  const confirmAbandon = useCallback(() => {
    if (!abandonPending) return;
    if (abandonPending === "reset") reset();
    else skip();
    setAbandonPending(null);
  }, [abandonPending, reset, skip]);

  const cancelAbandon = useCallback(() => {
    setAbandonPending(null);
  }, []);

  // PL19: document.title with remaining time while timer active (no PWA)
  // Only restore DEFAULT_TITLE when becoming inactive or on unmount — never in
  // the effect cleanup on each secondsLeft tick (avoids tab-title flicker).
  useEffect(() => {
    if (!store.hydrated) return;
    const active = store.status === "running" || store.status === "paused";
    if (!active) {
      document.title = DEFAULT_TITLE;
      return;
    }
    const time = formatTime(store.secondsLeft);
    let suffix: string;
    if (store.mode === "focus") {
      if (store.activeTodo?.text) {
        const t = store.activeTodo.text;
        suffix = t.length > 40 ? `${t.slice(0, 37)}…` : t;
      } else {
        suffix = "Focus";
      }
    } else {
      suffix = modeLabel(store.mode);
    }
    document.title = `${time} · ${suffix}`;
  }, [
    store.hydrated,
    store.status,
    store.secondsLeft,
    store.mode,
    store.activeTodo,
  ]);

  useEffect(() => {
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, []);

  if (!store.hydrated) {
    return <HydrationSkeleton />;
  }

  const timerPrimary = store.status === "running" || store.status === "paused";
  /** Chrome-minimal Focus: digits + task + controls + today/streak only */
  const focusMinimal =
    store.mode === "focus" &&
    (store.status === "running" || store.status === "paused");

  const timerShared = {
    mode: store.mode,
    status: store.status,
    secondsLeft: store.secondsLeft,
    progress: store.progress,
    activeTodo: store.activeTodo,
    todos: store.todos,
    focusTowardLongBreak: store.focusTowardLongBreak,
    onStart: store.start,
    onPause: store.pause,
    onResume: store.resume,
    onReset: () => requestAbandon("reset"),
    onSkip: () => requestAbandon("skip"),
    onSelectTodo: store.selectTodo,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200 text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {!focusMinimal && (
        <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-2 pt-6 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Habit Tracker
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pomodoro · Todos · Streaks
            </p>
          </div>
          <button
            type="button"
            onClick={() => store.setSettingsOpen(true)}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            aria-haspopup="dialog"
          >
            Settings
          </button>
        </header>
      )}

      {focusMinimal && (
        <header className="mx-auto flex max-w-3xl items-center justify-end px-4 pt-4 sm:px-6">
          <button
            type="button"
            onClick={() => store.setSettingsOpen(true)}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-haspopup="dialog"
            aria-label="Open settings"
          >
            Settings
          </button>
        </header>
      )}

      <main
        id="main"
        className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-16 pt-2 sm:px-6"
      >
        <TodayStrip
          todayStats={store.todayStats}
          streak={store.streak}
          compact={focusMinimal}
        />

        {focusMinimal ? (
          <Timer {...timerShared} isPrimary minimal />
        ) : (
          <div className="flex flex-col gap-4">
            {timerPrimary ? (
              <>
                <Timer {...timerShared} isPrimary />
                <TodoList
                  todos={store.todos}
                  activeTodoId={store.activeTodoId}
                  isPrimary={false}
                  onAdd={store.addTodo}
                  onToggle={store.toggleTodo}
                  onDelete={store.deleteTodo}
                  onEdit={store.editTodo}
                  onSelect={store.selectTodo}
                />
              </>
            ) : (
              <>
                <TodoList
                  todos={store.todos}
                  activeTodoId={store.activeTodoId}
                  isPrimary
                  onAdd={store.addTodo}
                  onToggle={store.toggleTodo}
                  onDelete={store.deleteTodo}
                  onEdit={store.editTodo}
                  onSelect={store.selectTodo}
                />
                <Timer {...timerShared} isPrimary={false} />
              </>
            )}
          </div>
        )}
      </main>

      <SettingsPanel
        open={store.settingsOpen}
        onClose={() => store.setSettingsOpen(false)}
        settings={store.settings}
        streak={store.streak}
        focusTowardLongBreak={store.focusTowardLongBreak}
        onUpdateSettings={store.updateSettings}
        onSeedTesting={store.seedTesting}
      />

      {store.focusCredited && (
        <FocusCreditedBeat
          nextIsLongBreak={store.mode === "longBreak"}
          onTakeBreak={() => store.dismissFocusCredited()}
          onBackToToday={() => store.dismissFocusCredited()}
        />
      )}

      {abandonPending && (
        <AbandonConfirm onKeep={cancelAbandon} onEnd={confirmAbandon} />
      )}

      {store.sessionToast && (
        <SessionToastBanner
          kind={store.sessionToast.kind}
          onDismiss={store.dismissSessionToast}
        />
      )}
    </div>
  );
}

/** PL15: idle-layout skeleton while hydrating from localStorage */
function HydrationSkeleton() {
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-950 dark:to-zinc-900"
      aria-busy="true"
      aria-label="Loading Habit Tracker"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-2 pt-6 sm:px-6">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
          <div className="h-3 w-32 rounded bg-zinc-200/80 motion-safe:animate-pulse dark:bg-zinc-800/80" />
        </div>
        <div className="h-9 w-24 rounded-full bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-16 pt-2 sm:px-6">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/80">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 rounded-xl bg-zinc-50 px-2 py-3 dark:bg-zinc-800/60"
            >
              <div className="h-2.5 w-10 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-700" />
              <div className="h-7 w-8 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-700" />
              <div className="h-2.5 w-12 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-700" />
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4 h-5 w-20 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
          <div className="mb-4 h-11 w-full rounded-xl bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-12 rounded-xl bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800" />
            <div className="h-12 rounded-xl bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800" />
            <div className="h-12 rounded-xl bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="h-6 w-24 rounded-full bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
          <div className="h-[180px] w-[180px] rounded-full bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-800" />
          <div className="h-10 w-28 rounded-full bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

function FocusCreditedBeat({
  nextIsLongBreak,
  onTakeBreak,
  onBackToToday,
}: {
  nextIsLongBreak: boolean;
  onTakeBreak: () => void;
  onBackToToday: () => void;
}) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  // Escape = dismiss same as Back to Today (PL10)
  const handleClose = useCallback(() => onBackToToday(), [onBackToToday]);
  const panelRef = useDialogA11y(true, handleClose, primaryRef);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-credited-title"
      >
        <p
          id="focus-credited-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Focus credited
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Nice work. That session counts toward today and your streak.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBackToToday}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Back to Today
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onTakeBreak}
            className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {nextIsLongBreak ? "Take a long break" : "Take a short break"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AbandonConfirm({
  onKeep,
  onEnd,
}: {
  onKeep: () => void;
  onEnd: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  // Escape = Keep focusing (PL10); no backdrop dismiss
  const handleClose = useCallback(() => onKeep(), [onKeep]);
  const panelRef = useDialogA11y(true, handleClose, keepRef);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="abandon-title"
      >
        <p
          id="abandon-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          End Focus without credit?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          This session won’t count toward today or your streak.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            ref={keepRef}
            type="button"
            onClick={onKeep}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Keep focusing
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            End without credit
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionToastBanner({
  kind,
  onDismiss,
}: {
  kind: "preEnd" | "focusComplete";
  onDismiss: () => void;
}) {
  const message =
    kind === "preEnd"
      ? "Almost there — finish to credit this Focus"
      : "Focus complete";

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[70] w-[min(100%-2rem,24rem)] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
        <p className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          aria-label="Dismiss"
        >
          OK
        </button>
      </div>
    </div>
  );
}
