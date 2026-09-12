# Habit Tracker v1 — locked copy pack

**Owner:** Ellis · Docs · **Hand to:** Jordan · Eng / Nora · Design  
**Source of truth for rules:** `README.md` Product loop / Timer / Habit streaks  
**Escalate product claims to:** CEO Bart  
**Date:** 2026-09-11  
**Aligned to:** Reid locked polish strings + PR #3 (PL10–PL15, AD1–AD3)

Do **not** invent freeze/repair, day-start offset, off-days, estimates, sync, or gamification in user-facing copy. Those are deferred.

---

## Product loop (one glance)

1. Add a task  
2. Pick one to focus  
3. Start Focus and finish the timer  
4. Only a **completed** Focus credits today + streak  

Completing Focus does **not** check off the todo. Skip / Reset mid-Focus = **zero credit**.

---

## Locked in-app strings (PR #3 + Reid)

### Chrome / brand
| Surface | String | Where |
| --- | --- | --- |
| App title | `Habit Tracker` | header |
| Tagline | `Pomodoro · Todos · Streaks` | header |
| Document title (idle) | `Habit Tracker — Pomodoro · Todos · Streaks` | AD2 |
| Document title (active) | `{mm:ss} · {task or mode}` | AD2 — no PWA |
| Settings CTA | `Settings` | header |
| Hydrate | skeleton + aria-label `Loading Habit Tracker` | PL15 |

### Today strip (sole Today/Streak source — PL12)
| Surface | String | Notes |
| --- | --- | --- |
| Focus count | `Today · {n} Focus` | compact + full |
| Streak | `Streak · {n} days` | compact + full |
| Minutes | label `Minutes` | full strip |
| Zero Focus hint | `not yet` | PL13 full strip when focusCount = 0 |
| Zero streak (and zero Focus) | `start today` | PL13 |
| Streak hint otherwise | `best {n}` | PL13 |

### Todos
| Surface | String |
| --- | --- |
| List heading | `Todos` (PL12 — no Today/Streak in header) |
| Placeholder | `Add a task…` |
| Empty title | `Nothing on Today yet` |
| Empty body | `Add a task, start a Focus, finish the timer. Only completed Focus counts toward your streak.` |
| Empty CTA | `Add a task` |
| No selection title | `Pick a task to focus` |
| No selection body | `Select one, start the timer, and finish to credit Focus. Skipping or abandoning doesn’t count.` |
| Selected badge | `Focusing` |
| Footer note | `Completing a Focus session does not auto-complete the linked todo. Streaks count only completed Focus sessions (≥1 per local day).` |

### Timer
| Surface | String | Notes |
| --- | --- | --- |
| Focus, no task (under clock) | `Pick a task to focus` | **PL11** — muted soft CTA. Supersedes older PL1 placeholder `No task selected`. |
| Break, no linked task | `Pick a task for your next Focus` | AD3 priming |
| Mid-Focus switch, empty list | `Add a task from Todos when you pause` | AD1 |
| Toward long break (title) | `Completed Focus sessions toward next long break (Skip does not count)` | |
| Controls | `Start` / `Pause` / `Resume` / `Reset` / `Skip` | Idle: **Start** only (PL11) |

### Focus credited beat
| Surface | String |
| --- | --- |
| Title | `Focus credited` |
| Body | `Nice work. That session counts toward today and your streak.` |
| Secondary | `Back to Today` |
| Primary | `Take a short break` / `Take a long break` |

### Abandon confirm (Skip / Reset mid-Focus)
| Surface | String |
| --- | --- |
| Title | `End Focus without credit?` |
| Body | `This session won’t count toward today or your streak.` |
| Keep | `Keep focusing` |
| Confirm | `End without credit` |

### Toasts
| Kind | String |
| --- | --- |
| Pre-end | `Almost there — finish to credit this Focus` |
| Focus complete | `Focus complete` |

### Settings — Streak rules
| Line | Locked text |
| --- | --- |
| Heading | `Streak rules` |
| 1 | `A day counts if you complete ≥1 Focus session that local calendar day.` |
| 2 | `Day = device local date (YYYY-MM-DD), not UTC.` |
| 3 | `Incomplete, paused, or skipped sessions never count. Breaks never count.` |
| 4 | `After 4 completed Focus sessions, the next break is a Long break. Skip does not advance that counter.` |

---

## Copy that must never imply

- Skip / Reset / pause credits Focus or streak  
- Breaks count toward streak  
- Completing Focus auto-completes the todo  
- UTC midnight defines the day  
- Freeze, repair, off-days, or day-start offset exist in v1  

---

## Known doc conflict (escalated)

`docs/pl1-pl9-acceptance.md` **PL1** still says under-clock unlinked placeholder = `No task selected`.  
**PL11** (same file, follow-on) + PR #3 code use `Pick a task to focus`.  
**Locked for copy:** PL11 string. Acceptance PL1 row should be amended by Priya/Bart.

