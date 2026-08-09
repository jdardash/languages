# Spoken Production and Picture-Prompted Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spoken production (record-and-compare in the drill), real edge-tts audio for the core deck, and Wikimedia-curated picture-prompted production cards.

**Architecture:** Extract the MediaRecorder machinery from `shadow.js` into a shared `docs/js/recorder.js`, then build the drill's Speak mode on it. Two Python pipelines (edge-tts vocab audio, Wikimedia Commons image fetcher) enrich `vocab-spanish.json` in place; the browser degrades gracefully when an asset is missing. Spec: `specs/2026-08-09-speaking-and-images-design.md`.

**Tech Stack:** Vanilla ES modules, `node --test`, Python 3 (edge-tts, requests, Pillow), GitHub Pages static hosting.

## Global Constraints

- No emojis anywhere (user rule).
- Conventional commits; each of the three PRs stays small and focused.
- `npm test` (node --test) green before every commit.
- Plain committed mp3/webp files - no Git LFS (breaks Pages playback).
- No ASR scoring of recordings; no image-recognition (tap-the-picture) mode.
- Spanish only for generated assets; pipelines take a language argument.
- Playwright verification (mobile 375px, desktop, dark mode) on touched pages before each PR.
- House JS style: `const $ = id => document.getElementById(id)`, pure logic in DOM-free modules, `now` passed in, ASCII hyphens in UI copy.

---

## PR A: `feat/drill-speak-mode` (Tasks 1-2)

### Task 1: Extract shared recorder module

**Files:**
- Create: `docs/js/recorder.js`
- Modify: `docs/js/shadow.js:112-151` (replace inline recorder with the module)

**Interfaces:**
- Produces: `createRecorder({ recBtn, playBtn, statusEl, recordingMsg }) -> { reset() }` - binds click handlers on construction; `reset()` stops any live recording, revokes the take, restores button labels.

- [ ] **Step 1: Write `docs/js/recorder.js`**

```js
// Shared record-and-compare machinery (Speechling/Mango mechanic, minus the
// fake scoring): hearing your own attempt against the native clip is the
// feedback loop. One ephemeral take; gone on reset. No ASR on purpose -
// automatic scoring runs 75-80% accuracy on learner speech and mistrains.

export function createRecorder({ recBtn, playBtn, statusEl, recordingMsg = "Recording - speak now." }) {
  let recorder = null, takeUrl = null;

  function reset() {
    if (recorder && recorder.state === "recording") recorder.stop();
    if (takeUrl) { URL.revokeObjectURL(takeUrl); takeUrl = null; }
    playBtn.hidden = true;
    recBtn.textContent = "Record my attempt";
    statusEl.textContent = "";
  }

  recBtn.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") { recorder.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      statusEl.textContent = "Recording is not supported in this browser.";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.addEventListener("dataavailable", e => chunks.push(e.data));
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach(t => t.stop());
        if (takeUrl) URL.revokeObjectURL(takeUrl);
        takeUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        playBtn.hidden = false;
        recBtn.textContent = "Record again";
        statusEl.textContent = "Play the native clip, then yours - where do they differ?";
      });
      recorder.start();
      recBtn.textContent = "Stop recording";
      statusEl.textContent = recordingMsg;
    } catch {
      statusEl.textContent = "Microphone unavailable or permission denied.";
    }
  });

  playBtn.addEventListener("click", () => { if (takeUrl) new Audio(takeUrl).play(); });

  return { reset };
}
```

- [ ] **Step 2: Refactor `shadow.js` to consume it**

Delete the whole inline block (the comment starting `// Record-and-compare`, `let recorder = null, takeUrl = null;`, `function resetRecording()`, the `recBtn` and `playMine` listeners - currently lines 112-151). Add to the imports and replace `resetRecording()`:

```js
import { createRecorder } from "./recorder.js";

const rec = createRecorder({
  recBtn: $("recBtn"), playBtn: $("playMine"), statusEl: $("recStatus"),
  recordingMsg: "Recording - shadow the clip now.",
});
```

