// Cloze production over the deck's own examples: recall the blanked word from
// sentence context. New cloze cards are gated on the word having been met in
// the core deck (recognition first, production second). Objective grading:
// exact token, accents strict.

import { newCard, nextState, isDue, seedFrom } from "./scheduler.js";
import { normalize } from "./dictation.js";
import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

const SESSION = 15;
const NEW_PER_SESSION = 6;

let lang, schedule, queue, current;
let reviewed = 0;
const misses = [];

async function init() {
  try {
    lang = getSettings().language;
    let data;
    try { data = await loadJSON(`data/cloze-${lang}.json`); }
    catch { $("status").textContent = "No cloze deck for this language yet."; return; }
    schedule = store.get(key(lang, "cloze-schedule"), {});
    const vSchedule = store.get(key(lang, "vocab-schedule"), {});
    const now = Date.now();

    const due = data.items.filter(c => schedule[c.id] && isDue(schedule[c.id], now));
    const unlocked = data.items.filter(c => !schedule[c.id] && vSchedule[c.id.replace(/^z-/, "")]);
    queue = [...due.slice(0, SESSION), ...unlocked.slice(0, NEW_PER_SESSION)].slice(0, SESSION);
    if (!queue.length) {
      $("status").textContent = "Nothing due, and no new cards are unlocked - meet more words in the core deck first.";
      return;
    }
    $("status").hidden = true;
    $("stage").hidden = false;
    show();
  } catch (err) { $("status").textContent = `Could not load data: ${err.message}`; }
}

function show() {
  current = queue[0];
  $("counter").textContent = `${queue.length} remaining - rank ${current.rank}`;
  $("text").textContent = current.text;
  $("en").textContent = current.en;
  $("feedback").hidden = true;
  $("nextRow").hidden = true;
  $("typeZone").hidden = false;
  $("typed").value = "";
  $("typed").focus();
}

$("check").addEventListener("click", () => {
  const now = Date.now();
  const right = normalize($("typed").value) === normalize(current.answer);
  schedule[current.id] = nextState(schedule[current.id] ?? newCard(), right ? "good" : "miss", now, seedFrom(current.id));
  store.set(key(lang, "cloze-schedule"), schedule);
  reviewed++;

  const fb = $("feedback");
  fb.textContent = "";
  const full = document.createElement("span");
  full.className = right ? "diff-same" : "diff-missing";
  full.textContent = current.text.replace("____", current.answer);
  fb.append(full);
  if (!right) {
    const yours = document.createElement("span");
    yours.className = "diff-extra";
    yours.textContent = ` you wrote: ${$("typed").value.trim() || "(blank)"}`;
    yours.lang = "en";
    fb.append(yours);
    misses.push(current);
    queue.push(current);
  }
  fb.hidden = false;
  $("typeZone").hidden = true;
  $("nextRow").hidden = false;
  $("next").focus();
  queue.shift();
});

$("next").addEventListener("click", () => { queue.length ? show() : finish(); });
$("typed").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); $("check").click(); }
});
document.addEventListener("keydown", e => {
  if (!$("nextRow").hidden && (e.key === "Enter" || e.key === " ") && e.target !== $("typed")) {
    e.preventDefault();
    $("next").click();
  }
});

function finish() {
  $("stage").hidden = true;
  $("done").hidden = false;
  const unique = [...new Map(misses.map(m => [m.id, m])).values()];
  $("summary").textContent = `${reviewed} answers, ${unique.length} words missed.`;
  for (const m of unique) {
    const li = document.createElement("li");
    li.textContent = `${m.answer} - ${m.text.replace("____", m.answer)} (${m.gloss})`;
    $("missList").append(li);
  }
}

init();
