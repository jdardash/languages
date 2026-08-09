# How To Learn GitHub And The Web

Written 2026-08-09. Every URL here was fetched and confirmed live on that date; the
handful of claims that rest on community sources rather than official documentation
are marked ⚠ where they appear.

The premise: you do not learn version control by reading about version control. This
folder is the vehicle. By the end you will have these notes on GitHub, a study page
live at a public URL, and a workflow you can repeat on any project after this one.

---

## 0. Two decisions to make before anything else

**Move this folder out of OneDrive.** Git for Windows now ships a warning that
concurrent access to OneDrive-synced folders can corrupt repositories — the sync
client and Git both write to `.git/` without coordinating. Once GitHub holds the
history, OneDrive is redundant backup for this folder anyway.

```powershell
New-Item -ItemType Directory -Force C:\Dev
Move-Item "C:\Users\jsdar\OneDrive\Learning\Languages" "C:\Dev\languages"
Set-Location C:\Dev\languages
```

If you keep it in OneDrive, pause sync during Git operations. The risk is real, not
theoretical.

**Do not put the audio in Git LFS.** ⚠ GitHub Pages checks out repositories without
resolving LFS pointers, so a browser asking for `t-6.mp3` receives a ~130-byte text
file instead of audio, and the study page silently loses sound. This is confirmed by
several git-lfs issues and a GitHub community discussion but is not stated in the
official Pages documentation — treat it as well-established rather than canonical.
It does not cost you anything: the largest file in this folder is `recall.mp3` at
3.0 MB against a 100 MiB hard limit. Commit the mp3s as ordinary files.

The real discipline is different: **commit the small per-sentence clips, ignore the
large regenerable concatenations.** `out/recall.mp3` and `out/shadow.mp3` are 5.3 MB
of a 7.2 MB repository and `build_audio.py` reproduces both on demand.

---

## 1. Git in dependency order

Git is a program on your machine that records snapshots of a folder. GitHub is a
website that hosts copies of those histories. They are separate; Git works fine
without GitHub forever.

### The three areas

Everything else is built on these.

| Area | What it is | The command |
|---|---|---|
| **Working tree** | The files on disk as your editor sees them | `git status` |
| **Staging area** (index) | A holding pen where you assemble exactly what goes in the next snapshot | `git add METHOD.md` |
| **Commit** | A permanent named snapshot of the staged content, with a message, an author, a timestamp and a parent | `git commit -m "..."` |

The staging area is the part beginners skip and then miss. It exists so a commit can
be one coherent idea rather than "everything I touched today."

```powershell
git add .                          # stage everything changed
git diff                           # working tree vs staged — what you haven't staged
git diff --staged                  # staged vs last commit — what you're about to commit
git restore --staged METHOD.md     # unstage, keep the edits
git log --oneline --graph          # the shape of history
```

A commit's ID is a hash of its content *and of its parent*, which is why history is
tamper-evident: alter an old commit and every ID after it changes.

### Parallel lines of history

**Branch** — a movable label pointing at one commit, so an idea can develop without
disturbing the main line. **HEAD** — a pointer to the branch you are on, i.e. where
the next commit will attach.

```powershell
git switch -c feature/spanish-page   # create and switch
git switch main                      # back
```

`git switch` and `git restore` replaced the overloaded `git checkout` in Git 2.23.
`checkout` still works; the newer verbs each do one thing, which is why they are
easier to reason about.

**Merge** combines another branch in by making a commit with two parents, preserving
the true shape of what happened. **Rebase** replays your commits onto a different
base, producing a straight line as though you had started from the newer code.

```powershell
git switch main            &&  git merge feature/spanish-page
git switch feature/x       &&  git rebase main
```

The rule that keeps you out of trouble: **rebase only commits you have not pushed and
nobody else has.** Rewriting shared history forces everyone else to repair their
clones. Working alone here, either is fine — start with merge, because merge is never
destructive.

**Merge conflict** — two branches changed the same lines, so Git stops and marks the
file with `<<<<<<<`, `=======`, `>>>>>>>`. Edit the file, delete the markers, keep
what you want, then `git add` the file and `git commit`. `git merge --abort` backs
out entirely.

### Other copies

| Concept | One sentence | Command |
|---|---|---|
| **Remote** | A nickname for another copy of the repository elsewhere, conventionally `origin` | `git remote -v` |
| **Push** | Upload your commits to a remote | `git push -u origin main` |
| **Fetch** | Download new commits without touching your files | `git fetch origin` |
| **Pull** | Fetch, then merge into your branch immediately | `git pull` (or `--rebase`) |
| **Clone** | Copy a whole remote repository locally, history and all | `git clone <url>` |