In `render()`, replace the `resetRecording();` call with `rec.reset();`.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: all pass, 0 fail (module is browser-API only; this catches import typos via nothing - the real check is Step 4).

- [ ] **Step 4: Playwright check of the Shadow page**

Serve `docs/` (`python -m http.server 8000 -d docs`), open `http://localhost:8000/shadow.html`, grant a fake mic (`--use-fake-ui-for-media-stream` context flag or Playwright `permissions: ["microphone"]`). Verify: Record my attempt -> Stop recording -> Play mine appears; navigating to the next clip resets the row. Zero console errors.

- [ ] **Step 5: Commit**

```bash
git add docs/js/recorder.js docs/js/shadow.js
git commit -m "refactor: extract record-and-compare into shared recorder module"
```

### Task 2: Drill Speak mode

**Files:**
- Modify: `docs/drill.html:38-42` (mode row), `docs/drill.html:49-57` (record row)
- Modify: `docs/js/drill.js`

**Interfaces:**
- Consumes: `createRecorder` from Task 1.
- Produces: `drillMode` setting value `"speak"` (alongside `"recall"`/`"dictation"`).

- [ ] **Step 1: Add the mode button and record row to `drill.html`**

Mode row becomes:

```html
<div class="mode-row" id="modeRow" hidden>
  <button id="modeRecall" aria-pressed="true">Recall</button>
  <button id="modeDictation" aria-pressed="false">Dictation</button>
  <button id="modeSpeak" aria-pressed="false">Speak</button>
  <span class="muted small">Recall: say it from English. Dictation: type what you hear. Speak: record yourself, compare with the native clip.</span>
</div>
```

Inside `.answer-zone`, after the `replayRow` line, add:

```html
<div class="record-row" id="recordRow" hidden>
  <button id="recBtn">Record my attempt</button>
  <button id="playMine" hidden>Play mine</button>
  <span id="recStatus" class="muted small"></span>
</div>
```

- [ ] **Step 2: Wire the mode into `drill.js`**

Imports gain the recorder; after the `$`/state setup add the instance:

```js
import { createRecorder } from "./recorder.js";
const rec = createRecorder({ recBtn: $("recBtn"), playBtn: $("playMine"), statusEl: $("recStatus") });
```

In `init()`, both audio-dependent modes fall back and filter identically - replace the two dictation lines with:

```js
const needsAudio = mode === "dictation" || mode === "speak";
if (needsAudio && !due.some(s => s.audio)) mode = "recall";
queue = (needsAudio ? due.filter(s => s.audio) : due).slice(0, settings.drillLimit);
```

`syncModeButtons()` gains `$("modeSpeak").setAttribute("aria-pressed", String(mode === "speak"));` and the button loop becomes:

```js
for (const [btn, m] of [["modeRecall", "recall"], ["modeDictation", "dictation"], ["modeSpeak", "speak"]]) {
```

In `show()`, add a speak branch (recall stays the `else`); speak shows the English prompt like recall plus the record row:

```js
$("recordRow").hidden = mode !== "speak";
rec.reset();
if (mode === "dictation") {
  // ... existing branch unchanged
} else {
  $("counter").textContent = mode === "speak"
    ? `${queue.length} remaining - record yourself saying it, then reveal`
    : `${queue.length} remaining - say it out loud before revealing`;
  $("prompt").textContent = current.en;
  $("replayRow").hidden = true;
  $("typeZone").hidden = true;
  $("reveal").hidden = false;
  $("reveal").focus();
}
```

Reveal already plays `current.audio` when present, which is guaranteed in speak mode - no change needed there. Keyboard: in the existing `keydown` handler add, before the reveal/grades branches:

```js
if (mode === "speak" && (e.key === "r" || e.key === "R") && e.target.tagName !== "TEXTAREA") {
  e.preventDefault();
  $("recBtn").click();
  return;
}
```

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: all pass (drill.js has no unit tests; suite guards the modules it imports).

- [ ] **Step 4: Playwright verification**

