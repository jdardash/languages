# Languages

**Live app: <https://jdardash.github.io/languages/>**

An offline-first study app that turns four evidence-backed interventions into one
site: high-variability phonetic training, a frequency-core vocabulary deck on a
spaced-repetition schedule, a grammar-spine checklist, and graded comprehensible
input with automatic hour tracking. No accounts, no server, no network calls after
first load. Progress lives in the browser with JSON export and import.

Ten languages ship with it. Adding an eleventh requires data files only, and that
claim is covered by a test.

## What is interesting technically

- **Zero runtime dependencies.** Twenty ES modules, plain DOM, no framework and no
  build step for the app itself. `docs/` is the site; GitHub Pages serves it from
  `main`.
- **Conflict-free multi-device sync without a backend.** State merges per key with
  day-level ORing of activity flags, so two devices that worked the same day both
  keep their work. The merge is idempotent and tested against divergent histories.
- **A scheduler under test.** 56 unit tests run on `node --test` with no test
  framework installed — deck scheduling, review forecasting, phase gating,
  dictation scoring, statistics and sync merges.
- **A generated data layer.** Python builders turn `sentences.csv`, open dictionary
  dumps and frequency lists into the JSON the site reads, so content changes never
  touch application code.

```sh
python -m http.server 8000 --directory docs   # run the site locally
npm test                                       # 56 scheduler and sync tests
python "Sentence Islands/tools/build_site_data.py"   # regenerate site data
```

## How the app is laid out

A first visit asks whether you are starting from zero and, if so, opens a phased
path. Phase 0 is two weeks of multi-voice minimal-pair ear training plus sentence
capture. Phase 1 adds the frequency core deck (recognition cards, 20 new per day,
band progress), the grammar-spine checklist and graded input. Week 6 surfaces the
tutor card with a standing correction instruction. The progress page leads with one
phase-appropriate headline metric and a seven-day review forecast. Phases prescribe;
they never lock.

| Path | What it holds |
| --- | --- |
| `docs/` | The site itself — pages, ES modules, generated JSON, audio |
| `Sentence Islands/` | Per-language sentence lists, audio, and the Python builders |
| `tests/` | Node test suite for the scheduler, sync and scoring |
| `specs/`, `plans/` | Design history for each feature |
| Language folders | One per language: the book, a free alternative, and a fluency ladder |

## The method behind it

[METHOD.md](METHOD.md) is the daily routine — the sentence-island system, what in it
is evidence-backed and what is its author selling his own app, and how drilling,
the book and the input engine divide the day.

[How To Learn Languages](notes/how-to-learn-languages.md) is the evidence layer
underneath, researched from nine meta-analyses in August 2026: the four
interventions with real effect sizes, a vocabulary-coverage table that turns
"fluent" into a countable target, SRS policy, and pronunciation training. It
corrects three claims made elsewhere in this repository — delayed output, card
direction, and reading-with-audio — and reconciles the frequency-list versus
personal-sentences question that METHOD.md raises.

The two are layers rather than rivals: one is the routine, the other is why the
routine is shaped that way and what it costs.

## The ten languages

Each folder carries the same structure: one fundamental book as the finish-test
standard, a free and legal alternative, a first move, and a ladder of book, graded
input, speaking practice, and the milestone that counts as fluent (B2/C1).

| Language | Fundamental book | Free alternative |
| --- | --- | --- |
| Arabic | Mastering Arabic 1 — Wightwick & Gaafar | FSI / Language Transfer |
| Chinese | Integrated Chinese Vol. 1 (4th ed.) | FSI Standard Chinese |
| Farsi | Complete Modern Persian — Farzad | DLI / Peace Corps (livelingua) |
| French | Assimil New French with Ease | FSI French Basic |
| Hebrew | Hebrew from Scratch, Part 1 | FSI Hebrew Basic |
| Japanese | Genki I (3rd ed.) | Tae Kim; Irodori (official, free) |
| Portuguese | Colloquial Portuguese of Brazil | FSI Portuguese Programmatic |
| Russian | The New Penguin Russian Course — Brown | FSI Russian FAST |
| Spanish | Complete Spanish Step-by-Step — Bregstein | Language Transfer |
| Tagalog | Tagalog for Beginners — Barrios | FSI / Peace Corps Tagalog |

Almost every language here has a public-domain US government course (FSI, DLI or
Peace Corps) hosted free at livelingua.com — dated but complete, with audio.

## What running ten at once actually costs

The goal is broad, even familiarity rather than ten parallel pushes, so the app
assumes one focus language at a time (45-60 min/day), rotating on milestone rather
than on the calendar, with maintenance capped at two more.

The arithmetic is the reason for that cap. Steady-state SRS load is roughly mature
cards divided by mean interval, so ten languages held at a 1,000-word floor really
does cost only about 15 min/day — but 1,000 word families buys under 80% text
coverage, which is the ability to understand nothing unassisted, and it is exactly
the level attrition research says evaporates. Held at a usable 5,000 words, or 95%
coverage, ten languages cost about 75 min/day, forever, before any input or
speaking. Acquisition ends; maintenance does not. Full arithmetic and the resulting
three-language cap are in section 8 of
[How To Learn Languages](notes/how-to-learn-languages.md).

Useful discounts: Spanish, Portuguese and French share heavy grammar and vocabulary
overlap, and the Arabic script discounts Farsi once learned. Chinese, Japanese,
Hebrew and Tagalog are islands.

## Data credits

The app bundles data derived from open sources:

- Conjugations: [Fred Jehle Spanish verb database](https://github.com/ghidinelli/fred-jehle-spanish-verbs) (CC BY-NC-SA 3.0).
- Reader glosses: [WikDict](https://www.wikdict.com/) es-en (CC BY-SA); the derived `docs/data/dict-spanish.json` carries the same license.
- Minimal-pair mining: [ipa-dict](https://github.com/open-dict-data/ipa-dict) (MIT) and [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (CC BY-SA 3.0).
- Bundled reader text: *A First Spanish Reader*, Project Gutenberg #15353 (public domain).
- Audio: synthesized with edge-tts; transcription tooling uses faster-whisper locally.

Application code is MIT licensed (see [LICENSE](LICENSE)). Bundled third-party data
keeps the licenses listed above.
