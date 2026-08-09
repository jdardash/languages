# Sentence Islands — the working pipeline

The method is described and evaluated in [../METHOD.md](../METHOD.md). This folder
is the machinery: capture prompts, one sentence list per language, and two scripts
that turn a list into audio and into a recall drill.

One folder per focus language. Do **not** run more than one at a time — see the
rotation note at the end of [../README.md](../README.md).

```
Sentence Islands/
  capture-prompts.md        the prompts you narrate to yourself, day 1-3
  tools/build_audio.py      sentences.csv -> shadow.mp3 + recall.mp3
  tools/recall_drill.py     terminal active-recall drill, tracks what you miss
  Spanish/sentences.csv     one list per language (Spanish is seeded as the example)
  Spanish/audio/            generated; per-sentence mp3 cache
  Spanish/out/              generated; the two tracks you actually listen to
```

## The loop

**1. Capture (days 1-3).** Work through [capture-prompts.md](capture-prompts.md),
out loud, using phone speech-to-text. Do not filter or tidy. Aim for 300-500
English sentences before you translate anything; the list keeps growing forever
after that.

**2. Translate.** Paste batches of 30-50 into an AI with the register spelled out
("neutral Latin American Spanish, how a person actually speaks, not textbook"),
and fill the `target` column. **Get the first hundred checked by a native speaker
or tutor before you drill them** — see the register warning in METHOD.md. This
matters little in Spanish and enormously in Japanese, Arabic and Farsi.

**3. Build audio.**

```powershell
python "tools\build_audio.py" Spanish --voice es-MX-JorgeNeural
```

Produces `Spanish/out/shadow.mp3` (each target sentence twice, with a gap — for
shadowing in dead time) and `Spanish/out/recall.mp3` (English prompt, silence,
target answer — hands-free active recall for the car). Re-running only
re-synthesizes sentences whose text changed, so adding 20 rows is cheap.

Useful flags: `--rate -10%` to slow speech early on, `--limit 200` for a first
test, `--only-topic work`, `--mode shadow`, `--gap 3.0` for a longer answer pause.
`python tools\build_audio.py --list-voices es` prints the available voices.

**4. Drill.**

```powershell
python "tools\recall_drill.py" Spanish -n 25
```

Shows the English, waits, you say the target **out loud**, Enter reveals the
answer, you mark hit or miss. Misses come back tomorrow, hits get spaced out
(1, 2, 4, 7, 14 days). Progress is written back into `sentences.csv`, so the file
is both the curriculum and the scheduler — no separate database.

`--reverse` drills target to English (much easier; use it only for sentences that
are brand new). `--all` ignores scheduling. `--stats` prints where you stand.

**5. Feed the list.** Every time you want to say something and can't, it goes in
the list that evening. That gap *is* the syllabus.

## Anki instead of the drill script

If you would rather keep everything in the one shared Anki session the main README
describes:

```powershell
python "tools\recall_drill.py" Spanish --export-anki Spanish\anki.tsv
```

Import as tab-separated, field 1 = Front (English), field 2 = Back (target),
field 3 = Tags. Use it *or* the drill script, not both, or the scheduling gets
counted twice.

## Requirements

Both already present on this machine: Python 3.14, `edge-tts` (free Microsoft
neural voices, no API key, needs an internet connection while synthesizing), and
`ffmpeg` on PATH. Only `build_audio.py` needs any of the audio pieces —
`recall_drill.py` is standard library only.