### GitHub-only concepts

These are not Git. They are features of a website that stores Git repositories.

- **Fork** — a copy of someone else's repository under your account, so you can change
  it without write access to the original. `gh repo fork owner/repo --clone`
- **Pull request** — "please merge my branch into yours," with a place to review the
  diff and argue about it first. Worth using even alone: it gives you a diff view, a
  written record of *why*, and something searchable a year later.

```powershell
git push -u origin feature/spanish-page
gh pr create --fill
gh pr merge --squash --delete-branch
```

`--squash` collapses a messy branch into one tidy commit on `main`.

### Undoing things

Three cover almost everything:

```powershell
git restore METHOD.md                    # discard uncommitted edits to a file
git commit --amend -m "better message"   # fix the most recent commit — unpushed only
git revert <sha>                         # new commit undoing an old one — safe on pushed history
```

`git reset --hard` also exists and permanently destroys work. Leave it alone until
the rest is reflex.

---

## 2. This folder onto GitHub

Your machine as of 2026-08-09: git 2.52.0.windows.1, gh 2.86.0, Python 3.14.2,
`user.name` = Joshua Dardashti, `user.email` = the GitHub noreply form (good — that
keeps your real address out of public commit history), and `gh` already authenticated
as **jdardash** and wired in as the Git credential helper. So most of what follows is
verification rather than setup.

### Verify

```powershell
git --version
gh --version
git config --global user.name
git config --global user.email
```

Two settings worth adding, both about Windows-specific pain:

```powershell
git config --global init.defaultBranch main
git config --global core.autocrlf true      # LF in the repo, CRLF in the working tree
```

### Authentication: HTTPS versus SSH

**HTTPS with Git Credential Manager** — remotes look like
`https://github.com/jdardash/languages.git`. Git needs a token for every push; GCM,
which ships bundled with Git for Windows, keeps it in the Windows Credential Manager
vault and supplies it silently. It is port 443 like ordinary web traffic, so it
survives corporate proxies. Note your GitHub *password* will not work for Git
operations — GitHub removed that in 2021. It must be a token, which is what GCM
manages.

**SSH keys** — remotes look like `git@github.com:jdardash/languages.git`. A keypair
authenticates you, nothing expires, but setup is longer and port 22 is blocked on many
networks.

```powershell
ssh-keygen -t ed25519 -C "135767837+jdardash@users.noreply.github.com"
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
gh ssh-key add $env:USERPROFILE\.ssh\id_ed25519.pub --title "windows-desktop"
ssh -T git@github.com
```

**Stay on HTTPS.** It already works on this machine.

⚠ One machine-specific trap: your active `gh` account authenticates from a
`GITHUB_TOKEN` environment variable carrying `admin:org`, `admin:enterprise` and
`delete_repo` — far more privilege than a notes repository needs — with a second
keyring token sitting inactive behind it. While that variable is set, it **overrides**
the keyring and `gh auth login` will not change which account is active. If
authentication ever behaves strangely, check `$env:GITHUB_TOKEN` first.

### Initialize and ignore

Write `.gitignore` *before* the first commit. Ignoring a file after committing it does
not remove it from history. The file is already written — see `.gitignore` in this
folder — and covers: `.remember/`, Python bytecode and virtualenvs, the regenerable
`Sentence Islands/*/out/` tracks, Windows and editor cruft, and logs.

One note on `.remember/`: it contains its own `.gitignore` whose entire contents are
`*`, which does exclude the folder — but `*` also matches that `.gitignore` itself, so
it can never be committed, and a fresh clone loses the protection. That is why the
root `.gitignore` names it explicitly.

```powershell
git init
git add .
git status        # READ THIS. Confirm no .remember/, no out/, no __pycache__
git commit -m "chore: initial commit of language notes and Sentence Islands tooling"
```

### Create the repository and push

```powershell
gh repo create languages --public --source=. --remote=origin --push `
  --description "Personal language-learning method, notes, and Sentence Islands drill tooling"