On `drill.html`: switch to Speak (page reloads), confirm only audio-bearing cards queue, record -> stop -> reveal plays native clip -> Play mine and Replay audio both work -> grade 3 advances and resets the record row. Check mobile 375px and dark mode. Zero console errors.

- [ ] **Step 5: Commit, push, open PR A**

```bash
git add docs/drill.html docs/js/drill.js
git commit -m "feat: drill speak mode - record your attempt and compare with the native clip"
git push -u origin feat/drill-speak-mode
gh pr create --title "feat: drill speak mode on a shared recorder module" --body "..."
```

---

## PR B: `feat/vocab-audio` (Tasks 3-4)

### Task 3: Vocab audio pipeline

**Files:**
- Create: `Sentence Islands/tools/build_vocab_audio.py`
- Modifies (as output): `docs/data/vocab-spanish.json`, `docs/audio/spanish/vocab/*.mp3`

**Interfaces:**
- Produces: deck entries gain `"audio": "audio/spanish/vocab/w-<n>.mp3"` and `"exampleAudio": "audio/spanish/vocab/w-<n>-ex.mp3"`.

- [ ] **Step 1: Write `build_vocab_audio.py`**

```python
"""Synthesize per-word and per-example clips for the frequency core deck.

    python build_vocab_audio.py spanish --voice es-MX-JorgeNeural,es-MX-DaliaNeural

Reads docs/data/vocab-<lang>.json, writes docs/audio/<lang>/vocab/w-<n>.mp3
(word) and w-<n>-ex.mp3 (example sentence), then rewrites the deck JSON with
audio/exampleAudio paths. Caches by text+voice hash in a manifest next to the
clips; re-running only synthesizes what changed. Voices rotate across words
(talker variability aids perception).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "docs"


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha1(f"{text}|{voice}".encode("utf-8")).hexdigest()


async def synth_all(jobs: list[tuple[Path, str, str]]) -> None:
    try:
        import edge_tts
    except ImportError:
        die("edge-tts is not installed:  python -m pip install edge-tts")

    sem = asyncio.Semaphore(4)
    done = 0

    async def one(path: Path, text: str, voice: str) -> None:
        nonlocal done
        async with sem:
            tmp = path.with_suffix(".part")
            await edge_tts.Communicate(text, voice).save(str(tmp))
            tmp.replace(path)
            done += 1
            print(f"\r  synthesizing {done}/{len(jobs)}", end="", flush=True)

    await asyncio.gather(*(one(*job) for job in jobs))
    print()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lang", help="language id, e.g. spanish")
    ap.add_argument("--voice", required=True, help="comma-separated voice list, rotated across words")
    args = ap.parse_args()

    deck_path = DOCS / "data" / f"vocab-{args.lang}.json"
    if not deck_path.exists():
        die(f"missing {deck_path}")
    deck = json.loads(deck_path.read_text(encoding="utf-8"))

    audio_dir = DOCS / "audio" / args.lang / "vocab"
    audio_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = audio_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    voices = [v.strip() for v in args.voice.split(",") if v.strip()]
    jobs: list[tuple[Path, str, str]] = []
    for idx, w in enumerate(deck["words"]):
        voice = voices[idx % len(voices)]
        n = w["id"].removeprefix("w-")
        for suffix, text in (("", w["word"]), ("-ex", w["example"])):
            name = f"w-{n}{suffix}.mp3"
            path = audio_dir / name
            k = cache_key(text, voice)
            if manifest.get(name) != k or not path.exists():
                jobs.append((path, text, voice))
                manifest[name] = k
            w["audio" if not suffix else "exampleAudio"] = f"audio/{args.lang}/vocab/{name}"

    print(f"{len(deck['words'])} words, {len(jobs)} clips to synthesize")
    if jobs:
        asyncio.run(synth_all(jobs))
        manifest_path.write_text(json.dumps(manifest, indent=1), encoding="utf-8")

    deck_path.write_text(json.dumps(deck, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"rewrote {deck_path}")


if __name__ == "__main__":
    main()
```

