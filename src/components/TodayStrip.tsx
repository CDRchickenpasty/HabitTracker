"use client";

import type { DailyStats, StreakState } from "@/lib/types";

interface TodayStripProps {
  todayStats: DailyStats;
  streak: StreakState;
  compact?: boolean;
}

export function TodayStrip({ todayStats, streak, compact = false }: TodayStripProps) {
  const focusCount = todayStats.focusSessionsCompleted;
  const streakDays = streak.currentStreak;

  if (compact) {
    return (
      <section
        aria-label="Today summary"
        className="flex items-center justify-center gap-4 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-2.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
      >
        <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-100">
          Today · {focusCount} Focus
        </span>
        <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-100">
          Streak · {streakDays} days
        </span>
      </section>
    );
  }

  // PL13: zero-day coaching hints on full strip only
  const todayHint = focusCount === 0 ? "not yet" : "Focus";
  const streakHint =
    focusCount === 0 && streakDays === 0
      ? "start today"
      : `best ${streak.bestStreak}`;

  return (
    <section
      aria-label="Today summary"
      className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
    >
      <Stat
        label="Today"
        value={String(focusCount)}
        hint={todayHint}
        caption={`Today · ${focusCount} Focus`}
      />
      <Stat
        label="Minutes"
        value={String(todayStats.focusMinutesCompleted)}
        hint="focus"
      />
      <Stat
        label="Streak"
        value={String(streakDays)}
        hint={streakHint}
        caption={`Streak · ${streakDays} days`}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  caption,
}: {
  label: string;
  value: string;
  hint: string;
  caption?: string;
}) {
  return (
    <div
      className="flex flex-col items-center rounded-xl bg-zinc-50 px-2 py-2 dark:bg-zinc-800/60"
      title={caption}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </span>
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</span>
    </div>
  );
}
