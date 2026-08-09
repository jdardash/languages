# Spoken production and picture-prompted vocabulary

Date: 2026-08-09. Status: approved (scope, image source, and PR structure chosen by user).

## Problem

The evidence base (retrieval practice, the production effect, Swain's output hypothesis;
see Polyglot Practices Research and How To Learn Languages) says producing the language
aloud beats recognizing it, and that images help when they replace the L1 translation as
the meaning anchor for concrete vocabulary. Today the drill tells the learner to "say it
out loud" but never captures the attempt, record-and-compare exists only on the Shadow
page, the core deck is recognition-direction only with `speechSynthesis` audio, and no
card carries an image. Cloze production shipped in PR #15 and is out of scope here.

Decisions made during design: full scope (speaking + images + supporting audio),
curated Wikimedia Commons photos as the image source, delivery as small focused PRs on
a shared foundation.

## PR 1: shared recorder module and drill Speak mode

### Module: `docs/js/recorder.js`

Extract the MediaRecorder lifecycle from `shadow.js` (lines 115-151) unchanged in
behavior: `createRecorder({ recBtn, playBtn, statusEl })` returning `{ reset() }`.
It owns getUserMedia, start/stop, the single ephemeral object-URL take (revoked on
reset), and the two failure messages (unsupported browser, mic denied). `shadow.js`
becomes a consumer; the Shadow page behaves identically.

### Drill Speak mode

Third mode button on `drill.html` (Recall / Dictation / Speak), persisted as
`drillMode: "speak"`, mode switch reloads the session (existing pattern).

Per-card flow: English prompt -> Record my attempt (R key toggles) -> Reveal shows the
target and plays the native clip -> Play native / Play mine side by side -> self-grade
1/2/3 into the same schedule with the same miss-requeue rules. The queue filters to
cards with `audio`, like dictation. Recording is encouraged, not required: Reveal stays
enabled so a missing mic degrades to recall behavior.

No new unit tests (browser-API module, no pure logic); the existing suite must stay
green and Playwright verifies Shadow still records and Speak mode round-trips.

## PR 2: real audio for the core deck

New `Sentence Islands/tools/build_vocab_audio.py` (edge-tts, same voices as
`build_audio.py`): one clip per word and one per example into
`docs/audio/spanish/vocab/` as `w-<n>.mp3` / `w-<n>-ex.mp3`, low-bitrate mono,
plain committed files (no LFS - it breaks Pages playback). `vocab-spanish.json`
entries gain `audio` and `exampleAudio` paths. `vocab.js` plays the file when the
field is present and keeps the current `speechSynthesis` path as fallback, so a
partially generated deck never breaks the page.

## PR 3: Wikimedia image pipeline and Picture round

### Pipeline: `Sentence Islands/tools/fetch_images.py`

Two modes:

- `--search <word>`: query the Commons API, print top candidates (file title,
  thumbnail URL, license, author) for fast human curation.
- `--fetch`: read the committed curation CSV (`word id -> Commons file title`),
  download each 512px thumbnail, convert to WebP (target 30-60 KB) at
  `docs/img/vocab/spanish/<id>.webp`, and write
  `docs/data/image-credits-spanish.json` (title, author, license, source URL).

Curation targets concrete nouns in the top 500 ranks - expect 80-150 words. License
preference when choosing: PD/CC0 over CC BY over CC BY-SA; never NC/ND. A credits
section linked from the Method page renders the attribution file (required by
CC BY / BY-SA).

### Picture round

Mode button on `vocab.html`. Queue: due cards that have an `image` AND have been seen
at least once - introduction stays recognition-direction so meaning is never guessed
from a possibly ambiguous photo on first exposure. Front: image only, "say the Spanish
word aloud". Reveal: word + gloss + audio. Grades feed the same `vocab-schedule`.
An image that fails to load drops the card back to recognition for that session.

## Cross-cutting

- All pipelines take a language argument; Spanish ships first (no French deck yet).
- Error handling follows house patterns: mic denied -> status text, missing audio ->
  speechSynthesis fallback, missing data -> friendly status.
- Each PR: `node --test` green before commit, Playwright pass on touched pages
  (mobile, desktop, dark), conventional commits.
- Sequencing: PR 1 first (foundation), PRs 2 and 3 independent afterward; the Picture
  round uses deck audio when PR 2 has landed and falls back cleanly when it has not.

## Out of scope

Cloze production (shipped, PR #15), ASR scoring of recordings (rejected: 75-80%
accuracy on learner speech mistrains), any image-recognition/tap-the-picture mode
(poor transfer), French assets.
