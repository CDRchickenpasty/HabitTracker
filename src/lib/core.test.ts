import { describe, expect, it } from "vitest";
import {
  getTodayLocalDateString,
  localDayDiff,
  parseLocalDate,
  previousLocalDate,
  toLocalDateString,
} from "./dates";
import {
  applyFocusCompletionToStreak,
  resolveDisplayStreak,
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
  };

  it("starts a streak on first focus completion", () => {
    expect(applyFocusCompletionToStreak(empty, "2026-09-11")).toEqual({
      lastQualifyingDate: "2026-09-11",
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it("increments when yesterday qualified and ignores second focus same day", () => {
    const afterFirst = applyFocusCompletionToStreak(empty, "2026-09-10");
    const afterNextDay = applyFocusCompletionToStreak(afterFirst, "2026-09-11");
    expect(afterNextDay).toEqual({
      lastQualifyingDate: "2026-09-11",
      currentStreak: 2,
      bestStreak: 2,
    });
    expect(applyFocusCompletionToStreak(afterNextDay, "2026-09-11")).toEqual(
      afterNextDay
    );
  });

  it("resets current streak after a gap but keeps best", () => {
    const prior: StreakState = {
      lastQualifyingDate: "2026-09-01",
      currentStreak: 5,
      bestStreak: 5,
    };
    expect(applyFocusCompletionToStreak(prior, "2026-09-11")).toEqual({
      lastQualifyingDate: "2026-09-11",
      currentStreak: 1,
      bestStreak: 5,
    });
  });

  it("resolveDisplayStreak keeps alive streak from yesterday, zeros broken", () => {
    const alive: StreakState = {
      lastQualifyingDate: "2026-09-10",
      currentStreak: 3,
      bestStreak: 4,
    };
    expect(resolveDisplayStreak(alive, "2026-09-11")).toEqual(alive);

    const todayHit: StreakState = {
      lastQualifyingDate: "2026-09-11",
      currentStreak: 3,
      bestStreak: 4,
    };
    expect(resolveDisplayStreak(todayHit, "2026-09-11")).toEqual(todayHit);

    const broken: StreakState = {
      lastQualifyingDate: "2026-09-08",
      currentStreak: 3,
      bestStreak: 4,
    };
    expect(resolveDisplayStreak(broken, "2026-09-11")).toEqual({
      lastQualifyingDate: "2026-09-08",
      currentStreak: 0,
      bestStreak: 4,
    });

    expect(resolveDisplayStreak(empty, "2026-09-11").currentStreak).toBe(0);
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

describe("storage load/merge", () => {
  it("mergePersistedState fills defaults for empty/partial input", () => {
    const empty = mergePersistedState({});
    expect(empty.version).toBe(1);
    expect(empty.todos).toEqual([]);
    expect(empty.settings.durations.focusMinutes).toBe(25);
    expect(empty.timer.mode).toBe("focus");
    expect(empty.streak.currentStreak).toBe(0);

    const partial = mergePersistedState({
      todos: [{ id: "a", text: "Write tests", completed: false, createdAt: 1 }],
      settings: { soundEnabled: false, durations: { focusMinutes: 45 } } as PersistedState["settings"],
      focusTowardLongBreak: 2,
    });
    expect(partial.todos).toHaveLength(1);
    expect(partial.todos[0].text).toBe("Write tests");
    expect(partial.settings.soundEnabled).toBe(false);
    expect(partial.settings.durations.focusMinutes).toBe(45);
    expect(partial.settings.durations.shortBreakMinutes).toBe(5);
    expect(partial.focusTowardLongBreak).toBe(2);
  });

  it("mergeTimer demotes running-without-endsAt to paused", () => {
    expect(
      mergeTimer({ mode: "focus", status: "running", secondsLeft: 100, endsAt: null })
    ).toEqual({
      mode: "focus",
      status: "paused",
      secondsLeft: 100,
      endsAt: null,
    });
  });

  it("parsePersistedJson uses the merge path and recovers from bad shapes", () => {
    const json = JSON.stringify({
      todos: "nope",
      streak: { currentStreak: 7, bestStreak: 9, lastQualifyingDate: "2026-09-10" },
      timer: { mode: "shortBreak", status: "paused", secondsLeft: 120 },
    });
    const parsed = parsePersistedJson(json);
    expect(parsed.todos).toEqual([]);
    expect(parsed.streak.currentStreak).toBe(7);
    expect(parsed.timer.mode).toBe("shortBreak");
    expect(parsed.timer.status).toBe("paused");
    expect(parsed.timer.secondsLeft).toBe(120);
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
      },
      streak: {
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
      },
    };
  }

  it("export → import round-trips todos, streak, settings, stats, timer", () => {
    const original = sampleState();
    const json = exportStateToJson(original);
    expect(json).toContain("Ship export");
    expect(json).toContain("2026-09-10");

    const restored = importStateFromJson(json);
    expect(restored.todos).toEqual(original.todos);
    expect(restored.activeTodoId).toBe("t1");
    expect(restored.settings.soundEnabled).toBe(false);
    expect(restored.settings.durations.focusMinutes).toBe(50);
    expect(restored.settings.durations.shortBreakMinutes).toBe(8);
    expect(restored.streak).toEqual(original.streak);
    expect(restored.focusTowardLongBreak).toBe(2);
    expect(restored.dailyStats["2026-09-10"]).toEqual(
      original.dailyStats["2026-09-10"]
    );
    expect(restored.timer).toEqual(original.timer);
  });

  it("import still goes through merge (partial backup fills defaults)", () => {
    const partial = JSON.stringify({
      todos: [{ id: "x", text: "Partial", completed: true, createdAt: 1 }],
      streak: { currentStreak: 2, bestStreak: 2, lastQualifyingDate: "2026-09-09" },
    });
    const restored = importStateFromJson(partial);
    expect(restored.todos[0].text).toBe("Partial");
    expect(restored.settings.durations.focusMinutes).toBe(25);
    expect(restored.timer.mode).toBe("focus");
    expect(restored.version).toBe(1);
  });

  it("clearToDefaultState yields empty default persisted state", () => {
    const cleared = clearToDefaultState();
    const fresh = createDefaultPersistedState();
    expect(cleared.todos).toEqual([]);
    expect(cleared.activeTodoId).toBeNull();
    expect(cleared.streak).toEqual(fresh.streak);
    expect(cleared.focusTowardLongBreak).toBe(0);
    expect(cleared.dailyStats).toEqual({});
    expect(cleared.settings.durations.focusMinutes).toBe(25);
    expect(cleared.timer.mode).toBe("focus");
    expect(cleared.timer.status).toBe("idle");
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