Note: the deck JSON is stored one-word-per-line today; `indent=1` changes that formatting. Acceptable - it is a generated-data file from here on.

- [ ] **Step 2: Run it**

Run: `python "Sentence Islands/tools/build_vocab_audio.py" spanish --voice es-MX-JorgeNeural,es-MX-DaliaNeural`
Expected: clips in `docs/audio/spanish/vocab/`, deck JSON now has `audio`/`exampleAudio` on every word. Spot-check two mp3s by ear.

- [ ] **Step 3: Commit**

```bash
git add "Sentence Islands/tools/build_vocab_audio.py" docs/data/vocab-spanish.json docs/audio/spanish/vocab
git commit -m "feat: edge-tts audio pipeline for the core deck"
```

### Task 4: Play deck files with speechSynthesis fallback

**Files:**
- Modify: `docs/js/vocab.js:75-111`, `docs/vocab.html:67` (add audio element)

**Interfaces:**
- Consumes: `audio`/`exampleAudio` fields from Task 3; `playAudio` from `app.js`.

- [ ] **Step 1: Add a player element to `vocab.html`**

Before the `<script>` tag: `<audio id="player" preload="none"></audio>`.

- [ ] **Step 2: Route audio through files first**

In `vocab.js`: import `playAudio` from `./app.js`. Rename the existing `speak(text)` to `synthesize(text)` unchanged, and add:

```js
// Shipped clips beat speechSynthesis (rejected for quality); keep synthesis
// as the fallback so a deck without generated audio still speaks.
async function speak(kind) {
  const src = kind === "word" ? current.audio : current.exampleAudio;
  const text = kind === "word" ? current.word : current.example;
  if (!src || !(await playAudio($("player"), src))) synthesize(text);
}
```

Update the three call sites: `show()` ends with `speak("word")`; the reveal handler ends with `speak("example")`; the `$("speak")` button becomes `speak($("back").hidden ? "word" : "example")`.

- [ ] **Step 3: Run the suite, then Playwright**

Run: `npm test` - all pass. In the browser: card front plays the word clip (network tab shows the mp3, not synthesis), reveal plays the example, and with devtools blocking `audio/spanish/vocab/*` the page falls back to speechSynthesis without errors.

- [ ] **Step 4: Commit, push, open PR B**

```bash
git add docs/vocab.html docs/js/vocab.js
git commit -m "feat: core deck plays shipped clips with synthesis fallback"
git push -u origin feat/vocab-audio
gh pr create --title "feat: real audio for the core deck" --body "..."
```

---

## PR C: `feat/picture-round` (Tasks 5-7)

### Task 5: Picture-round session logic (TDD)

**Files:**
- Modify: `docs/js/deck.js`
- Test: `tests/deck.test.js`

**Interfaces:**
- Produces: `pickPictureRound(words, schedule, now, limit = 60)` - due cards that carry an `image` and have been seen (present in schedule), oldest due first.

- [ ] **Step 1: Write the failing tests** (append to `tests/deck.test.js`; `seenCard` helper already exists there)

