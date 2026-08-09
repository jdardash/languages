# Complete From-Zero System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the site from a drill-and-shadow companion into a complete, self-contained from-zero learning system implementing all four evidence-backed engines plus phased onboarding.

**Architecture:** Static GitHub Pages site, ES modules, localStorage progress under `languages:*` keys (backup already covers the prefix). New pure modules (`plan.js`, `deck.js`, `forecast` in stats) carry all logic that needs tests; pages stay thin DOM glue in the established style. Python tooling under `Sentence Islands/tools/` extends for pair audio and multi-voice. Content data ships as JSON under `docs/data/`.

**Tech Stack:** Vanilla ES modules, node:test, edge-tts + ffmpeg (Python) for audio, Playwright MCP for browser verification.

## Global Constraints

- No emojis anywhere (user rule).
- All storage keys via `key(lang, kind)` from app.js so export/import keeps working.
- Conventional commits; run `npm test` before every commit; small focused PRs.
- Match existing code style: terse modules, `$` helper, comment only non-obvious constraints, evidence notes as `muted small` copy.
- Phases prescribe, never lock (Dreaming Spanish/Refold pattern): every page stays reachable.
- One headline metric per phase (LingQ/DS pattern).
- New-card throttling with visible two-queue split: "due reviews" unbounded, "new today" capped (WaniKani pattern).
- Dates: day keys are local `YYYY-MM-DD` strings.

## Research patterns adopted (from 2026-08-09 competitor survey)

1. Do-first onboarding with a "starting from zero?" fork (Duolingo).
2. Phase roadmap with self-rated graduation, no content locks (Refold/DS).
3. Two queues: throttled new vs unbounded review (WaniKani/Glossika).
4. Review forecast bars (WaniKani).
5. Frequency bands with per-band mastery, recognition-first cards, mark-as-known (Clozemaster/Refold/Lingvist).
6. Per-contrast minimal-pair decks with accuracy state, "contrast N of M" finite spine (ELSA/LingQ Mini Stories).
7. Auto-credit in-app listening time + two-field manual hour log, milestone bar labeled as estimates (DS).
8. Tutor prompt sheets: bring your 5 worst sentences; standing correction instruction surfaced at booking (Speechling coach loop, adapted).
9. Anti-patterns: no hearts, no points detached from learning state, no content locks.

---

### Task 0: Land the in-flight frontend polish (PR 0)

**Files:**
- Modify: `docs/js/drill.js` (wire `#bar`/`#fill` progress + `#replay`)
- Already modified (uncommitted): `docs/css/site.css`, `docs/drill.html`, `docs/index.html`, `docs/method.html`, `docs/progress.html`, `docs/shadow.html`

**Interfaces:** none new.

- [ ] Wire drill.js: track `total = queue.length` at init (plus requeues as they happen), update `#fill` width and `#bar` aria-valuenow in `show()`; on reveal, show `#replayRow` when `current.audio` exists; `#replay` click replays `current.audio`.
- [ ] `npm test` (scheduler tests must still pass).
- [ ] Browser-verify drill page end to end on `feat/frontend-polish` via local server + Playwright.
- [ ] Commit `feat: frontend polish with progress bar and grade-colored controls`, push, PR, merge.

### Task 1: Plan module — phases, day math, tutor trigger (PR 1)

**Files:**
- Create: `docs/js/plan.js`, `tests/plan.test.js`

