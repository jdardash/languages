# Language Study Site — Design

Date: 2026-08-09
Status: approved (design approved in session; spec pending user review)

## Purpose

One static site with three faces:

1. **Study app** — implements the evidence-backed daily routine from
   `../How To Learn Languages.md` (§10 push-mode day): active-recall drilling of
   sentence islands, shadowing audio, and progress measured against vocabulary
   coverage thresholds.
2. **Method reference** — the existing research and method documents, readable
   on the web.
3. **Learning vehicle** — a codebase clean enough to serve as the web-development
   curriculum from `../How To Learn GitHub And The Web.md`. Every feature lands
   as a small PR with a written description; the PR history is the course.

Spanish is the first and only language at launch (per How To Learn Languages.md
§9). The architecture is validated when a second language can be added with data
files alone — no JavaScript changes.

## Constraints (decided, not open)

- **Vanilla HTML/CSS/JS, no build step, no framework.** Site lives in `docs/`
  on `main`, deployed via GitHub Pages "deploy from a branch" with `/docs`.
- **Public repository.** Sentence content is kept impersonal/genericized.
  Privacy decision made explicitly by the user on 2026-08-09.
- **Repo lives at `C:\Dev\languages`.** The folder moves out of OneDrive before
  `git init` (OneDrive/Git corruption risk, documented in
  How To Learn GitHub And The Web.md §0). OneDrive retains its historical cloud
  copy; Git becomes the working history.
- **No server-side anything.** No accounts, no analytics, no secrets. All state
  is client-side.
- **Audio committed as plain files, never Git LFS** (Pages serves LFS pointers,
  not content). Large regenerable concatenations (`out/*.mp3`) stay ignored.

## Architecture

```text
C:\Dev\languages\
  docs\                     <- Pages web root (all lowercase-with-hyphens inside)
    .nojekyll
    index.html              <- Today dashboard
    drill.html
    shadow.html
    method.html
    progress.html
    css\site.css
    js\
      app.js                <- shared bootstrapping, nav, storage helpers
      scheduler.js          <- pure FSRS-lite scheduling module (no DOM)
      drill.js
      shadow.js
      method.js
      progress.js
      vendor\marked.min.js  <- vendored markdown parser (only third-party code)
    data\
      spanish.json          <- emitted by Python tooling from sentences.csv
      manifest.json         <- list of available languages
    audio\spanish\          <- per-sentence mp3s (copied/renamed lowercase)
    method\*.md             <- copies of the method docs served to method.html
  Sentence Islands\         <- existing Python tooling, still source of truth
  specs\                    <- design docs (this file)
  tests\scheduler.test.js   <- Node-runnable unit tests for scheduler.js
```

### Data flow

`sentences.csv` (per language, existing format) remains the single source of
truth for content. `Sentence Islands/tools/build_site_data.py` (new, sibling of
`build_audio.py`) emits `docs/data/<language>.json`:

```json
{
  "language": "spanish",
  "label": "Spanish",
  "bcp47": "es-419",
  "sentences": [
    { "id": "s-001", "en": "…", "target": "…", "topic": "work",
      "audio": "audio/spanish/t-1.mp3", "promptAudio": "audio/spanish/e-1.mp3" }
  ]
}
```

Schedule and progress state live in the browser:

- `localStorage` key: `languages:<lang>:schedule:v1` — per-sentence scheduler
  state (due date, interval, streak, lapses).
- `localStorage` key: `languages:settings:v1` — active language, playback rate,
  last-session timestamp.
- Export/import: Progress page offers download/upload of all state as one JSON
  file, for moving between devices. No sync; per-device schedules are accepted.
- Scheduling of record moves to the browser. `recall_drill.py` remains usable
  offline but the README will note: use one scheduler, not both.

## Pages

### Today (index.html)

Not a menu — the §10 routine as a dashboard:

- Due-card count and a "Start drill" button (primary action).
- Shadow shortcut with last-position resume.
- Evening nudge: if local time is morning, a low-key note that the SRS session
  consolidates better in the evening (How To Learn Languages.md §6). Informational
  only; never blocks.
- One language active at a time. Switching languages is deliberate (settings),
  not per-card — enforcing the no-interleaving rule.

### Drill (drill.html)

Active recall, production direction (L1→L2), matching METHOD.md step 3:

1. Show English prompt. User says the target sentence **out loud**.
2. Reveal target text (+ play target audio).
3. Self-grade: Miss / Hard / Good. Grades feed the scheduler.
4. Misses are queued to reappear within the same session (retrieval-count floor,
   Nakata 2017: 5–7 retrievals beat 1–3 — implemented as same-session requeue of
   misses until answered correctly twice).

Session is scoped to one language. Session length defaults to 25 cards
(configurable). End-of-session summary lists misses so they can feed the
sentence list ("feed the list" loop from Sentence Islands/README.md).

### Shadow (shadow.html)

Audio player over per-sentence clips:

- Play/pause, next/prev, loop-one, chained playback with configurable gap.
- Playback rate control (1.0× / 0.85× / 0.75×), pitch preserved
  (`audio.preservesPitch`).
- Shows target text large, English small (toggleable).
- `preload="none"`; first playback always from a user gesture; `play()` awaited
  in try/catch (autoplay policy).
- `speechSynthesis` is fallback only, for sentences with no recorded clip,
  feature-detected, voice matched by BCP 47 prefix, `voiceschanged`-aware.

### Method (method.html)

Client-side rendering of the method documents (`docs/method/*.md`) via vendored
`marked.min.js`. Document list is data-driven from `manifest.json`. The docs are
copies synchronized by the Python tooling (source files keep their current
locations and names; copies are lowercase-with-hyphens for Pages safety).

### Progress (progress.html)

- Cards by state (new / learning / mature), retention rate over trailing 30 days.
- Mature-sentence count displayed against the Nation (2006) coverage table
  (1,000 / 2,000 / 5,000 word-family thresholds) with honest labeling: sentence
  counts are a proxy, not word-family counts.
- Export / import state (JSON file download / file-input upload).

## Scheduler (scheduler.js)

Pure module, no DOM, no Date.now() inside the algorithm (current time passed in —
makes it unit-testable). FSRS-lite: interval ladder with ease adjustment.

- States: new → learning (1, 2, 4, 7, 14 days) → mature (interval × ease,
  ease adjusted by grade; caps at 180 days).
- Miss: back to interval 1, lapse counted; same-session requeue as described.
- Equal-vs-expanding subtleties deliberately ignored (Kim & Webb 2022: equivalent;
  kill list: "stop tuning the algorithm").
- API: `nextState(cardState, grade, now)` and `isDue(cardState, now)`.
  Both pure; unit-tested in `tests/scheduler.test.js` (Node built-in test runner).

## Evidence rules baked into behavior

| Rule | Source | Where enforced |
| --- | --- | --- |
| Production direction for islands (L1→L2) | METHOD.md step 3; How To Learn Languages.md reconciliation | Drill card layout |
| No cross-language interleaving in a session | How To Learn Languages.md §3 | One active language; switch only in settings |
| Retrieval floor (5–7) | Nakata 2017 | Same-session miss requeue |
| Evening SRS nudge | §6 sleep consolidation | Today page, informational |
| Talker variability (HVPT moderator) | §4 | build_audio.py gains multi-voice flag; new audio generated in several voices |
| Misses feed the list | Sentence Islands README step 5 | End-of-session miss summary |

## Error handling

- Every `fetch` checks `res.ok`; failure renders an inline error with the
  attempted URL (surfaces case-sensitivity 404s immediately).
- `localStorage` access wrapped: quota/private-mode failures degrade to
  in-memory state with a visible "progress will not be saved" banner.
- Audio `play()` awaited in try/catch; rejection shows a "tap to play" prompt.
- Missing audio file for a sentence: card still works text-only; synthesis
  fallback offered if a matching voice exists.
- State schema versioned (`:v1`); unknown versions are preserved untouched and
  reported, never overwritten.

## Testing

- `node --test tests/` for the scheduler (pure logic, the only algorithmic risk).
- Manual checklist per deploy: serve via `python -m http.server --directory docs`,
  verify drill round-trip, audio on first gesture, mobile viewport, hard-refresh
  after deploy (Pages ~10-min cache).
- Architecture test at the end: add French from data files alone.

## Delivery

Small PRs in dependency order, each with a description written to teach:

1. Repo bootstrap: move to `C:\Dev\languages`, `.gitignore`, `git init`, first
   commit, GitHub repo, Pages enabled, `docs/` skeleton with `.nojekyll` —
   deployed while still embarrassing.
2. Data pipeline: `build_site_data.py`, `spanish.json`, audio copied lowercase.
3. Scheduler module + tests.
4. Drill page.
5. Shadow page.
6. Today dashboard + settings.
7. Method pages.
8. Progress + export/import.
9. Polish: dark mode (`prefers-color-scheme`), keyboard controls, Lighthouse
   pass, repo README.

## Out of scope (v1)

- SpeechRecognition (unreliable cross-browser; poor on non-native accents).
- Frequency-ordered vocabulary deck and HVPT minimal-pair drills (v2; both need
  data that does not yet exist; pending polyglot-practices research findings).
- Second language content (French is the architecture test only).
- Any server, account, or sync feature.

## v2 candidates (from the polyglot-practices research, 2026-08-09)

The practitioner survey (`../../_Research/2026-08-09 - Polyglot Practices Research.md`)
confirmed v1's drill/shadow core and identified evidence-supported additions.
None change v1 scope:

- Minimal-pair ear-training drill (Wyner / HVPT) — needs contrast audio data.
- Bidirectional translation cycle as a card type (Lampariello).
- Comprehensible-input hour log with honest FSI-ordinal milestones.
- Frequency-ordered vocabulary deck (already planned; L2→L1 while beginner).
- Record-and-compare in the Shadow player (needs MediaRecorder; audio stays local).