gh repo view --web
```

Use `--private` if you want it closed — but a private repository **cannot serve GitHub
Pages on the free plan**, so if the study page is the goal, this repository has to be
public. ⚠ That plan restriction is assembled from GitHub's plans documentation rather
than one canonical Pages page; confirm in your own Settings → Pages. Before choosing
public, read back through the ten language READMEs for anything personal.

### The daily loop

```powershell
git status
git add -p          # stage hunk by hunk — the best learning tool in Git
git commit -m "docs: expand Farsi phonology notes"
git push
```

---

## 3. GitHub Pages

### The three routes, and which one to take

Settings → Pages → Source offers exactly two options. **Deploy from a branch** lets
you pick any branch plus a folder, and the folder may only be the repository root or
`/docs` — those are the only two. **GitHub Actions** lets you supply a workflow, which
removes the folder restriction and exempts you from the ten-builds-per-hour limit.

A `gh-pages` branch is not a third option. It is the historical convention where an
external tool commits built output to a branch of that name, which you then select
under the first option. It predates Actions deployment and buys a hand-written HTML
page nothing.

**Take the first route, `/docs` on `main`.** These notes are Markdown-first; a `docs/`
folder keeps the site cleanly separate, and there is no build step.

```powershell
gh api -X POST repos/jdardash/languages/pages `
  -f "source[branch]=main" -f "source[path]=/docs"
gh api repos/jdardash/languages/pages --jq '.html_url, .status'
```

Your URL will be `https://jdardash.github.io/languages/`. A *user* site at
`https://jdardash.github.io` needs a repository named exactly `jdardash.github.io`,
and you get one per account.

If you later add a bundler, the Actions route wants `actions/upload-pages-artifact@v3`
and `actions/deploy-pages@v4`, with `pages: write` and `id-token: write` permissions
and a `github-pages` environment. All three are mandatory; deployment fails silently
without them.

### The gotchas that will actually bite

1. **Paths are case-sensitive.** Pages runs on Linux; Windows does not care about
   case. `src="Audio/t-6.mp3"` works perfectly on your laptop and 404s in production
   if the folder is really `audio/`. This is the single most common
   "but it worked locally."
2. **Spaces in filenames** become `%20`. This folder has `Sentence Islands/` and
   `How To Learn Languages.md`. It works, but it is brittle. Name everything under
   `docs/` lowercase-with-hyphens.
3. **Anything starting with `_` disappears.** Pages runs Jekyll by default and treats
   `_`-prefixed names as reserved. Create an empty `docs/.nojekyll` preemptively — the
   failure mode is a silent 404 that is baffling to debug. Note this would eat your
   `_silence-0.8.mp3` files if you ever published them.
4. **No server-side code, ever.** Static files only. Any key you put in the JavaScript
   is public.
5. **Aggressive caching**, roughly a ten-minute TTL. Hard-refresh before you start
   debugging a deploy that "didn't work."
6. **Limits**: site under 1 GB, 100 GB/month bandwidth, ten builds/hour, all soft.
   7.2 MB is not close.

Custom domains: `www` is one CNAME record pointing at `jdardash.github.io`; an apex
domain needs four A records to `185.199.108-111.153`. Saving a domain commits a
`CNAME` file to the branch — do not delete it. HTTPS provisioning can take 24 hours.

---

## 4. How the web actually works

**DNS** is the phone book. Computers route by IP address, so `jdardash.github.io` has
to become something like `185.199.110.153`. A resolver walks a hierarchy — root servers
know who runs `.io`, those know who runs `github.io` — and every answer is cached for a
TTL. That caching is precisely why DNS changes "take time to propagate": you are
waiting for other people's caches to expire.

The browser then opens a TCP connection on port 443 and performs a **TLS handshake**:
the server presents a certificate proving it owns that hostname, both sides agree on
keys, everything after is unreadable in between. That is the padlock.

**HTTP** over that channel is a request — a method (`GET`, `POST`), a path, headers,
sometimes a body — and a response: a status code (`200` fine, `301` moved, `304` use
your cache, `404` missing, `429` rate-limited, `500` server broke), headers, and the
bytes. `Content-Type` is the header that matters most; it is what tells the browser
whether those bytes are HTML, JSON or an mp3.

Two properties define it. It is **request/response** — the server never speaks first,
which is why live-updating pages need WebSockets or polling. And it is **stateless** —
each request is independent and the server remembers nothing between them, which is
the entire reason cookies and tokens exist.

What the browser does next:

1. **Parse the HTML into the DOM**, a live tree of objects in memory. The file is dead
   text; the DOM is the living structure. When JavaScript changes the page it is
   changing the DOM, not the file — which is why a refresh loses everything unless you
   saved it somewhere.
2. **Fetch subresources.** Every stylesheet, script, image and audio file is a separate
   HTTP request. A page is not one download, it is dozens.
3. **Parse CSS into the CSSOM**, a parallel tree of rules.
4. **Render tree → layout → paint.** Layout computes where every box goes and is
   expensive; paint fills pixels. Changing `width` forces a reflow, changing
   `transform` or `opacity` usually does not — which is the whole reason smooth
   animations use those two properties.

