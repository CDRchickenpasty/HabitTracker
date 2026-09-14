"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { getTodayLocalDateString, previousLocalDate } from "@/lib/dates";
import {
  buildHeatmapDays,
  sessionsForDate,
  type HeatmapDay,
} from "@/lib/history";
import type {
  AppSettings,
  DailyStats,
  FocusSession,
  StreakState,
} from "@/lib/types";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  dailyStats: Record<string, DailyStats>;
  focusSessions: FocusSession[];
  streak: StreakState;
  settings: AppSettings;
  onMarkOffDay: (date: string) => void;
  onUnmarkOffDay: (date: string) => void;
  onUseFreeze: (date: string) => void;
  onRepair: (date: string) => void;
}

const LEVEL_CLASS: Record<HeatmapDay["level"], string> = {
  0: "bg-zinc-100 dark:bg-zinc-800",
  1: "bg-[color:var(--accent-200)] dark:bg-[color:var(--accent-900)]",
  2: "bg-[color:var(--accent-300)] dark:bg-[color:var(--accent-700)]",
  3: "bg-[color:var(--accent-400)] dark:bg-[color:var(--accent-600)]",
  4: "bg-[color:var(--accent-500)] dark:bg-[color:var(--accent-500)]",
};

export function HistoryPanel({
  open,
  onClose,
  dailyStats,
  focusSessions,
  streak,
  settings,
  onMarkOffDay,
  onUnmarkOffDay,
  onUseFreeze,
  onRepair,
}: HistoryPanelProps) {
  const today = getTodayLocalDateString(settings);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => onClose(), [onClose]);
  const panelRef = useDialogA11y(open, handleClose, closeBtnRef);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = useMemo(
    () => buildHeatmapDays(dailyStats, today, 16),
    [dailyStats, today]
  );

  const selected = selectedDate ?? today;
  const daySessions = useMemo(
    () => sessionsForDate(focusSessions, selected),
    [focusSessions, selected]
  );
  const dayStats = dailyStats[selected];
  const isOff = streak.offDays.includes(selected);
  const isFrozen = streak.freezeUsedDates.includes(selected);
  const yesterday = previousLocalDate(today);
  const kindnessOn = settings.kindness.enabled;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="history-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            History
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Close history"
          >
            Close
          </button>
        </div>

        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Last 16 weeks · darker = more Focus minutes
        </p>

        <div
          className="mb-5 grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1"
          role="grid"
          aria-label="Focus activity heatmap"
        >
          {days.map((day) => {
            const selectedDay = day.date === selected;
            const bridged =
              streak.offDays.includes(day.date) ||
              streak.freezeUsedDates.includes(day.date);
            return (
              <button
                key={day.date}
                type="button"
                role="gridcell"
                title={`${day.date}: ${day.minutes} min · ${day.sessions} Focus`}
                aria-label={`${day.date}, ${day.minutes} focus minutes, ${day.sessions} sessions`}
                aria-selected={selectedDay}
                onClick={() => setSelectedDate(day.date)}
                className={`h-3 w-3 rounded-sm sm:h-3.5 sm:w-3.5 ${LEVEL_CLASS[day.level]} ${
                  selectedDay
                    ? "ring-2 ring-[color:var(--accent-500)] ring-offset-1 dark:ring-offset-zinc-900"
                    : ""
                } ${bridged && day.level === 0 ? "outline outline-1 outline-dashed outline-zinc-400" : ""}`}
              />
            );
          })}
        </div>

        <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {selected}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            {dayStats
              ? `${dayStats.focusSessionsCompleted} Focus · ${dayStats.focusMinutesCompleted} minutes`
              : "No Focus completed"}
            {isOff ? " · Planned off-day" : ""}
            {isFrozen ? " · Freeze used" : ""}
          </p>

          {kindnessOn && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  isOff ? onUnmarkOffDay(selected) : onMarkOffDay(selected)
                }
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {isOff ? "Remove off-day" : "Mark off-day"}
              </button>
              {selected === yesterday && streak.freezeTokens > 0 && !isFrozen && (
                <button
                  type="button"
                  onClick={() => onUseFreeze(selected)}
                  className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  Use freeze ({streak.freezeTokens})
                </button>
              )}
              {selected === yesterday &&
                streak.repairsRemaining > 0 &&
                streak.lastQualifyingDate !== selected && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Repair yesterday as a qualifying day? This uses your one repair."
                        )
                      ) {
                        onRepair(selected);
                      }
                    }}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                  >
                    Repair ({streak.repairsRemaining})
                  </button>
                )}
            </div>
          )}
        </div>

        <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Sessions
        </h3>
        {daySessions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No completed Focus sessions this day.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {daySessions.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                  {s.plannedMinutes}m
                </span>
                <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
                <span className="text-zinc-600 dark:text-zinc-300">
                  {s.todoTextSnapshot ?? "No task linked"}
                </span>
                <span className="mt-0.5 block text-[11px] text-zinc-400">
                  {new Date(s.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {kindnessOn && (
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Freeze tokens: {streak.freezeTokens} · Toward next:{" "}
            {streak.towardNextFreeze}/{settings.kindness.freezeEveryNDays} ·
            Repairs left: {streak.repairsRemaining}
          </p>
        )}
      </div>
    </div>
  );
}
