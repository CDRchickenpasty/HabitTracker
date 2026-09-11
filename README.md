# Habit Tracker

Local-first **Pomodoro + Todos + habit streaks** web app (v1).

- **Stack:** Next.js App Router, TypeScript, Tailwind CSS
- **Persistence:** `localStorage` only (no accounts, sync, or backend)
- **Deploy:** Vercel-ready

## Quick start

```bash
cd HabitTracker
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

### Deploy on Vercel

1. Push this folder to a Git repo (or import the directory in the Vercel dashboard).
2. In Vercel: **Add New Project** → import the repo.
3. Framework preset: **Next.js** (defaults are fine).
4. Deploy. No environment variables required.

Or with the CLI:

```bash
npx vercel
```

## Product loop (v1)

1. Add todos (list is not day-scoped in v1 — it persists until you clear items).
2. Select one task as the current focus (shown under the timer for the whole Focus).
3. Run a **Focus** Pomodoro.
4. On **completed** Focus (natural 00:00) → “Focus credited” beat; auto-advance to a break; credit streak / today stats.
5. Completing Focus does **not** auto-complete the linked todo.
6. Skip / Reset during an in-progress Focus asks for confirm — **zero credit**.

**UX:** While Focus is running/paused, chrome is minimal (digits + task name + controls + today/streak). Fuller chrome returns on breaks / idle. Timer is primary while a session is running/paused; the todo list is primary otherwise.

## Timer

| Mode        | Default | Notes                                      |
|-------------|---------|--------------------------------------------|
| Focus       | 25 min  | Soft presets 15 / 25 / 45 / 50 in Settings |
| Short break | 5 min   | After a completed Focus (until 4th)        |
| Long break  | 15 min  | After **4 completed** Focus sessions       |

Controls: **Start**, **Pause**, **Resume**, **Reset**, **Skip**.

- After each **completed** Focus → auto-advance to break + credit beat.
- After 4 completed Focus sessions → next break is **Long break**; counter resets.
- **Skip / Reset do not** credit Focus (abandon confirm when Focus is in progress). Skip also does not increment the focus-toward-long-break counter.
- Optional **end sound** (muted when End sound is off) and permission-gated browser Notification.
- Optional **pre-end cue** (Settings): once in the last 10s of a Focus — soft sound (if End sound on) + toast. Not fired on skip/reset.
- **Live timer persists** across refresh: mode / status / remaining time are saved. If a session was **running**, remaining time is recomputed from wall clock (`endsAt`); if it hit 0 while away, the same completion path runs (advance mode, credit Focus if applicable).

## Todos

- Add, edit/rename, complete/uncomplete, delete
- Select one as current focus (persisted with the list in `localStorage`)
- Focus completion does **not** check off the todo
- Empty state teaches the loop: only completed Focus counts toward the streak
- List chrome shows **Today · N Focus** and **Streak · N days**

## Habit streaks

Documented rules (also summarized in Settings):

1. A **local calendar day** qualifies if you complete **≥1 Focus** session that day.
2. **Day** = device local date, stored as `YYYY-MM-DD` (not UTC).
3. **Incomplete / paused / skipped** Focus sessions never count.
4. **Breaks** never count.
5. Current + best streak are shown on the Today strip, list header, and in Settings.

Out of scope for v1: day-start offset, off-days, freeze/repair, estimates, export, sync, accounts, gamification / RPG / social.

## Today strip

Shows:

- Focus sessions completed today (`Today · N Focus`)
- Focus minutes completed today
- Current streak (`Streak · N days`, with best as hint)

## QA / Testing hooks

Open **Settings → enable “Show QA hooks”** (marked **Testing**).

Available:

- **Override “today” (`testToday`):** date input (YYYY-MM-DD). When set, streak / daily-stats / “today” logic uses that local date instead of the real calendar day. **Clear — use real today** resets the override. Use this to QA multi-day streak behavior without waiting real days.
- **Short-duration overrides** for Focus / Short / Long (seconds). Quick preset: Focus 5s / Short 3s / Long 4s.
- **Seed:** last qualifying streak date, current/best streak, focus-toward-long-break counter (0–3), plus a one-click demo seed (yesterday relative to effective today).

These exist for manual QA only; leave overrides blank / cleared for normal use.

## Project structure

```
src/
  app/           # App Router entry (layout, page, styles)
  components/    # HabitApp, Timer, TodoList, TodayStrip, SettingsPanel
  hooks/         # useHabitStore (timer + persistence)
  lib/           # types, dates, streaks, storage, timerUtils
```

## License

Private / internal unless otherwise noted.
