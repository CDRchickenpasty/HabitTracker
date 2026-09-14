# Habit Tracker

A local-first **Pomodoro + todos + habit streaks** app that runs in your browser.

Everything works on **this device** in `localStorage` with no required accounts. Optional cloud sync (Supabase) is available when you add env keys.

**Version:** 2.0.0 · **Stack:** Next.js (App Router), TypeScript, Tailwind CSS

---

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer
- npm (comes with Node)

That’s it.

---

## Run it locally

```bash
git clone https://github.com/CDRchickenpasty/HabitTracker.git
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

---

## How to use it

1. **Add a task** in the Todos list.
2. **Select one task** as your current focus (it appears under the timer).
3. Press **Start** to begin a Focus session.
4. Let the timer reach **00:00**. That session is credited toward today and your streak.

Important details:

- Finishing a Focus does **not** check off the linked todo — mark tasks done yourself when you’re ready.
- **Skip** or **Reset** during an in-progress Focus asks for confirmation and gives **zero credit**.
- With no task selected you can still start a Focus; the app nudges you to pick one when it helps.

### Timer defaults

| Mode | Default | When |
| --- | --- | --- |
| Focus | 25 minutes | Soft presets 15 / 25 / 45 / 50 in Settings |
| Short break | 5 minutes | After each completed Focus (until the 4th) |
| Long break | 15 minutes | After **4 completed** Focus sessions |

Controls: **Start**, **Pause**, **Resume**, **Reset**, **Skip**. While idle, only **Start** is shown.

While a Focus is running or paused, the UI stays minimal (big timer, task name, controls, today/streak). Fuller chrome comes back on breaks and when idle.

The browser tab title shows remaining time while a session is active. If you refresh mid-session, the timer keeps going from wall-clock time; if Focus hit zero while you were away, it still gets credited the same way.

### Today strip

At a glance you get:

- Focus sessions completed today
- Focus minutes completed today
- Current streak (with best streak as a hint)

### History

Open **History** for a 16-week Focus heatmap. Tap a day to see sessions and (when kindness is on) mark off-days, spend a freeze, or repair.

### Settings

Open **Settings** to change:

- Focus / short / long durations
- Accent color and density
- Streak kindness (freezes, off-days, repair)
- End sound, pre-end cue, browser notifications
- Optional cloud sync (when Supabase env vars are set)
- PWA install (when the browser offers it)

---

## Your data

- Stored in this browser’s `localStorage` (key: `habit-tracker-v2`; v1 data migrates automatically).
- Not uploaded unless you opt into cloud sync.
- Clearing site data, another browser, or another device will not have your history unless you restore a backup or sync.

### Backup and reset

In **Settings → Data**:

| Action | What it does |
| --- | --- |
| **Export** | Downloads a JSON backup of todos, settings, streak, history, and timer state |
| **Import** | Replaces current data with a previously exported JSON file (asks for confirm) |
| **Clear all data** | Wipes local data back to defaults (asks for confirm) |

Keep exports somewhere safe if you care about your streak history.

---

## Streak rules

1. A **local calendar day** counts if you complete **at least one Focus** that day.
2. “Day” means your device’s local date (`YYYY-MM-DD`), not UTC.
3. Incomplete, paused, or skipped Focus sessions never count.
4. Breaks never count.
5. With **streak kindness** enabled (default): planned off-days and freeze tokens can bridge a miss; you also get one repair.

Turn kindness off in Settings for classic v1 rules (completed Focus only).

---

## Testing hooks (optional)

For people verifying streak or timer behavior:

1. Open **Settings**.
2. Turn on **Show QA hooks**.

You can then override “today”, shorten Focus/break lengths (seconds), and seed streak values. Leave these off for normal use.

---

## Develop

```bash
npm test        # Vitest unit tests (dates, streaks, timer transitions, storage)
npm run build   # Production build
npm run lint    # ESLint
```

### Project layout

```
src/
  app/           # Next.js App Router (layout, page, styles)
  components/    # HabitApp, Timer, TodoList, TodayStrip, History, Settings, Account
  hooks/         # Store + dialog accessibility
  lib/           # Types, dates, streaks, history, storage, supabase helpers
public/          # PWA manifest, icons, service worker
supabase/        # Optional SQL migrations for cloud sync
docs/            # Product notes (not required to use the app)
```

---

## Optional cloud sync (Supabase)

1. Create a Supabase project and run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
2. Enable Email → Magic link auth.
3. Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Restart the dev server. **Settings → Cloud sync** then offers magic-link sign-in.

Without these vars the app stays fully local.

---

## Deploy on Vercel

1. Import this repo in the [Vercel dashboard](https://vercel.com/) (or run `npx vercel` from the project folder).
2. Framework preset: **Next.js** (defaults are fine).
3. Deploy. **No environment variables** are required for local-only mode.
4. To enable cloud sync, add the two `NEXT_PUBLIC_SUPABASE_*` vars in the Vercel project settings.

---

## Docs (optional)

Internal / historical notes live under [`docs/`](docs/), including [`docs/v2-release-notes.md`](docs/v2-release-notes.md).

---

## License

No `LICENSE` file is included in this repository. Do not assume open-source reuse rights until the owner adds one.
