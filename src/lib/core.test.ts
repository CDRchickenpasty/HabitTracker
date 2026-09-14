import { describe, expect, it } from "vitest";
import {
  getTodayLocalDateString,
  localDayDiff,
  parseLocalDate,
  previousLocalDate,
  toLocalDateString,
} from "./dates";
import {
  appendFocusSession,
  buildHeatmapDays,
  createFocusSession,
  mergeFocusSessions,
  minutesToHeatLevel,
  sessionsForDate,
} from "./history";
import { migrateToV2 } from "./migrate";
import {
  addOffDay,
  applyFocusCompletionToStreak,
  applyRepair,
  resolveDisplayStreak,
  spendFreeze,
} from "./streaks";
import { nextModeAfterCompletion } from "./timerUtils";
import {
  clearToDefaultState,
  createDefaultPersistedState,
  exportStateToJson,
  importStateFromJson,
  mergePersistedState,
  mergeTimer,
  parsePersistedJson,
} from "./storage";
import type { PersistedState, StreakState } from "./types";
import { DEFAULT_KINDNESS, STORAGE_KEY } from "./types";

describe("dates", () => {
  it("formats local YYYY-MM-DD from a concrete Date", () => {
    const d = new Date(2026, 8, 11, 15, 30, 0); // Sep 11 2026 local
    expect(toLocalDateString(d)).toBe("2026-09-11");
  });

  it("parses YYYY-MM-DD as local midnight and walks previous day", () => {
    const d = parseLocalDate("2026-03-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
    expect(previousLocalDate("2026-03-01")).toBe("2026-02-28");
    expect(previousLocalDate("2026-01-01")).toBe("2025-12-31");
  });

  it("computes whole local day differences", () => {
    expect(localDayDiff("2026-09-11", "2026-09-10")).toBe(1);
    expect(localDayDiff("2026-09-11", "2026-09-13")).toBe(-2);
    expect(localDayDiff("2026-09-11", "2026-09-11")).toBe(0);
  });

  it("honors valid testToday override and ignores invalid", () => {
    expect(getTodayLocalDateString({ testToday: "2026-01-15" })).toBe(
      "2026-01-15"
    );
    expect(getTodayLocalDateString({ testToday: "not-a-date" })).toBe(
      toLocalDateString()
    );
    expect(getTodayLocalDateString({ testToday: null })).toBe(
      toLocalDateString()
    );
  });
});

describe("streaks", () => {
  const empty: StreakState = {
    lastQualifyingDate: null,
    currentStreak: 0,
    bestStreak: 0,
    offDays: [],
    freezeTokens: 0,
    freezeUsedDates: [],
    towardNextFreeze: 0,
    repairsRemaining: 1,
  };

  it("starts a streak on first focus completion", () => {
    expect(applyFocusCompletionToStreak(empty, "2026-09-11")).toEqual({
      ...empty,
      lastQualifyingDate: "2026-09-11",
      currentStreak: 1,
      bestStreak: 1,
      towardNextFreeze: 1,
    });
  });

  it("increments when yesterday qualified and ignores second focus same day", () => {
    const afterFirst = applyFocusCompletionToStreak(empty, "2026-09-10");
    const afterNextDay = applyFocusCompletionToStreak(afterFirst, "2026-09-11");
    expect(afterNextDay).toMatchObject({
      lastQualifyingDate: "2026-09-11",
      currentStreak: 2,
      bestStreak: 2,
      towardNextFreeze: 2,
    });
    expect(applyFocusCompletionToStreak(afterNextDay, "2026-09-11")).toEqual(
      afterNextDay
    );
  });

  it("resets current streak after a gap but keeps best", () => {
    const prior: StreakState = {
      ...empty,
      lastQualifyingDate: "2026-09-01",
      currentStreak: 5,
      bestStreak: 5,
    };
    expect(applyFocusCompletionToStreak(prior, "2026-09-11", { ...DEFAULT_KINDNESS, enabled: false })).toMatchObject({
      lastQualifyingDate: "2026-09-11",
      currentStreak: 1,
      bestStreak: 5,
    });
  });

  it("resolveDisplayStreak keeps alive streak from yesterday, zeros broken", () => {
    const alive: StreakState = {
      ...empty,
      lastQualifyingDate: "2026-09-10",
      currentStreak: 3,
      bestStreak: 4,
    };
    expect(resolveDisplayStreak(alive, "2026-09-11")).toEqual(alive);

    const todayHit: StreakState = {
      ...empty,
      lastQualifyingDate: "2026-09-11",
      currentStreak: 3,
      bestStreak: 4,
    };
    expect(resolveDisplayStreak(todayHit, "2026-09-11")).toEqual(todayHit);

    const broken: StreakState = {
      ...empty,
      lastQualifyingDate: "2026-09-08",
      currentStreak: 3,
      bestStreak: 4,
    };
    expect(resolveDisplayStreak(broken, "2026-09-11", { ...DEFAULT_KINDNESS, enabled: false })).toEqual({
      ...broken,
      currentStreak: 0,
    });

    expect(resolveDisplayStreak(empty, "2026-09-11").currentStreak).toBe(0);
  });

  it("bridges planned off-days and freeze days", () => {
    const withOff: StreakState = {
      ...empty,
      lastQualifyingDate: "2026-09-09",
      currentStreak: 4,
      bestStreak: 4,
      offDays: ["2026-09-10"],
    };
    expect(
      resolveDisplayStreak(withOff, "2026-09-11", DEFAULT_KINDNESS).currentStreak
    ).toBe(4);

    const continued = applyFocusCompletionToStreak(
      withOff,
      "2026-09-11",
      DEFAULT_KINDNESS
    );
    expect(continued.currentStreak).toBe(5);
  });

  it("spends freeze tokens and repairs", () => {
    const base: StreakState = {
      ...empty,
      lastQualifyingDate: "2026-09-09",
      currentStreak: 3,
      bestStreak: 3,
      freezeTokens: 1,
      repairsRemaining: 1,
    };
    const frozen = spendFreeze(base, "2026-09-10");
    expect(frozen?.freezeTokens).toBe(0);
    expect(frozen?.freezeUsedDates).toContain("2026-09-10");
    expect(
      resolveDisplayStreak(frozen!, "2026-09-11", DEFAULT_KINDNESS).currentStreak
    ).toBe(3);

    const repaired = applyRepair(
      { ...base, freezeTokens: 0 },
      "2026-09-10",
      "2026-09-11",
      DEFAULT_KINDNESS
    );
    expect(repaired?.repairsRemaining).toBe(0);
    expect(repaired?.lastQualifyingDate).toBe("2026-09-10");
  });

  it("addOffDay is idempotent", () => {
    const once = addOffDay(empty, "2026-09-12");
    expect(addOffDay(once, "2026-09-12").offDays).toEqual(["2026-09-12"]);
  });
});

describe("nextModeAfterCompletion", () => {
  it("cycles focus → short until 4th focus → long, then breaks → focus", () => {
    expect(nextModeAfterCompletion("focus", 0)).toEqual({
      mode: "shortBreak",
      focusTowardLongBreak: 1,
    });
    expect(nextModeAfterCompletion("focus", 2)).toEqual({
      mode: "shortBreak",
      focusTowardLongBreak: 3,
    });
    expect(nextModeAfterCompletion("focus", 3)).toEqual({
      mode: "longBreak",
      focusTowardLongBreak: 0,
    });
    expect(nextModeAfterCompletion("shortBreak", 2)).toEqual({
      mode: "focus",
      focusTowardLongBreak: 2,
    });
    expect(nextModeAfterCompletion("longBreak", 0)).toEqual({
      mode: "focus",
      focusTowardLongBreak: 0,
    });
  });
});

describe("history", () => {
  it("appends and prunes focus sessions newest-first", () => {
    const a = createFocusSession({
      id: "a",
      localDate: "2026-09-11",
      plannedMinutes: 25,
      completedAt: 100,
    });
    const b = createFocusSession({
      id: "b",
      localDate: "2026-09-11",
      plannedMinutes: 25,
      completedAt: 200,
    });
    const next = appendFocusSession([a], b, 2);
    expect(next.map((s) => s.id)).toEqual(["b", "a"]);
    const pruned = appendFocusSession(next, createFocusSession({
      id: "c",
      localDate: "2026-09-12",
      plannedMinutes: 15,
      completedAt: 300,
    }), 2);
    expect(pruned).toHaveLength(2);
    expect(pruned[0].id).toBe("c");
  });

  it("maps minutes to heat levels and builds a grid", () => {
    expect(minutesToHeatLevel(0)).toBe(0);
    expect(minutesToHeatLevel(10)).toBe(1);
    expect(minutesToHeatLevel(30)).toBe(2);
    expect(minutesToHeatLevel(80)).toBe(3);
    expect(minutesToHeatLevel(120)).toBe(4);

    const days = buildHeatmapDays(
      {
        "2026-09-11": {
          date: "2026-09-11",
          focusSessionsCompleted: 2,
          focusMinutesCompleted: 50,
        },
      },
      "2026-09-11",
      2
    );
    expect(days).toHaveLength(14);
    expect(days[days.length - 1].date).toBe("2026-09-11");
    expect(days[days.length - 1].level).toBe(3);
  });

  it("filters sessions for a date", () => {
    const sessions = [
      createFocusSession({
        id: "1",
        localDate: "2026-09-11",
        plannedMinutes: 25,
        completedAt: 2,
      }),
      createFocusSession({
        id: "2",
        localDate: "2026-09-10",
        plannedMinutes: 25,
        completedAt: 1,
      }),
    ];
    expect(sessionsForDate(sessions, "2026-09-11")).toHaveLength(1);
  });

  it("mergeFocusSessions drops bad rows", () => {
    expect(
      mergeFocusSessions([
        { id: "x", localDate: "2026-09-11", completedAt: 1, plannedMinutes: 25 },
        { nope: true },
        null,
      ])
    ).toHaveLength(1);
  });
});

describe("migrate v1 → v2", () => {
  it("fills appearance, kindness, sessions and bumps version", () => {
    const v2 = migrateToV2({
      version: 1,
      todos: [{ id: "t", text: "Hi", completed: true, createdAt: 1 }],
      settings: { soundEnabled: false, durations: { focusMinutes: 45 } },
      streak: { currentStreak: 2, bestStreak: 3, lastQualifyingDate: "2026-09-10" },
      timer: { mode: "focus", status: "paused", secondsLeft: 60, endsAt: null },
    });
    expect(v2.version).toBe(2);
    expect(v2.settings.appearance.accent).toBe("rose");
    expect(v2.settings.kindness.enabled).toBe(true);
    expect(v2.focusSessions).toEqual([]);
    expect(v2.timer.sessionTotalSeconds).toBe(60);
    expect(v2.settings.durations.focusMinutes).toBe(45);
    expect(STORAGE_KEY).toBe("habit-tracker-v2");
  });
});

describe("storage load/merge", () => {
  it("mergePersistedState fills defaults for empty/partial input", () => {
    const empty = mergePersistedState({});
    expect(empty.version).toBe(2);
    expect(empty.todos).toEqual([]);
    expect(empty.settings.durations.focusMinutes).toBe(25);
    expect(empty.settings.appearance.accent).toBe("rose");
    expect(empty.timer.mode).toBe("focus");
    expect(empty.streak.currentStreak).toBe(0);
    expect(empty.focusSessions).toEqual([]);

    const partial = mergePersistedState({
      todos: [{ id: "a", text: "Write tests", completed: false, createdAt: 1 }],
      settings: {
        soundEnabled: false,
        durations: { focusMinutes: 45 },
      } as PersistedState["settings"],
      focusTowardLongBreak: 2,
    });
    expect(partial.todos).toHaveLength(1);
    expect(partial.todos[0].text).toBe("Write tests");
    expect(partial.settings.soundEnabled).toBe(false);
    expect(partial.settings.durations.focusMinutes).toBe(45);
    expect(partial.settings.durations.shortBreakMinutes).toBe(5);
    expect(partial.focusTowardLongBreak).toBe(2);
  });

  it("mergeTodos defaults completed/createdAt for partial todo objects", () => {
    const partial = mergePersistedState({
      todos: [{ id: "x", text: "Partial only" }] as unknown as PersistedState["todos"],
    });
    expect(partial.todos[0].completed).toBe(false);
    expect(typeof partial.todos[0].createdAt).toBe("number");
  });

  it("mergeTimer demotes running-without-endsAt to paused", () => {
    expect(
      mergeTimer({
        mode: "focus",
        status: "running",
        secondsLeft: 100,
        endsAt: null,
      })
    ).toMatchObject({
      mode: "focus",
      status: "paused",
      secondsLeft: 100,
      endsAt: null,
    });
  });

  it("parsePersistedJson uses the merge path and recovers from bad shapes", () => {
    const json = JSON.stringify({
      todos: "nope",
      streak: {
        currentStreak: 7,
        bestStreak: 9,
        lastQualifyingDate: "2026-09-10",
      },
      timer: { mode: "shortBreak", status: "paused", secondsLeft: 120 },
    });
    const parsed = parsePersistedJson(json);
    expect(parsed.todos).toEqual([]);
    expect(parsed.streak.currentStreak).toBe(7);
    expect(parsed.timer.mode).toBe("shortBreak");
    expect(parsed.timer.status).toBe("paused");
    expect(parsed.timer.secondsLeft).toBe(120);
    expect(parsed.version).toBe(2);
  });
});

describe("export / import / clear", () => {
  function sampleState(): PersistedState {
    const base = createDefaultPersistedState();
    return {
      ...base,
      todos: [
        {
          id: "t1",
          text: "Ship export",
          completed: false,
          createdAt: 1720000000000,
        },
      ],
      activeTodoId: "t1",
      settings: {
        ...base.settings,
        soundEnabled: false,
        durations: {
          focusMinutes: 50,
          shortBreakMinutes: 8,
          longBreakMinutes: 20,
        },
        appearance: { accent: "emerald", density: "compact" },
      },
      streak: {
        ...base.streak,
        lastQualifyingDate: "2026-09-10",
        currentStreak: 4,
        bestStreak: 6,
      },
      focusTowardLongBreak: 2,
      dailyStats: {
        "2026-09-10": {
          date: "2026-09-10",
          focusSessionsCompleted: 3,
          focusMinutesCompleted: 75,
        },
      },
      timer: {
        mode: "shortBreak",
        status: "paused",
        secondsLeft: 90,
        endsAt: null,
        sessionTotalSeconds: 90,
      },
      focusSessions: [
        createFocusSession({
          id: "s1",
          localDate: "2026-09-10",
          plannedMinutes: 25,
          completedAt: 1720000000000,
          todoTextSnapshot: "Ship export",
        }),
      ],
    };
  }

  it("export → import round-trips todos, streak, settings, stats, timer, sessions", () => {
    const original = sampleState();
    const json = exportStateToJson(original);
    expect(json).toContain("Ship export");
    expect(json).toContain("2026-09-10");
    expect(json).toContain("emerald");

    const restored = importStateFromJson(json);
    expect(restored.todos).toEqual(original.todos);
    expect(restored.activeTodoId).toBe("t1");
    expect(restored.settings.soundEnabled).toBe(false);
    expect(restored.settings.durations.focusMinutes).toBe(50);
    expect(restored.settings.appearance.accent).toBe("emerald");
    expect(restored.streak.currentStreak).toBe(4);
    expect(restored.focusTowardLongBreak).toBe(2);
    expect(restored.dailyStats["2026-09-10"]).toEqual(
      original.dailyStats["2026-09-10"]
    );
    expect(restored.timer).toEqual(original.timer);
    expect(restored.focusSessions).toHaveLength(1);
    expect(restored.version).toBe(2);
  });

  it("import still goes through merge (partial backup fills defaults)", () => {
    const partial = JSON.stringify({
      todos: [{ id: "x", text: "Partial", completed: true, createdAt: 1 }],
      streak: {
        currentStreak: 2,
        bestStreak: 2,
        lastQualifyingDate: "2026-09-09",
      },
    });
    const restored = importStateFromJson(partial);
    expect(restored.todos[0].text).toBe("Partial");
    expect(restored.settings.durations.focusMinutes).toBe(25);
    expect(restored.timer.mode).toBe("focus");
    expect(restored.version).toBe(2);
    expect(restored.focusSessions).toEqual([]);
  });

  it("clearToDefaultState yields empty default persisted state", () => {
    const cleared = clearToDefaultState();
    const fresh = createDefaultPersistedState();
    expect(cleared.todos).toEqual([]);
    expect(cleared.activeTodoId).toBeNull();
    expect(cleared.streak.currentStreak).toBe(fresh.streak.currentStreak);
    expect(cleared.focusTowardLongBreak).toBe(0);
    expect(cleared.dailyStats).toEqual({});
    expect(cleared.settings.durations.focusMinutes).toBe(25);
    expect(cleared.timer.mode).toBe("focus");
    expect(cleared.timer.status).toBe("idle");
    expect(cleared.focusSessions).toEqual([]);
    // Mutating cleared must not poison the next default
    cleared.todos.push({
      id: "z",
      text: "leak?",
      completed: false,
      createdAt: 1,
    });
    expect(clearToDefaultState().todos).toEqual([]);
  });
});
