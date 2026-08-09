// Progress: one phase-appropriate headline metric first (the LingQ/Dreaming
// Spanish lesson - every product that works has exactly one number), then the
// combined review forecast, then the per-engine detail. Backup covers every
// languages:* key; there is deliberately no sync server.

import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";
import { PHASES } from "./plan.js";
import { forecast } from "./stats.js";
import { bandStats } from "./deck.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    const lang = data.language;
    $("heading").textContent = `Progress - ${data.label}`;

    const schedule = store.get(key(lang, "schedule"), {});
    const vSchedule = store.get(key(lang, "vocab-schedule"), {});
    let deck = null, pairsData = null;
    try { deck = await loadJSON(`data/vocab-${lang}.json`); } catch { /* no deck yet */ }
    try { pairsData = await loadJSON(`data/pairs-${lang}.json`); } catch { /* no pairs yet */ }
    const pairsStats = store.get(key(lang, "pairs"), {});
    const inputMins = store.get(key(lang, "inputlog"), []).reduce((a, e) => a + e.mins, 0);
    const plan = store.get(key(lang, "plan"), null);

    renderHeadline(plan, { deck, vSchedule, pairsData, pairsStats, inputMins, data, schedule });
    renderForecast([...Object.values(schedule), ...Object.values(vSchedule)]);
    renderIslands(data, schedule, lang);
    if (deck) renderVocab(deck, vSchedule);
    if (pairsData) renderPairs(pairsData, pairsStats);
    renderEngines(lang, inputMins);
  } catch (err) { $("stats").textContent = `Could not load data: ${err.message}`; }
}

function accuracy(s) {
  if (!s || !s.last50 || s.last50.length === 0) return null;
  return Math.round(100 * s.last50.reduce((a, b) => a + b, 0) / s.last50.length);
}

function renderHeadline(plan, g) {
  const focus = plan ? PHASES[plan.phase].focus : null;
  if (focus === "pairs" && g.pairsData) {
    const accs = g.pairsData.contrasts
      .map(c => ({ label: c.label, acc: accuracy(g.pairsStats[c.id]) }))
      .filter(x => x.acc !== null);
    if (!accs.length) {
      $("headlineLabel").textContent = "Phase 0 - ear training";
      $("headlineValue").textContent = "Not started";
      $("headlineSub").textContent = "Ten minutes of minimal pairs, before anything else.";
      return;
    }
    const weakest = accs.reduce((a, b) => (a.acc <= b.acc ? a : b));
    $("headlineLabel").textContent = "Weakest contrast";
    $("headlineValue").textContent = `${weakest.acc}%`;
    $("headlineSub").textContent = `${weakest.label}. Above roughly 85% on every contrast ends phase 0.`;
    return;
  }
  if (focus === "vocab" && g.deck) {
    const mature = g.deck.words.filter(w => g.vSchedule[w.id]?.state === "mature").length;
    $("headlineLabel").textContent = "Core words mature";
    $("headlineValue").textContent = String(mature);
    $("headlineSub").textContent = `Of ${g.deck.words.length} shipped (deck grows toward 1,000). The first 1,000 families buy 75-80% of everyday speech.`;
    return;
  }
  if (focus === "hours") {
    $("headlineLabel").textContent = "Input hours";
    $("headlineValue").textContent = (g.inputMins / 60).toFixed(1);
    $("headlineSub").textContent = "Comprehension of people you did not script - the engine islands cannot replace.";
    return;
  }
  const matureSentences = Object.values(g.schedule).filter(c => c.state === "mature").length;
  $("headlineLabel").textContent = "Mature island sentences";
  $("headlineValue").textContent = String(matureSentences);
  $("headlineSub").textContent = "Pick a phase on the Today page to get a phase-appropriate headline.";
}

