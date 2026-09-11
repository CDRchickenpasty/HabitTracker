"use client";

import { useCallback, useState } from "react";
import { useHabitStore } from "@/hooks/useHabitStore";
import { SettingsPanel } from "./SettingsPanel";
import { Timer } from "./Timer";
import { TodayStrip } from "./TodayStrip";
import { TodoList } from "./TodoList";

type AbandonAction = "reset" | "skip";

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

  if (!store.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        Loading…
      </div>
    );
  }

  const timerPrimary = store.status === "running" || store.status === "paused";
  /** Chrome-minimal Focus: digits + task + controls + today/streak only */
  const focusMinimal =
    store.mode === "focus" &&
    (store.status === "running" || store.status === "paused");

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
          <Timer
            mode={store.mode}
            status={store.status}
            secondsLeft={store.secondsLeft}
            progress={store.progress}
            activeTodo={store.activeTodo}
            focusTowardLongBreak={store.focusTowardLongBreak}
            isPrimary
            minimal
            onStart={store.start}
            onPause={store.pause}
            onResume={store.resume}
            onReset={() => requestAbandon("reset")}
            onSkip={() => requestAbandon("skip")}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {timerPrimary ? (
              <>
                <Timer
                  mode={store.mode}
                  status={store.status}
                  secondsLeft={store.secondsLeft}
                  progress={store.progress}
                  activeTodo={store.activeTodo}
                  focusTowardLongBreak={store.focusTowardLongBreak}
                  isPrimary
                  onStart={store.start}
                  onPause={store.pause}
                  onResume={store.resume}
                  onReset={() => requestAbandon("reset")}
                  onSkip={() => requestAbandon("skip")}
                />
                <TodoList
                  todos={store.todos}
                  activeTodoId={store.activeTodoId}
                  isPrimary={false}
                  todayStats={store.todayStats}
                  streak={store.streak}
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
                  todayStats={store.todayStats}
                  streak={store.streak}
                  onAdd={store.addTodo}
                  onToggle={store.toggleTodo}
                  onDelete={store.deleteTodo}
                  onEdit={store.editTodo}
                  onSelect={store.selectTodo}
                />
                <Timer
                  mode={store.mode}
                  status={store.status}
                  secondsLeft={store.secondsLeft}
                  progress={store.progress}
                  activeTodo={store.activeTodo}
                  focusTowardLongBreak={store.focusTowardLongBreak}
                  isPrimary={false}
                  onStart={store.start}
                  onPause={store.pause}
                  onResume={store.resume}
                  onReset={() => requestAbandon("reset")}
                  onSkip={() => requestAbandon("skip")}
                />
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
        <AbandonConfirm
          onKeep={() => setAbandonPending(null)}
          onEnd={confirmAbandon}
        />
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

function FocusCreditedBeat({
  nextIsLongBreak,
  onTakeBreak,
  onBackToToday,
}: {
  nextIsLongBreak: boolean;
  onTakeBreak: () => void;
  onBackToToday: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-credited-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
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
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="abandon-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
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
