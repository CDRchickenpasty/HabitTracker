# HabitTracker — Locked acceptance: polish pack PL1–PL9

**Owner:** Priya (PM)  
**Impl:** Jordan · Eng  
**QA:** Jeff · QA  
**Durable URL:** Theo · DevOps  
**Copy source:** `docs/v1-copy-pack.md`  
**Escalate tradeoffs to:** CEO Bart  
**Date:** 2026-09-11  
**Status:** LOCKED — Bart approved 2026-09-11 — do not expand scope

Core v1 contract (T/D/S/P) already re-run green. This pack is the remaining polish bar.

---

## Scope fence

**In:** PL1–PL9 only (UX clarity on the locked Focus → credit loop).  
**Out:** streak forgiveness, session history, estimates, export, day-start offset, ambient audio, themes, RPG, plant-death, social, accounts/sync.

---

## Locked definitions (Bart-approved)

| Term | Locked meaning |
| --- | --- |
| **Credited** | Focus timer hits **00:00** naturally. Counts toward today Focus + streak rules. UI must show **Focus credited** beat (see copy pack). |
| **Abandon** | Skip or Reset while Focus is **running or paused** with time left. Confirm first. **Zero** today/streak credit. Copy must **not** say credited. |
| **Minimal Focus chrome** | While Focus is **running or paused**: timer primary (digits + task under clock + controls + today/streak). Todo list / Settings **recede** (compact or below) — no full todo editor competing above the clock. Idle + breaks may show fuller chrome. |
| **Pre-end cue** | Fires **once** when remaining Focus time enters the last **10 seconds** (not 1–2 minutes). Soft sound only if End sound is on + toast. **Never** on skip/reset. **Default off (opt-in)** — PL7 still tested when enabled. |
| **Presets** | Focus soft presets **15 / 25 / 45 / 50** minutes. Idle clock shows `MM:00` before Start; Start uses that length. |

---

## Acceptance matrix

| ID | Must | Pass when | Fail if |
| --- | --- | --- | --- |
| **PL1** | Task under timer | Linked todo title sits **directly under the clock** for the whole Focus. Unlinked shows explicit placeholder `No task selected`. | Title only in the list; blank under clock when unlinked. |
| **PL2** | Minimal Focus chrome | Running/paused Focus: timer primary; list/settings recede. | Loud full todo editor stacked on top of the clock during Focus. |
| **PL3** | Credited UX | Natural 00:00 → visible **Focus credited** beat; Today Focus +1; streak rule applies; mode advances to break. | Abandon copy shown; no credit UI; count unchanged. |
| **PL4** | Abandon UX | Skip/Reset mid-Focus → confirm (`End Focus without credit?`); confirm → **no** streak/today credit; UI is abandon, not credited. Cancel (`Keep focusing`) leaves session intact. | Skip shows credited; credit without confirm; confirm still credits. |
| **PL5** | Today + streak | Same chrome shows `Today · N Focus` **and** `Streak · N days` together (strip and/or list header). | Only one of the two visible during normal use. |
| **PL6** | Presets 15/25/45/50 | Idle: each preset sets duration; clock shows 15:00 / 25:00 / 45:00 / 50:00; Start uses that length. | Preset does not change idle clock or Start length. |
| **PL7** | Pre-end cue | With pre-end **on** + short override (~12s): cue **once** in last 10s before 00:00. Skip/reset mid-session: **no** cue. | No cue when enabled; cue on abandon; fires more than once. |
| **PL8** | End sound | Sound **on**: end sound on Focus complete. Sound **off**: silent. Pre-end cue is separate (still gated by sound toggle for its soft sound). | End sound ignores toggle; pre-end confused with end sound. |
| **PL9** | Empty-state copy | Empty todos: specific empty copy visible (`Nothing on Today yet` + loop body from copy pack). Add one todo → empty state gone. | Blank hole / generic “no items”. |

---

## Impl handoff (Jordan)

1. Confirm build matches this matrix + `docs/v1-copy-pack.md` strings.  
2. Pre-end stays **default off**; implement/verify PL7 path when the setting is enabled.  
3. When ready, ping Jeff (and Bart) — do not expand into v1.1.

---

## QA handoff (Jeff)

1. Run PL1–PL9 after Jordan reports polish build ready (Settings QA hooks: short Focus override, `testToday` as needed).  
2. Also clear remaining **PENDING_UI** when practical: T1–T3, T6, D11, P6.  
3. Report PASS/FAIL per ID + one-line reason + evidence to Bart/Priya.  
4. Polish is **not** “shipped to Sam” until: **PL1–PL9 green** + **Theo’s durable public Vercel URL** is live (smoke on that URL when Bart says go).

---

## Ship gate (Bart-approved)

1. Jordan polish build matches PL1–PL9  
2. Jeff PL1–PL9 **green**  
3. Theo durable **public** Vercel URL available  
4. Then Jeff smoke on that URL (Bart go) → polish shipped to Sam  

After that: v1.1 **streak forgiveness** (not this pack). Non-goals hold.

## Follow-on polish (Bart-approved, non-blocking)

Do **not** block PL1–PL9 ship or the durable-URL smoke gate on these. Specs: `/workspace/habittracker-ux/PL10-PL15-specs.md` (+ checklist in `PL10-PL17-acs.md` for PL10–PL15 only).

### PL10–PL15 (Nora in-lane)

| ID | Must | Pass when |
| --- | --- | --- |
| **PL10** | Dialog keyboard a11y | Settings / Abandon / Focus credited: focus trap, Escape (Abandon=keep; Credited=dismiss; Settings=close), restore focus to opener; Abandon **no** backdrop dismiss |
| **PL11** | Idle control hierarchy | Idle: **Start** only (hide Reset/Skip). Focus + no task: under-clock `Pick a task to focus` as muted soft CTA (not task-name weight). Start with no task still allowed |
| **PL12** | Stats dedupe | TodoList header = `Todos` only; TodayStrip is sole Today/Streak source (compact Focus strip unchanged) |
| **PL13** | Zero-day Today strip | Full strip only: focus=0 streak=0 → hints `not yet` / `start today`; focus=0 streak>0 → `not yet` / `best N`. Compact unchanged |
| **PL14** | Timer live region | No per-tick SR announcements; announce once on status/mode transitions; keep `role="timer"` + queryable label |
| **PL15** | Hydrate skeleton | Pre-hydrate approximates header + strip + 2 cards; same bg; reduced-motion → static |

### Also approved (was out-of-lane; still non-blocking for PL1–PL9)

| Item | Locked intent |
| --- | --- |
| **Mid-Focus task switch** | Switch linked task while Focus is running/paused **without leaving minimal chrome** |
| **Document title + remaining time** | Update `document.title` with remaining time while a session is active — **no PWA** |
| **Break-mode priming hint** | When on a break and next Focus has no linked task, show a priming empty-state hint (product copy; not a new surface beyond empty-state) |

### Explicitly not in this approval

PL16 / PL17 from Nora’s longer checklist — **hold** until Bart/Priya reopen. Non-goals still hold (RPG, plant-death, social, sync, auto-complete todo).

### Handoff

1. Jordan: PL1–PL9 first; then PL10–PL15 + the three adjacent items as capacity allows.  
2. Jeff: gate “polish shipped to Sam” on **PL1–PL9 green** + Theo durable public URL only. Track PL10+ separately.  
3. Ellis: align any new strings with `docs/v1-copy-pack.md` when copy lands.
