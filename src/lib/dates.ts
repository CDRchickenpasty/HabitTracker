/**
 * Local calendar helpers — all streak/day logic uses device local date,
 * never UTC "today".
 */

/** Format a Date as YYYY-MM-DD in the device's local timezone. */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "Today" for streaks / daily stats — honors settings.testToday QA override
 * when it is a valid YYYY-MM-DD string.
 */
export function getTodayLocalDateString(
  settings?: { testToday?: string | null } | null
): string {
  const override = settings?.testToday;
  if (typeof override === "string" && YMD_RE.test(override)) {
    return override;
  }
  return toLocalDateString();
}

/** Parse YYYY-MM-DD as a local midnight Date (not UTC). */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Previous local calendar day as YYYY-MM-DD. */
export function previousLocalDate(ymd: string): string {
  const date = parseLocalDate(ymd);
  date.setDate(date.getDate() - 1);
  return toLocalDateString(date);
}

/** Difference in whole local calendar days (a - b). */
export function localDayDiff(a: string, b: string): number {
  const ms = parseLocalDate(a).getTime() - parseLocalDate(b).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