**Interfaces (produces):**
```js
export const PHASES = [
  { id: 0, name: "Sound system", // weeks 1-2
    focus: "pairs", days: 14 },
  { id: 1, name: "Core 1,000 + grammar spine", focus: "vocab" },
  { id: 2, name: "1,000 to 5,000 + conversation", focus: "hours" },
  { id: 3, name: "Maintenance", focus: "hours" },
];
export function newPlan(startDate /* "YYYY-MM-DD" */, phase = 0) // -> {startDate, phase, phaseStarted: startDate}
export function dayNumber(startDate, now) // 1-based calendar day count
export function weekNumber(startDate, now) // 1-based
export function tutorDue(plan, now)       // true when weekNumber >= 6 or phase >= 2
export function phaseZeroDone(plan, now)  // dayNumber(phaseStarted) > 14
export function checklist(plan, now)      // ordered [{id, label, href}] for the phase
export function todayKey(now)             // local YYYY-MM-DD
```
Checklist contents (exact):
- Phase 0: pairs ("Minimal pairs - 10 min, before anything else", pairs.html), capture ("Capture sentences - narrate your day", capture.html), input ("Graded listening in dead time", input.html)
- Phase 1: grammar ("Grammar spine - exercises closed-book, morning", method.html), vocab ("Core deck - new cards + reviews", vocab.html), drill ("Island drill - say it out loud", drill.html), input ("Input - graded audio + captioned video", input.html), shadow ("Shadow in dead time", shadow.html)
- Phase 2: same as 1 minus grammar, plus tutor ("Tutor session prep", index.html#tutor)
- Phase 3: vocab reviews only + monthly conversation reminder.

- [ ] Write failing tests (day/week math incl. same-day = day 1, tutor trigger at week 6 exactly, phase-0 completion at day 15, checklist per phase, todayKey format).
- [ ] Run tests, verify fail. Implement plan.js. Run tests green.
- [ ] Commit `feat: plan module with phases, day math and tutor trigger`.

### Task 2: Onboarding wizard + phase-aware Today (PR 1)

**Files:**
- Modify: `docs/index.html`, `docs/js/today.js`
- Modify: `Sentence Islands/tools/build_site_data.py` (book + resources metadata into language JSON), regenerate `docs/data/*.json`

**Interfaces (consumes):** plan.js above. **Produces:** storage `key(lang,"plan")` = plan object; `key(lang,"daylog")` = { "YYYY-MM-DD": {pairs:true, grammar:true, ...} }; `key(lang,"tutorlog")` = [{ts, note}].

Language JSON gains: `"book": {"title": "Complete Spanish Step-by-Step - Bregstein", "free": "Language Transfer"}` (Spanish), French: Assimil / FSI French Basic.

Behavior:
- No stored plan -> setup card: "Are you starting this language from zero?" buttons [Starting from zero -> phase 0] [I already know some -> phase 1]; creates plan with startDate = today, hides rest until chosen; below the fork, a one-line reassurance + link to Method.
- With plan: banner "Phase N - Name - day D" + phase description line; checklist rendered with checkboxes bound to daylog for today; two-queue line "R reviews due (islands + core deck) - N new cards available today (cap 20)"; primary CTA follows phase focus (pairs page in phase 0, vocab/drill in phase 1+).
- Phase 0 day > 14: card suggesting graduation with self-check ("Can you hear r/rr and stress reliably? Move to Phase 1") + button advancing phase (stores phase 1, phaseStarted today). Same mechanic phase 1 -> 2 keyed on "book finished + first 1,000 mature" self-check, phase 2 -> 3 on B2 self-check.
- Tutor card when `tutorDue`: italki link, copyable standing instruction blockquote (exact text from How To Learn Languages §10), "Log session" button appending to tutorlog, count shown; prep list = 5 most-missed island sentences from `key(lang,"log")` misses.
- Grammar line shows book title from language JSON.

- [ ] Update build_site_data.py, re-run for Spanish + French.
- [ ] Rewrite today.js; extend index.html sections (setup, banner, checklist, queues, tutor).
- [ ] `npm test`; browser-verify: fresh profile -> fork -> phase 0 checklist; localStorage phase 1 -> tutor card at simulated week 6.
- [ ] Commit `feat: guided onboarding and phase-aware today dashboard`, PR, merge.

### Task 3: Deck module — vocab session logic (PR 2)

**Files:**
- Create: `docs/js/deck.js`, `tests/deck.test.js`

**Interfaces (produces):**
```js
export function pickSession(words, schedule, introducedToday, now, {newPerDay = 20, limit = 60} = {})
// words: [{id, rank, ...}] frequency-ordered. Returns {reviews: [...], news: [...]}:
// reviews = seen cards due (isDue, card exists), oldest-due first, capped at limit;
// news = first unseen words by rank, capped at max(0, newPerDay - introducedToday).
export function bandStats(words, schedule, bands = [100, 250, 500, 1000])
// -> [{limit: 100, total, seen, mature, pct}] pct = mature/total rounded
export function introKey(now) // same day-key semantics as plan.todayKey
```
Storage: `key(lang,"vocab-schedule")` (same card shape as scheduler), `key(lang,"vocab-intro")` = {day: "YYYY-MM-DD", count}.

- [ ] Failing tests: new-card cap respects introducedToday; reviews exclude unseen; band stats counts; mark-known handled as mature card (write test that a mature 180d card counts mature and is not in news).
- [ ] Implement, green, commit `feat: deck module with throttled new cards and band stats`.

### Task 4: Spanish core frequency deck data (PR 2)

**Files:**
- Create: `docs/data/vocab-spanish.json`

Format:
```json
{ "language": "spanish", "bands": [100, 250, 500],
  "words": [{ "id": "w-1", "rank": 1, "word": "de", "pos": "prep", "gloss": "of, from", "example": "Soy de California.", "exampleEn": "I am from California." }] }
```
Rules: 500 entries, frequency-ordered (corpus-informed, pedagogically smoothed - merge trivial inflections, skip pure grammar duplicates), es-419 register, every entry has a short natural example. No TTS files; audio via browser speechSynthesis on demand.

- [ ] Author words 1-100 (function words + top verbs/nouns), 101-250, 251-500 in three chunks; validate JSON parses and ids/ranks are sequential (node one-liner).
- [ ] Commit `feat: spanish frequency core deck data, top 500`.

### Task 5: Vocab page (PR 2)

**Files:**
- Create: `docs/vocab.html`, `docs/js/vocab.js`
- Modify: all page navs (add Vocab), `docs/js/today.js` (queue counts include vocab)

**Interfaces (consumes):** deck.js, scheduler.js, app.js. Card flow: front = word (+ Play button via speechSynthesis, lang = bcp47) + "rank N - band"; reveal -> gloss, example, collapsed English (details element); grades Miss/Hard/Good reuse `nextState`; "Mark known" sets `{state:"mature", interval:180, ease:2.5, due:now+180d, reps:1, lapses:0}`. Session = reviews then news; header shows "R reviews - N new"; band progress bars at top; keyboard 1/2/3 + space reveal, matching drill.

- [ ] Build page + JS; wire today.js due counts (islands due + vocab due, news available).
- [ ] `npm test`; browser-verify full session incl. new-cap rollover to next day (fake by editing localStorage day).
- [ ] Commit `feat: core frequency deck page with recognition cards`, PR (with Tasks 3-4), merge.

### Task 6: Minimal-pair trainer data + audio tooling (PR 3)

**Files:**
- Create: `docs/data/pairs-spanish.json`, `Sentence Islands/tools/build_pairs_audio.py`
- Create (generated): `docs/audio/pairs/spanish/<word>-<voiceShort>.mp3`

Contrasts (es-419, English-speaker perception targets):
- `r-rr` tap vs trill: pero/perro, caro/carro, cero/cerro, coro/corro, para/parra, moro/morro
- `d-r` intervocalic d vs tap: todo/toro, cada/cara, mudo/muro, seda/sera, codo/coro, boda/hora is invalid - use oda/ora? No: use lodo/loro
- `n-ñ`: una/uña, sonar/soñar, cana/caña, pena/peña, mono/moño, campana/campaña
- `stress` final vs penult: papa/papá, hablo/habló, canto/cantó, esta/está, termino/terminó, llamo/llamó

JSON format:
```json
{ "language": "spanish", "voices": ["es-MX-DaliaNeural", "es-MX-JorgeNeural", "es-US-AlonsoNeural", "es-US-PalomaNeural"],
  "contrasts": [{ "id": "r-rr", "label": "r vs rr (tap vs trill)", "tip": "...", "pairs": [{ "a": "pero", "b": "perro", "glossA": "but", "glossB": "dog" }] }] }
```
Tool: reads the JSON, synthesizes every word in every voice via edge-tts (cache-keyed like build_audio.py) into `docs/audio/pairs/spanish/`. Words with accents map to filenames via unicode NFC as-is (URLs percent-encode fine).

- [ ] Write pairs JSON + tool; run it (needs network); verify file count = words x voices.
- [ ] Commit `feat: minimal pair data and multi-voice audio tooling`.

### Task 7: Pairs page (PR 3)

**Files:**
- Create: `docs/pairs.html`, `docs/js/pairs.js`
- Modify: navs (add Pairs)

Session: pick contrast (or "weakest first" default ordering by stored accuracy); 20 trials; each trial picks a random pair + random word + random voice, plays audio (fallback: speechSynthesis when the mp3 404s or list empty), shows two buttons [a] [b] with glosses; immediate right/wrong feedback + replay; stores per-contrast rolling stats `key(lang,"pairs")` = { "r-rr": {seen, correct, last50: [0/1...]} }. End screen: per-contrast accuracy, weakest highlighted, "Contrast N of M" framing. Keyboard: 1/2 answer, space replay.

- [ ] Build page + JS; browser-verify with real audio.
- [ ] `npm test`; commit `feat: minimal pair perception trainer`, PR (with Task 6), merge.

### Task 8: Input hours page + shadow auto-credit (PR 4)

**Files:**
- Create: `docs/input.html`, `docs/js/input.js`
- Modify: `docs/js/shadow.js` (accumulate listened seconds; flush >=60s into log on pagehide/interval), navs (add Input), language JSON via build_site_data.py (`"resources"` per language: Spanish = Dreaming Spanish, Language Transfer Complete Spanish, ¿Qué onda español? style graded podcasts entry, italki; French = FSI, Assimil note, InnerFrench)

Storage: `key(lang,"inputlog")` = [{ts, mins, kind: "listening"|"video"|"reading"|"shadow", note}].
Page: total hours headline; milestone bar to next of 50/150/300/600/1000/1500 h labeled "estimates, not evidence"; two-field quick log (minutes + kind, optional note); pre-input comprehension workflow card (transcript-first steps); resources list from language JSON; last-14-days log with delete.

- [ ] Build page + shadow auto-credit + data; browser-verify (log entry, milestone bar, shadow credit after playing a clip).
- [ ] `npm test`; commit `feat: input hour tracking with shadow auto-credit`, PR opens after Task 9.

### Task 9: Capture page (PR 4)

**Files:**
- Create: `docs/capture.html`, `docs/js/capture.js`
- Modify: navs (add Capture)

Storage: `key(lang,"captured")` = [{id, en, topic, ts}].
Page: rotating prompt card (embedded array of ~12 prompts distilled from capture-prompts.md, one shown at a time with Next prompt); textarea + topic select (morning/work/opinions/stories/transactions/glue/questions/life) + Add (splits on newlines); count vs 300-500 goal with bar; list with per-item delete; CSV export matching `sentences.csv` header `id,topic,english,target,box,due,misses,notes` (target empty, notes=CAPTURED, ids continue from max existing? No - fresh numbering, user merges); dictation button when `webkitSpeechRecognition` exists (es-419 off - capture is in English, lang "en-US"); footer explains the pipeline: translate (AI ok), tutor-check first 100, run build_audio.py + build_site_data.py.

- [ ] Build; browser-verify add/delete/export.
- [ ] `npm test`; commit `feat: sentence capture flow with csv export`, PR (Tasks 8-9), merge.

### Task 10: Forecast + phase headline metric on Progress (PR 5)

**Files:**
- Create: `docs/js/stats.js`, `tests/stats.test.js`
- Modify: `docs/js/progress.js`, `docs/progress.html`

**Interfaces (produces):**
```js
export function forecast(cards, now, days = 7) // -> [{day: "YYYY-MM-DD", due: n}] counting card.due within each local day, day 0 = today incl. overdue
export function headline(plan, gather) // gather = {pairsAcc, matureWords, hours} -> {label, value, sub} per phase focus
```
Progress page: headline stat first (phase 0: weakest-contrast accuracy; phase 1: mature core words + "of 1,000, coverage ~X%" via Nation bands 75-80% at 1000; phase 2/3: input hours); then 7-day due-forecast bars (CSS bars, both schedules combined; read the dataviz skill before writing the chart); then existing sentence stats, vocab bands, pairs accuracies, tutor session count, captured count, hours; backup unchanged.

- [ ] Failing tests for forecast bucketing (overdue lands on today; day boundaries local) and headline selection; implement; green.
- [ ] Rework progress page; browser-verify all states (fresh profile and mid-phase profile).
- [ ] Commit `feat: review forecast and phase headline metrics`.

### Task 11: Multi-voice island audio + French audio + docs (PR 5)

**Files:**
- Modify: `Sentence Islands/tools/build_audio.py` (`--voice` accepts comma-separated list, rotates by row index), root `README.md` (overview: new pages + phase system), re-run pipeline

- [ ] Extend build_audio.py rotation; regenerate Spanish audio with 3 voices (es-MX-Jorge, es-MX-Dalia, es-US-Alonso) - cache keys change so full resynth; run build_site_data.py Spanish.
- [ ] Generate French audio (fr-FR-HenriNeural + fr-FR-DeniseNeural rotation, 3 sentences), build_site_data.py French; shadow page then has French clips.
- [ ] Update root README.md "Live study app" paragraph to describe the full system; build_site_data sync copies it to docs/method/overview.md.
- [ ] `npm test`; spot-check audio in browser; commit `feat: multi-voice island audio and french clips`, PR (Tasks 10-11), merge.

### Task 12: Final end-to-end verification

- [ ] Fresh-profile Playwright pass: onboarding fork -> phase 0 (pairs, capture) -> advance phase -> vocab session -> drill -> shadow (auto-credit) -> input log -> progress (headline + forecast) -> backup export.
- [ ] `npm test` full suite; confirm all PRs merged; verify deployed site on GitHub Pages.

## Self-review notes

- Every audit gap maps: onboarding (T1-2), grammar tracking (T2), tutor engine (T2), frequency deck (T3-5), pairs/HVPT (T6-7), input engine (T8), capture (T9), phase metrics + forecast (T10), multi-voice + French (T11).
- Type consistency: card shape everywhere = scheduler's `newCard()` shape; day keys via `todayKey`; all storage through `key()`.
- Risk: edge-tts/ffmpeg availability - verify early in Task 6; fallback is speechSynthesis-only pairs (page works without files) and skipping Task 11 resynthesis.
