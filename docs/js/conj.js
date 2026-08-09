// Conjugation cells drilled as typed production. Grading is objective (a
// single form, accents strict) so the scheduler is fed automatically:
// exact match = good, anything else = miss. Cells share the island card shape.

import { newCard, nextState, isDue, seedFrom } from "./scheduler.js";
import { normalize } from "./dictation.js";
import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

const SESSION = 20;
const NEW_PER_SESSION = 8;

let lang, schedule, queue, current;
let reviewed = 0;
const misses = [];

const slug = t => t.toLowerCase().replace(/[^a-z]+/g, "-");

async function init() {
  try {
    const settings = getSettings();
    lang = settings.language;
    let data;
    try { data = await loadJSON(`data/conj-${lang}.json`); }
    catch { $("status").textContent = `No conjugation deck for this language yet.`; return; }
    schedule = store.get(key(lang, "conj-schedule"), {});
    const now = Date.now();

    const cells = [];
    for (const item of data.items) {
      for (const [person, form] of Object.entries(item.forms)) {
        cells.push({
          id: `c-${slug(item.verb)}-${slug(item.mood)}-${slug(item.tense)}-${person}`,
          verb: item.verb,
          english: item.english,
          mood: item.mood,
          tense: item.tense,
          person, personLabel: data.persons[person],
          form,
        });
      }
    }
    const due = cells.filter(c => schedule[c.id] && isDue(schedule[c.id], now));
    const fresh = cells.filter(c => !schedule[c.id]).slice(0, NEW_PER_SESSION);
    queue = [...due.slice(0, SESSION), ...fresh].slice(0, SESSION);
    if (!queue.length) {
      $("status").textContent = "Nothing due and no new cells left for today. Come back tomorrow.";
      return;
    }
    $("status").hidden = true;
    $("stage").hidden = false;
    show();
  } catch (err) { $("status").textContent = `Could not load data: ${err.message}`; }
}

function show() {
  current = queue[0];
  $("counter").textContent = `${queue.length} remaining`;
  $("cellLine").textContent = `${current.mood} - ${current.tense} - ${current.personLabel}`;
  $("verb").textContent = current.verb;
  $("verbEn").textContent = current.english;
  $("feedback").hidden = true;
  $("nextRow").hidden = true;
  $("typeZone").hidden = false;
  $("typed").value = "";
  $("typed").focus();
}

$("check").addEventListener("click", () => {
  const now = Date.now();
  const right = normalize($("typed").value) === normalize(current.form);
  const grade = right ? "good" : "miss";
  schedule[current.id] = nextState(schedule[current.id] ?? newCard(), grade, now, seedFrom(current.id));
  store.set(key(lang, "conj-schedule"), schedule);
  reviewed++;

  const fb = $("feedback");
  fb.textContent = "";
  const answer = document.createElement("span");
  answer.className = right ? "diff-same" : "diff-missing";
  answer.textContent = current.form;
  fb.append(answer);
  if (!right) {
    const yours = document.createElement("span");
    yours.className = "diff-extra";
    yours.textContent = ` ${$("typed").value.trim() || "(blank)"}`;
    fb.append(yours);
    misses.push(current);
    queue.push(current);            // retry within the session
  }
  fb.hidden = false;
  $("typeZone").hidden = true;
  $("nextRow").hidden = false;
  $("next").focus();

  queue.shift();
});

$("next").addEventListener("click", () => {
  queue.length ? show() : finish();
});

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
  const uniqueMisses = [...new Map(misses.map(m => [m.id, m])).values()];
  $("summary").textContent = `${reviewed} answers, ${uniqueMisses.length} cells missed.`;
  for (const m of uniqueMisses) {
    const li = document.createElement("li");
    li.textContent = `${m.verb} - ${m.tense} - ${m.personLabel}: ${m.form}`;
    $("missList").append(li);
  }
}

init();
