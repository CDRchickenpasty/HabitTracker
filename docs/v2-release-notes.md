# Habit Tracker v2.0 — release notes

**Status:** Ready for review · 2026-09-13

---

## What’s new

### Visual history
- **History** panel with a 16-week Focus heatmap
- Tap a day for minutes, sessions, and the session log
- Completed Focus sessions are stored locally (pruned at 2000)

### Streak kindness
- Planned **off-days** that don’t break your streak
- **Freeze tokens** earned every 7 qualifying days
- One **repair** to restore a missed day
- Toggle kindness off in Settings for classic v1 rules

### Themes
- Accent colors: Rose, Emerald, Sky, Amber, Violet
- Density: Comfortable / Compact

### PWA
- Installable via web manifest + icons
- Offline shell service worker
- Install button appears in Settings when the browser supports it

### Optional cloud (Supabase)
- Magic-link sign-in when `NEXT_PUBLIC_SUPABASE_*` env vars are set
- Snapshot sync + conflict prompt (Keep local / Use cloud / Export first)
- App still works fully offline with **no** env vars

### Quality
- v1 → v2 localStorage migration (`habit-tracker-v1` → `habit-tracker-v2`)
- Import of an expired running timer now credits like a refresh restore
- Progress ring freezes duration at Start (settings edits don’t skew mid-session)
- Safer todo merge defaults; save failures surface a toast

---

## Setup cloud (optional)

1. Create a Supabase project
2. Run `supabase/migrations/001_init.sql` in the SQL editor
3. Enable Email auth (magic link)
4. Copy `.env.example` → `.env.local` and fill URL + anon key
5. Restart `npm run dev`

---

## Upgrade notes

- Existing v1 data migrates automatically on first load
- Export a backup before enabling cloud sync on a second device