**Static** means the server hands over files that already exist, identical for every
visitor. **Dynamic** means it generates the response per request. The distinction
people get wrong: a static site can be extremely interactive. Pages only hands out
files, but the JavaScript in those files runs on your machine and can play audio,
track a streak, quiz you and speak Spanish at you. What it cannot do is keep data that
outlives the browser, hold a secret, or share state between two people. For a personal
study tool, static is genuinely sufficient — which is the whole reason this fits on
free hosting.

**Hosting** is renting a computer that is always on, always connected, and answers HTTP.
A **CDN** is a fleet of them in many cities each holding a cached copy, so the bytes
travel 50 km instead of 8,000. Pages sits behind one automatically.

---

## 5. The specific HTML, CSS and JavaScript this project needs

Not all of the web platform — the subset a single-page study app actually uses.

**Semantic HTML.** `<header>`, `<nav>`, `<main>`, `<section>`, `<button>`. Not style
pedantry: a real `<button>` is keyboard-focusable, Enter/Space-activatable and
announced as a button for free, where a `<div onclick>` is none of those. Put
`lang="es"` on Spanish text — it makes screen readers and speech synthesis use Spanish
pronunciation, which is directly relevant here.

**CSS custom properties.** Named variables that cascade and inherit. Define a palette
once and a whole theme changes by overriding a handful of lines.

**Grid, one pattern.** `grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr))`
gives a responsive card deck with no media queries at all. Learn this and most layout
is solved. Flexbox handles the one-axis cases — a row of buttons.

**`prefers-color-scheme`.** Combined with custom properties, dark mode is about five
lines.

**`<audio>`.** Set `preload="none"` — with 69 clips you do not want the browser
fetching all of them. Drive it from JavaScript for a custom UI: `.currentTime`,
`.playbackRate` (0.75 for shadowing, pitch preserved), and the `ended` event to chain
into the next card. **The autoplay trap:** browsers block playback not triggered by a
user gesture, and `play()` returns a *rejected Promise* rather than throwing. Always
`await` it inside `try/catch`, and make the first sound of a session come from a real
click.

**`localStorage`.** String key/value storage scoped to the origin, surviving restarts.
Three rules: `JSON.stringify` on the way in and `parse` on the way out (assigning an
object stores the literal text `[object Object]`); wrap both in `try/catch` because
`setItem` throws on quota and access throws outright in private mode; and namespace
and version the key — `languages:spanish:progress:v1` — because every project you ever
publish to `jdardash.github.io` shares one bucket.

**`fetch`.** Load `sentences.json` at runtime so the Python tooling can regenerate data
without touching the HTML. **The trap:** `fetch` only rejects on network failure. A 404
resolves successfully with `res.ok === false`. Check `res.ok` explicitly, every time.
**Second trap:** opening `index.html` by double-clicking gives a `file://` URL where
`fetch` is blocked by CORS. You need a local server even for a purely static page:

```powershell
python -m http.server 8000 --directory docs
```

That is also the only way to catch the case-sensitivity bugs before deploying.

**Event delegation.** One listener on a container handles every child, including ones
added later, via `e.target.closest('[data-id]')`. It is the difference between one
listener and two hundred.

**Web Speech, in two very unequal halves.**

`speechSynthesis` (text to speech) is **Baseline, widely available since September
2018** — safe to rely on. One real caveat: `getVoices()` is effectively asynchronous
and returns an empty array on first call, so populate it from the `voiceschanged`
event. Voices come from the operating system, so which languages exist varies per
machine — expect Spanish, French and Japanese to be well served and Farsi and Tagalog
to be sparse. Feature-detect with `voices.some(v => v.lang.startsWith('fa'))`.

Because this folder already has 69 real recorded clips, **treat synthesis as the
fallback for text you have not recorded, not the primary source.** Recorded human
audio is better for pronunciation training, and per `How To Learn Languages.md` the
pronunciation evidence is the one place the method most needs to be right.

`SpeechRecognition` (speech to text) is **not** safe to rely on. MDN labels it
"limited availability"; caniuse puts it at ~87.6% global with **every single one of
those partial**. Firefox does not support it at all — it sits behind
`dom.webspeech.recognition.enable`, disabled by default. It still ships
vendor-prefixed. Chrome sends your audio to Google's servers, so it does not work
offline and carries privacy implications worth disclosing. And recognition quality on
non-native accents — exactly this use case — is unreliable, which makes it a poor
grader. Build it as an optional, clearly-labelled enhancement or skip it entirely.

---

