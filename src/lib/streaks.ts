import {
  localDayDiff,
  previousLocalDate,
  toLocalDateString,
} from "./dates";
import type { KindnessSettings, StreakState } from "./types";
import { DEFAULT_STREAK } from "./types";

/**
 * Streak rules (v2):
 * - A day qualifies if ≥1 Focus session is COMPLETED that local calendar day.
 * - Incomplete / paused / skipped Focus sessions never count.
 * - Breaks never count.
 * - Day = device local date (YYYY-MM-DD), not UTC.
 * - Current streak = consecutive qualifying days ending today or yesterday
 *   (if today has not yet qualified, streak can still be alive from yesterday).
 * - Kindness (when enabled): planned off-days and freeze-used dates bridge gaps;
 *   freeze tokens are earned every N qualifying days.
 */

function isBridgeDay(
  date: string,
  streak: StreakState,
  kindnessEnabled: boolean
): boolean {
  if (!kindnessEnabled) return false;
  return (
    streak.offDays.includes(date) || streak.freezeUsedDates.includes(date)
  );
}

/**
 * True when the streak is still alive as of `today`.
 * Alive if last qualifying is today or yesterday, or every day between
 * lastQualifyingDate and today is an off-day / freeze day (kindness on).
 */
export function isStreakAlive(
  streak: StreakState,
  today: string,
  kindnessEnabled: boolean
): boolean {
  const last = streak.lastQualifyingDate;
  if (!last) return false;
  if (last === today) return true;
  if (last === previousLocalDate(today)) return true;

  if (!kindnessEnabled) return false;
  if (localDayDiff(today, last) <= 0) return false;

  // Every day strictly after `last` and strictly before `today` must be bridged.
  // Also yesterday must be bridged if last is older than yesterday.
  let cursor = previousLocalDate(today);
  const guard = 400;
  for (let i = 0; i < guard; i++) {
    if (cursor === last) return true;
    if (localDayDiff(cursor, last) <= 0) {
      // Walked past last without hitting it
      return cursor === last;
    }
    if (!isBridgeDay(cursor, streak, true)) return false;
    cursor = previousLocalDate(cursor);
  }
  return false;
}

/**
 * Recompute displayed current streak given stored state and today's date.
 * Bridges planned off-days and freeze-used dates when kindness is enabled.
 */
export function resolveDisplayStreak(
  streak: StreakState,
  today: string = toLocalDateString(),
  kindness?: KindnessSettings | null
): StreakState {
  const kindnessEnabled = kindness?.enabled ?? true;
  const { lastQualifyingDate } = streak;

  if (!lastQualifyingDate) {
    return { ...streak, currentStreak: 0 };
  }

  if (isStreakAlive(streak, today, kindnessEnabled)) {
    return streak;
  }

  return { ...streak, currentStreak: 0 };
}

export function applyFocusCompletionToStreak(
  streak: StreakState,
  today: string = toLocalDateString(),
  kindness?: KindnessSettings | null
): StreakState {
  const kindnessEnabled = kindness?.enabled ?? true;
  const freezeEvery = Math.max(1, kindness?.freezeEveryNDays ?? 7);
  const { lastQualifyingDate, currentStreak, bestStreak } = streak;

  // Already counted today
  if (lastQualifyingDate === today) {
    return streak;
  }

  let nextCurrent: number;
  if (lastQualifyingDate === null) {
    nextCurrent = 1;
  } else if (
    lastQualifyingDate === previousLocalDate(today) ||
    (kindnessEnabled && isStreakAlive(streak, today, true))
  ) {
    nextCurrent = currentStreak + 1;
  } else {
    nextCurrent = 1;
  }

  let freezeTokens = streak.freezeTokens;
  let towardNextFreeze = streak.towardNextFreeze;

  if (kindnessEnabled) {
    towardNextFreeze += 1;
    if (towardNextFreeze >= freezeEvery) {
      freezeTokens += 1;
      towardNextFreeze = 0;
    }
  }

  return {
    ...streak,
    lastQualifyingDate: today,
    currentStreak: nextCurrent,
    bestStreak: Math.max(bestStreak, nextCurrent),
    freezeTokens,
    towardNextFreeze,
  };
}

/** Mark a local date as a planned off-day. */
export function addOffDay(streak: StreakState, date: string): StreakState {
  if (streak.offDays.includes(date)) return streak;
  return { ...streak, offDays: [...streak.offDays, date].sort() };
}

export function removeOffDay(streak: StreakState, date: string): StreakState {
  return {
    ...streak,
    offDays: streak.offDays.filter((d) => d !== date),
  };
}

/**
 * Spend one freeze token to cover `date` (typically yesterday).
 * Returns null if no tokens available or date already bridged/qualified.
 */
export function spendFreeze(
  streak: StreakState,
  date: string
): StreakState | null {
  if (streak.freezeTokens < 1) return null;
  if (streak.freezeUsedDates.includes(date)) return null;
  if (streak.offDays.includes(date)) return null;
  if (streak.lastQualifyingDate === date) return null;

  return {
    ...streak,
    freezeTokens: streak.freezeTokens - 1,
    freezeUsedDates: [...streak.freezeUsedDates, date].sort(),
  };
}

/**
 * Repair: treat `date` as a qualifying day without a Focus.
 * Consumes one repair. Returns null if none left.
 */
export function applyRepair(
  streak: StreakState,
  date: string,
  today: string = toLocalDateString(),
  kindness?: KindnessSettings | null
): StreakState | null {
  if (streak.repairsRemaining < 1) return null;
  if (streak.lastQualifyingDate === date) return null;

  const withRepairBudget: StreakState = {
    ...streak,
    repairsRemaining: streak.repairsRemaining - 1,
  };

  const applied = applyFocusCompletionToStreak(withRepairBudget, date, kindness);
  return resolveDisplayStreak(applied, today, kindness);
}

export function mergeStreakState(
  raw: Partial<StreakState> | undefined
): StreakState {
  return {
    lastQualifyingDate:
      typeof raw?.lastQualifyingDate === "string"
        ? raw.lastQualifyingDate
        : null,
    currentStreak:
      typeof raw?.currentStreak === "number" && Number.isFinite(raw.currentStreak)
        ? Math.max(0, Math.floor(raw.currentStreak))
        : 0,
    bestStreak:
      typeof raw?.bestStreak === "number" && Number.isFinite(raw.bestStreak)
        ? Math.max(0, Math.floor(raw.bestStreak))
        : 0,
    offDays: Array.isArray(raw?.offDays)
      ? raw!.offDays.filter((d): d is string => typeof d === "string")
      : [],
    freezeTokens:
      typeof raw?.freezeTokens === "number" && Number.isFinite(raw.freezeTokens)
        ? Math.max(0, Math.floor(raw.freezeTokens))
        : 0,
    freezeUsedDates: Array.isArray(raw?.freezeUsedDates)
      ? raw!.freezeUsedDates.filter((d): d is string => typeof d === "string")
      : [],
    towardNextFreeze:
      typeof raw?.towardNextFreeze === "number" &&
      Number.isFinite(raw.towardNextFreeze)
        ? Math.max(0, Math.floor(raw.towardNextFreeze))
        : 0,
    repairsRemaining:
      typeof raw?.repairsRemaining === "number" &&
      Number.isFinite(raw.repairsRemaining)
        ? Math.max(0, Math.floor(raw.repairsRemaining))
        : DEFAULT_STREAK.repairsRemaining,
  };
}
