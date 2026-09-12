"use client";

import { useCallback, useRef, useState } from "react";
import {
  getTodayLocalDateString,
  previousLocalDate,
  toLocalDateString,
} from "@/lib/dates";
import {
  FOCUS_DURATION_PRESETS,
  type AppSettings,
  type StreakState,
} from "@/lib/types";
import { useDialogA11y } from "@/hooks/useDialogA11y";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  streak: StreakState;
  focusTowardLongBreak: number;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSeedTesting: (seed: {
    lastQualifyingDate?: string | null;
    currentStreak?: number;
    bestStreak?: number;
    focusTowardLongBreak?: number;
  }) => void;
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  streak,
  focusTowardLongBreak,
  onUpdateSettings,
  onSeedTesting,
}: SettingsPanelProps) {
  const effectiveToday = getTodayLocalDateString(settings);
  const [seedLastDate, setSeedLastDate] = useState(
    streak.lastQualifyingDate ?? effectiveToday
  );
  const [seedCurrent, setSeedCurrent] = useState(streak.currentStreak);
  const [seedBest, setSeedBest] = useState(streak.bestStreak);
  const [seedCounter, setSeedCounter] = useState(focusTowardLongBreak);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => onClose(), [onClose]);
  const panelRef = useDialogA11y(open, handleClose, closeBtnRef);

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
        aria-labelledby="settings-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="settings-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Settings
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Close settings"
          >
            Close
          </button>
        </div>

        <fieldset className="mb-5 space-y-3">
          <legend className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Durations (minutes)
          </legend>

          <div>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Focus soft presets
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {FOCUS_DURATION_PRESETS.map((mins) => {
                const active = settings.durations.focusMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        durations: {
                          ...settings.durations,
                          focusMinutes: mins,
                        },
                      })
                    }
                    aria-pressed={active}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
                      active
                        ? "bg-rose-500 text-white"
                        : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>
          </div>

          <NumberField
            id="focus-min"
            label="Focus"
            value={settings.durations.focusMinutes}
            min={1}
            max={120}
            onChange={(v) =>
              onUpdateSettings({
                durations: { ...settings.durations, focusMinutes: v },
              })
            }
          />
          <NumberField
            id="short-min"
            label="Short break"
            value={settings.durations.shortBreakMinutes}
            min={1}
            max={60}
            onChange={(v) =>
              onUpdateSettings({
                durations: { ...settings.durations, shortBreakMinutes: v },
              })
            }
          />
          <NumberField
            id="long-min"
            label="Long break"
            value={settings.durations.longBreakMinutes}
            min={1}
            max={60}
            onChange={(v) =>
              onUpdateSettings({
                durations: { ...settings.durations, longBreakMinutes: v },
              })
            }
          />
        </fieldset>

        <fieldset className="mb-5 space-y-3">
          <legend className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Alerts
          </legend>
          <Toggle
            id="sound"
            label="End sound"
            checked={settings.soundEnabled}
            onChange={(checked) => onUpdateSettings({ soundEnabled: checked })}
          />
          <Toggle
            id="pre-end"
            label="Pre-end cue (last 10s of Focus)"
            checked={settings.preEndCueEnabled}
            onChange={(checked) =>
              onUpdateSettings({ preEndCueEnabled: checked })
            }
          />
          <Toggle
            id="notif"
            label="Browser notifications (permission gated)"
            checked={settings.notificationsEnabled}
            onChange={async (checked) => {
              if (checked && "Notification" in window) {
                const perm = await Notification.requestPermission();
                onUpdateSettings({
                  notificationsEnabled: perm === "granted",
                });
              } else {
                onUpdateSettings({ notificationsEnabled: false });
              }
            }}
          />
        </fieldset>

        <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
          <p className="mb-1 font-semibold text-zinc-800 dark:text-zinc-100">
            Streak rules
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              A day counts if you complete ≥1 Focus session that local calendar
              day.
            </li>
            <li>Day = device local date (YYYY-MM-DD), not UTC.</li>
            <li>
              Incomplete, paused, or skipped sessions never count. Breaks never
              count.
            </li>
            <li>
              After 4 completed Focus sessions, the next break is a Long break.
              Skip does not advance that counter.
            </li>
          </ul>
          <p className="mt-2">
            Current: {streak.currentStreak} · Best: {streak.bestStreak}
            {streak.lastQualifyingDate
              ? ` · Last qualifying: ${streak.lastQualifyingDate}`
              : ""}
          </p>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Testing
          </h3>
          <Toggle
            id="show-testing"
            label="Show QA hooks"
            checked={settings.showTestingHooks}
            onChange={(checked) =>
              onUpdateSettings({ showTestingHooks: checked })
            }
          />
        </div>

        {settings.showTestingHooks && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/40">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
              QA test hooks — for testing only
            </p>

            <fieldset className="mb-4 space-y-2">
              <legend className="mb-1 text-xs font-semibold text-amber-900 dark:text-amber-100">
                Override &quot;today&quot; (local YYYY-MM-DD)
              </legend>
              <label className="flex items-center justify-between gap-3 text-sm text-zinc-800 dark:text-zinc-200">
                <span>testToday</span>
                <input
                  type="date"
                  value={settings.testToday ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdateSettings({
                      testToday: v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null,
                    });
                  }}
                  className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm dark:border-amber-700 dark:bg-zinc-900"
                />
              </label>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-100/80">
                Effective today:{" "}
                <span className="font-mono font-semibold">{effectiveToday}</span>
                {settings.testToday
                  ? " (override)"
                  : ` (real ${toLocalDateString()})`}
              </p>
              <button
                type="button"
                className="text-xs font-medium text-amber-800 underline dark:text-amber-200"
                onClick={() => onUpdateSettings({ testToday: null })}
              >
                Clear — use real today
              </button>
            </fieldset>

            <fieldset className="mb-4 space-y-2">
              <legend className="mb-1 text-xs font-semibold text-amber-900 dark:text-amber-100">
                Short-duration overrides (seconds; blank = use settings)
              </legend>
              <OverrideField
                id="ov-focus"
                label="Focus seconds"
                value={settings.testOverrides.focusSeconds}
                onChange={(v) =>
                  onUpdateSettings({
                    testOverrides: {
                      ...settings.testOverrides,
                      focusSeconds: v,
                    },
                  })
                }
              />
              <OverrideField
                id="ov-short"
                label="Short break seconds"
                value={settings.testOverrides.shortBreakSeconds}
                onChange={(v) =>
                  onUpdateSettings({
                    testOverrides: {
                      ...settings.testOverrides,
                      shortBreakSeconds: v,
                    },
                  })
                }
              />
              <OverrideField
                id="ov-long"
                label="Long break seconds"
                value={settings.testOverrides.longBreakSeconds}
                onChange={(v) =>
                  onUpdateSettings({
                    testOverrides: {
                      ...settings.testOverrides,
                      longBreakSeconds: v,
                    },
                  })
                }
              />
              <button
                type="button"
                className="mt-1 text-xs font-medium text-amber-800 underline dark:text-amber-200"
                onClick={() =>
                  onUpdateSettings({
                    testOverrides: {
                      focusSeconds: 5,
                      shortBreakSeconds: 3,
                      longBreakSeconds: 4,
                    },
                  })
                }
              >
                Quick set: Focus 5s / Short 3s / Long 4s
              </button>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold text-amber-900 dark:text-amber-100">
                Seed streak / counter
              </legend>
              <label className="flex items-center justify-between gap-3 text-sm text-zinc-800 dark:text-zinc-200">
                <span>Last qualifying date</span>
                <input
                  type="date"
                  value={seedLastDate}
                  onChange={(e) => setSeedLastDate(e.target.value)}
                  className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm dark:border-amber-700 dark:bg-zinc-900"
                />
              </label>
              <NumberField
                id="seed-current"
                label="Current streak"
                value={seedCurrent}
                min={0}
                max={9999}
                onChange={setSeedCurrent}
              />
              <NumberField
                id="seed-best"
                label="Best streak"
                value={seedBest}
                min={0}
                max={9999}
                onChange={setSeedBest}
              />
              <NumberField
                id="seed-counter"
                label="Focus toward long break (0–3)"
                value={seedCounter}
                min={0}
                max={3}
                onChange={setSeedCounter}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  onClick={() =>
                    onSeedTesting({
                      lastQualifyingDate: seedLastDate || null,
                      currentStreak: seedCurrent,
                      bestStreak: seedBest,
                      focusTowardLongBreak: seedCounter,
                    })
                  }
                >
                  Apply seed
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100"
                  onClick={() => {
                    const yesterday = previousLocalDate(effectiveToday);
                    setSeedLastDate(yesterday);
                    setSeedCurrent(3);
                    setSeedBest(5);
                    setSeedCounter(2);
                    onSeedTesting({
                      lastQualifyingDate: yesterday,
                      currentStreak: 3,
                      bestStreak: 5,
                      focusTowardLongBreak: 2,
                    });
                  }}
                >
                  Seed demo (yesterday / streak 3 / counter 2)
                </button>
              </div>
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 text-sm text-zinc-800 dark:text-zinc-200"
    >
      <span>{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right tabular-nums dark:border-zinc-600 dark:bg-zinc-800"
      />
    </label>
  );
}

function OverrideField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 text-sm text-zinc-800 dark:text-zinc-200"
    >
      <span>{label}</span>
      <input
        id={id}
        type="number"
        min={1}
        max={3600}
        placeholder="—"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 1) onChange(Math.floor(n));
        }}
        className="w-24 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-right tabular-nums dark:border-amber-700 dark:bg-zinc-900"
      />
    </label>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-800 dark:text-zinc-200"
    >
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-400 text-rose-500 focus:ring-rose-400"
      />
    </label>
  );
}
