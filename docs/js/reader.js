// Known-words reader (the Lute/LWT mechanic, static-site version): every word
// carries a persistent status, tap for gloss and to reclassify, coverage bar
// shows how comprehensible the passage is (95%+ is the reading zone). Reading
// minutes credit the input log the same way shadowing does.

import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";
import { tokenize, knownStats } from "./readerlib.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

let lang, passages = [], dict = {}, statuses = {}, tokens = [], currentWord = null;

async function init() {
  try {
    lang = getSettings().language;
    let data;
    try { data = await loadJSON(`data/reader-${lang}.json`); }
    catch { $("status").textContent = "No reader texts for this language yet."; return; }
    passages = data.passages;
    try {
      const lib = await loadJSON(`data/library-${lang}.json`);
      passages = [...passages, ...lib.items.map(x => ({ id: x.id, title: `Library: ${x.title}`, text: x.text }))];
    } catch { /* no transcribed library yet */ }
    try { dict = (await loadJSON(`data/dict-${lang}.json`)).words; }
    catch { dict = {}; }
    statuses = store.get(key(lang, "words"), {});

    $("sourceLine").textContent = data.source;
    for (const p of passages) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.title;
      $("passageSel").append(opt);
    }
    const savedId = store.get(key(lang, "reader-passage"), passages[0].id);
    if (passages.some(p => p.id === savedId)) $("passageSel").value = savedId;
    $("status").hidden = true;
    $("pickCard").hidden = false;
    $("textCard").hidden = false;
    render();
  } catch (err) { $("status").textContent = `Could not load data: ${err.message}`; }
}

function render() {
  const p = passages.find(x => x.id === $("passageSel").value) ?? passages[0];
  store.set(key(lang, "reader-passage"), p.id);
  tokens = tokenize(p.text);
  const box = $("text");
  box.textContent = "";
  for (const tok of tokens) {
    if (tok.t === "x") { box.append(tok.s); continue; }
    const span = document.createElement("span");
    span.textContent = tok.s;
    span.dataset.w = tok.w;
    span.className = wordClass(tok.w);
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    box.append(span);
  }
  updateStats();
}

function wordClass(w) {
  const s = statuses[w];
  return `rw ${s === 2 ? "rw-known" : s === 1 ? "rw-learning" : "rw-unknown"}`;
}

function updateStats() {
  const s = knownStats(tokens, statuses);
  $("coverLine").textContent =
    `${s.total} words - ${s.pct}% known, ${s.learning} learning. 95%+ is the comfortable reading zone.`;
  $("coverFill").style.width = `${s.pct}%`;
}

$("text").addEventListener("click", e => {
  const w = e.target.dataset?.w;
  if (w) selectWord(w);
});
$("text").addEventListener("keydown", e => {
  const w = e.target.dataset?.w;
  if (w && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectWord(w); }
});

function selectWord(w) {
  currentWord = w;
  $("wordCard").hidden = false;
  $("wWord").textContent = w;
  $("wGloss").textContent = dict[w] ?? "No gloss for this form - look it up once, then mark it.";
  for (const [btn, val] of [["wUnknown", undefined], ["wLearning", 1], ["wKnown", 2]]) {
    $(btn).setAttribute("aria-pressed", String(statuses[w] === val));
  }
  $("wordCard").scrollIntoView({ block: "nearest" });
}

function setStatus(val) {
  if (!currentWord) return;
  if (val === undefined) delete statuses[currentWord];
  else statuses[currentWord] = val;
  store.set(key(lang, "words"), statuses);
  for (const el of $("text").querySelectorAll(`[data-w="${CSS.escape(currentWord)}"]`)) {
    el.className = wordClass(currentWord);
  }
  selectWord(currentWord);
  updateStats();
}
$("wUnknown").addEventListener("click", () => setStatus(undefined));
$("wLearning").addEventListener("click", () => setStatus(1));
$("wKnown").addEventListener("click", () => setStatus(2));

$("passageSel").addEventListener("change", render);

// Reading time -> input log, whole minutes, flushed when the page hides.
let readMs = 0, tick = Date.now();
setInterval(() => {
  if (document.visibilityState === "visible") readMs += Date.now() - tick;
  tick = Date.now();
}, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  const mins = Math.floor(readMs / 60_000);
  if (!mins || !lang) return;
  readMs -= mins * 60_000;
  const log = store.get(key(lang, "inputlog"), []);
  log.push({ ts: Date.now(), mins, kind: "reading", note: "reader" });
  store.set(key(lang, "inputlog"), log);
});

init();