```js
import { pickPictureRound } from "../docs/js/deck.js";   // extend the existing import line

test("picture round takes only seen, due, image-bearing cards, oldest due first", () => {
  const imgWords = words.map(w => ["w-1", "w-2", "w-3"].includes(w.id) ? { ...w, image: `img/${w.id}.webp` } : w);
  const schedule = {
    "w-1": seenCard(-1),   // due, image -> in
    "w-2": seenCard(2),    // not due -> out
    "w-3": seenCard(-3),   // most overdue -> first
    "w-4": seenCard(-5),   // due but no image -> out
  };
  assert.deepEqual(pickPictureRound(imgWords, schedule, NOW).map(w => w.id), ["w-3", "w-1"]);
});

test("unseen image cards never enter the picture round", () => {
  const imgWords = words.map(w => ({ ...w, image: `img/${w.id}.webp` }));
  assert.deepEqual(pickPictureRound(imgWords, {}, NOW), []);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL - `pickPictureRound` is not exported.

- [ ] **Step 3: Implement in `deck.js`**

```js
// Picture round: production direction over images. Only seen cards qualify -
// meaning is never guessed from a possibly ambiguous photo on first exposure.
export function pickPictureRound(words, schedule, now, limit = 60) {
  return words
    .filter(w => w.image && schedule[w.id] && isDue(schedule[w.id], now))
    .sort((a, b) => (schedule[a.id].due ?? 0) - (schedule[b.id].due ?? 0))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run to verify pass** - `npm test`, all green.

- [ ] **Step 5: Commit**

```bash
git add docs/js/deck.js tests/deck.test.js
git commit -m "feat: picture-round session selection in the deck module"
```

### Task 6: Wikimedia image pipeline

**Files:**
- Create: `Sentence Islands/tools/fetch_images.py`
- Create: `Sentence Islands/tools/images-spanish.csv` (curation file, committed)
- Modifies (as output): `docs/img/vocab/spanish/*.webp`, `docs/data/image-credits-spanish.json`, `docs/data/vocab-spanish.json`

**Interfaces:**
- Produces: deck entries gain `"image": "img/vocab/spanish/w-<n>.webp"`; credits JSON is a list of `{id, word, file, author, license, source}`.

- [ ] **Step 1: Write `fetch_images.py`**

```python
"""Curated Wikimedia Commons images for concrete nouns in the core deck.

    python fetch_images.py spanish --search manzana        # print candidates
    python fetch_images.py spanish --fetch                 # download curated CSV

Curation lives in images-<lang>.csv (id,word,commons_title): run --search per
word, paste the chosen File: title into the CSV, then --fetch downloads 512px
thumbnails, converts to WebP under docs/img/vocab/<lang>/, records attribution
in docs/data/image-credits-<lang>.json, and adds image paths to the deck JSON.
Prefer PD/CC0 over CC BY over CC BY-SA; never NC/ND.
"""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
from pathlib import Path

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

REPO = Path(__file__).resolve().parents[2]
DOCS = REPO / "docs"
API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "languages-site-image-curation (personal study project)"}


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def api_get(params: dict) -> dict:
    r = requests.get(API, params={"format": "json", **params}, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def meta_field(info: dict, name: str) -> str:
    raw = info.get("extmetadata", {}).get(name, {}).get("value", "") or ""
    return html.unescape(re.sub(r"<[^>]+>", "", raw)).strip()


def search(word: str) -> None:
    data = api_get({
        "action": "query", "generator": "search", "gsrsearch": word,
        "gsrnamespace": "6", "gsrlimit": "8", "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": "320",
    })
    pages = (data.get("query") or {}).get("pages") or {}
    if not pages:
        print("no results")
        return
    for p in sorted(pages.values(), key=lambda p: p.get("index", 99)):
        info = (p.get("imageinfo") or [{}])[0]
        license_ = meta_field(info, "LicenseShortName") or "?"
        author = meta_field(info, "Artist") or "?"
        print(f"{p['title']}\n    license: {license_:<14} author: {author[:60]}\n    {info.get('thumburl', '')}")


def fetch(lang: str) -> None:
    try:
        from PIL import Image
    except ImportError:
        die("Pillow is not installed:  python -m pip install Pillow")

    csv_path = Path(__file__).parent / f"images-{lang}.csv"
    if not csv_path.exists():
        die(f"missing {csv_path} - curate some rows first (id,word,commons_title)")
    rows = [r for r in csv.DictReader(csv_path.open(encoding="utf-8-sig")) if (r.get("commons_title") or "").strip()]
    if not rows:
        die("no curated rows in the CSV yet")

    deck_path = DOCS / "data" / f"vocab-{lang}.json"
    deck = json.loads(deck_path.read_text(encoding="utf-8"))
    by_id = {w["id"]: w for w in deck["words"]}

    img_dir = DOCS / "img" / "vocab" / lang
    img_dir.mkdir(parents=True, exist_ok=True)
    credits = []

    for row in rows:
        wid, title = row["id"].strip(), row["commons_title"].strip()
        if wid not in by_id:
            die(f"{wid} is not in the deck")
        data = api_get({
            "action": "query", "titles": title, "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": "512",
        })
        pages = list((data.get("query") or {}).get("pages", {}).values())
        info = (pages[0].get("imageinfo") if pages else None) or None
        if not info:
            die(f"no imageinfo for {title}")
        info = info[0]
        license_ = meta_field(info, "LicenseShortName")
        if any(bad in license_.upper() for bad in ("NC", "ND")):
            die(f"{title} is {license_} - NC/ND is not usable here")

        img_bytes = requests.get(info["thumburl"], headers=HEADERS, timeout=60).content
        out = img_dir / f"{wid}.webp"
        Image.open(io.BytesIO(img_bytes)).convert("RGB").save(out, "WEBP", quality=80)
        by_id[wid]["image"] = f"img/vocab/{lang}/{wid}.webp"
        credits.append({
            "id": wid, "word": by_id[wid]["word"], "file": title,
            "author": meta_field(info, "Artist"), "license": license_ or "public domain",
            "source": info.get("descriptionurl", ""),
        })
        print(f"{wid} <- {title} ({license_ or 'PD'}, {out.stat().st_size // 1024} KB)")

    (DOCS / "data" / f"image-credits-{lang}.json").write_text(
        json.dumps({"language": lang, "images": credits}, ensure_ascii=False, indent=1), encoding="utf-8")
    deck_path.write_text(json.dumps(deck, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(credits)} images, credits and deck rewritten")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lang")
    ap.add_argument("--search", metavar="WORD")
    ap.add_argument("--fetch", action="store_true")
    args = ap.parse_args()
    if args.search:
        search(args.search)
    elif args.fetch:
        fetch(args.lang)
    else:
        ap.error("give --search WORD or --fetch")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Curate**

Identify the concrete nouns in the deck (scan `vocab-spanish.json` for `pos` of noun with picturable meaning - expect 80-150 in the top 500). For each, `--search`, pick the clearest unambiguous candidate with the freest license, append `id,word,commons_title` to `images-spanish.csv`. This is deliberate manual work; batch it (10-20 words per sitting is fine - `--fetch` is incremental over the CSV).

- [ ] **Step 3: Fetch and eyeball**

Run: `python "Sentence Islands/tools/fetch_images.py" spanish --fetch`
Expected: webp files 30-60 KB each, credits JSON populated, deck entries carry `image`. Open a handful of images - would a stranger name this word from this picture? Replace any that fail that test.

- [ ] **Step 4: Commit**

```bash
git add "Sentence Islands/tools/fetch_images.py" "Sentence Islands/tools/images-spanish.csv" docs/img docs/data/image-credits-spanish.json docs/data/vocab-spanish.json
git commit -m "feat: wikimedia image pipeline and curated deck images"
```

### Task 7: Picture round UI and credits

**Files:**
- Modify: `docs/vocab.html`, `docs/js/vocab.js`
- Create: `docs/credits.html`, `docs/js/credits.js`
- Modify: `docs/method.html` (one link), `docs/sw.js` (precache list)

**Interfaces:**
- Consumes: `pickPictureRound` (Task 5), `image` fields and credits JSON (Task 6), `speak("word")` (Task 4).
- Produces: settings key `vocabMode: "cards" | "pictures"` (default `"cards"`).

- [ ] **Step 1: Add the mode row and image element to `vocab.html`**

After the `<h1>`:

```html
<div class="mode-row" id="modeRow" hidden>
  <button id="modeCards" aria-pressed="true">Cards</button>
  <button id="modePictures" aria-pressed="false">Picture round</button>
  <span class="muted small">Picture round: due words you have met, prompted by image only - say the word aloud.</span>
</div>
```

Inside `#stage`, before `<p id="word">`: `<img id="pic" alt="" hidden style="max-width:min(100%,320px); border-radius:8px">`.

- [ ] **Step 2: Wire the mode into `vocab.js`**

Import `pickPictureRound` from `./deck.js`. Read the mode in `init()` (`let vmode = getSettings().vocabMode ?? "cards";`) and show the row once data loads (`$("modeRow").hidden = false;` plus a `syncModeButtons()` mirroring drill.js, with the two-button reload loop persisting `saveSettings({ vocabMode: m })`). Queue selection:

```js
if (vmode === "pictures") {
  queue = pickPictureRound(deck.words, schedule, now, settings.drillLimit);
  if (!queue.length) {
    $("status").textContent = "No due picture cards - meet more words in the card mode first.";
    return;
  }
} else {
  // existing pickSession path unchanged
}
```

In `show()`, picture cards hide the word and show the image; a load failure falls back to the normal card front for that word:

```js
const asPicture = vmode === "pictures" && current.image;
$("pic").hidden = !asPicture;
$("word").hidden = asPicture;
$("wordMeta").hidden = asPicture;
if (asPicture) {
  $("pic").src = current.image;
  $("pic").onerror = () => { $("pic").hidden = true; $("word").hidden = false; $("wordMeta").hidden = false; };
}
```

On reveal in picture mode, unhide `word`/`wordMeta` alongside the existing back panel. In picture mode `show()` must NOT call `speak("word")` (it would give the answer away); reveal still plays it. `Mark known` and the new-intro bookkeeping are card-mode concerns; picture mode never introduces new cards so both paths are naturally never hit (queue is schedule-only).

- [ ] **Step 3: Credits page**

`docs/credits.html`: copy the header/nav boilerplate from `vocab.html` (title "Image credits - Languages", no nav highlight), a `<main id="main"><h1>Image credits</h1><ul id="list"></ul><p id="status" class="muted">Loading...</p></main>`, script `js/credits.js`:

```js
// Attribution for curated Wikimedia Commons images (CC BY / BY-SA require it).
import { loadJSON, getSettings, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();

try {
  const { images } = await loadJSON(`data/image-credits-${getSettings().language}.json`);
  for (const c of images) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = c.source;
    a.textContent = c.file;
    li.append(`${c.word} - `, a, ` - ${c.author} - ${c.license}`);
    $("list").append(li);
  }
  $("status").hidden = true;
} catch {
  $("status").textContent = "No image credits for this language yet.";
}
```

Link it from `method.html` near the existing footer/source links: `<a href="credits.html">Image credits</a>`.

- [ ] **Step 4: Service worker**

In `docs/sw.js`, add `"js/recorder.js"`, `"credits.html"`, `"js/credits.js"` to the precached asset list (match the existing array format exactly) and bump the cache version string the same way previous PRs did. Images and vocab audio stay runtime-cached (do not precache 100+ binary files).

- [ ] **Step 5: Run suite + Playwright**

`npm test` green. Browser: picture round shows image-only front, reveal shows word + gloss + plays the clip, grading advances, empty-queue message when nothing due; credits page lists every curated image; broken-image fallback verified by temporarily renaming one webp. Mobile + dark pass.

- [ ] **Step 6: Commit, push, open PR C**

```bash
git add docs/vocab.html docs/js/vocab.js docs/credits.html docs/js/credits.js docs/method.html docs/sw.js
git commit -m "feat: picture round - image-prompted spoken production over the core deck"
git push -u origin feat/picture-round
gh pr create --title "feat: picture round and image credits" --body "..."
```

---

## Self-review notes

- Spec coverage: recorder module (T1), Speak mode (T2), vocab audio pipeline + fallback (T3-T4), image pipeline with license guard + credits (T6, T7), picture round gated to seen cards with broken-image fallback (T5, T7). Cloze intentionally absent (shipped in PR #15).
- PR A has no new unit tests by design (browser-API only); PR C's pure logic is TDD'd in Task 5.
- `drillMode`/`vocabMode` settings ride the existing `DEFAULTS` spread in `app.js` - unknown keys default via `??` in vocab.js, so no `app.js` change is required.
