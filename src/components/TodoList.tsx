"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { DailyStats, StreakState, Todo } from "@/lib/types";

interface TodoListProps {
  todos: Todo[];
  activeTodoId: string | null;
  isPrimary: boolean;
  todayStats: DailyStats;
  streak: StreakState;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onSelect: (id: string) => void;
}

export function TodoList({
  todos,
  activeTodoId,
  isPrimary,
  todayStats,
  streak,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onSelect,
}: TodoListProps) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onAdd(text);
    setText("");
  }

  function beginEdit(todo: Todo) {
    setEditingId(todo.id);
    setDraft(todo.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  function commitEdit(id: string) {
    const trimmed = draft.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    onEdit(id, trimmed);
    setEditingId(null);
    setDraft("");
  }

  const focusCount = todayStats.focusSessionsCompleted;
  const streakDays = streak.currentStreak;

  return (
    <section
      aria-label="Todos"
      className={`rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${
        isPrimary ? "p-5" : "p-4"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Todos
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
          <span>Today · {focusCount} Focus</span>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <span>Streak · {streakDays} days</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <label htmlFor="new-todo" className="sr-only">
          New todo
        </label>
        <input
          ref={addInputRef}
          id="new-todo"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task…"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-rose-900"
        />
        <button
          type="submit"
          className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          Add
        </button>
      </form>

      {todos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center dark:border-zinc-600">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Nothing on Today yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Add a task, start a Focus, finish the timer. Only completed Focus
            counts toward your streak.
          </p>
          <button
            type="button"
            onClick={() => addInputRef.current?.focus()}
            className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Add a task
          </button>
        </div>
      ) : (
        <>
          {!activeTodoId && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 dark:border-rose-500/40 dark:bg-rose-950/30">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                Pick a task to focus
              </p>
              <p className="mt-1 text-xs leading-relaxed text-rose-800/90 dark:text-rose-200/90">
                Select one, start the timer, and finish to credit Focus.
                Skipping or abandoning doesn’t count.
              </p>
            </div>
          )}
          <ul className="flex flex-col gap-2" role="list">
            {todos.map((todo) => {
              const selected = todo.id === activeTodoId;
              const editing = editingId === todo.id;
              return (
                <li
                  key={todo.id}
                  className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${
                    selected
                      ? "border-rose-400 bg-rose-50 dark:border-rose-500/60 dark:bg-rose-950/40"
                      : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => onToggle(todo.id)}
                    aria-label={`Mark "${todo.text}" ${todo.completed ? "incomplete" : "complete"}`}
                    className="h-4 w-4 shrink-0 rounded border-zinc-400 text-rose-500 focus:ring-rose-400"
                  />
                  {editing ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitEdit(todo.id);
                      }}
                    >
                      <label htmlFor={`edit-${todo.id}`} className="sr-only">
                        Edit todo text
                      </label>
                      <input
                        ref={editInputRef}
                        id={`edit-${todo.id}`}
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-rose-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-rose-600 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                      <button
                        type="submit"
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950"
                        aria-label="Save todo"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        aria-label="Cancel edit"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelect(todo.id)}
                        aria-pressed={selected}
                        aria-label={
                          selected
                            ? `Deselect "${todo.text}" as focus task`
                            : `Select "${todo.text}" as focus task`
                        }
                        className={`min-w-0 flex-1 truncate text-left text-sm ${
                          todo.completed
                            ? "text-zinc-400 line-through"
                            : "text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {todo.text}
                        {selected && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                            Focusing
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => beginEdit(todo)}
                        aria-label={`Edit "${todo.text}"`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(todo.id)}
                        aria-label={`Delete "${todo.text}"`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Completing a Focus session does not auto-complete the linked todo.
        Streaks count only completed Focus sessions (≥1 per local day).
      </p>
    </section>
  );
}
