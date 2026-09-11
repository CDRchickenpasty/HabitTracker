"use client";

import type { DailyStats, StreakState } from "@/lib/types";

interface TodayStripProps {
  todayStats: DailyStats;
  streak: StreakState;
}

export function TodayStrip({ todayStats, streak }: TodayStripProps) {
  return (
    <section
      aria-label="Today summary"
      className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
    >
      <Stat
        label="Focus today"
        value={String(todayStats.focusSessionsCompleted)}
        hint="sessions"
      />
      <Stat
        label="Minutes"
        value={String(todayStats.focusMinutesCompleted)}
        hint="focus"
      />
      <Stat
        label="Streak"
        value={String(streak.currentStreak)}
        hint={`best ${streak.bestStreak}`}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-zinc-50 px-2 py-2 dark:bg-zinc-800/60">
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