## 6. Resources, verified 2026-08-09

| Resource | URL | Good for |
|---|---|---|
| **GitHub Learn — Skills** | https://learn.github.com/skills | Interactive courses that run as real repositories on your account with a bot giving feedback. The best starting point. |
| **Introduction to GitHub** | https://github.com/skills/introduction-to-github | The specific first course. Repos, branches, commits, PRs in under an hour. |
| **Pro Git, 2nd ed.** | https://git-scm.com/book/en/v2 | The official book, free, CC-licensed. Chapters 2–3 are §1 above done properly. |
| **Learn Git Branching** | https://learngitbranching.js.org/ | Visual animated sandbox. The fastest way to make merge-versus-rebase click, because you watch the graph move. |
| **MDN — Learn web development** | https://developer.mozilla.org/en-US/docs/Learn_web_development | Structured beginner path, and *the* reference for what any element or method does. |
| **JavaScript.info** | https://javascript.info/ | The best free JavaScript explanation that exists. Part 2 (Browser: DOM, Events) is §5 above. |
| **web.dev — Learn** | https://web.dev/learn | Chrome team. Course-length HTML, CSS, JS, Accessibility, Performance. |
| **freeCodeCamp** | https://www.freecodecamp.org/learn | Project-driven. Responsive Web Design, then JavaScript Algorithms. Best for doing rather than reading. |
| **The Odin Project** | https://www.theodinproject.com/ | Makes you work on your own machine with your own editor and Git from day one — which is the actual skill. |
| **Can I Use** | https://caniuse.com/ | Check real browser support before depending on any API. |

⚠ **Two naming changes that make most existing tutorials stale.** GitHub Learning Lab
shut down on 2022-09-01; anything pointing at `lab.github.com` is dead. And GitHub
Skills has been folded into **GitHub Learn** — `skills.github.com` still returns 200
but serves only a meta-refresh stub redirecting to `learn.github.com/skills`. GitHub's
own documentation still links the old address.

---

## 7. Four weeks, ending with the page live

One rule throughout: **commit every day you work, even if it is one line.** The habit
matters more than the content.

**Week 1 — Git, and these notes on GitHub.** Run §2 end to end on day one. Then the
Introduction to GitHub course, then Pro Git ch. 2. Spend a day just doing the loop
three times with three real messages. Then branching: make a branch, merge it, then
*deliberately cause a merge conflict* and resolve it — break it on purpose while
nothing is at stake. Finish with Learn Git Branching and your first pull request, read
back your own diff before merging. Shipped: repo on GitHub, ~15 commits, one merged
PR, one resolved conflict.

**Week 2 — HTML, CSS, and a live URL by day two.** Build `docs/index.html` with a
heading and your ten languages, add `docs/.nojekyll`, serve it locally. Then **deploy
while it is still embarrassing** — you want the pipeline proven before you have
anything to lose. Spend the rest of the week on the box model, custom properties, the
one Grid pattern, a media query and `prefers-color-scheme`. Hunt for the
case-sensitivity bug; if it works locally and 404s live, that is the lesson landing.

**Week 3 — JavaScript, and the app does something.** Fundamentals, then DOM and
events, then the pivotal day: extend `build_audio.py` to also emit
`docs/data/spanish.json` from `sentences.csv`, and render cards from it with `fetch`.
That is the moment the Python tooling and the web page become one system. Then wire
the audio with the `try/catch` autoplay handling and a 0.75× shadowing button, then
`localStorage` for progress. Verify on your phone — mobile autoplay policy is the
strictest.

**Week 4 — polish and workflow.** `speechSynthesis` for the sentences with no
recording. Optionally `SpeechRecognition`, and skip it the moment it fights you.
Accessibility and keyboard control, then Lighthouse. Then the real test of the
architecture: **add a second language.** If French needs only a new data file, the
design is right; if it needs JavaScript changes, refactor until it does not. Finish on
a branch with a proper PR description, and write the repository README.

After that, the obvious next thing is spaced repetition in the browser — an SM-2
implementation is roughly forty lines of JavaScript, and it would let the web page and
`recall_drill.py` share one schedule instead of two.

---

## Quick reference

```powershell
git status                              # what's going on
git add -p                              # stage hunk by hunk
git commit -m "feat: add audio replay"  # snapshot
git push                                # upload
git log --oneline --graph --all         # the shape of history
git switch -c feature/thing             # new branch
git merge feature/thing                 # combine
gh pr create --fill                     # open a PR
gh pr merge --squash --delete-branch     # land it
python -m http.server 8000 --directory docs   # local server — required for fetch
```
