import { previousLocalDate, toLocalDateString, localDayDiff } from "./dates";
import type { StreakState } from "./types";

/**
 * Streak rules (v1):
 * - A day qualifies if ≥1 Focus session is COMPLETED that local calendar day.
 * - Incomplete / paused / skipped Focus sessions never count.
 * - Breaks never count.
 * - Day = device local date (YYYY-MM-DD), not UTC.
 * - Current streak = consecutive qualifying days ending today or yesterday
 *   (if today has not yet qualified, streak can still be alive from yesterday).
 */

export function applyFocusCompletionToStreak(
  streak: StreakState,
  today: string = toLocalDateString()
): StreakState {
  const { lastQualifyingDate, currentStreak, bestStreak } = streak;

  // Already counted today
  if (lastQualifyingDate === today) {
    return streak;
  }

  let nextCurrent: number;
  if (lastQualifyingDate === null) {
    nextCurrent = 1;
  } else if (lastQualifyingDate === previousLocalDate(today)) {
    nextCurrent = currentStreak + 1;
  } else {
    // Gap — streak resets
    nextCurrent = 1;
  }

  return {
    lastQualifyingDate: today,
    currentStreak: nextCurrent,
    bestStreak: Math.max(bestStreak, nextCurrent),
  };
}

/**
 * Recompute displayed current streak given stored state and today's date.
 * If last qualifying day was before yesterday, current streak is 0.
 * If last was yesterday and today hasn't qualified yet, keep current.
 * If last was today, keep current.
 */
export function resolveDisplayStreak(
  streak: StreakState,
  today: string = toLocalDateString()
): StreakState {
  const { lastQualifyingDate, currentStreak, bestStreak } = streak;

  if (!lastQualifyingDate) {
    return { ...streak, currentStreak: 0 };
  }

  if (lastQualifyingDate === today) {
    return streak;
  }

  if (lastQualifyingDate === previousLocalDate(today)) {
    // Still alive — waiting for today's Focus
    return streak;
  }

  // Broken
  if (localDayDiff(today, lastQualifyingDate) > 1) {
    return {
      lastQualifyingDate,
      currentStreak: 0,
      bestStreak,
    };
  }

  return { lastQualifyingDate, currentStreak, bestStreak };
}
