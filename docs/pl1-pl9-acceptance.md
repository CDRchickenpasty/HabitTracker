# HabitTracker — Locked acceptance: polish packs

**Owner:** Priya (PM)  
**Impl:** Jordan · Eng  
**QA:** Jeff · QA  
**Durable URL:** Theo · DevOps  
**Copy:** Ellis · Docs / Nora · Design  
**Escalate to:** CEO Bart  
**Date:** 2026-09-11  
**Status:** LOCKED — Pack A done except PL1 string clears on PR #3 merge; Pack B blocked on PL19 flicker fix push

---

## Scope fence

**In:** PL1–PL15, PL18–PL20 (Focus → credit loop polish + a11y/hierarchy).  
**Out / held:** PL16, PL17, streak forgiveness, session history, estimates, export, day-start offset, ambient audio, themes, RPG, plant-death, social, accounts/sync, PWA.

---

## Locked definitions

| Term | Locked meaning |
| --- | --- |
| **Credited** | Focus hits **00:00** naturally. Today Focus + streak rules. **Focus credited** beat. |
| **Abandon** | Skip/Reset while Focus running/paused with time left. Confirm first. **Zero** credit. |
| **Minimal Focus chrome** | Focus running/paused: timer primary; list/settings recede. |
| **Pre-end cue** | Once in last **10s** of Focus. Soft sound if End sound on + toast. Never on skip/reset. **Default off**. |
| **Presets** | Focus **15 / 25 / 45 / 50**. Idle clock matches; Start uses that length. |
| **No-task under clock** | Unlinked Focus under-clock = **`Pick a task to focus`** (PL1 ≡ PL11). `No task selected` = **FAIL**. |

---

## Pack A — PL1–PL9 (PR #2)

| ID | Must | Pass when | Fail if |
| --- | --- | --- | --- |
| **PL1** | Task under timer | Title under clock for whole Focus. Unlinked: **`Pick a task to focus`** (muted soft CTA; ≡ PL11). | Title only in list; blank; or `No task selected`. |
| **PL2** | Minimal Focus chrome | Running/paused Focus: timer primary; list/settings recede. | Full todo editor on top of clock during Focus. |
| **PL3** | Credited UX | Natural 00:00 → Focus credited beat; Today +1; streak rule; advance to break. | Abandon copy; no credit UI. |
| **PL4** | Abandon UX | Confirm `End Focus without credit?`; confirm → zero credit; `Keep focusing` keeps session. | Credited on skip; credit without confirm. |
| **PL5** | Today + streak | `Today · N Focus` and `Streak · N days` together (TodayStrip sole source after PL12). | Missing one. |
| **PL6** | Presets | Idle presets → 15:00 / 25:00 / 45:00 / 50:00; Start uses length. | Preset no-op. |
| **PL7** | Pre-end cue | Enabled + short override: once in last 10s. Skip/reset: no cue. | Missing / on abandon / multi-fire. |
| **PL8** | End sound | On → sound; off → silent. Pre-end separate (sound-gated). | Ignores toggle. |
| **PL9** | Empty-state | `Nothing on Today yet` + loop body; add todo clears it. | Blank hole. |

**Jeff @ 15d9a8b:** PL2–PL9 PASS; **PL1 stale** until PR #3 merges (string fix).

---

## Pack B — PR #3 (ship gate)

PR: https://github.com/CDRchickenpasty/HabitTracker/pull/3  
Checklist: `/workspace/habittracker-ux/PL10-PL20-acs.md`  
Tip scored: `7fc501b`

| ID | Must | Pass when | Fail if |
| --- | --- | --- | --- |
| **PL10** | Dialog a11y | Focus trap; Escape (Abandon=keep; Credited=dismiss; Settings=close); restore focus; Abandon no backdrop dismiss | Focus escapes; no Escape |
| **PL11** | Idle hierarchy | Idle: Start only. No task: `Pick a task to focus` muted. Start w/o task OK | Reset/Skip idle; old no-task copy |
| **PL12** | Stats dedupe | TodoList header = `Todos` only; TodayStrip sole stats | Dup Today/Streak in list header |
| **PL13** | Zero-day strip | Full: 0/0 → `not yet` / `start today`; 0/streak>0 → `not yet` / `best N`. Compact unchanged | Wrong hints |
| **PL14** | Live region | No per-tick SR; announce on status/mode transitions; keep role=timer | Countdown drone |
| **PL15** | Hydrate skeleton | ≈ header + strip + 2 cards; reduced-motion static | Dead “Loading…” only |
| **PL18** | Mid-Focus switch | Under-clock control in minimal chrome; picker updates activeTodoId; timer unchanged; Esc/outside; a11y | Leaves minimal chrome; stops timer |
| **PL19** | Document title | `MM:SS · Focus` or `MM:SS · {task≤40}`; breaks labeled; idle restores default; **no PWA**. **No per-tick flicker:** must not restore `DEFAULT_TITLE` in effect cleanup that re-runs on `secondsLeft`. | Tab flicker each second; PWA |
| **PL20** | Break priming | Break + no activeTodo → `Pick a task for your next Focus`; optional muted up-next; no auto-open | Missing hint |

**Jeff @ 7fc501b:** PL10–PL15, PL18, PL20, PL1-amend **PASS**. **PL19 FAIL** (title flicker). Workspace has uncommitted flicker WIP — **not green until Jordan pushes newer SHA** and Jeff re-scores PL19.

**Held:** PL16, PL17.

---

## Ship gate (Bart)

1. Pack A green (PL1 clears on #3 merge)  
2. Pack B Jeff **green** on pushed tip (PL19 fix required)  
3. Theo durable **public** Vercel URL  
4. Bart go → Jeff smoke on that URL → polish shipped to Sam  

Then v1.1: streak forgiveness. Non-goals hold.
