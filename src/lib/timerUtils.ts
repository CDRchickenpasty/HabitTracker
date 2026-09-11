import type {
  AppSettings,
  DurationSettings,
  TimerMode,
  TestDurationOverrides,
} from "./types";

export function modeLabel(mode: TimerMode): string {
  switch (mode) {
    case "focus":
      return "Focus";
    case "shortBreak":
      return "Short break";
    case "longBreak":
      return "Long break";
  }
}

/** Effective duration in seconds for a mode, honoring QA overrides. */
export function durationSecondsForMode(
  mode: TimerMode,
  durations: DurationSettings,
  overrides: TestDurationOverrides
): number {
  if (mode === "focus" && overrides.focusSeconds != null) {
    return Math.max(1, overrides.focusSeconds);
  }
  if (mode === "shortBreak" && overrides.shortBreakSeconds != null) {
    return Math.max(1, overrides.shortBreakSeconds);
  }
  if (mode === "longBreak" && overrides.longBreakSeconds != null) {
    return Math.max(1, overrides.longBreakSeconds);
  }

  const minutes =
    mode === "focus"
      ? durations.focusMinutes
      : mode === "shortBreak"
        ? durations.shortBreakMinutes
        : durations.longBreakMinutes;
  return Math.max(1, Math.round(minutes * 60));
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * After a COMPLETED session, pick the next mode and updated focus-toward-long counter.
 * Skip must not call this for focus increments — only full completions.
 */
export function nextModeAfterCompletion(
  completedMode: TimerMode,
  focusTowardLongBreak: number
): { mode: TimerMode; focusTowardLongBreak: number } {
  if (completedMode === "focus") {
    const nextCount = focusTowardLongBreak + 1;
    if (nextCount >= 4) {
      return { mode: "longBreak", focusTowardLongBreak: 0 };
    }
    return { mode: "shortBreak", focusTowardLongBreak: nextCount };
  }
  // Breaks → back to focus; counter unchanged
  return { mode: "focus", focusTowardLongBreak };
}

/** Play a short beep via Web Audio API (no asset required). */
export function playEndSound(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.45);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // ignore
  }
}

export async function maybeNotify(
  title: string,
  body: string,
  enabled: boolean
): Promise<void> {
  if (!enabled || typeof window === "undefined" || !("Notification" in window)) {
    return;
  }
  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission === "granted") {
      new Notification(title, { body, silent: false });
    }
  } catch {
    // ignore
  }
}

export function settingsSummary(settings: AppSettings): string {
  const { durations, testOverrides } = settings;
  const parts = [
    `Focus ${durations.focusMinutes}m`,
    `Short ${durations.shortBreakMinutes}m`,
    `Long ${durations.longBreakMinutes}m`,
  ];
  if (
    testOverrides.focusSeconds != null ||
    testOverrides.shortBreakSeconds != null ||
    testOverrides.longBreakSeconds != null
  ) {
    parts.push("(QA overrides active)");
  }
  return parts.join(" · ");
}