function renderForecast(cards) {
  const f = forecast(cards, Date.now(), 7);
  const max = Math.max(1, ...f.map(b => b.due));
  $("forecast").textContent = "";
  f.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "band";
    const name = document.createElement("span");
    name.textContent = i === 0 ? "Today" :
      new Date(b.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${Math.round(100 * b.due / max)}%`;
    track.append(fill);
    const n = document.createElement("span");
    n.className = "muted";
    n.textContent = String(b.due);
    row.append(name, track, n);
    $("forecast").append(row);
  });
}

function renderIslands(data, schedule, lang) {
  const cards = Object.values(schedule);
  const by = state => cards.filter(c => c.state === state).length;
  const log = store.get(key(lang, "log"), []);
  const cutoff = Date.now() - 30 * 86_400_000;
  const recent = log.filter(e => e.ts >= cutoff);
  const hits = recent.filter(e => e.grade !== "miss").length;
  const retention = recent.length ? Math.round(100 * hits / recent.length) : 0;
  const total = data.sentences.length;
  const unseen = total - cards.length;
  const learning = by("new") + by("learning");
  const mature = by("mature");

  $("stats").textContent = "";
  const h = document.createElement("h2");
  h.textContent = "Islands";
  const tile = (value, label) => {
    const d = document.createElement("div");
    d.className = "tile";
    const v = document.createElement("div");
    v.className = "value";
    v.textContent = value;
    const l = document.createElement("div");
    l.className = "label";
    l.textContent = label;
    d.append(v, l);
    return d;
  };
  const tiles = document.createElement("div");
  tiles.className = "tiles";
  tiles.append(
    tile(String(recent.length), "Reviews, last 30 days"),
    tile(recent.length ? `${retention}%` : "-", "Retention, last 30 days"),
    tile(`${mature}/${total}`, "Mature sentences"),
  );

  const segs = [
    ["seg-unseen", unseen, "Unseen"],
    ["seg-learning", learning, "Learning"],
    ["seg-mature", mature, "Mature"],
  ];
  const bar = document.createElement("div");
  bar.className = "stack-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label",
    `${unseen} unseen, ${learning} learning, ${mature} mature of ${total} sentences`);
  for (const [cls, count] of segs) {
    if (!count) continue;
    const s = document.createElement("div");
    s.className = cls;
    s.style.flex = String(count);
    bar.append(s);
  }
  const legend = document.createElement("p");
  legend.className = "stack-legend";
  for (const [cls, count, label] of segs) {
    const item = document.createElement("span");
    const swatch = document.createElement("span");
    swatch.className = `swatch ${cls}`;
    item.append(swatch, `${label} ${count}`);
    legend.append(item);
  }
  $("stats").append(h, tiles, bar, legend);
}

function renderVocab(deck, vSchedule) {
  $("vocabCard").hidden = false;
  $("vocabBands").textContent = "";
  for (const b of bandStats(deck.words, vSchedule, deck.bands)) {
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
    pct.textContent = `${b.mature}/${b.total}`;
    row.append(name, track, pct);
    $("vocabBands").append(row);
  }
}

function renderPairs(pairsData, pairsStats) {
  $("pairsCard").hidden = false;
  $("pairsList").textContent = "";
  for (const c of pairsData.contrasts) {
    const li = document.createElement("li");
    const acc = accuracy(pairsStats[c.id]);
    li.textContent = `${c.label}: ${acc === null ? "not trained" : `${acc}%`}`;
    $("pairsList").append(li);
  }
}

function renderEngines(lang, inputMins) {
  const tutor = store.get(key(lang, "tutorlog"), []).length;
  const captured = store.get(key(lang, "captured"), []).length;
  $("engines").textContent =
    `Tutor sessions logged: ${tutor}. Input: ${(inputMins / 60).toFixed(1)} hours. ` +
    `Captured sentences: ${captured}.`;
}

$("exportBtn").addEventListener("click", () => {
  const keys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("languages:")) keys[k] = JSON.parse(localStorage.getItem(k));
  }
  const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), keys }, null, 1)],
    { type: "application/json" });
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
