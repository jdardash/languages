# Language Study Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the static language-study site (drill, shadow, dashboard, method reference, progress) from `specs/2026-08-09-language-study-site-design.md`, live on GitHub Pages.

**Architecture:** Vanilla HTML/CSS/JS in `docs/` on `main`, deployed via GitHub Pages "/docs" route, no build step. Python tooling emits per-language JSON from `sentences.csv`. A pure ES-module scheduler is the only algorithmic component, unit-tested with Node's built-in test runner. All state in versioned `localStorage` keys.

**Tech Stack:** HTML/CSS/JS (ES modules), Python 3.14 (data pipeline), Node built-in `node --test`, `gh` CLI, vendored `marked` (only third-party code).

## Global Constraints

- Repo root: `C:\Dev\languages` (moved out of OneDrive before `git init`).
- Everything under `docs/` is lowercase-with-hyphens; `docs/.nojekyll` present.
- Public repo `jdardash/languages`; sentence content stays impersonal.
- Audio committed as plain files; never Git LFS; `Sentence Islands/*/out/` stays ignored.
- No framework, no bundler, no server code, no analytics, no emojis anywhere.
- `localStorage` keys: `languages:<lang>:<kind>:v1` (kinds: `schedule`, `log`) and `languages:settings:v1`.
- Conventional commits; each task after Task 1 lands as a squash-merged PR with a teaching description.
- Every `fetch` checks `res.ok`; every `audio.play()` awaited in try/catch; `localStorage` wrapped.

---

### Task 1: Relocate, initialize, first commit

