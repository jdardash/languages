// Frequency core deck, recognition direction while a beginner (L2 word on the
// front - SSLA 2021: L2->L1 wins at low proficiency). Reviews first, then new
// words capped per day. Audio is on-demand speechSynthesis: no shipped files.

import { newCard, nextState, DAY_MS } from "./scheduler.js";
import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";
import { pickSession, bandStats } from "./deck.js";
import { todayKey } from "./plan.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

const NEW_PER_DAY = 20;
let lang, bcp47, deck, schedule, queue, current;
const newIds = new Set();
const sessionMisses = new Map();
const correctStreak = new Map();
let reviewed = 0;

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    lang = entry.id;
    const langData = await loadJSON(entry.data);
    bcp47 = langData.bcp47;
    try { deck = await loadJSON(`data/vocab-${lang}.json`); }
    catch { $("status").textContent = `No core deck for ${langData.label} yet - the drill and shadow pages still work.`; return; }
    schedule = store.get(key(lang, "vocab-schedule"), {});
    renderBands();
    const now = Date.now();
    const intro = store.get(key(lang, "vocab-intro"), { day: "", count: 0 });
    const introToday = intro.day === todayKey(now) ? intro.count : 0;
    const { reviews, news } = pickSession(deck.words, schedule, introToday, now,
      { newPerDay: NEW_PER_DAY, limit: settings.drillLimit });
    for (const w of news) newIds.add(w.id);
    queue = [...reviews, ...news];
    $("heading").textContent = `Core deck - ${langData.label}`;
    if (queue.length === 0) {
      $("status").textContent = "Nothing due and today's new-word allowance is used. Come back tomorrow.";
      return;
    }
    $("status").textContent = `${reviews.length} reviews, ${news.length} new words.`;
    $("stage").hidden = false;
    show();
  } catch (err) {
    $("status").textContent = `Could not load data: ${err.message}`;
  }
}

function renderBands() {
  const stats = bandStats(deck.words, schedule, deck.bands);
  $("bandsCard").hidden = false;
  $("bands").textContent = "";
  for (const b of stats) {
    const row = document.createElement("div");
    row.className = "band";
    const name = document.createElement("span");
    name.textContent = `Top ${b.limit}`;
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${b.pct}%`;
    track.append(fill);
    const pct = document.createElement("span");
    pct.className = "muted";
    pct.textContent = `${b.pct}%`;
    row.append(name, track, pct);
    $("bands").append(row);
  }
}

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("es"));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } catch { /* no speech synthesis available */ }
}

function show() {
  current = queue[0];
  const isNew = newIds.has(current.id) && !schedule[current.id];
  $("counter").textContent = `${queue.length} remaining${isNew ? " - new word" : ""}`;
  $("word").textContent = current.word;
  $("word").lang = bcp47;
  $("wordMeta").textContent = `rank ${current.rank} - ${current.pos}`;
  $("back").hidden = true;
  $("gloss").textContent = current.gloss;
  $("example").textContent = current.example;
  $("exampleEn").textContent = current.exampleEn;
  $("grades").hidden = true;
  $("reveal").hidden = false;
  $("reveal").focus();
  speak(current.word);
}

$("speak").addEventListener("click", () => speak($("back").hidden ? current.word : current.example));

$("reveal").addEventListener("click", () => {
  $("back").hidden = false;
  $("reveal").hidden = true;
  $("grades").hidden = false;
  $("good").focus();
  speak(current.example);
});

function bumpIntro() {
  const day = todayKey(Date.now());
  const intro = store.get(key(lang, "vocab-intro"), { day: "", count: 0 });
  const count = intro.day === day ? intro.count + 1 : 1;
  store.set(key(lang, "vocab-intro"), { day, count });
}

function grade(g) {
  const now = Date.now();
  const wasNew = !schedule[current.id];
  schedule[current.id] = nextState(schedule[current.id] ?? newCard(), g, now);
  store.set(key(lang, "vocab-schedule"), schedule);
  if (wasNew) bumpIntro();
  const log = store.get(key(lang, "vocab-log"), []);
  log.push({ ts: now, grade: g, id: current.id });
  store.set(key(lang, "vocab-log"), log.slice(-2000));
  reviewed++;
  queue.shift();
  if (g === "miss") {
    sessionMisses.set(current.id, current);
    correctStreak.set(current.id, 0);
    queue.splice(Math.min(3, queue.length), 0, current);
  } else if (sessionMisses.has(current.id)) {
    const streak = (correctStreak.get(current.id) ?? 0) + 1;
    correctStreak.set(current.id, streak);
    if (streak < 2) queue.push(current);
  }
  renderBands();
  queue.length ? show() : finish();
}
$("miss").addEventListener("click", () => grade("miss"));
$("hard").addEventListener("click", () => grade("hard"));
$("good").addEventListener("click", () => grade("good"));

// Mark known: a long-interval mature card. Costs no new-card allowance - it is
// the Lingvist-style skip for words a non-beginner already owns.
$("known").addEventListener("click", () => {
  const now = Date.now();
  schedule[current.id] = { state: "mature", stepIndex: 0, interval: 180, ease: 2.5,
    due: now + 180 * DAY_MS, lapses: 0, reps: 1 };
  store.set(key(lang, "vocab-schedule"), schedule);
  reviewed++;
  queue.shift();
  renderBands();
  queue.length ? show() : finish();
});

document.addEventListener("keydown", e => {
  if ($("stage").hidden) return;
  if (!$("reveal").hidden && (e.key === "Enter" || e.key === " ")) {
    if (e.target === $("reveal")) return;
    e.preventDefault();
    $("reveal").click();
  } else if (!$("grades").hidden) {
    if (e.key === "1") $("miss").click();
    if (e.key === "2") $("hard").click();
    if (e.key === "3") $("good").click();
  }
});

function finish() {
  $("stage").hidden = true;
  $("done").hidden = false;
  $("summary").textContent = `${reviewed} cards, ${sessionMisses.size} missed.`;
}

init();
