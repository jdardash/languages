# Cross-device sync and self-assessment checkpoints

Date: 2026-08-09. Status: approved (sync backend and checkpoint cadence chosen by user).

## Problem

Progress lives in one browser's localStorage. Drilling on a phone and reviewing on a
laptop produces two divergent histories, reconcilable only by manual JSON export/import.
Separately, the system measures retention and coverage but never asks the learner whether
the skills are real; phase advancement rests on a single sentence of self-check text.

## Feature 1: GitHub Gist sync

### Approach

One private gist per user holds `languages-progress.json`. The browser talks directly to
`api.github.com` with a fine-grained personal access token scoped to gists only. No
server. The token and gist id live in localStorage on each device (not synced).

### Module: `docs/js/sync.js`

Pure logic, no DOM, `now` passed in, in the house style:

- `SYNC_META_KEY` — `languages:sync:v1`, holds `{ token, gistId, lastSync }`. Excluded
  from the synced payload along with `languages:settings:v1` (device preferences).
- `collectState(storage)` — every other `languages:*` key, as `{ key: value }`.
- `mergeStates(local, remote)` — field-level merge so same-day work on two devices both
  survive. Per key kind:
  - `schedule`, `vocab-schedule` — per-card: higher `reps` wins, tie to later `due`.
  - `log`, `vocab-log` — union, dedup by `ts:id`, sort by `ts`, cap 2000 (matches writers).
  - `inputlog`, `tutorlog`, `checkpoints` — union, dedup by `ts`, sort by `ts`.
  - `captured`, `usercards` — union, dedup by `id`.
  - `pairs` — per-contrast: higher `seen` wins.
  - `daylog` — per-day: OR of item flags.
  - `vocab-intro` — same `day`: max `count`; else later `day` wins.
  - `plan` — higher `phase` wins, tie to later `phaseStarted`; a null side loses.
  - Unknown keys — local wins if present, else remote (forward compatibility).
- `pullGist(token, gistId)` / `pushGist(token, gistId, state)` — thin fetch wrappers,
  untested; create a private gist on first push when `gistId` is empty.
- `syncNow(storage, now)` — pull, merge, write merged keys locally, push, stamp
  `lastSync`. Returns a status summary for the UI.

### UI

- Progress page: a Sync card — password-type token field, Connect, Sync now, status line
  with last-synced time, and one sentence telling the user to mint a fine-grained PAT
  with only the gist scope.
- Today page: silent auto-sync on load when a token is stored, so the common
  phone-then-laptop case needs no button. Failures degrade to a quiet status line;
  the page never blocks on the network.

### Security

Token is user-supplied, gist-scope only, stored in localStorage, sent only to
`api.github.com`. The Sync card says exactly that. Export/import buttons remain as the
offline fallback.

## Feature 2: Self-assessment checkpoints

### Cadence (chosen)

Phase gates plus monthly: the can-do checklist appears when the user advances a phase
(always), and a check-in card appears on Today when 30 days have passed since the last
recorded checkpoint. Phases still never lock — the checklist informs, the user decides,
per the existing plan.js philosophy.

### Module: `docs/js/checkpoint.js`

- `STATEMENTS` — per-phase CEFR-flavored can-do statements (phase 0 sound contrasts,
  phase 1 A1/A2, phase 2 B1, phase 3 maintenance), each `{ id, text }`.
- `RATINGS` — 0-3: can't / with help / mostly / easily.
- `checkpointDue(plan, history, now)` — true when no checkpoint recorded in 30 days
  (phase gates always show the checklist regardless).
- `record(history, { ts, phase, kind, ratings })` — append entry; `kind` is
  `"advance"` or `"monthly"`.
- `average(entry)` — mean rating for trend display.

Storage: `key(lang, "checkpoints")` — array of `{ ts, phase, kind, ratings }` where
`ratings` maps statement id to 0-3. Rides along in sync (dedup by `ts`).

### UI

- Today: the advance button reveals the phase checklist with a 0-3 control per
  statement; submitting records the checkpoint and advances. A monthly check-in card
  renders the current phase's checklist when `checkpointDue`.
- Progress: a Checkpoints section listing recorded entries (date, phase, average
  rating) so the trend is visible next to retention.

## Testing

- `tests/sync.test.js` — `collectState` exclusions, every `mergeStates` key kind,
  idempotence (merge(a, a) = a), and that merging two divergent same-day states loses
  nothing.
- `tests/checkpoint.test.js` — due logic around the 30-day boundary, record/average.
- Network wrappers stay thin and untested; Playwright browser verification of Today and
  Progress before each merge.

## Delivery

Two focused PRs off main: `feat: gist-backed cross-device sync` first, then
`feat: self-assessment checkpoints` (sync's merge table already lists the
`checkpoints` key, so the second PR needs no sync changes).
