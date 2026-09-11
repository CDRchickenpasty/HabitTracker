"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatTime, modeLabel } from "@/lib/timerUtils";
import type { TimerMode, TimerStatus, Todo } from "@/lib/types";

interface TimerProps {
  mode: TimerMode;
  status: TimerStatus;
  secondsLeft: number;
  progress: number;
  activeTodo: Todo | null;
  todos?: Todo[];
  focusTowardLongBreak: number;
  isPrimary: boolean;
  minimal?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
  onSelectTodo?: (id: string) => void;
}

const MODE_ACCENT: Record<TimerMode, string> = {
  focus: "stroke-rose-500",
  shortBreak: "stroke-emerald-500",
  longBreak: "stroke-sky-500",
};

const MODE_BG: Record<TimerMode, string> = {
  focus: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  shortBreak: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  longBreak: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export function Timer({
  mode,
  status,
  secondsLeft,
  progress,
  activeTodo,
  todos = [],
  focusTowardLongBreak,
  isPrimary,
  minimal = false,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
  onSelectTodo,
}: TimerProps) {
  const size = isPrimary ? 260 : 180;
  const stroke = isPrimary ? 10 : 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));

  const announceId = useId();
  const [announce, setAnnounce] = useState("");
  const prevStatusRef = useRef(status);
  const prevModeRef = useRef(mode);
  const mountedRef = useRef(false);

  // PL14: announce status/mode transitions only (not every tick)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevStatusRef.current = status;
      prevModeRef.current = mode;
      return;
    }
    const parts: string[] = [];
    if (prevModeRef.current !== mode) {
      parts.push(`${modeLabel(mode)} mode`);
    }
    if (prevStatusRef.current !== status) {
      if (status === "running") {
        parts.push(prevStatusRef.current === "paused" ? "Resumed" : "Started");
      } else if (status === "paused") {
        parts.push("Paused");
      } else if (status === "idle") {
        if (
          prevStatusRef.current === "running" ||
          prevStatusRef.current === "paused"
        ) {
          parts.push(
            prevModeRef.current !== mode
              ? `${modeLabel(mode)} ready`
              : "Timer reset"
          );
        }
      }
    }
    if (parts.length > 0) {
      setAnnounce(parts.join(". ") + ".");
    }
    prevStatusRef.current = status;
    prevModeRef.current = mode;
  }, [status, mode]);

  const isBreak = mode === "shortBreak" || mode === "longBreak";
  const canPickTask =
    Boolean(onSelectTodo) &&
    ((minimal &&
      mode === "focus" &&
      (status === "running" || status === "paused")) ||
      isBreak);

  return (
    <section
      aria-label="Pomodoro timer"
      className={`flex flex-col items-center rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${
        isPrimary ? "gap-5" : "gap-3"
      }`}
    >
      {!minimal && (
        <div className="flex w-full items-center justify-between gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${MODE_BG[mode]}`}
          >
            {modeLabel(mode)}
          </span>
          <span
            className="text-xs text-zinc-500 dark:text-zinc-400"
            title="Completed Focus sessions toward next long break (Skip does not count)"
          >
            Long break in {Math.max(0, 4 - focusTowardLongBreak)}
          </span>
        </div>
      )}

      {minimal && (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${MODE_BG[mode]}`}
        >
          {modeLabel(mode)}
        </span>
      )}

      <div
        className="relative"
        style={{ width: size, height: size }}
        role="timer"
        aria-live="off"
        aria-atomic="true"
        aria-label={`${modeLabel(mode)}: ${formatTime(secondsLeft)} remaining`}
      >
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-zinc-100 dark:stroke-zinc-800"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className={`${MODE_ACCENT[mode]} transition-[stroke-dashoffset] duration-1000 ease-linear`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          <span
            className={`font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 ${
              isPrimary ? "text-5xl sm:text-6xl" : "text-4xl"
            }`}
            aria-hidden
          >
            {formatTime(secondsLeft)}
          </span>
        </div>
      </div>

      <div
        id={announceId}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announce}
      </div>

      <UnderClockTask
        mode={mode}
        activeTodo={activeTodo}
        todos={todos}
        canPickTask={canPickTask}
        onSelectTodo={onSelectTodo}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        {status === "idle" && (
          <ControlButton onClick={onStart} variant="primary" ariaLabel="Start timer">
            Start
          </ControlButton>
        )}
        {status === "running" && (
          <>
            <ControlButton onClick={onPause} variant="primary" ariaLabel="Pause timer">
              Pause
            </ControlButton>
            <ControlButton onClick={onReset} variant="secondary" ariaLabel="Reset timer">
              Reset
            </ControlButton>
            <ControlButton onClick={onSkip} variant="secondary" ariaLabel="Skip session">
              Skip
            </ControlButton>
          </>
        )}
        {status === "paused" && (
          <>
            <ControlButton onClick={onResume} variant="primary" ariaLabel="Resume timer">
              Resume
            </ControlButton>
            <ControlButton onClick={onReset} variant="secondary" ariaLabel="Reset timer">
              Reset
            </ControlButton>
            <ControlButton onClick={onSkip} variant="secondary" ariaLabel="Skip session">
              Skip
            </ControlButton>
          </>
        )}
      </div>
    </section>
  );
}

function UnderClockTask({
  mode,
  activeTodo,
  todos,
  canPickTask,
  onSelectTodo,
}: {
  mode: TimerMode;
  activeTodo: Todo | null;
  todos: Todo[];
  canPickTask: boolean;
  onSelectTodo?: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const isBreak = mode === "shortBreak" || mode === "longBreak";

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPickerOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || triggerRef.current?.contains(t)) {
        return;
      }
      setPickerOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [pickerOpen]);

  if (mode === "focus") {
    const label = activeTodo ? activeTodo.text : "Pick a task to focus";
    const isCta = !activeTodo;

    if (canPickTask && onSelectTodo) {
      return (
        <div className="relative flex w-full max-w-sm flex-col items-center">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            className={`max-w-full truncate rounded-full px-3 py-1.5 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
              isCta
                ? "text-sm font-medium text-rose-600/90 hover:bg-rose-50 dark:text-rose-300/90 dark:hover:bg-rose-950/40"
                : "text-base font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            }`}
            title={activeTodo?.text}
          >
            {label}
            <span className="ml-1 text-[10px] font-normal text-zinc-400" aria-hidden>
              ▾
            </span>
          </button>
          {pickerOpen && (
            <TaskPicker
              listRef={listRef}
              todos={todos}
              activeTodoId={activeTodo?.id ?? null}
              onSelect={(id) => {
                onSelectTodo(id);
                setPickerOpen(false);
                triggerRef.current?.focus();
              }}
              onClose={() => {
                setPickerOpen(false);
                triggerRef.current?.focus();
              }}
            />
          )}
        </div>
      );
    }

    return (
      <p
        className={`max-w-sm truncate text-center ${
          isCta
            ? "text-sm font-medium text-rose-600/90 dark:text-rose-300/90"
            : "text-base font-medium text-zinc-800 dark:text-zinc-100"
        }`}
        title={activeTodo?.text}
      >
        {label}
      </p>
    );
  }

  if (isBreak) {
    if (canPickTask && onSelectTodo) {
      const label = activeTodo
        ? activeTodo.text
        : "Pick a task for your next Focus";
      const isCta = !activeTodo;
      return (
        <div className="relative flex w-full max-w-sm flex-col items-center">
          {activeTodo && (
            <span className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Up next
            </span>
          )}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            className={`max-w-full truncate rounded-full px-3 py-1.5 text-center text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
              isCta
                ? "font-medium text-rose-600/90 hover:bg-rose-50 dark:text-rose-300/90 dark:hover:bg-rose-950/40"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            title={activeTodo?.text}
          >
            {label}
            <span className="ml-1 text-[10px] font-normal text-zinc-400" aria-hidden>
              ▾
            </span>
          </button>
          {pickerOpen && (
            <TaskPicker
              listRef={listRef}
              todos={todos}
              activeTodoId={activeTodo?.id ?? null}
              onSelect={(id) => {
                onSelectTodo(id);
                setPickerOpen(false);
                triggerRef.current?.focus();
              }}
              onClose={() => {
                setPickerOpen(false);
                triggerRef.current?.focus();
              }}
            />
          )}
        </div>
      );
    }

    if (activeTodo) {
      return (
        <p className="max-w-sm truncate text-center text-sm text-zinc-500 dark:text-zinc-400">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Up next
          </span>
          {activeTodo.text}
        </p>
      );
    }

    return (
      <p className="max-w-sm truncate text-center text-sm font-medium text-rose-600/90 dark:text-rose-300/90">
        Pick a task for your next Focus
      </p>
    );
  }

  return null;
}

function TaskPicker({
  listRef,
  todos,
  activeTodoId,
  onSelect,
  onClose,
}: {
  listRef: React.RefObject<HTMLUListElement | null>;
  todos: Todo[];
  activeTodoId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const incomplete = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => t.completed);
  const ordered = [...incomplete, ...completed];

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Choose focus task"
      className="absolute top-full z-20 mt-2 max-h-56 w-[min(100%,18rem)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
    >
      {ordered.length === 0 ? (
        <li className="px-3 py-3 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Add a task from Todos when you pause
          <button
            type="button"
            onClick={onClose}
            className="mt-2 block w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Dismiss
          </button>
        </li>
      ) : (
        ordered.map((todo) => {
          const selected = todo.id === activeTodoId;
          return (
            <li key={todo.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelect(todo.id)}
                className={`flex w-full items-center gap-2 truncate px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  todo.completed
                    ? "text-zinc-400 line-through"
                    : "text-zinc-900 dark:text-zinc-100"
                } ${selected ? "bg-rose-50 dark:bg-rose-950/40" : ""}`}
              >
                {todo.text}
                {selected && (
                  <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-300">
                    Current
                  </span>
                )}
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
}

function ControlButton({
  children,
  onClick,
  variant,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant: "primary" | "secondary";
  ariaLabel: string;
}) {
  const base =
    "rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
