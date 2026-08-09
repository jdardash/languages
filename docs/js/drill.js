// Active recall, production direction (English prompt -> say the target out
// loud -> reveal -> self-grade). Misses requeue within the session until
// answered correctly twice: 5-7 retrievals beat 1-3 (Nakata 2017).

import { newCard, nextState, isDue } from "./scheduler.js";
import { store, key, getSettings, loadJSON, playAudio, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

let lang, schedule, queue, current;
const sessionMisses = new Map();   // id -> sentence, for the summary
const correctStreak = new Map();   // id -> consecutive in-session non-miss answers
let reviewed = 0;

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    lang = data.language;
    $("answer").lang = data.bcp47;
    schedule = store.get(key(lang, "schedule"), {});
    const now = Date.now();
    const due = data.sentences.filter(s => isDue(schedule[s.id] ?? newCard(), now));
    queue = due.slice(0, settings.drillLimit);
    $("heading").textContent = `Drill - ${data.label}`;
    if (queue.length === 0) {
      $("status").textContent = "Nothing due. Come back later, or raise the session size on the Today page.";
      return;
    }
    $("status").hidden = true;
    $("stage").hidden = false;
    show();
  } catch (err) {
    $("status").textContent = `Could not load data: ${err.message}`;
  }
}

function updateBar() {
  const total = reviewed + queue.length;
  const pct = total ? Math.round(100 * reviewed / total) : 0;
  $("fill").style.width = `${pct}%`;
  $("bar").setAttribute("aria-valuenow", String(pct));
}

function show() {
  current = queue[0];
  updateBar();
  $("counter").textContent = `${queue.length} remaining - say it out loud before revealing`;
  $("prompt").textContent = current.en;
  $("answer").hidden = true;
  $("answer").textContent = current.target;
  $("replayRow").hidden = true;
  $("grades").hidden = true;
  $("reveal").hidden = false;
  $("reveal").focus();
}

$("reveal").addEventListener("click", async () => {
  $("answer").hidden = false;
  $("reveal").hidden = true;
  $("grades").hidden = false;
  $("good").focus();
  if (current.audio) {
    $("replayRow").hidden = false;
    await playAudio($("player"), current.audio);
  }
});

$("replay").addEventListener("click", () => {
  if (current.audio) playAudio($("player"), current.audio);
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
    queue.splice(Math.min(3, queue.length), 0, current);   // reappears a few cards later
  } else if (sessionMisses.has(current.id)) {
    const streak = (correctStreak.get(current.id) ?? 0) + 1;
    correctStreak.set(current.id, streak);
    if (streak < 2) queue.push(current);                    // right twice before it rests
  }
  queue.length ? show() : finish();
}
$("miss").addEventListener("click", () => grade("miss"));
$("hard").addEventListener("click", () => grade("hard"));
$("good").addEventListener("click", () => grade("good"));

document.addEventListener("keydown", e => {
  if ($("stage").hidden) return;
  if (!$("reveal").hidden && (e.key === "Enter" || e.key === " ")) {
    if (e.target === $("reveal")) return;   // native button activation handles it
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
  $("summary").textContent = `${reviewed} reviews, ${sessionMisses.size} sentences missed.`;
  for (const s of sessionMisses.values()) {
    const li = document.createElement("li");
    li.textContent = `${s.en} - ${s.target}`;
    $("missList").append(li);
  }
}

init();
