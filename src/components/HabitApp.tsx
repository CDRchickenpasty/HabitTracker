"use client";

import { useHabitStore } from "@/hooks/useHabitStore";
import { SettingsPanel } from "./SettingsPanel";
import { Timer } from "./Timer";
import { TodayStrip } from "./TodayStrip";
import { TodoList } from "./TodoList";

export function HabitApp() {
  const store = useHabitStore();

  if (!store.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        Loading…
      </div>
    );
  }

  const timerPrimary = store.status === "running" || store.status === "paused";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200 text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

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

      <main
        id="main"
        className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-16 pt-2 sm:px-6"
      >
        <TodayStrip todayStats={store.todayStats} streak={store.streak} />

        <div
          className={`flex flex-col gap-4 ${
            timerPrimary ? "md:flex-col" : "md:flex-col"
          }`}
        >
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
                onReset={store.reset}
                onSkip={store.skip}
              />
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
                onReset={store.reset}
                onSkip={store.skip}
              />
            </>
          )}
        </div>
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
    </div>
  );
}
