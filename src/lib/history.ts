import { previousLocalDate, toLocalDateString } from "./dates";
import {
  MAX_FOCUS_SESSIONS,
  type DailyStats,
  type FocusSession,
} from "./types";

export function createFocusSession(input: {
  completedAt?: number;
  localDate: string;
  plannedMinutes: number;
  todoId?: string | null;
  todoTextSnapshot?: string | null;
  id?: string;
}): FocusSession {
  return {
    id: input.id ?? crypto.randomUUID(),
    completedAt: input.completedAt ?? Date.now(),
    localDate: input.localDate,
    plannedMinutes: Math.max(1, Math.floor(input.plannedMinutes)),
    todoId: input.todoId ?? null,
    todoTextSnapshot: input.todoTextSnapshot ?? null,
  };
}

/** Newest-first; drop oldest beyond cap. */
export function appendFocusSession(
  sessions: FocusSession[],
  session: FocusSession,
  max = MAX_FOCUS_SESSIONS
): FocusSession[] {
  const withoutDup = sessions.filter((s) => s.id !== session.id);
  const next = [session, ...withoutDup];
  if (next.length <= max) return next;
  return next.slice(0, max);
}

export function sessionsForDate(
  sessions: FocusSession[],
  localDate: string
): FocusSession[] {
  return sessions
    .filter((s) => s.localDate === localDate)
    .sort((a, b) => b.completedAt - a.completedAt);
}

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapDay {
  date: string;
  minutes: number;
  sessions: number;
  level: HeatmapLevel;
}

/** Map minutes → 0–4 intensity. */
export function minutesToHeatLevel(minutes: number): HeatmapLevel {
  if (minutes <= 0) return 0;
  if (minutes < 25) return 1;
  if (minutes < 50) return 2;
  if (minutes < 100) return 3;
  return 4;
}

/**
 * Build a contiguous local-date grid ending at `endDate` (inclusive).
 * `weeks` × 7 days, Monday-start aligned like GitHub (column = week).
 */
export function buildHeatmapDays(
  dailyStats: Record<string, DailyStats>,
  endDate: string = toLocalDateString(),
  weeks = 16
): HeatmapDay[] {
  const totalDays = weeks * 7;
  // Walk back totalDays-1 from end
  let cursor = endDate;
  const dates: string[] = [cursor];
  for (let i = 1; i < totalDays; i++) {
    cursor = previousLocalDate(cursor);
    dates.push(cursor);
  }
  dates.reverse();

  return dates.map((date) => {
    const stats = dailyStats[date];
    const minutes = stats?.focusMinutesCompleted ?? 0;
    const sessions = stats?.focusSessionsCompleted ?? 0;
    return {
      date,
      minutes,
      sessions,
      level: minutesToHeatLevel(minutes),
    };
  });
}

/** Normalize unknown JSON into FocusSession[]. */
export function mergeFocusSessions(raw: unknown): FocusSession[] {
  if (!Array.isArray(raw)) return [];
  const out: FocusSession[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<FocusSession>;
    if (typeof s.id !== "string" || typeof s.localDate !== "string") continue;
    if (typeof s.completedAt !== "number" || !Number.isFinite(s.completedAt)) {
      continue;
    }
    out.push({
      id: s.id,
      completedAt: Math.floor(s.completedAt),
      localDate: s.localDate,
      plannedMinutes:
        typeof s.plannedMinutes === "number" && Number.isFinite(s.plannedMinutes)
          ? Math.max(1, Math.floor(s.plannedMinutes))
          : 1,
      todoId: typeof s.todoId === "string" ? s.todoId : null,
      todoTextSnapshot:
        typeof s.todoTextSnapshot === "string" ? s.todoTextSnapshot : null,
    });
  }
  out.sort((a, b) => b.completedAt - a.completedAt);
  return out.slice(0, MAX_FOCUS_SESSIONS);
}
