# Feature-branch audit vs `main`

Remote: `https://github.com/CDRchickenpasty/HabitTracker`  
Compared after `git fetch origin`. `main` tip at audit: `216a045` (export/import/clear + Vitest).

`git diff A B -- src/` below is two-dot (what changes to turn A into B). Unique-on-branch commits are `git log --oneline main..origin/<branch>`.

| Branch | Unique commits vs `main` | Verdict |
| --- | --- | --- |
| `feature/pomodoro-v1` | `1b34d48` feat: Pomodoro habit tracker v1 | **Already on main.** Tip `src/` is identical to squash-merge PR #1 (`f3867b5`). `main` is a strict superset: later files (`useDialogA11y.ts`, `core.test.ts`, export/import in storage/Settings) exist only on `main`. No leftover unique app behavior to port. |
| `feature/pomodoro-v1-polish` | `a24b596`, `5565e13`, `cf7332e` (PL1–PL9 polish pack) | **Already on main.** Tip `src/` is identical to squash-merge PR #2 (`15d9a8b`). Later PL10–PL20 Timer/a11y/title work and export/import live only on `main`. |
| `feature/pl10-pl20-ux` | *(none)* | **Already on main.** Tip SHA equals `15d9a8b` (ancestor of `main`). Fully contained; no unique source. |
| `feature/pl10-pl20-polish` | `7fc501b` PL10–PL20 polish, `9a2e6be` PL19 title restore, `11679bf`/`0e1e512` v1.1.0 stamp | **Already on main.** Tip `src/` is identical to follow-up `099a121`. Remaining `src/` two-dot vs `main` is only later export/import/clear + tests (`HabitApp` / `SettingsPanel` / `useHabitStore` / `storage` / `core.test.ts`). Timer, `useDialogA11y`, dates/streaks/timerUtils/types match `main` exactly. |

Wholesale `git merge` of any of these tips would drop later `main` work (data export/import/clear, Vitest). Content union: nothing still-missing to cherry-pick.

## `src/` two-dot vs `main` (main as B)

All four diffs add files/lines on `main` (superset). Reverse diffs only restore older bodies of files `main` later replaced.