**Files:**
- Create: `C:\Dev\languages\` (copy of the OneDrive folder, minus `.remember/`)
- Create: `C:\Users\jsdar\OneDrive\Learning\Languages\MOVED.md` (pointer left behind)
- Create: `C:\Dev\languages\Polyglot Practices Research.md` (copied from `..\_Research\`)
- Verify: `.gitignore` (already written; must cover `.remember/`, `Sentence Islands/*/out/`, `__pycache__`, logs)

**Interfaces:**
- Produces: a git repo at `C:\Dev\languages` with one commit on `main`; all later tasks run there.

- [ ] **Step 1: Copy folder out of OneDrive (copy, not move — original left for the user to delete after verifying)**

```powershell
robocopy "C:\Users\jsdar\OneDrive\Learning\Languages" "C:\Dev\languages" /E /XD ".remember" /NFL /NDL
Copy-Item "C:\Users\jsdar\OneDrive\Learning\_Research\2026-08-09 - Polyglot Practices Research.md" "C:\Dev\languages\Polyglot Practices Research.md"
```

robocopy exit codes 0–7 are success; 8+ is failure.

- [ ] **Step 2: Leave a pointer in the OneDrive original**

`MOVED.md` content:

```markdown
# Moved

This folder's working copy is now the git repository at `C:\Dev\languages`
(GitHub: jdardash/languages). Edits here will NOT reach the site or the repo.
This OneDrive copy is a frozen snapshot as of 2026-08-09; delete it once the
repo is verified.
```

- [ ] **Step 3: Verify `.gitignore` coverage, init, commit**

```powershell
Set-Location C:\Dev\languages
git init
git add .
git status
```

READ the status output: no `.remember/`, no `out/`, no `__pycache__`, no `MOVED.md` (it lives only in OneDrive). Then:

```powershell
git commit -m "chore: initial commit of language notes and Sentence Islands tooling"
```

- [ ] **Step 4: Create the GitHub repo and push**

```powershell
gh repo create languages --public --source=. --remote=origin --push --description "Evidence-based language study app and method notes"
```

### Task 2: Pages skeleton, deployed while embarrassing

**Files:**
- Create: `docs/.nojekyll`, `docs/index.html`, `docs/css/site.css`
- Create: `package.json` (Node module mode for tests; ignored by Pages)

**Interfaces:**
- Produces: live URL `https://jdardash.github.io/languages/`; `site.css` custom properties (`--bg`, `--fg`, `--accent`, `--muted`, `--card`) used by all later pages; shared nav markup pattern (`<nav class="site-nav">`).

- [ ] **Step 1: Write skeleton files**

`docs/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Languages</title>
  <link rel="stylesheet" href="css/site.css">
</head>
<body>
  <nav class="site-nav">
    <a href="index.html" aria-current="page">Today</a>
    <a href="drill.html">Drill</a>
    <a href="shadow.html">Shadow</a>
    <a href="method.html">Method</a>
    <a href="progress.html">Progress</a>
  </nav>
  <main>
    <h1>Languages</h1>
    <p>Evidence-based study app. Under construction; deployed early on purpose.</p>
  </main>
</body>
</html>
```

`docs/css/site.css`:

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --accent: #2456a4;
  --card: #f4f4f2;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #16181d; --fg: #e8e8e4; --muted: #9a9aa0; --accent: #7aa2e8; --card: #22252c; }
}
* { box-sizing: border-box; }
body {
  margin: 0 auto; max-width: 44rem; padding: 1rem;
  background: var(--bg); color: var(--fg);
  font: 1rem/1.6 system-ui, sans-serif;
}
.site-nav { display: flex; gap: 1rem; flex-wrap: wrap; padding: .5rem 0; border-bottom: 1px solid var(--card); }
.site-nav a { color: var(--muted); text-decoration: none; }
.site-nav a[aria-current="page"] { color: var(--accent); font-weight: 600; }
button { font: inherit; padding: .6rem 1.2rem; border-radius: .5rem; border: 1px solid var(--muted); background: var(--card); color: var(--fg); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.card { background: var(--card); border-radius: .75rem; padding: 1rem 1.25rem; margin: 1rem 0; }
.muted { color: var(--muted); }
```

`package.json`:

```json
{
  "name": "languages-site",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

Also create empty `docs/.nojekyll`.

- [ ] **Step 2: Serve locally and eyeball**

```powershell
python -m http.server 8000 --directory docs
```

Fetch `http://localhost:8000/` — expect 200 and the heading.

- [ ] **Step 3: Branch, PR, merge**

```powershell
git switch -c feature/pages-skeleton
git add docs package.json
git commit -m "feat: pages skeleton with shared css and nav"
git push -u origin feature/pages-skeleton
gh pr create --title "Pages skeleton" --body "<teaching description>"
gh pr merge --squash --delete-branch
git switch main; git pull
```

- [ ] **Step 4: Enable Pages and verify live**

```powershell
gh api -X POST repos/jdardash/languages/pages -f "source[branch]=main" -f "source[path]=/docs"
gh api repos/jdardash/languages/pages --jq '.html_url, .status'
```

Poll until status `built`; fetch the live URL, hard-refresh mentality (Pages caches ~10 min).

### Task 3: Data pipeline

**Files:**
- Create: `Sentence Islands/tools/build_site_data.py`
- Create (generated): `docs/data/spanish.json`, `docs/data/manifest.json`, `docs/audio/spanish/*.mp3`, `docs/method/*.md`

**Interfaces:**
- Consumes: `Sentence Islands/<Lang>/sentences.csv` (columns `id,topic,english,target,box,due,misses,notes`), audio at `Sentence Islands/<Lang>/audio/{t,e}-<id>.mp3`.
- Produces: `docs/data/<lang>.json` shape used by all JS:

```json
{
  "language": "spanish", "label": "Spanish", "bcp47": "es-419",
  "sentences": [
    { "id": "s-1", "en": "...", "target": "...", "topic": "morning",
      "audio": "audio/spanish/t-1.mp3", "promptAudio": "audio/spanish/e-1.mp3" }
  ]
}
```

`audio`/`promptAudio` keys are omitted when the mp3 does not exist. `docs/data/manifest.json`:

```json
{
  "languages": [ { "id": "spanish", "label": "Spanish", "data": "data/spanish.json" } ],
  "methodDocs": [
    { "title": "Overview", "file": "method/overview.md" },
    { "title": "The Method (Sentence Islands)", "file": "method/method.md" },
    { "title": "How To Learn Languages (Evidence)", "file": "method/how-to-learn-languages.md" },
    { "title": "What Top Learners Actually Do", "file": "method/polyglot-practices.md" },
    { "title": "Sentence Islands Pipeline", "file": "method/sentence-islands.md" }
  ]
}
```

- [ ] **Step 1: Write `build_site_data.py`**

```python
"""Emit docs/data/<lang>.json, copy audio, and sync method docs for the site.

Usage: python "Sentence Islands/tools/build_site_data.py" Spanish
"""
import csv, json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
LANGS = {"Spanish": {"id": "spanish", "label": "Spanish", "bcp47": "es-419"},
         "French": {"id": "french", "label": "French", "bcp47": "fr-FR"}}
METHOD_DOCS = [
    ("README.md", "overview.md", "Overview"),
    ("METHOD.md", "method.md", "The Method (Sentence Islands)"),
    ("How To Learn Languages.md", "how-to-learn-languages.md", "How To Learn Languages (Evidence)"),
    ("Polyglot Practices Research.md", "polyglot-practices.md", "What Top Learners Actually Do"),
    ("Sentence Islands/README.md", "sentence-islands.md", "Sentence Islands Pipeline"),
]

def build(folder_name: str) -> None:
    meta = LANGS[folder_name]
    src = ROOT / "Sentence Islands" / folder_name
    audio_src = src / "audio"
    audio_dst = DOCS / "audio" / meta["id"]
    audio_dst.mkdir(parents=True, exist_ok=True)
    sentences = []
    with open(src / "sentences.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sid = row["id"].strip()
            entry = {"id": f"s-{sid}", "en": row["english"].strip(),
                     "target": row["target"].strip(), "topic": row["topic"].strip()}
            for key, prefix in (("audio", "t"), ("promptAudio", "e")):
                clip = audio_src / f"{prefix}-{sid}.mp3"
                if clip.exists():
                    shutil.copy2(clip, audio_dst / clip.name)
                    entry[key] = f"audio/{meta['id']}/{clip.name}"
            sentences.append(entry)
    data_dir = DOCS / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    out = {"language": meta["id"], "label": meta["label"], "bcp47": meta["bcp47"],
           "sentences": sentences}
    (data_dir / f"{meta['id']}.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    sync_method_docs()
    write_manifest()
    print(f"{meta['id']}: {len(sentences)} sentences")

def sync_method_docs() -> None:
    dst = DOCS / "method"
    dst.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name, _ in METHOD_DOCS:
        src = ROOT / src_name
        if src.exists():
            shutil.copy2(src, dst / dst_name)

def write_manifest() -> None:
    langs = [{"id": m["id"], "label": m["label"], "data": f"data/{m['id']}.json"}
             for name, m in LANGS.items()
             if (DOCS / "data" / f"{m['id']}.json").exists() or name == "Spanish"]
    manifest = {"languages": langs,
                "methodDocs": [{"title": t, "file": f"method/{d}"} for _, d, t in METHOD_DOCS]}
    (DOCS / "data" / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "Spanish")
```

- [ ] **Step 2: Run it and validate output**

```powershell
python "Sentence Islands\tools\build_site_data.py" Spanish
python -c "import json; d=json.load(open('docs/data/spanish.json', encoding='utf-8')); print(len(d['sentences']), d['sentences'][0])"
```

Expected: 32 sentences; first entry has `audio` and `promptAudio` keys.

- [ ] **Step 3: PR**

```powershell
git switch -c feature/data-pipeline
git add "Sentence Islands/tools/build_site_data.py" docs/data docs/audio docs/method
git commit -m "feat: emit site data, audio, and method docs from csv source of truth"
git push -u origin feature/data-pipeline
gh pr create --title "Data pipeline" --body "<teaching description>"
gh pr merge --squash --delete-branch
git switch main; git pull
```

### Task 4: Scheduler module (TDD)

**Files:**
- Create: `docs/js/scheduler.js`
- Test: `tests/scheduler.test.js`

**Interfaces:**
- Produces (exact exports, used by drill.js and progress.js):
  - `newCard()` → `{state:"new", stepIndex:0, interval:0, ease:2.5, due:null, lapses:0, reps:0}`
  - `nextState(card, grade, now)` → new card object; `grade` ∈ `"miss"|"hard"|"good"`; `now` = ms epoch; never mutates input.
  - `isDue(card, now)` → boolean; new cards always due.
  - `LEARNING_STEPS = [1, 2, 4, 7, 14]` (days); `DAY_MS = 86400000`; mature interval cap 180 days; ease floor 1.3.

- [ ] **Step 1: Write failing tests** (`tests/scheduler.test.js`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { newCard, nextState, isDue, LEARNING_STEPS, DAY_MS } from "../docs/js/scheduler.js";

const NOW = 1_800_000_000_000;

test("new card is due and pristine", () => {
  const c = newCard();
  assert.equal(c.state, "new");
  assert.equal(isDue(c, NOW), true);
});

test("good climbs the learning ladder", () => {
  let c = newCard();
  c = nextState(c, "good", NOW);
  assert.equal(c.state, "learning");
  assert.equal(c.due, NOW + LEARNING_STEPS[0] * DAY_MS);
  c = nextState(c, "good", NOW);
  assert.equal(c.due, NOW + LEARNING_STEPS[1] * DAY_MS);
});

test("finishing the ladder matures with interval = last step * ease", () => {
  let c = newCard();
  for (let i = 0; i <= LEARNING_STEPS.length; i++) c = nextState(c, "good", NOW);
  assert.equal(c.state, "mature");
  assert.equal(c.interval, Math.round(14 * 2.5));
});

test("miss lapses a mature card back to step 0 and drops ease", () => {
  let c = { state: "mature", stepIndex: 0, interval: 35, ease: 2.5, due: NOW, lapses: 0, reps: 9 };
  c = nextState(c, "miss", NOW);
  assert.equal(c.state, "learning");
  assert.equal(c.stepIndex, 0);
  assert.equal(c.lapses, 1);
  assert.equal(c.ease, 2.3);
});

test("ease never drops below 1.3 and interval caps at 180", () => {
  let c = { state: "mature", stepIndex: 0, interval: 170, ease: 1.31, due: NOW, lapses: 0, reps: 9 };
  c = nextState(c, "good", NOW);
  assert.equal(c.interval, 180);
  let d = { state: "mature", stepIndex: 0, interval: 10, ease: 1.3, due: NOW, lapses: 0, reps: 9 };
  d = nextState(d, "miss", NOW);
  assert.equal(d.ease, 1.3);
});

test("hard on mature grows slowly and reduces ease", () => {
  let c = { state: "mature", stepIndex: 0, interval: 30, ease: 2.0, due: NOW, lapses: 0, reps: 9 };
  c = nextState(c, "hard", NOW);
  assert.equal(c.interval, 36);
  assert.equal(c.ease, 1.85);
});

test("nextState does not mutate its input", () => {
  const c = newCard();
  nextState(c, "good", NOW);
  assert.equal(c.state, "new");
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → module not found.

- [ ] **Step 3: Implement** (`docs/js/scheduler.js`)

```js
export const LEARNING_STEPS = [1, 2, 4, 7, 14];
export const DAY_MS = 86_400_000;
const MAX_INTERVAL = 180;
const EASE_FLOOR = 1.3;

export function newCard() {
  return { state: "new", stepIndex: 0, interval: 0, ease: 2.5, due: null, lapses: 0, reps: 0 };
}

export function isDue(card, now) {
  return card.state === "new" || card.due === null || card.due <= now;
}

export function nextState(card, grade, now) {
  const c = { ...card, reps: card.reps + 1 };
  if (grade === "miss") {
    c.lapses = card.lapses + 1;
    c.ease = Math.max(EASE_FLOOR, card.ease - 0.2);
    c.state = "learning";
    c.stepIndex = 0;
    c.due = now + LEARNING_STEPS[0] * DAY_MS;
    return c;
  }
  if (card.state === "mature") {
    if (grade === "hard") {
      c.ease = Math.max(EASE_FLOOR, card.ease - 0.15);
      c.interval = Math.max(1, Math.round(card.interval * 1.2));
    } else {
      c.interval = Math.round(card.interval * card.ease);
    }
    c.interval = Math.min(MAX_INTERVAL, c.interval);
    c.due = now + c.interval * DAY_MS;
    return c;
  }
  // new or learning
  c.state = "learning";
  if (grade === "hard") {
    c.due = now + LEARNING_STEPS[card.stepIndex] * DAY_MS;
    return c;
  }
  const next = card.state === "new" ? 0 : card.stepIndex + 1;
  if (next >= LEARNING_STEPS.length) {
    c.state = "mature";
    c.interval = Math.min(MAX_INTERVAL, Math.round(LEARNING_STEPS.at(-1) * card.ease));
    c.due = now + c.interval * DAY_MS;
  } else {
    c.stepIndex = next;
    c.due = now + LEARNING_STEPS[next] * DAY_MS;
  }
  return c;
}
```

Note the ladder semantics the tests encode: a new card's first "good" schedules step 0 (1 day) and enters learning with `stepIndex` 0; each later "good" schedules the *next* step; "good" with `stepIndex` at the last step matures.

- [ ] **Step 4: Run tests to green** — `npm test` → all pass.

- [ ] **Step 5: PR** (branch `feature/scheduler`, commit `feat: spaced-repetition scheduler with tests`).

### Task 5: Shared app module

**Files:**
- Create: `docs/js/app.js`

**Interfaces:**
- Produces (exact exports used by every page script):
  - `store.get(key, fallback)` / `store.set(key, value)` / `store.ok` (false when localStorage unavailable; then in-memory Map fallback and pages show a warning banner via `storageWarning(el)`).
  - `key(lang, kind)` → `` `languages:${lang}:${kind}:v1` ``; `SETTINGS_KEY = "languages:settings:v1"`.
  - `getSettings()` → `{language:"spanish", rate:1, drillLimit:25, shadowIndex:0, showEnglish:true}` merged over stored values; `saveSettings(patch)`.
  - `loadJSON(url)` → parsed JSON; throws `Error` with url and status when `!res.ok`.
  - `playAudio(audioEl, src)` → awaits `play()` in try/catch; returns `true` on success, `false` on autoplay rejection.
  - `markNav()` → sets `aria-current` on the nav link matching `location.pathname`.

- [ ] **Step 1: Implement** (`docs/js/app.js`)

```js
export const SETTINGS_KEY = "languages:settings:v1";
const mem = new Map();

function storageWorks() {
  try {
    localStorage.setItem("languages:probe", "1");
    localStorage.removeItem("languages:probe");
    return true;
  } catch { return false; }
}

export const store = {
  ok: storageWorks(),
  get(k, fallback) {
    try {
      const raw = this.ok ? localStorage.getItem(k) : mem.get(k);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(k, v) {
    const raw = JSON.stringify(v);
    try { this.ok ? localStorage.setItem(k, raw) : mem.set(k, raw); }
    catch { mem.set(k, raw); this.ok = false; }
  },
};

export function key(lang, kind) { return `languages:${lang}:${kind}:v1`; }

const DEFAULTS = { language: "spanish", rate: 1, drillLimit: 25, shadowIndex: 0, showEnglish: true };
export function getSettings() { return { ...DEFAULTS, ...store.get(SETTINGS_KEY, {}) }; }
export function saveSettings(patch) { store.set(SETTINGS_KEY, { ...getSettings(), ...patch }); }

export async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

export async function playAudio(audioEl, src) {
  try {
    if (src) audioEl.src = src;
    await audioEl.play();
    return true;
  } catch { return false; }
}

export function storageWarning(container) {
  if (store.ok) return;
  const p = document.createElement("p");
  p.className = "card";
  p.textContent = "Storage is unavailable in this browser session - progress will not be saved.";
  container.prepend(p);
}

export function markNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach(a => {
    if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
```

- [ ] **Step 2: Verify import cleanly in Node** — `node -e "import('./docs/js/app.js').catch(e=>{console.error(e);process.exit(1)})"` will fail on `localStorage` — instead verify via the browser during Task 6. For now check syntax: `node --check docs/js/app.js` (note: `--check` does not support ES modules pre-flag; acceptable substitute is importing it in the drill page in Task 6). Skip mechanical verification; visual check only.

- [ ] **Step 3: PR** (branch `feature/app-shared`, commit `feat: shared storage, settings, fetch and audio helpers`).

### Task 6: Drill page

**Files:**
- Create: `docs/drill.html`, `docs/js/drill.js`

**Interfaces:**
- Consumes: `scheduler.js` exports, `app.js` exports, `data/manifest.json`, `data/<lang>.json`.
- Produces: schedule state at `key(lang, "schedule")` = `{ [sentenceId]: cardState }`; review log at `key(lang, "log")` = array of `{ts, grade, id}` (capped at 2000, oldest dropped).

- [ ] **Step 1: Write `docs/drill.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Drill - Languages</title>
  <link rel="stylesheet" href="css/site.css">
</head>
<body>
  <nav class="site-nav">
    <a href="index.html">Today</a>
    <a href="drill.html">Drill</a>
    <a href="shadow.html">Shadow</a>
    <a href="method.html">Method</a>
    <a href="progress.html">Progress</a>
  </nav>
  <main id="main">
    <h1 id="heading">Drill</h1>
    <section id="stage" class="card" hidden>
      <p class="muted" id="counter"></p>
      <p id="prompt" style="font-size:1.4rem"></p>
      <p id="answer" lang="es" style="font-size:1.4rem" hidden></p>
      <div id="controls">
        <button class="primary" id="reveal">Reveal</button>
        <span id="grades" hidden>
          <button id="miss">Miss</button>
          <button id="hard">Hard</button>
          <button id="good">Good</button>
        </span>
      </div>
    </section>
    <section id="done" class="card" hidden>
      <h2>Session complete</h2>
      <p id="summary"></p>
      <ul id="missList"></ul>
      <p class="muted">Sentences you missed are tomorrow's syllabus - add anything you could not say to the sentence list.</p>
    </section>
    <p id="status" class="muted">Loading...</p>
  </main>
  <audio id="player" preload="none"></audio>
  <script type="module" src="js/drill.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `docs/js/drill.js`**

```js
import { newCard, nextState, isDue } from "./scheduler.js";
import { store, key, getSettings, loadJSON, playAudio, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

let lang, sentences, schedule, queue, current;
let sessionMisses = new Map();   // id -> sentence, for the summary
let correctStreak = new Map();   // id -> consecutive in-session "good"
let reviewed = 0;

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    lang = data.language;
    sentences = data.sentences;
    document.querySelectorAll("[lang]").forEach(el => { if (el.id === "answer") el.lang = data.bcp47; });
    schedule = store.get(key(lang, "schedule"), {});
    const now = Date.now();
    const due = sentences.filter(s => isDue(schedule[s.id] ?? newCard(), now));
    queue = due.slice(0, settings.drillLimit);
    $("heading").textContent = `Drill - ${data.label}`;
    if (queue.length === 0) {
      $("status").textContent = "Nothing due. Come back later, or raise the session limit in Today's settings.";
      return;
    }
    $("status").hidden = true;
    $("stage").hidden = false;
    show();
  } catch (err) {
    $("status").textContent = `Could not load data: ${err.message}`;
  }
}

function show() {
  current = queue[0];
  $("counter").textContent = `${queue.length} remaining - say it out loud before revealing`;
  $("prompt").textContent = current.en;
  $("answer").hidden = true;
  $("answer").textContent = current.target;
  $("grades").hidden = true;
  $("reveal").hidden = false;
  $("reveal").focus();
}

$("reveal").addEventListener("click", async () => {
  $("answer").hidden = false;
  $("reveal").hidden = true;
  $("grades").hidden = false;
  $("good").focus();
  if (current.audio) await playAudio($("player"), current.audio);
});

function grade(g) {
  const now = Date.now();
  const card = schedule[current.id] ?? newCard();
  schedule[current.id] = nextState(card, g, now);
  store.set(key(lang, "schedule"), schedule);
  const log = store.get(key(lang, "log"), []);
  log.push({ ts: now, grade: g, id: current.id });
  store.set(key(lang, "log"), log.slice(-2000));
  reviewed++;
  queue.shift();
  if (g === "miss") {
    sessionMisses.set(current.id, current);
    correctStreak.set(current.id, 0);
    queue.splice(Math.min(3, queue.length), 0, current);   // requeue soon, same session
  } else if (sessionMisses.has(current.id)) {
    const streak = (correctStreak.get(current.id) ?? 0) + 1;
    correctStreak.set(current.id, streak);
    if (streak < 2) queue.push(current);                    // retrieval floor: twice right
  }
  queue.length ? show() : finish();
}
$("miss").addEventListener("click", () => grade("miss"));
$("hard").addEventListener("click", () => grade("hard"));
$("good").addEventListener("click", () => grade("good"));

document.addEventListener("keydown", e => {
  if (e.target.tagName === "BUTTON" && e.key === " ") return;
  if (!$("stage").hidden) {
    if (!$("reveal").hidden && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); $("reveal").click(); }
    else if (!$("grades").hidden) {
      if (e.key === "1") $("miss").click();
      if (e.key === "2") $("hard").click();
      if (e.key === "3") $("good").click();
    }
  }
});

function finish() {
  $("stage").hidden = true;
  $("done").hidden = false;
  $("summary").textContent = `${reviewed} reviews, ${sessionMisses.size} sentences missed.`;
  for (const s of sessionMisses.values()) {
    const li = document.createElement("li");
    li.textContent = `${s.en} - ${s.target}`;
    $("missList").append(li);
  }
}

init();
```

- [ ] **Step 3: Manual test locally** — serve, run a session end to end: reveal plays audio after the click (a user gesture has occurred), grades advance, misses reappear within the session, summary lists them, `localStorage` keys `languages:spanish:schedule:v1` and `:log:v1` populate, reload shows fewer due.

- [ ] **Step 4: PR** (branch `feature/drill`, commit `feat: active-recall drill with same-session miss requeue`).

### Task 7: Shadow page

**Files:**
- Create: `docs/shadow.html`, `docs/js/shadow.js`

**Interfaces:**
- Consumes: `app.js`, data JSON. Persists `shadowIndex`, `rate`, `showEnglish` via `saveSettings`.

- [ ] **Step 1: Write `docs/shadow.html`** — same head/nav pattern as drill.html; main content:

```html
  <main id="main">
    <h1 id="heading">Shadow</h1>
    <section id="stage" class="card" hidden>
      <p class="muted" id="counter"></p>
      <p id="target" lang="es" style="font-size:1.6rem"></p>
      <p id="english" class="muted"></p>
      <div style="display:flex; gap:.5rem; flex-wrap:wrap">
        <button id="prev">Prev</button>
        <button class="primary" id="playBtn">Play</button>
        <button id="next">Next</button>
        <button id="loop" aria-pressed="false">Loop</button>
        <button id="chain" aria-pressed="false">Auto-advance</button>
        <select id="rate" aria-label="Playback rate">
          <option value="1">1.0x</option>
          <option value="0.85">0.85x</option>
          <option value="0.75">0.75x</option>
        </select>
        <button id="toggleEn" aria-pressed="true">English</button>
      </div>
    </section>
    <p id="status" class="muted">Loading...</p>
  </main>
  <audio id="player" preload="none"></audio>
  <script type="module" src="js/shadow.js"></script>
```

- [ ] **Step 2: Write `docs/js/shadow.js`**

```js
import { getSettings, saveSettings, loadJSON, playAudio, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();

let clips = [], i = 0, chainTimer = null;
const player = $("player");

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    clips = data.sentences.filter(s => s.audio);
    $("target").lang = data.bcp47;
    if (!clips.length) { $("status").textContent = "No recorded audio for this language yet."; return; }
    i = Math.min(settings.shadowIndex, clips.length - 1);
    $("rate").value = String(settings.rate);
    setEnglish(settings.showEnglish);
    $("status").hidden = true;
    $("stage").hidden = false;
    $("heading").textContent = `Shadow - ${data.label}`;
    render();
  } catch (err) { $("status").textContent = `Could not load data: ${err.message}`; }
}

function render() {
  const s = clips[i];
  $("counter").textContent = `${i + 1} / ${clips.length} - ${s.topic}`;
  $("target").textContent = s.target;
  $("english").textContent = s.en;
  saveSettings({ shadowIndex: i });
}

async function play() {
  player.playbackRate = Number($("rate").value);
  if ("preservesPitch" in player) player.preservesPitch = true;
  const ok = await playAudio(player, clips[i].audio);
  $("playBtn").textContent = ok ? "Pause" : "Tap to play";
}

$("playBtn").addEventListener("click", () => {
  if (player.paused) play(); else { player.pause(); $("playBtn").textContent = "Play"; }
});
$("prev").addEventListener("click", () => { i = (i - 1 + clips.length) % clips.length; render(); play(); });
$("next").addEventListener("click", () => { i = (i + 1) % clips.length; render(); play(); });

function toggle(btn) {
  const on = btn.getAttribute("aria-pressed") !== "true";
  btn.setAttribute("aria-pressed", String(on));
  return on;
}
$("loop").addEventListener("click", e => { if (toggle(e.target)) $("chain").setAttribute("aria-pressed", "false"); });
$("chain").addEventListener("click", e => { if (toggle(e.target)) $("loop").setAttribute("aria-pressed", "false"); });
$("rate").addEventListener("change", () => { saveSettings({ rate: Number($("rate").value) }); player.playbackRate = Number($("rate").value); });
$("toggleEn").addEventListener("click", e => setEnglish(toggle(e.target)));

function setEnglish(on) {
  $("english").hidden = !on;
  $("toggleEn").setAttribute("aria-pressed", String(on));
  saveSettings({ showEnglish: on });
}

player.addEventListener("ended", () => {
  if ($("loop").getAttribute("aria-pressed") === "true") { play(); return; }
  if ($("chain").getAttribute("aria-pressed") === "true") {
    chainTimer = setTimeout(() => { i = (i + 1) % clips.length; render(); play(); }, 1200);
  } else $("playBtn").textContent = "Play";
});
document.addEventListener("keydown", e => {
  if ($("stage").hidden || e.target.tagName === "SELECT") return;
  if (e.key === " ") { e.preventDefault(); $("playBtn").click(); }
  if (e.key === "ArrowRight") $("next").click();
  if (e.key === "ArrowLeft") $("prev").click();
});

init();
```

- [ ] **Step 3: Manual test locally** — playback from click, rate change audibly slows with pitch kept, loop repeats, auto-advance chains with the gap, position survives reload.

- [ ] **Step 4: PR** (branch `feature/shadow`, commit `feat: shadowing player with rate, loop and auto-advance`).

### Task 8: Today dashboard and settings

**Files:**
- Modify: `docs/index.html` (replace placeholder body)
- Create: `docs/js/today.js`

**Interfaces:**
- Consumes: `scheduler.js` (`isDue`, `newCard`), `app.js`, data JSON. Writes `language` and `drillLimit` via `saveSettings`.

- [ ] **Step 1: Rewrite `docs/index.html` main**

```html
  <main id="main">
    <h1 id="heading">Today</h1>
    <section class="card">
      <p id="dueLine">Loading...</p>
      <a href="drill.html"><button class="primary" id="startBtn">Start drill</button></a>
      <a href="shadow.html"><button>Shadow</button></a>
      <p class="muted" id="nudge" hidden>Evidence note: vocabulary consolidates better across sleep - if you have one session in you today, make it the evening one.</p>
    </section>
    <section class="card">
      <h2>Settings</h2>
      <label>Language
        <select id="langSel" aria-label="Active language"></select>
      </label>
      <label style="margin-left:1rem">Session size
        <input id="limit" type="number" min="5" max="100" step="5" style="width:4rem">
      </label>
      <p class="muted">One language per session - switching mid-session is deliberately not offered (interleaving vocabulary across languages measures null-to-negative).</p>
    </section>
  </main>
  <script type="module" src="js/today.js"></script>
```

- [ ] **Step 2: Write `docs/js/today.js`**

```js
import { newCard, isDue } from "./scheduler.js";
import { store, key, getSettings, saveSettings, loadJSON, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    for (const l of manifest.languages) {
      const opt = document.createElement("option");
      opt.value = l.id; opt.textContent = l.label;
      if (l.id === settings.language) opt.selected = true;
      $("langSel").append(opt);
    }
    $("limit").value = settings.drillLimit;
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    const schedule = store.get(key(data.language, "schedule"), {});
    const now = Date.now();
    const due = data.sentences.filter(s => isDue(schedule[s.id] ?? newCard(), now)).length;
    $("dueLine").textContent = due
      ? `${data.label}: ${Math.min(due, settings.drillLimit)} of ${due} due sentences queued.`
      : `${data.label}: nothing due right now.`;
    $("startBtn").disabled = !due;
    if (new Date().getHours() < 17) $("nudge").hidden = false;
  } catch (err) { $("dueLine").textContent = `Could not load data: ${err.message}`; }
}

$("langSel").addEventListener("change", e => { saveSettings({ language: e.target.value }); location.reload(); });
$("limit").addEventListener("change", e => {
  const v = Math.max(5, Math.min(100, Number(e.target.value) || 25));
  e.target.value = v;
  saveSettings({ drillLimit: v });
});

init();
```

- [ ] **Step 3: Manual test locally** — due count matches drill, nudge appears before 17:00 local, language dropdown lists Spanish, limit persists.

- [ ] **Step 4: PR** (branch `feature/today`, commit `feat: today dashboard with due count, settings and evening nudge`).

### Task 9: Method pages

**Files:**
- Create: `docs/method.html`, `docs/js/method.js`, `docs/js/vendor/marked.min.js` (vendored, pinned)

**Interfaces:**
- Consumes: `manifest.json` `methodDocs` list; `docs/method/*.md` (synced by Task 3).

- [ ] **Step 1: Vendor marked (pinned version)**

```powershell
curl.exe -L -o docs\js\vendor\marked.min.js https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js
```

Record the version in the PR description. UMD build — exposes `window.marked`; load it with a plain (non-module) script tag before the module script.

- [ ] **Step 2: Write `docs/method.html`** — standard head/nav; main:

```html
  <main id="main">
    <h1>Method</h1>
    <nav id="docList" class="card" aria-label="Documents"></nav>
    <article id="doc"></article>
  </main>
  <script src="js/vendor/marked.min.js"></script>
  <script type="module" src="js/method.js"></script>
```

- [ ] **Step 3: Write `docs/js/method.js`**

```js
import { loadJSON, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();

async function init() {
  try {
    const manifest = await loadJSON("data/manifest.json");
    for (const d of manifest.methodDocs) {
      const a = document.createElement("a");
      a.href = `#${d.file}`;
      a.textContent = d.title;
      a.style.display = "block";
      $("docList").append(a);
    }
    const openFromHash = () => {
      const file = location.hash.slice(1) || manifest.methodDocs[0].file;
      open(file);
    };
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
  } catch (err) { $("doc").textContent = `Could not load documents: ${err.message}`; }
}

async function open(file) {
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`);
    $("doc").innerHTML = window.marked.parse(await res.text());
  } catch (err) { $("doc").textContent = `Could not load ${file}: ${err.message}`; }
}

init();
```

- [ ] **Step 4: Manual test locally** — every doc in the list renders; internal links between docs will point at `.md` paths and open raw; acceptable for v1 (note it in the PR).

- [ ] **Step 5: PR** (branch `feature/method`, commit `feat: method reference pages rendered from markdown`).

### Task 10: Progress page with export/import

**Files:**
- Create: `docs/progress.html`, `docs/js/progress.js`

**Interfaces:**
- Consumes: schedule/log keys, `scheduler.js` states, settings. Export format: `{ exportedAt: <ms>, keys: { "<storageKey>": <value> } }` covering every localStorage key starting `languages:`.

- [ ] **Step 1: Write `docs/progress.html`** — standard head/nav; main:

```html
  <main id="main">
    <h1 id="heading">Progress</h1>
    <section class="card" id="stats"></section>
    <section class="card">
      <h2>Coverage context</h2>
      <p class="muted">Mature sentences are a rough proxy, not word families - the honest yardstick (Nation 2006): 1,000 families buys ~75-80% coverage, 2,000 makes conversation possible, 5,000 (95% coverage) makes the language usable.</p>
    </section>
    <section class="card">
      <h2>Backup</h2>
      <button id="exportBtn">Export progress</button>
      <label style="margin-left:1rem">Import: <input type="file" id="importFile" accept="application/json"></label>
      <p id="backupStatus" class="muted"></p>
    </section>
  </main>
  <script type="module" src="js/progress.js"></script>
```

- [ ] **Step 2: Write `docs/js/progress.js`**

```js
import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    const schedule = store.get(key(data.language, "schedule"), {});
    const cards = Object.values(schedule);
    const by = state => cards.filter(c => c.state === state).length;
    const log = store.get(key(data.language, "log"), []);
    const cutoff = Date.now() - 30 * 86_400_000;
    const recent = log.filter(e => e.ts >= cutoff);
    const hits = recent.filter(e => e.grade !== "miss").length;
    $("heading").textContent = `Progress - ${data.label}`;
    $("stats").innerHTML = `
      <p>${data.sentences.length} sentences total: ${data.sentences.length - cards.length} unseen,
         ${by("learning") + by("new")} learning, ${by("mature")} mature.</p>
      <p>Last 30 days: ${recent.length} reviews, ${recent.length ? Math.round(100 * hits / recent.length) : 0}% retention.</p>`;
  } catch (err) { $("stats").textContent = `Could not load data: ${err.message}`; }
}

$("exportBtn").addEventListener("click", () => {
  const keys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("languages:")) keys[k] = JSON.parse(localStorage.getItem(k));
  }
  const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), keys }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `languages-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  $("backupStatus").textContent = "Exported.";
});

$("importFile").addEventListener("change", async e => {
  try {
    const text = await e.target.files[0].text();
    const parsed = JSON.parse(text);
    if (!parsed.keys || typeof parsed.keys !== "object") throw new Error("not a progress export");
    for (const [k, v] of Object.entries(parsed.keys)) {
      if (k.startsWith("languages:")) store.set(k, v);
    }
    $("backupStatus").textContent = "Imported - reloading.";
    setTimeout(() => location.reload(), 600);
  } catch (err) { $("backupStatus").textContent = `Import failed: ${err.message}`; }
});

init();
```

- [ ] **Step 3: Manual test locally** — stats match a drilled session; export downloads; clearing storage then importing restores the due counts.

- [ ] **Step 4: PR** (branch `feature/progress`, commit `feat: progress stats and backup export-import`).

### Task 11: Polish, architecture test, README, final deploy

**Files:**
- Create: `Sentence Islands/French/sentences.csv` (3 impersonal seed rows, architecture test)
- Modify: repository `README.md` (add site link + repo map section at top)
- Verify: live site end to end

- [ ] **Step 1: Architecture test — add French from data alone**

`Sentence Islands/French/sentences.csv`:

```csv
id,topic,english,target,box,due,misses,notes
1,morning,I just woke up.,Je viens de me réveiller.,0,,0,SEED
2,work,This meeting could have been an email.,Cette réunion aurait pu être un courriel.,0,,0,SEED
3,evening,I am going to read before sleeping.,Je vais lire avant de dormir.,0,,0,SEED
```

```powershell
python "Sentence Islands\tools\build_site_data.py" French
```

Verify: `docs/data/french.json` exists, manifest lists both languages, the Today dropdown shows French, drill works text-only (no audio) — **zero JavaScript changes**. If any JS change is needed, the architecture failed: fix the JS generically, not with a special case.

- [ ] **Step 2: README top section** — prepend to repo `README.md`: live URL, one-paragraph description, repo map (`docs/` app, `Sentence Islands/` tooling and data, `specs/` and `plans/` design history, method docs at root), and the local dev loop (`python -m http.server 8000 --directory docs`, `npm test`).

- [ ] **Step 3: Run full verification**

```powershell
npm test
python -m http.server 8000 --directory docs
```

Click through all five pages locally. Then PR (branch `feature/polish`, commit `feat: french architecture test and repository readme`), merge, wait for Pages build, click through all five pages on the live URL, verify audio plays over HTTPS on first click.

- [ ] **Step 4: Update memory** — record in session memory that the repo now lives at `C:\Dev\languages` and the OneDrive copy is frozen.

---

## Self-Review Notes

- Spec coverage: all five pages, scheduler, data pipeline, evidence rules (drill direction L1→L2, single language per session, requeue floor, evening nudge, miss summary), error handling patterns, export/import, French architecture test, PR-per-feature delivery — covered. Multi-voice audio flag for `build_audio.py` (spec's HVPT row) is content tooling, not site: deferred to first new audio generation, noted here explicitly as a conscious deferral.
- Type consistency: `newCard/nextState/isDue/LEARNING_STEPS/DAY_MS` names match across Tasks 4, 6, 8; storage keys via `key()` everywhere; settings shape identical in Tasks 5–10.
- Placeholders: PR bodies say `<teaching description>` — these are prose written at execution time describing what the PR teaches; all code is concrete.
