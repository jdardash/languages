// Forced-choice minimal-pair perception trainer. Each trial plays one word of
// a pair in a randomly drawn voice - talker variability is the meta-analytic
// moderator, so the voice rotation is the training, not decoration. The page
// cannot score your mouth; it scores your ear, which is the trainable half.

import { store, key, getSettings, loadJSON, playAudio, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

const TRIALS = 20;
const LAST_N = 50;
let lang, data, contrast, trial, trialNo, roundCorrect, answered;

async function init() {
  try {
    const settings = getSettings();
    lang = settings.language;
    try { data = await loadJSON(`data/pairs-${lang}.json`); }
    catch { $("status").textContent = "No minimal-pair set for this language yet."; return; }
    $("status").hidden = true;
    renderPicker();
  } catch (err) {
    $("status").textContent = `Could not load data: ${err.message}`;
  }
}

function stats() { return store.get(key(lang, "pairs"), {}); }

function accuracy(s) {
  if (!s || !s.last50 || s.last50.length === 0) return null;
  return Math.round(100 * s.last50.reduce((a, b) => a + b, 0) / s.last50.length);
}

function renderPicker() {
  $("picker").hidden = false;
  $("stage").hidden = true;
  $("done").hidden = true;
  const all = stats();
  const byWeakness = [...data.contrasts].sort((a, b) => (accuracy(all[a.id]) ?? -1) - (accuracy(all[b.id]) ?? -1));
  const weakest = byWeakness[0];
  $("contrastList").textContent = "";
  data.contrasts.forEach((c, i) => {
    const acc = accuracy(all[c.id]);
    const div = document.createElement("div");
    div.className = "card";
    const h = document.createElement("h2");
    h.textContent = `${i + 1} of ${data.contrasts.length}: ${c.label}`;
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = acc === null ? "Not trained yet." : `${acc}% over your last ${all[c.id].last50.length} answers.`;
    const btn = document.createElement("button");
    if (c.id === weakest.id) { btn.className = "primary"; btn.textContent = "Train (weakest first)"; }
    else btn.textContent = "Train";
    btn.addEventListener("click", () => startRound(c));
    div.append(h, p, btn);
    $("contrastList").append(div);
  });
}

function startRound(c) {
  contrast = c;
  trialNo = 0;
  roundCorrect = 0;
  $("picker").hidden = true;
  $("done").hidden = true;
  $("stage").hidden = false;
  $("tip").textContent = c.tip;
  nextTrial();
}

function nextTrial() {
  if (trialNo >= TRIALS) { finish(); return; }
  trialNo++;
  answered = false;
  const pair = contrast.pairs[Math.floor(Math.random() * contrast.pairs.length)];
  const side = Math.random() < 0.5 ? "a" : "b";
  const voice = Math.floor(Math.random() * data.voices.length);
  trial = { pair, side, voice, word: pair[side] };
  $("counter").textContent = `${contrast.label} - trial ${trialNo} of ${TRIALS}`;
  $("choiceA").textContent = `${pair.a} - ${pair.glossA}`;
  $("choiceB").textContent = `${pair.b} - ${pair.glossB}`;
  $("choiceA").className = "";
  $("choiceB").className = "";
  $("feedback").textContent = " ";
  $("feedback").className = "";
  play();
}

async function play() {
  const ok = await playAudio($("player"), `audio/pairs/${lang}/${trial.word}-v${trial.voice}.mp3`);
  if (!ok) {
    // No shipped audio (or autoplay refused): speech synthesis is the fallback.
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(trial.word);
      u.lang = "es-419";
      speechSynthesis.speak(u);
    } catch { /* nothing to play with */ }
  }
}
$("playBtn").addEventListener("click", play);

function record(hit) {
  const all = stats();
  const s = all[contrast.id] ?? { seen: 0, correct: 0, last50: [] };
  s.seen++;
  if (hit) s.correct++;
  s.last50 = [...s.last50, hit ? 1 : 0].slice(-LAST_N);
  all[contrast.id] = s;
  store.set(key(lang, "pairs"), all);
}

function answer(side) {
  if (answered) return;
  answered = true;
  const hit = side === trial.side;
  if (hit) roundCorrect++;
  record(hit);
  const chosen = side === "a" ? $("choiceA") : $("choiceB");
  chosen.className = hit ? "feedback-good" : "feedback-bad";
  $("feedback").textContent = hit
    ? `Right - it was "${trial.word}".`
    : `It was "${trial.word}". Replaying...`;
  $("feedback").className = hit ? "feedback-good" : "feedback-bad";
  if (!hit) play();
  setTimeout(nextTrial, hit ? 900 : 1800);
}
$("choiceA").addEventListener("click", () => answer("a"));
$("choiceB").addEventListener("click", () => answer("b"));

document.addEventListener("keydown", e => {
  if ($("stage").hidden) return;
  if (e.key === "1") $("choiceA").click();
  if (e.key === "2") $("choiceB").click();
  if (e.key === " ") { e.preventDefault(); play(); }
});

function finish() {
  $("stage").hidden = true;
  $("done").hidden = false;
  const acc = accuracy(stats()[contrast.id]);
  $("summary").textContent = `${roundCorrect} of ${TRIALS} this round.`;
  $("rolling").textContent = `Rolling accuracy on this contrast: ${acc}%. Above roughly 85% on every contrast means phase 0 has done its job.`;
}
$("again").addEventListener("click", () => startRound(contrast));
$("back").addEventListener("click", renderPicker);

init();
