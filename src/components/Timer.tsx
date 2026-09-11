"use client";

import { formatTime, modeLabel } from "@/lib/timerUtils";
import type { TimerMode, TimerStatus, Todo } from "@/lib/types";

interface TimerProps {
  mode: TimerMode;
  status: TimerStatus;
  secondsLeft: number;
  progress: number;
  activeTodo: Todo | null;
  focusTowardLongBreak: number;
  isPrimary: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
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
  focusTowardLongBreak,
  isPrimary,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
}: TimerProps) {
  const size = isPrimary ? 260 : 180;
  const stroke = isPrimary ? 10 : 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <section
      aria-label="Pomodoro timer"
      className={`flex flex-col items-center rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${
        isPrimary ? "gap-5" : "gap-3"
      }`}
    >
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

      <div
        className="relative"
        style={{ width: size, height: size }}
        role="timer"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`${modeLabel(mode)}: ${formatTime(secondsLeft)} remaining`}
      >
        <svg width={size} height={size} className="-rotate-90">
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 ${
              isPrimary ? "text-5xl sm:text-6xl" : "text-4xl"
            }`}
          >
            {formatTime(secondsLeft)}
          </span>
          <span className="mt-1 max-w-[12rem] truncate text-center text-sm text-zinc-500 dark:text-zinc-400">
            {activeTodo ? activeTodo.text : "No task selected"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {status === "idle" && (
          <ControlButton onClick={onStart} variant="primary" ariaLabel="Start timer">
            Start
          </ControlButton>
        )}
        {status === "running" && (
          <ControlButton onClick={onPause} variant="primary" ariaLabel="Pause timer">
            Pause
          </ControlButton>
        )}
        {status === "paused" && (
          <ControlButton onClick={onResume} variant="primary" ariaLabel="Resume timer">
            Resume
          </ControlButton>
        )}
        <ControlButton onClick={onReset} variant="secondary" ariaLabel="Reset timer">
          Reset
        </ControlButton>
        <ControlButton onClick={onSkip} variant="secondary" ariaLabel="Skip session">
          Skip
        </ControlButton>
      </div>
    </section>
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
