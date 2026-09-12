# Habit Tracker v1 — draft release notes

**Status:** Draft for Sam / Bart · **Ellis · Docs** · 2026-09-11  
Ship only after CEO Bart gives a go (per QA plan).

---

## What’s new

Local-first **Pomodoro + Todos + habit streaks** in the browser. No account, no sync — everything stays on your device in `localStorage`.

### The loop
1. Add tasks for Today  
2. Select one as your focus  
3. Run a Focus session  
4. When the timer hits **00:00**, you get **Focus credited** — that counts toward today and your streak  

Finishing Focus does **not** auto-complete the task. Skip or Reset mid-Focus asks for confirm and gives **zero credit**.

### Timer
- Focus **25 min** (soft presets 15 / 25 / 45 / 50 in Settings)  
- Short break **5 min** after a completed Focus  
- Long break **15 min** after **4 completed** Focus sessions  
- Start / Pause / Resume / Reset / Skip (idle shows Start only)  
- Optional end sound, browser notification, and last-10s pre-end cue  
- Live timer survives refresh; tab title shows remaining time while a session is active  

### Streaks (honest by design)
- A local calendar day qualifies with **≥1 completed Focus**  
- Day = device local date (`YYYY-MM-DD`), not UTC  
- Incomplete, paused, skipped Focus never count; breaks never count  

### During Focus
Chrome stays minimal: big digits, task name, controls, and today/streak.

No task linked? You’ll see **Pick a task to focus** under the clock (you can still Start). On a break with no task set, a short hint primes the next Focus.

---

## Not in v1
Day-start offset, off-days, freeze/repair, todo estimates, session history export, sync, accounts, themes, or gamification.

---

## Try it
```bash
cd HabitTracker
npm install
npm run dev
```
Open http://localhost:3000. For QA multi-day streak checks, Settings → enable **Show QA hooks**.

